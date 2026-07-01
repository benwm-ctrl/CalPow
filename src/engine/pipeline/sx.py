"""
sx.py — Winstral Sx wind-exposure index.

Sx is the maximum upwind slope angle along a search azimuth.
Positive Sx → sheltered (lee, deposition zone).
Negative Sx → exposed (windward, scoured).

Reference:
  Winstral A. and Marks D. (2002). Simulating wind fields and snow redistribution
  using terrain-based parameters to model snow accumulation and melt over a
  semi-arid mountain catchment. Hydrol. Processes 16:3585–3603.
  DOI: 10.1002/hyp.1238

Corpus §4.1:
  Formula: Sx(A, dmax) = max{ arctan((z(xv,yv) − z(xi,yi)) / dist) }
           over cells in direction A out to dmax.
  dmax = 300 m (Reynolds Mountain East default — calibrate for Sierra Nevada).
  Mean Sx: average over ±25° sector around prevailing wind azimuth.
"""

from pathlib import Path
import numpy as np
import rasterio


def compute_sx(
    dem_path: Path,
    wind_azimuth: float,
    out_path: Path,
    dmax: float = 300.0,
    az_window: float = 25.0,
    az_step: float = 5.0,
) -> Path:
    """
    Compute mean Sx (S̄x) over a sector around ``wind_azimuth``.

    Parameters
    ----------
    dem_path     : elevation GeoTIFF (UTM, metres)
    wind_azimuth : prevailing upwind direction in degrees from North (0–360).
                   This is the direction FROM WHICH the wind comes.
    out_path     : path to write Sx GeoTIFF (float32, same grid as DEM)
    dmax         : max upwind search distance in metres (site-dependent; 300 m default)
    az_window    : ± degrees around wind_azimuth for sector averaging
    az_step      : step between azimuths within the sector

    Returns
    -------
    Path to the written Sx GeoTIFF.
    """
    with rasterio.open(dem_path) as src:
        dem = src.read(1).astype("float64")
        transform = src.transform
        nodata = src.nodata or -9999.0
        profile = src.profile.copy()

    res = abs(transform.a)  # pixel size in metres
    dem = np.where(dem == nodata, np.nan, dem)

    rows, cols = dem.shape
    n_steps = max(1, int(dmax / res))

    # Azimuths to average over
    azimuths = np.arange(
        wind_azimuth - az_window,
        wind_azimuth + az_window + az_step,
        az_step,
    ) % 360

    sx_sum = np.zeros((rows, cols), dtype="float64")
    n_az = len(azimuths)

    for az in azimuths:
        sx_sum += _sx_single_azimuth(dem, az, n_steps, res)

    sx_mean = sx_sum / n_az

    # ── Write output ─────────────────────────────────────────────────────────
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    sx_out = np.where(np.isnan(dem), -9999.0, sx_mean).astype("float32")
    profile.update(dtype="float32", count=1, compress="deflate", nodata=-9999.0)

    with rasterio.open(out_path, "w", **profile) as dst:
        dst.write(sx_out, 1)

    sheltered = float((sx_mean > 0).mean() * 100)
    exposed = float((sx_mean < 0).mean() * 100)
    print(f"[sx] Wind azimuth {wind_azimuth}° ± {az_window}°, dmax={dmax} m")
    print(f"[sx] Sheltered (Sx>0): {sheltered:.1f}%  Exposed (Sx<0): {exposed:.1f}%")
    print(f"[sx] Written to {out_path}")
    return out_path


def _sx_single_azimuth(
    dem: np.ndarray, azimuth: float, n_steps: int, res: float
) -> np.ndarray:
    """
    Compute Sx for a single search azimuth using vectorised numpy.

    For each cell (r, c), search n_steps steps in the upwind direction
    (opposite to azimuth — we look UPWIND, not downwind).

    Sx(A) = max{ arctan((z_upwind - z_current) / dist) } over all steps.

    Returns Sx array in degrees (same shape as dem). NaN where dem is NaN.
    """
    rows, cols = dem.shape

    # Search direction: upwind = opposite of where wind is going.
    # azimuth is the direction FROM which wind comes → we search in that direction.
    az_rad = np.radians(azimuth)
    # step vector in (row, col) space: North is -row, East is +col
    dr = -np.cos(az_rad)  # row offset per unit step (- because row 0 is at top/North)
    dc = np.sin(az_rad)   # col offset per unit step

    sx = np.full((rows, cols), -np.inf)

    # Base cell indices
    rr, cc = np.meshgrid(np.arange(rows), np.arange(cols), indexing="ij")
    z_base = dem.copy()

    for step in range(1, n_steps + 1):
        dist = step * res

        # Target cell (float → round to nearest integer)
        r_tgt = (rr + dr * step).round().astype(int)
        c_tgt = (cc + dc * step).round().astype(int)

        # Mask valid (in-bounds) targets
        valid = (
            (r_tgt >= 0) & (r_tgt < rows) &
            (c_tgt >= 0) & (c_tgt < cols)
        )

        # Elevation at target cells (use 0 for out-of-bounds, masked later)
        r_safe = np.clip(r_tgt, 0, rows - 1)
        c_safe = np.clip(c_tgt, 0, cols - 1)
        z_tgt = dem[r_safe, c_safe]

        # Sx contribution: arctan((z_target - z_base) / dist)
        # Positive when target is higher than base → sheltered
        sx_step = np.degrees(np.arctan((z_tgt - z_base) / dist))

        # Only update where target is valid and non-nan
        update = valid & ~np.isnan(z_base) & ~np.isnan(z_tgt)
        sx = np.where(update, np.maximum(sx, sx_step), sx)

    # Cells where no valid step was found stay at -inf; set to nan
    sx = np.where(sx == -np.inf, np.nan, sx)
    # Propagate source nan
    sx = np.where(np.isnan(z_base), np.nan, sx)

    return sx


if __name__ == "__main__":
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from config import OUTPUT_DIR, SX
    # Test with a NW wind (common Sierra storm track: 315°)
    compute_sx(
        dem_path=OUTPUT_DIR.parent / "data" / "dem_10m.tif",
        wind_azimuth=315.0,
        out_path=OUTPUT_DIR / "sx_315.tif",
        dmax=SX["dmax"],
        az_window=SX["az_window"],
        az_step=SX["az_step"],
    )
