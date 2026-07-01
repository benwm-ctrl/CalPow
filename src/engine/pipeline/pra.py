"""
pra.py — Potential Release Area (PRA) model.

Implements the Veitinger et al. (2016) fuzzy-logic PRA using a generalised
bell-shaped membership function (gbellmf), not a Cauchy function.

Reference:
  Veitinger J., Purves R.S., Sovilla B. (2016). Potential slab avalanche release
  area identification from estimated winter terrain: a multi-scale, fuzzy logic
  approach. NHESS 16:2211–2225. DOI: 10.5194/nhess-16-2211-2016.

⚠ Region calibration note (corpus §2):
  Membership function parameters in config.py are from Swiss Alps calibration.
  Read the actual values from the primary paper PDF before treating them as
  authoritative for Sierra Nevada terrain.
"""

from pathlib import Path
import numpy as np
import rasterio


def gbellmf(x: np.ndarray, a: float, b: float, c: float) -> np.ndarray:
    """
    Generalised bell-shaped membership function.

        μ(x) = 1 / (1 + |(x − c) / a|^{2b})

    Parameters
    ----------
    x : input array
    a : width parameter (> 0)
    b : shape parameter (controls steepness; b=1 → Cauchy, b=2 → Veitinger)
    c : centre (peak) value

    Returns
    -------
    membership values in [0, 1]
    """
    return 1.0 / (1.0 + np.abs((x - c) / (a + 1e-10)) ** (2 * b))


def compute_pra(
    slope_path: Path,
    tri_path: Path,
    out_path: Path,
    params: dict | None = None,
    forest_path: Path | None = None,
) -> Path:
    """
    Compute the PRA membership raster.

    Inputs
    ------
    slope_path  : slope in degrees (float32 GeoTIFF)
    tri_path    : TRI or roughness raster (float32 GeoTIFF)
    out_path    : path to write PRA membership [0, 1] GeoTIFF
    params      : PRA config dict (from config.PRA); uses defaults if None
    forest_path : optional canopy-density raster [0, 1] — LANDFIRE or Sentinel-2

    Returns
    -------
    Path to the written PRA GeoTIFF
    """
    if params is None:
        import sys
        sys.path.insert(0, str(Path(__file__).parent.parent))
        from config import PRA as params

    with rasterio.open(slope_path) as src:
        slope = src.read(1).astype("float64")
        nodata = src.nodata or -9999.0
        profile = src.profile.copy()

    with rasterio.open(tri_path) as src:
        tri = src.read(1).astype("float64")

    # mask nodata
    valid = (slope != nodata) & (tri != nodata)

    # ── Slope membership ─────────────────────────────────────────────────────
    # Generalised bell; peak at params["slope_c"] (~38°, confirmed ~35–45° per corpus §2)
    mu_slope = gbellmf(slope, params["slope_a"], params["slope_b"], params["slope_c"])

    # Hard limits: cells outside [slope_min, slope_max] are excluded entirely
    mu_slope = np.where(
        (slope < params["slope_min"]) | (slope > params["slope_max"]),
        0.0,
        mu_slope,
    )

    # ── Roughness membership (inverse) ───────────────────────────────────────
    # High TRI → terrain is rough/rocky → less likely to form slab → lower PRA
    # We invert: mu_rough = 1 - gbellmf(TRI, ...) centred at 0 (flat = high membership)
    mu_rough = 1.0 - gbellmf(tri, params["rough_a"], params["rough_b"], params["rough_c"])

    # ── Forest density (optional) ─────────────────────────────────────────────
    mu_forest = np.ones_like(slope)
    if forest_path is not None and Path(forest_path).exists():
        with rasterio.open(forest_path) as src:
            canopy = src.read(1).astype("float64")
        # Dense forest (canopy → 1) suppresses PRA
        mu_forest = 1.0 - canopy

    # ── Combined PRA membership ───────────────────────────────────────────────
    # Product (T-norm AND): all factors must be simultaneously high
    pra = mu_slope * mu_rough * mu_forest

    # Apply nodata and minimum threshold
    pra = np.where(valid, pra, 0.0)
    pra = np.where(pra < params["min_membership"], 0.0, pra)

    # ── Write output ─────────────────────────────────────────────────────────
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    profile.update(dtype="float32", count=1, compress="deflate", nodata=-9999.0)
    with rasterio.open(out_path, "w", **profile) as dst:
        dst.write(pra.astype("float32"), 1)

    n_release = int((pra > 0).sum())
    pct = 100 * n_release / pra.size
    print(f"[pra] PRA computed: {n_release:,} release cells ({pct:.1f}% of domain)")
    print(f"[pra] Written to {out_path}")
    return out_path


if __name__ == "__main__":
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from config import OUTPUT_DIR
    compute_pra(
        slope_path=OUTPUT_DIR / "slope.tif",
        tri_path=OUTPUT_DIR / "tri.tif",
        out_path=OUTPUT_DIR / "pra.tif",
    )
