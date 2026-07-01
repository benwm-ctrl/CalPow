"""
cost_surface.py — Fuse terrain-physics layers into a routing cost surface.

Cost = effort_cost + hazard_cost (Tier-A static terrain, per corpus §6.2)

Effort cost: slope-dependent traversal (Rees 2004 quadratic form)
  effort(slope_deg) = 1 + k * slope_deg²

Hazard cost: weighted sum of PRA, Flow-Py z_δ, Flow-Py cell_counts, Winstral Sx.
  All layers are normalised to [0, 1] before weighting.

CRITICAL TIER BOUNDARY (corpus §0.5):
  This function produces a STATIC Tier-A cost surface from precomputed terrain
  layers only. It does NOT accept or encode any weather, forecast, or snowpack
  data. Live forecast coupling (danger rating × aspect × elevation) happens at
  request time in the routing API — NOT here. Never bake Tier-B conditions
  into a COG.
"""

from pathlib import Path
import numpy as np
import rasterio


def build_cost_surface(
    slope_path: Path,
    pra_path: Path,
    z_delta_path: Path,
    cell_counts_path: Path,
    sx_path: Path,
    out_path: Path,
    weights: dict | None = None,
) -> Path:
    """
    Build a static terrain-physics cost surface.

    Parameters
    ----------
    slope_path       : slope in degrees (float32 GeoTIFF)
    pra_path         : PRA membership [0, 1]
    z_delta_path     : Flow-Py z_δ (residual energy height, metres)
    cell_counts_path : Flow-Py cell_counts (path count per cell)
    sx_path          : Winstral Sx (degrees, signed)
    out_path         : path to write cost GeoTIFF
    weights          : dict with keys from config.COST; uses defaults if None

    Returns
    -------
    Path to the written cost GeoTIFF. Values are raw cost (no upper bound).
    Higher = more expensive (more dangerous / harder to traverse).
    """
    if weights is None:
        import sys
        sys.path.insert(0, str(Path(__file__).parent.parent))
        from config import COST as weights

    # ── Load all layers ───────────────────────────────────────────────────────
    layers = {}
    for name, path in [
        ("slope", slope_path),
        ("pra", pra_path),
        ("z_delta", z_delta_path),
        ("cell_counts", cell_counts_path),
        ("sx", sx_path),
    ]:
        with rasterio.open(path) as src:
            arr = src.read(1).astype("float64")
            nd = src.nodata or -9999.0
            if name == "slope":
                profile = src.profile.copy()
        layers[name] = np.where(arr == nd, np.nan, arr)

    # ── Normalise hazard layers to [0, 1] ─────────────────────────────────────
    def norm(arr: np.ndarray) -> np.ndarray:
        """Min-max normalise, ignoring nan. Returns 0 where nan."""
        valid = arr[~np.isnan(arr)]
        if len(valid) == 0 or valid.max() == valid.min():
            return np.zeros_like(arr)
        lo, hi = valid.min(), valid.max()
        return np.where(np.isnan(arr), 0.0, (arr - lo) / (hi - lo))

    pra_n    = norm(layers["pra"])
    zdelta_n = norm(np.clip(layers["z_delta"], 0, None))  # z_δ < 0 → outside runout → 0
    counts_n = norm(layers["cell_counts"])

    # Sx: positive = sheltered (leeward, loading zone) → high hazard.
    #     Negative = exposed (scoured) → lower slab-load hazard.
    # We use clipped Sx > 0 only as the wind-load signal.
    sx_load  = norm(np.clip(layers["sx"], 0, None))  # sheltered zones only

    # ── Effort cost ───────────────────────────────────────────────────────────
    # Rees (2004): cost ∝ 1 + k × slope²
    k = weights["slope_k"]
    effort = 1.0 + k * (layers["slope"] ** 2)
    effort = np.where(np.isnan(layers["slope"]), np.nan, effort)

    # ── Hazard cost ───────────────────────────────────────────────────────────
    # Weighted sum; all weights should sum to 1 within hazard term
    w_pra    = weights["w_pra"]
    w_zdelta = weights["w_zdelta"]
    w_counts = weights["w_cell_counts"]
    w_sx     = weights["w_sx"]

    hazard = (
        w_pra    * pra_n +
        w_zdelta * zdelta_n +
        w_counts * counts_n +
        w_sx     * sx_load
    )

    # ── Combined cost ─────────────────────────────────────────────────────────
    ew = weights["effort_weight"]
    hw = weights["hazard_weight"]
    cost = ew * effort + hw * hazard

    # Cells with no valid data get a very high cost (not nan — MCP needs finite values)
    cost = np.where(np.isnan(cost), cost.max() * 10 if not np.all(np.isnan(cost)) else 1e6, cost)

    # ── Write output ──────────────────────────────────────────────────────────
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    profile.update(dtype="float32", count=1, compress="deflate", nodata=-9999.0)
    with rasterio.open(out_path, "w", **profile) as dst:
        dst.write(cost.astype("float32"), 1)

    print(f"[cost] Cost surface built: min={cost.min():.3f}, max={cost.max():.3f}, "
          f"mean={cost.mean():.3f}")
    print(f"[cost] Written to {out_path}")
    return out_path


if __name__ == "__main__":
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from config import OUTPUT_DIR
    build_cost_surface(
        slope_path=OUTPUT_DIR / "slope.tif",
        pra_path=OUTPUT_DIR / "pra.tif",
        z_delta_path=OUTPUT_DIR / "z_delta.tif",
        cell_counts_path=OUTPUT_DIR / "cell_counts.tif",
        sx_path=OUTPUT_DIR / "sx_315.tif",
        out_path=OUTPUT_DIR / "cost_surface.tif",
    )
