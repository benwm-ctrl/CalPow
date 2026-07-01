"""
app.py — CalPow FastAPI routing service.

Architecture (corpus §6.5):
  This is the "live routing/fusion API" layer. It:
    1. Loads precomputed Tier-A COG tiles into memory at startup.
    2. At each request, fuses them with optional Tier-B forecast context
       (danger rating × aspect × elevation band scaler) in memory.
    3. Runs MCP least-cost-path on the fused cost surface.
    4. Returns GeoJSON + per-segment hazard breakdown.

  Tier-A static rasters on disk are NEVER modified. The forecast scaler
  operates on a per-request copy of the cost array and is discarded
  immediately after the response.

Usage:
  uvicorn api.app:app --reload --port 8000

  from the engine/ directory.

Endpoints:
  GET  /health         — liveness check + tile info
  POST /route          — least-cost route between two points
  GET  /forecast/live  — fetch current AFP forecast for a CA zone (proxy)
"""

import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

import numpy as np
import rasterio
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Add engine root to Python path so api/ imports work when run from engine/
sys.path.insert(0, str(Path(__file__).parent.parent))

from config import OUTPUT_DIR, DATA_DIR, FLOWPY, SX, COST, get_tile_dir
from pipeline.lcp import find_lcp, result_to_geojson, RouteResult
from api.models import (
    RouteRequest, RouteResponse, SegmentStat, ForecastContext
)
from api.forecast import apply_forecast_scaling, fetch_forecast
from api.live_data import fetch_live_context, LiveContext


# ── Global tile cache ─────────────────────────────────────────────────────────
# Loaded once at startup; shared across all requests (read-only after load).
# These are all Tier-A: static terrain geometry, never weather-derived.

class TileCache:
    slope:        np.ndarray | None = None
    aspect:       np.ndarray | None = None
    elevation:    np.ndarray | None = None
    pra:          np.ndarray | None = None
    z_delta:      np.ndarray | None = None
    cell_counts:  np.ndarray | None = None
    sx:           dict[int, np.ndarray]  = {}  # wind_az_rounded → array
    cost_base:    np.ndarray | None = None
    transform     = None
    crs           = None
    profile       = None
    loaded:       bool = False

TILES = TileCache()


def _load_raster(path: Path) -> np.ndarray | None:
    if not path.exists():
        return None
    with rasterio.open(path) as src:
        arr = src.read(1).astype("float64")
        nd  = src.nodata if src.nodata is not None else -9999.0
    return np.where(arr == nd, np.nan, arr)


def _load_tiles():
    """Load all precomputed Tier-A layers at startup."""
    tile_dir = get_tile_dir()
    print(f"[startup] Loading tiles from: {tile_dir}")
    TILES.elevation   = _load_raster(tile_dir / "dem_10m.tif")
    TILES.slope       = _load_raster(tile_dir / "slope.tif")
    TILES.aspect      = _load_raster(tile_dir / "aspect.tif")
    TILES.pra         = _load_raster(tile_dir / "pra.tif")
    TILES.z_delta     = _load_raster(tile_dir / "z_delta.tif")
    TILES.cell_counts = _load_raster(tile_dir / "cell_counts.tif")
    TILES.cost_base   = _load_raster(tile_dir / "cost_surface.tif")

    # Load all available Sx tiles (e.g. sx_315.tif, sx_45.tif, …)
    for sx_path in sorted(tile_dir.glob("sx_*.tif")):
        try:
            az = int(sx_path.stem.split("_")[1])
            TILES.sx[az] = _load_raster(sx_path)
        except (IndexError, ValueError):
            pass

    # Read transform/CRS from cost surface (all tiles share the same grid)
    cost_path = tile_dir / "cost_surface.tif"
    if cost_path.exists():
        with rasterio.open(cost_path) as src:
            TILES.transform = src.transform
            TILES.crs       = src.crs
            TILES.profile   = src.profile.copy()

    missing = [
        name for name, arr in [
            ("elevation", TILES.elevation), ("slope", TILES.slope),
            ("cost_base", TILES.cost_base),
        ] if arr is None
    ]
    TILES.loaded = len(missing) == 0
    return missing


# ── FastAPI lifespan (startup/shutdown) ───────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    missing = _load_tiles()
    if missing:
        print(f"[startup] WARNING: missing tiles: {missing}")
        print("[startup] Run run_pipeline.py to generate them.")
    else:
        n_sx  = len(TILES.sx)
        shape = TILES.cost_base.shape
        print(f"[startup] Tiles loaded: {shape[1]}×{shape[0]} grid, {n_sx} Sx tile(s)")
    yield
    print("[shutdown] CalPow routing service stopped.")


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="CalPow Terrain Routing API",
    description=(
        "Terrain-physics least-cost route planning for California backcountry. "
        "Static Tier-A terrain layers fused with optional live Tier-B forecast context. "
        "NOT a real-time safety system — planning aid only."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    """Liveness check. Returns tile inventory and grid info."""
    if not TILES.loaded:
        return {
            "status": "degraded",
            "message": "One or more required tiles missing. Run run_pipeline.py.",
            "tiles": _tile_inventory(),
        }
    shape = TILES.cost_base.shape
    return {
        "status": "ok",
        "grid": {"rows": shape[0], "cols": shape[1]},
        "sx_wind_azimuths": sorted(TILES.sx.keys()),
        "tiles": _tile_inventory(),
    }


@app.post("/route", response_model=RouteResponse)
def route(req: RouteRequest):
    """
    Find the least-cost path between two geographic points.

    With no forecast context: pure static Tier-A terrain routing.
    With forecast context: Tier-B scaler applied to matching aspect/elevation cells.

    The disclaimer field in the response MUST be shown to the user.
    """
    if not TILES.loaded:
        raise HTTPException(
            status_code=503,
            detail="Terrain tiles not loaded. Run run_pipeline.py first."
        )

    # ── Tier-B: build the fused cost surface for this request ─────────────────
    cost = TILES.cost_base.copy()
    forecast_applied = False

    if req.forecast is not None and TILES.aspect is not None and TILES.elevation is not None:
        cost = apply_forecast_scaling(
            cost=cost,
            aspect=TILES.aspect,
            elevation=TILES.elevation,
            ctx=req.forecast,
        )
        forecast_applied = True

    # Write fused cost to a temp in-memory rasterio MemoryFile for find_lcp
    import io, tempfile, os
    import rasterio
    from rasterio.io import MemoryFile

    nan_mask = np.isnan(cost)
    cost_out  = np.where(nan_mask, -9999.0, cost).astype("float32")
    profile   = TILES.profile.copy()
    profile.update(dtype="float32", count=1, nodata=-9999.0)

    # Write fused cost to a tempfile (find_lcp takes a Path)
    tmp = tempfile.NamedTemporaryFile(suffix=".tif", delete=False)
    tmp_path = Path(tmp.name)
    tmp.close()
    try:
        with rasterio.open(tmp_path, "w", **profile) as dst:
            dst.write(cost_out, 1)

        # ── Run LCP ──────────────────────────────────────────────────────────
        try:
            result: RouteResult = find_lcp(
                cost_path=tmp_path,
                start_lonlat=(req.start[0], req.start[1]),
                end_lonlat=(req.end[0], req.end[1]),
                extra_layer_paths={
                    "slope":       OUTPUT_DIR / "slope.tif",
                    "pra":         OUTPUT_DIR / "pra.tif",
                    "z_delta":     OUTPUT_DIR / "z_delta.tif",
                    "cell_counts": OUTPUT_DIR / "cell_counts.tif",
                },
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    finally:
        tmp_path.unlink(missing_ok=True)

    # ── Build response ────────────────────────────────────────────────────────
    geojson = result_to_geojson(result)

    seg_stats = []
    for seg in result.segment_stats:
        seg_stats.append(SegmentStat(
            slope_deg=       seg.get("slope",       float("nan")),
            pra_membership=  seg.get("pra",         float("nan")),
            z_delta_m=       seg.get("z_delta",     float("nan")),
            cell_counts=     seg.get("cell_counts", float("nan")),
            mean_cost=       float("nan"),  # TODO: compute from cumcost
        ))

    return RouteResponse(
        geometry=geojson,
        total_cost=result.total_cost,
        n_cells=len(result.path_rc),
        segment_stats=seg_stats,
        forecast_applied=forecast_applied,
    )


class AutoRouteRequest(BaseModel):
    """Request for POST /route/auto — no forecast needed, fetched automatically."""
    start: list[float] = Field(..., min_length=2, max_length=2,
                               description="[longitude, latitude] WGS84")
    end:   list[float] = Field(..., min_length=2, max_length=2,
                               description="[longitude, latitude] WGS84")


class AutoRouteResponse(RouteResponse):
    """Extended response that includes live context metadata."""
    live_context: dict = Field(
        default_factory=dict,
        description="Summary of the live data fetched: wind, AFP zone, danger level, warnings."
    )


@app.post("/route/auto", response_model=AutoRouteResponse)
def route_auto(req: AutoRouteRequest):
    """
    Find the least-cost path with automatic Tier-B data synthesis.

    Fetches current wind (Open-Meteo) + avalanche danger/problems (AFP) for
    the route midpoint, fuses them with the precomputed Tier-A cost surface,
    and returns the route GeoJSON with full hazard context.

    This is the primary endpoint for the frontend. The client only needs to
    supply start and end coordinates — all live data synthesis is automatic.

    Degrades gracefully: if Open-Meteo or AFP are unavailable, routing falls
    back to the static Tier-A cost surface and warnings are returned.
    """
    # Midpoint for zone lookup and wind fetch
    mid_lon = (req.start[0] + req.end[0]) / 2
    mid_lat = (req.start[1] + req.end[1]) / 2

    if not TILES.loaded:
        # ── Stub mode: no terrain tiles yet — return straight-line route ─────
        # This lets the frontend end-to-end flow be validated before tiles
        # are generated. Clearly flagged as stub in live_context.
        stub_geojson = {
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [req.start[0], req.start[1]],
                        [mid_lon, mid_lat],
                        [req.end[0], req.end[1]],
                    ],
                },
                "properties": {"stub": True},
            }],
        }
        return AutoRouteResponse(
            geometry=stub_geojson,
            total_cost=0.0,
            n_cells=3,
            segment_stats=[
                SegmentStat(slope_deg=float("nan"), pra_membership=float("nan"),
                            z_delta_m=float("nan"), cell_counts=float("nan"), mean_cost=float("nan")),
            ],
            forecast_applied=False,
            live_context={
                "stub": True,
                "warning": "Terrain tiles not loaded — straight-line stub route returned. "
                           "Run run_pipeline.py to generate real terrain data.",
            },
        )

    # ── Fetch Tier-B live context ─────────────────────────────────────────────
    live = fetch_live_context(
        lat=mid_lat,
        lon=mid_lon,
        available_sx_azimuths=sorted(TILES.sx.keys()),
        default_wind_az=315.0,
    )

    # ── Apply Tier-B scaler ───────────────────────────────────────────────────
    cost = TILES.cost_base.copy()
    forecast_applied = False

    if live.forecast and TILES.aspect is not None and TILES.elevation is not None:
        cost = apply_forecast_scaling(
            cost=cost,
            aspect=TILES.aspect,
            elevation=TILES.elevation,
            ctx=live.forecast,
        )
        forecast_applied = True

    # ── Write fused cost and run LCP ──────────────────────────────────────────
    import tempfile
    import rasterio as _rio

    nan_mask = np.isnan(cost)
    cost_out  = np.where(nan_mask, -9999.0, cost).astype("float32")
    profile   = TILES.profile.copy()
    profile.update(dtype="float32", count=1, nodata=-9999.0)

    tmp = tempfile.NamedTemporaryFile(suffix=".tif", delete=False)
    tmp_path = Path(tmp.name)
    tmp.close()
    try:
        with _rio.open(tmp_path, "w", **profile) as dst:
            dst.write(cost_out, 1)
        try:
            result = find_lcp(
                cost_path=tmp_path,
                start_lonlat=(req.start[0], req.start[1]),
                end_lonlat=(req.end[0], req.end[1]),
                extra_layer_paths={
                    "slope":       OUTPUT_DIR / "slope.tif",
                    "pra":         OUTPUT_DIR / "pra.tif",
                    "z_delta":     OUTPUT_DIR / "z_delta.tif",
                    "cell_counts": OUTPUT_DIR / "cell_counts.tif",
                },
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
    finally:
        tmp_path.unlink(missing_ok=True)

    geojson   = result_to_geojson(result)
    seg_stats = [
        SegmentStat(
            slope_deg=      s.get("slope",       float("nan")),
            pra_membership= s.get("pra",         float("nan")),
            z_delta_m=      s.get("z_delta",     float("nan")),
            cell_counts=    s.get("cell_counts", float("nan")),
            mean_cost=      float("nan"),
        )
        for s in result.segment_stats
    ]

    return AutoRouteResponse(
        geometry=geojson,
        total_cost=result.total_cost,
        n_cells=len(result.path_rc),
        segment_stats=seg_stats,
        forecast_applied=forecast_applied,
        live_context=live.summary(),
    )


@app.get("/forecast/live")
def forecast_live(center_id: str = "sierra-avalanche-center", zone_id: int = 2458):
    """
    Proxy: fetch current AFP forecast for a CA zone.

    Returns a ForecastContext suitable for passing back as req.forecast
    in a /route call. If the forecast cannot be retrieved (off-season,
    network error) returns a 503.

    Default zone_id=2458 is the SAC Central Sierra Nevada zone (unverified —
    confirm by capturing the AFP network call from sierraavalanchecenter.org).
    """
    ctx = fetch_forecast(center_id=center_id, zone_id=zone_id)
    if ctx is None:
        raise HTTPException(
            status_code=503,
            detail=(
                "Could not retrieve forecast. "
                "The AFP may be off-season, or the zone_id may be incorrect. "
                "Confirm zone_id by capturing the network request from "
                "sierraavalanchecenter.org/forecast."
            )
        )
    return ctx


# ── Helpers ───────────────────────────────────────────────────────────────────

def _tile_inventory() -> dict:
    return {
        "elevation":   TILES.elevation   is not None,
        "slope":       TILES.slope       is not None,
        "aspect":      TILES.aspect      is not None,
        "pra":         TILES.pra         is not None,
        "z_delta":     TILES.z_delta     is not None,
        "cell_counts": TILES.cell_counts is not None,
        "cost_base":   TILES.cost_base   is not None,
        "sx_tiles":    sorted(TILES.sx.keys()),
    }


# ── Dev entrypoint ────────────────────────────────────────────────────────────
# Run with: python api/app.py  (from engine/)
# Or:       uvicorn api.app:app --reload --port 8000

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api.app:app", host="0.0.0.0", port=8000, reload=True)
