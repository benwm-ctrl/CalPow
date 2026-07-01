"""
lcp.py — Least-cost path routing using scikit-image MCP_Geometric.

Finds the path between two geographic points that minimises accumulated
cost over the terrain-physics cost surface.

Reference:
  scikit-image skimage.graph.MCP_Geometric — BSD-3-Clause, v0.26.0 confirmed.
  Corpus §6.1.

Design note (corpus §6.5):
  This runs at request time in the FastAPI routing service. The cost surface
  (Tier A) is pre-loaded from a COG tile. Live forecast coupling (Tier B) is
  applied as a multiplicative hazard scaler BEFORE calling find_lcp — not
  inside this function, which deals only in static cost arrays.
"""

from pathlib import Path
from dataclasses import dataclass
import numpy as np
import rasterio
from rasterio.transform import rowcol, xy
from skimage.graph import MCP_Geometric


@dataclass
class RouteResult:
    """Output of a least-cost path query."""
    path_coords: list[tuple[float, float]]   # [(lon, lat), …] in WGS84 or source CRS
    path_rc: list[tuple[int, int]]           # [(row, col), …] in raster space
    total_cost: float
    cost_per_segment: list[float]            # accumulated cost at each waypoint
    # per-segment layer breakdown for UI explanation ("why this route")
    segment_stats: list[dict]               # {slope, pra, z_delta, sx} averages per segment


def find_lcp(
    cost_path: Path,
    start_lonlat: tuple[float, float],
    end_lonlat: tuple[float, float],
    extra_layer_paths: dict[str, Path] | None = None,
) -> RouteResult:
    """
    Find the least-cost path between two geographic points.

    Parameters
    ----------
    cost_path      : the terrain-physics cost surface GeoTIFF
    start_lonlat   : (longitude, latitude) of route start in WGS84
    end_lonlat     : (longitude, latitude) of route end in WGS84
    extra_layer_paths : optional dict of layer name → path for segment stats
                        (e.g. {"slope": ..., "pra": ..., "z_delta": ...})

    Returns
    -------
    RouteResult with path geometry and per-segment statistics.

    Raises
    ------
    ValueError if start or end points are outside the raster extent.
    """
    with rasterio.open(cost_path) as src:
        cost = src.read(1).astype("float64")
        transform = src.transform
        crs = src.crs
        nodata = src.nodata or -9999.0
        profile = src.profile

    # Replace nodata with a very high cost (walls off invalid regions)
    max_valid = cost[cost != nodata].max() if (cost != nodata).any() else 1.0
    cost = np.where(cost == nodata, max_valid * 100.0, cost)
    cost = np.clip(cost, 1e-6, None)  # MCP requires positive costs

    # ── Project start/end to raster row/col ──────────────────────────────────
    # Reproject lon/lat (WGS84) to the cost surface CRS if needed
    from pyproj import Transformer
    wgs84_to_raster = Transformer.from_crs("EPSG:4326", crs, always_xy=True)

    sx, sy = wgs84_to_raster.transform(start_lonlat[0], start_lonlat[1])
    ex, ey = wgs84_to_raster.transform(end_lonlat[0], end_lonlat[1])

    rows, cols = cost.shape
    start_rc = _lonlat_to_rc(sx, sy, transform, rows, cols)
    end_rc   = _lonlat_to_rc(ex, ey, transform, rows, cols)

    print(f"[lcp] Start pixel: row={start_rc[0]}, col={start_rc[1]}")
    print(f"[lcp] End pixel:   row={end_rc[0]},   col={end_rc[1]}")

    # ── Run MCP ──────────────────────────────────────────────────────────────
    mcp = MCP_Geometric(cost, fully_connected=True)
    cumcost, _ = mcp.find_costs([start_rc])
    path_rc    = mcp.traceback(end_rc)
    total_cost = float(cumcost[end_rc[0], end_rc[1]])

    print(f"[lcp] Path found: {len(path_rc)} cells, total cost = {total_cost:.4f}")

    # ── Convert path to geographic coordinates ────────────────────────────────
    # xy() returns (x, y) in the raster CRS (UTM metres)
    path_xy = [xy(transform, r, c, offset="center") for r, c in path_rc]

    # Back-project to WGS84 for GeoJSON output
    raster_to_wgs84 = Transformer.from_crs(crs, "EPSG:4326", always_xy=True)
    path_lonlat = [raster_to_wgs84.transform(x, y) for x, y in path_xy]

    # ── Accumulated cost per segment ──────────────────────────────────────────
    cost_seq = [float(cumcost[r, c]) for r, c in path_rc]

    # ── Per-segment layer stats (for UI "why" breakdown) ─────────────────────
    segment_stats = []
    if extra_layer_paths:
        extra_layers = {}
        for name, path in extra_layer_paths.items():
            with rasterio.open(path) as src:
                arr = src.read(1).astype("float64")
                nd = src.nodata or -9999.0
            extra_layers[name] = np.where(arr == nd, np.nan, arr)

        # Chunk path into segments of ~10 cells and compute mean per layer
        seg_size = max(1, len(path_rc) // 10)
        for i in range(0, len(path_rc), seg_size):
            seg = path_rc[i:i + seg_size]
            stats = {}
            for name, arr in extra_layers.items():
                vals = [arr[r, c] for r, c in seg if not np.isnan(arr[r, c])]
                stats[name] = float(np.mean(vals)) if vals else float("nan")
            segment_stats.append(stats)

    return RouteResult(
        path_coords=path_lonlat,
        path_rc=path_rc,
        total_cost=float(total_cost),
        cost_per_segment=cost_seq,
        segment_stats=segment_stats,
    )


def result_to_geojson(result: RouteResult) -> dict:
    """Convert a RouteResult to a GeoJSON LineString feature."""
    return {
        "type": "Feature",
        "geometry": {
            "type": "LineString",
            "coordinates": [[lon, lat] for lon, lat in result.path_coords],
        },
        "properties": {
            "total_cost": result.total_cost,
            "n_cells": len(result.path_rc),
            "segment_stats": result.segment_stats,
        },
    }


# ── helpers ──────────────────────────────────────────────────────────────────

def _lonlat_to_rc(
    x: float, y: float, transform, rows: int, cols: int
) -> tuple[int, int]:
    """Convert projected (x, y) coordinates to (row, col) pixel indices."""
    row, col = rowcol(transform, x, y)
    if not (0 <= row < rows and 0 <= col < cols):
        raise ValueError(
            f"Point ({x:.1f}, {y:.1f}) is outside the raster extent "
            f"({cols} cols × {rows} rows). Check that start/end points "
            f"fall within the downloaded DEM tile."
        )
    return int(row), int(col)


if __name__ == "__main__":
    import sys, json
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from config import OUTPUT_DIR

    # Carson Pass area test points
    # Start: roughly near Elephant Back summit (ski resort)
    # End:   near Red Lake Peak trailhead
    start = (-119.90, 38.72)   # lon, lat
    end   = (-119.88, 38.69)

    result = find_lcp(
        cost_path=OUTPUT_DIR / "cost_surface.tif",
        start_lonlat=start,
        end_lonlat=end,
        extra_layer_paths={
            "slope":     OUTPUT_DIR / "slope.tif",
            "pra":       OUTPUT_DIR / "pra.tif",
            "z_delta":   OUTPUT_DIR / "z_delta.tif",
        },
    )
    gj = result_to_geojson(result)
    print(json.dumps(gj, indent=2)[:500], "…")
