"""
app.py — CalPow FastAPI routing service.

Architecture (corpus §6.5):
  Tier-A static rasters loaded once at startup (precomputed COGs).
  Tier-B live data (forecast + wind) fused per-request in memory.
  Returns GeoJSON route + per-segment hazard breakdown.

Endpoints:
  GET  /health         — liveness check + tile info
  POST /route          — least-cost route (manual forecast context)
  POST /route/auto     — least-cost route (live forecast auto-fetched)
  GET  /forecast/live  — AFP forecast proxy for a CA zone
"""

import sys
from contextlib import asynccontextmanager
from pathlib import Path

import numpy as np
import rasterio
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field

# Add engine root to path so api/ imports work when run from engine/
sys.path.insert(0, str(Path(__file__).parent.parent))

from config import OUTPUT_DIR, DATA_DIR, FLOWPY, SX, COST, get_tile_dir
from pipeline.lcp import find_lcp, result_to_geojson, RouteResult
from api.models import RouteRequest, RouteResponse, SegmentStat, ForecastContext
from api.forecast import apply_forecast_scaling, fetch_forecast
from api.live_data import fetch_live_context, LiveContext


# ── Global tile cache ─────────────────────────────────────────────────────────

class TileCache:
    slope:        np.ndarray | None = None
    aspect:       np.ndarray | None = None
    elevation:    np.ndarray | None = None
    pra:          np.ndarray | None = None
    z_delta:      np.ndarray | None = None
    cell_counts:  np.ndarray | None = None
    sx:           dict[int, np.ndarray] = {}
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
    tile_dir = get_tile_dir()
    print(f"[startup] Loading tiles from: {tile_dir}")
    TILES.elevation   = _load_raster(tile_dir / "dem_10m.tif")
    TILES.slope       = _load_raster(tile_dir / "slope.tif")
    TILES.aspect      = _load_raster(tile_dir / "aspect.tif")
    TILES.pra         = _load_raster(tile_dir / "pra.tif")
    TILES.z_delta     = _load_raster(tile_dir / "z_delta.tif")
    TILES.cell_counts = _load_raster(tile_dir / "cell_counts.tif")
    TILES.cost_base   = _load_raster(tile_dir / "cost_surface.tif")

    for sx_path in sorted(tile_dir.glob("sx_*.tif")):
        try:
            az = int(sx_path.stem.split("_")[1])
            TILES.sx[az] = _load_raster(sx_path)
        except (IndexError, ValueError):
            pass

    cost_path = tile_dir / "cost_surface.tif"
    if cost_path.exists():
        with rasterio.open(cost_path) as src:
            TILES.transform = src.transform
            TILES.crs       = src.crs
            TILES.profile   = src.profile.copy()

    missing = [
        name for name, arr in [
            ("elevation", TILES.elevation),
            ("slope",     TILES.slope),
            ("cost_base", TILES.cost_base),
        ] if arr is None
    ]
    TILES.loaded = len(missing) == 0
    return missing


# ── FastAPI lifespan ──────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    missing = _load_tiles()
    if missing:
        print(f"[startup] WARNING: missing tiles: {missing}")
        print("[startup] Routing will use straight-line stub until tiles are present.")
    else:
        n_sx  = len(TILES.sx)
        shape = TILES.cost_base.shape
        print(f"[startup] Tiles loaded: {shape[1]}×{shape[0]} grid, {n_sx} Sx tile(s)")
    yield
    print("[shutdown] CalPow routing service stopped.")


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="CalPow Terrain Routing API",
    description="Terrain-physics least-cost route planning. Planning aid only — not a safety system.",
    version="0.2.0",
    lifespan=lifespan,
)

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "*",
}

@app.middleware("http")
async def cors_middleware(request: Request, call_next):
    if request.method == "OPTIONS":
        return Response(status_code=200, headers=CORS_HEADERS)
    response = await call_next(request)
    for k, v in CORS_HEADERS.items():
        response.headers[k] = v
    return response


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    if not TILES.loaded:
        return {
            "status": "degraded",
            "message": "Terrain tiles not loaded — stub routing active.",
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
    """Least-cost path with optional manual forecast context."""
    if not TILES.loaded:
        raise HTTPException(503, detail="Terrain tiles not loaded. Run run_pipeline.py first.")

    cost = TILES.cost_base.copy()
    forecast_applied = False

    if req.forecast is not None and TILES.aspect is not None and TILES.elevation is not None:
        cost = apply_forecast_scaling(cost=cost, aspect=TILES.aspect,
                                      elevation=TILES.elevation, ctx=req.forecast)
        forecast_applied = True

    return _run_lcp(cost, req.start, req.end, forecast_applied)


class AutoRouteRequest(BaseModel):
    start: list[float] = Field(..., min_length=2, max_length=2,
                               description="[longitude, latitude] WGS84")
    end:   list[float] = Field(..., min_length=2, max_length=2,
                               description="[longitude, latitude] WGS84")


class AutoRouteResponse(RouteResponse):
    live_context: dict = Field(default_factory=dict)


@app.post("/route/auto")
def route_auto(req: AutoRouteRequest):
    """
    Least-cost path with automatic Tier-B synthesis.
    Fetches live wind + AFP danger for route midpoint, fuses with Tier-A cost surface.
    Degrades gracefully to straight-line stub when tiles are missing.
    """
    mid_lon = (req.start[0] + req.end[0]) / 2
    mid_lat = (req.start[1] + req.end[1]) / 2

    # ── Stub: no tiles loaded ─────────────────────────────────────────────────
    if not TILES.loaded:
        return {
            "geometry": {
                "type": "FeatureCollection",
                "features": [{
                    "type": "Feature",
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [req.start, [mid_lon, mid_lat], req.end],
                    },
                    "properties": {"stub": True},
                }],
            },
            "total_cost": 0.0,
            "n_cells": 3,
            "segment_stats": [],
            "forecast_applied": False,
            "live_context": {"stub": True, "warning": "Terrain tiles not loaded."},
        }

    # ── Tier-B: live context ──────────────────────────────────────────────────
    live = fetch_live_context(
        lat=mid_lat, lon=mid_lon,
        available_sx_azimuths=sorted(TILES.sx.keys()),
        default_wind_az=315.0,
    )

    cost = TILES.cost_base.copy()
    forecast_applied = False

    if live.forecast and TILES.aspect is not None and TILES.elevation is not None:
        cost = apply_forecast_scaling(cost=cost, aspect=TILES.aspect,
                                      elevation=TILES.elevation, ctx=live.forecast)
        forecast_applied = True

    # ── LCP ───────────────────────────────────────────────────────────────────
    result = _run_lcp(cost, req.start, req.end, forecast_applied)

    return {
        "geometry":        result["geometry"],
        "total_cost":      result["total_cost"],
        "n_cells":         result["n_cells"],
        "segment_stats":   result["segment_stats"],
        "forecast_applied": result["forecast_applied"],
        "live_context":    live.summary(),
    }


@app.get("/forecast/live")
def forecast_live(center_id: str = "sierra-avalanche-center", zone_id: int = 2458):
    """AFP forecast proxy for a CA zone."""
    ctx = fetch_forecast(center_id=center_id, zone_id=zone_id)
    if ctx is None:
        raise HTTPException(503, detail="Could not retrieve forecast. AFP may be off-season.")
    return ctx


# ── Helpers ───────────────────────────────────────────────────────────────────

def _run_lcp(cost: np.ndarray, start: list[float], end: list[float],
             forecast_applied: bool) -> dict:
    """Write fused cost to temp raster, run MCP, return serialisable result dict."""
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
            result: RouteResult = find_lcp(
                cost_path=tmp_path,
                start_lonlat=(start[0], start[1]),
                end_lonlat=(end[0], end[1]),
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

    geojson = result_to_geojson(result)
    seg_stats = [
        {
            "slope_deg":      s.get("slope",       None),
            "pra_membership": s.get("pra",         None),
            "z_delta_m":      s.get("z_delta",     None),
            "cell_counts":    s.get("cell_counts", None),
        }
        for s in result.segment_stats
    ]

    return {
        "geometry":         geojson,
        "total_cost":       result.total_cost,
        "n_cells":          len(result.path_rc),
        "segment_stats":    seg_stats,
        "forecast_applied": forecast_applied,
    }


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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api.app:app", host="0.0.0.0", port=8000, reload=True)
