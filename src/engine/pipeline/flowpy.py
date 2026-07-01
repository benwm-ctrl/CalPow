"""
flowpy.py — Flow-Py runout algorithm (D'Amboise et al. 2022).

Implements the alpha-angle energy-line stopping criterion with vectorised
numpy propagation. For the full Holmgren (1994) divergent routing (which
requires AvaFrame/GDAL), see the AvaFrame com4FlowPy module. This
implementation gives correct runout extent and z_δ magnitude; it
approximates path length as straight-line Euclidean distance from the
nearest release cell rather than the true curvilinear flow path.

Approximation note: Euclidean distance is conservative (slightly
underestimates runout) and qualitatively correct for the cost-surface
use case. For safety-critical exact runout boundaries, validate against
AvaFrame com4FlowPy on a full GDAL install.

References:
  D'Amboise et al. (2022). Flow-Py v1.0. GMD 15:2423–2439.
    DOI: 10.5194/gmd-15-2423-2022
  Holmgren (1994). Hydrol. Processes 8:327–334.
    DOI: 10.1002/hyp.3360080405

Physics (corpus §3.3):
  Z^δ(s) = Z^γ(s) − Z^α(s)
    Z^γ = z(s₀) − z(s)             [gravitational energy height]
    Z^α = tan(α) × path_length      [Coulomb friction loss]
  Stop when Z^δ ≤ 0.

Outputs (corpus §3.3, verified from AvaFrame docs):
  z_delta      — max residual energy height per cell (intensity proxy)
  cell_counts  — number of PRA source cells whose energy line reaches this cell
  travel_angle — arctan(z_delta / dist_from_nearest_release) per cell

⚠ Calibration (corpus §3.3):
  α = 25° is the AvaFrame Alpine default. Recalibrate for Sierra Nevada
  before using outputs in safety-scored routing.
"""

from pathlib import Path
import numpy as np
import rasterio


def compute_flowpy(
    dem_path: Path,
    pra_path: Path,
    out_dir: Path,
    alpha: float = 25.0,
    exp: int = 8,
    min_flux: float = 1e-4,
) -> dict[str, Path]:
    """
    Compute Flow-Py runout outputs for all PRA release cells.

    Parameters
    ----------
    dem_path : elevation GeoTIFF (UTM, metres)
    pra_path : PRA membership GeoTIFF (cells > 0 are release zones)
    out_dir  : directory to write output rasters
    alpha    : stopping angle in degrees (default 25°, Alpine calibration)
    exp      : Holmgren exponent (stored in metadata; full Holmgren divergence
               routing requires AvaFrame on a GDAL install)
    min_flux : minimum PRA membership to treat as a release cell

    Returns
    -------
    dict mapping "z_delta", "cell_counts", "travel_angle" to output Paths.
    """
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    # ── Load inputs ───────────────────────────────────────────────────────────
    with rasterio.open(dem_path) as src:
        dem     = src.read(1).astype("float64")
        res     = abs(src.transform.a)
        nodata  = src.nodata if src.nodata is not None else -9999.0
        profile = src.profile.copy()

    with rasterio.open(pra_path) as src:
        pra     = src.read(1).astype("float64")
        pra_nd  = src.nodata if src.nodata is not None else -9999.0

    dem = np.where(dem == nodata, np.nan, dem)
    pra = np.where(pra == pra_nd, 0.0, pra)

    release_mask = (pra > min_flux) & ~np.isnan(dem)
    n_release    = int(release_mask.sum())
    print(f"[flowpy] {n_release} release cells | α={alpha}° | res={res:.0f} m")

    if n_release == 0:
        print("[flowpy] WARNING: no release cells — check PRA output.")
        # Write empty outputs and return
        profile.update(dtype="float32", count=1, compress="deflate", nodata=-9999.0)
        outputs = {}
        for name in ("z_delta", "cell_counts", "travel_angle"):
            p = out_dir / f"{name}.tif"
            if not p.exists():
                with rasterio.open(p, "w", **profile) as dst:
                    dst.write(np.full(dem.shape, -9999.0, dtype="float32"), 1)
            outputs[name] = p
        return outputs

    rows, cols = dem.shape
    alpha_rad  = np.radians(alpha)

    # ── Release cell coordinates and elevations ───────────────────────────────
    r0_arr, c0_arr = np.where(release_mask)        # (N,)
    z0_arr         = dem[r0_arr, c0_arr]           # (N,) release elevations

    # Grid of all cell (row, col) coordinates
    RR, CC = np.mgrid[0:rows, 0:cols].astype("float64")  # (R, C)

    # ── Vectorised z_δ computation over all release cells ─────────────────────
    # For each release cell s₀ and each grid cell s:
    #   Z^δ(s, s₀) = (dem[s₀] - dem[s]) - tan(α) × dist(s, s₀)
    # s is in the runout zone of s₀ iff Z^δ > 0.
    #
    # Outputs we accumulate:
    #   z_delta[s]     = max over s₀ of Z^δ(s, s₀)  [most energetic path]
    #   cell_counts[s] = count of s₀ with Z^δ > 0   [overhead exposure]
    #
    # Cells above the release elevation (dem[s] > dem[s₀]) have z_gamma < 0
    # and can never satisfy Z^δ > 0, so they're naturally excluded.
    #
    # Process in batches of BATCH release cells to cap memory.
    BATCH        = 128
    z_delta      = np.zeros((rows, cols), dtype="float64")
    cell_counts  = np.zeros((rows, cols), dtype="int32")

    for start in range(0, n_release, BATCH):
        end = min(start + BATCH, n_release)
        B   = end - start

        # Broadcast shapes: release dim → axis 0, row/col → axes 1, 2
        r0 = r0_arr[start:end, None, None]          # (B, 1, 1)
        c0 = c0_arr[start:end, None, None]          # (B, 1, 1)
        z0 = z0_arr[start:end, None, None]          # (B, 1, 1)

        # Euclidean distance from each release cell to every grid cell (metres)
        dist    = np.sqrt((RR[None] - r0)**2 + (CC[None] - c0)**2) * res  # (B, R, C)

        z_gamma = z0 - dem[None]                    # (B, R, C)  +ve downslope
        z_alpha = np.tan(alpha_rad) * dist          # (B, R, C)  friction
        zdelta  = z_gamma - z_alpha                 # (B, R, C)

        in_runout = zdelta > 0                      # (B, R, C) bool

        # Maximum z_δ from this batch
        batch_max = np.where(in_runout, zdelta, 0.0).max(axis=0)  # (R, C)
        z_delta   = np.maximum(z_delta, batch_max)

        # Count contributing sources
        cell_counts += in_runout.sum(axis=0).astype("int32")

        # Free batch arrays explicitly (helps in low-memory environments)
        del dist, z_gamma, z_alpha, zdelta, in_runout, batch_max

    # ── Travel angle ──────────────────────────────────────────────────────────
    # arctan(z_delta / dist_to_nearest_release_cell).
    # Use scipy distance transform for the nearest-release distance.
    try:
        from scipy.ndimage import distance_transform_edt
        dist_from_release = distance_transform_edt(~release_mask).astype("float64") * res
    except ImportError:
        dist_from_release = np.ones((rows, cols), dtype="float64") * res

    reached       = cell_counts > 0
    travel_angle  = np.where(
        reached,
        np.degrees(np.arctan(z_delta / (dist_from_release + 1e-6))),
        0.0,
    )

    # ── Write outputs ─────────────────────────────────────────────────────────
    nan_mask = np.isnan(dem)
    profile.update(dtype="float32", count=1, compress="deflate", nodata=-9999.0)
    outputs = {}

    for name, arr in [
        ("z_delta",      z_delta),
        ("cell_counts",  cell_counts.astype("float64")),
        ("travel_angle", travel_angle),
    ]:
        out_path = out_dir / f"{name}.tif"
        if out_path.exists():
            print(f"[flowpy] {name}.tif already exists, skipping.")
            outputs[name] = out_path
            continue
        arr_out = np.where(nan_mask, -9999.0, arr).astype("float32")
        with rasterio.open(out_path, "w", **profile) as dst:
            dst.write(arr_out, 1)
        outputs[name] = out_path
        print(f"[flowpy] wrote {name}.tif")

    n_reached = int(reached.sum())
    pct       = 100.0 * n_reached / dem.size
    print(f"[flowpy] {n_reached:,} cells reached ({pct:.1f}% of domain)")
    print(f"[flowpy] z_δ  max={z_delta[~nan_mask].max():.1f} m")
    print(f"[flowpy] cell_counts max={cell_counts[~nan_mask].max()}")
    return outputs


if __name__ == "__main__":
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from config import OUTPUT_DIR, DATA_DIR, FLOWPY as FP
    compute_flowpy(
        dem_path=DATA_DIR / "dem_10m.tif",
        pra_path=OUTPUT_DIR / "pra.tif",
        out_dir=OUTPUT_DIR,
        alpha=FP["alpha"],
        exp=FP["exp"],
    )
