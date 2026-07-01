"""
derivatives.py — Terrain derivatives from a DEM.

Computes: slope (degrees), aspect (degrees from N), planform curvature,
profile curvature, and TRI (Terrain Ruggedness Index).

Primary tool: WhiteboxTools (MIT, verified active v2.4.0). Corpus §1.2.
Fallback: pure numpy for slope/aspect when WhiteboxTools is unavailable.

All outputs are written as float32 GeoTIFFs alongside the input DEM.
"""

from pathlib import Path
import numpy as np
import rasterio
from rasterio.transform import Affine


def compute_all(dem_path: Path, out_dir: Path | None = None) -> dict[str, Path]:
    """
    Compute slope, aspect, planform curvature, profile curvature, and TRI.

    Parameters
    ----------
    dem_path : path to the input DEM GeoTIFF (UTM, metres)
    out_dir  : output directory; defaults to same directory as dem_path

    Returns
    -------
    dict mapping derivative name → output path
    """
    dem_path = Path(dem_path)
    out_dir = Path(out_dir) if out_dir else dem_path.parent
    out_dir.mkdir(parents=True, exist_ok=True)

    paths = {}

    try:
        import whitebox
        wbt = whitebox.WhiteboxTools()
        wbt.verbose = False
        print("[derivatives] Using WhiteboxTools for terrain derivatives.")
        paths = _compute_with_whitebox(wbt, dem_path, out_dir)
    except Exception as e:
        print(f"[derivatives] WhiteboxTools unavailable ({e}), falling back to numpy.")
        paths = _compute_with_numpy(dem_path, out_dir)

    return paths


# ── WhiteboxTools path ────────────────────────────────────────────────────────

def _compute_with_whitebox(wbt, dem_path: Path, out_dir: Path) -> dict[str, Path]:
    """Use WhiteboxTools for all derivatives (preferred)."""
    dem_str = str(dem_path)
    results = {}

    pairs = [
        ("slope",       lambda o: wbt.slope(dem_str, o, units="degrees")),
        ("aspect",      lambda o: wbt.aspect(dem_str, o)),
        ("plan_curv",   lambda o: wbt.plan_curvature(dem_str, o)),
        ("prof_curv",   lambda o: wbt.profile_curvature(dem_str, o)),
        ("tri",         lambda o: wbt.ruggedness_index(dem_str, o)),
    ]

    for name, fn in pairs:
        out = out_dir / f"{name}.tif"
        if not out.exists():
            print(f"[derivatives] Computing {name} …")
            fn(str(out))
        else:
            print(f"[derivatives] {name} already exists, skipping.")
        results[name] = out

    return results


# ── numpy fallback ────────────────────────────────────────────────────────────

def _compute_with_numpy(dem_path: Path, out_dir: Path) -> dict[str, Path]:
    """
    Pure-numpy slope, aspect, TRI, and simple curvature estimates.
    Less accurate than WhiteboxTools (no multi-scale curvature) but portable.
    """
    with rasterio.open(dem_path) as src:
        dem = src.read(1).astype("float64")
        transform: Affine = src.transform
        nodata = src.nodata or -9999.0
        profile = src.profile.copy()

    dem = np.where(dem == nodata, np.nan, dem)

    # pixel size from transform (assumes square pixels)
    res = abs(transform.a)  # metres

    # gradients using central differences
    dz_dy, dz_dx = np.gradient(dem, res)

    # ── Slope (degrees) ──────────────────────────────────────────────────────
    slope_rad = np.arctan(np.sqrt(dz_dx**2 + dz_dy**2))
    slope_deg = np.degrees(slope_rad)

    # ── Aspect (degrees from N, clockwise) ───────────────────────────────────
    # Note: numpy gradient: dz_dy is row-gradient (N–S), dz_dx is col-gradient (W–E)
    # Aspect: angle of steepest descent from North
    aspect = np.degrees(np.arctan2(-dz_dx, dz_dy)) % 360

    # ── TRI — terrain ruggedness index ───────────────────────────────────────
    # Wilson et al. (2007): RMSD of elevation differences to 8 neighbours
    tri = _tri_numpy(dem)

    # ── Curvature (Zevenbergen & Thorne 1987 — 3×3 quadratic surface fit) ───
    plan_curv, prof_curv = _curvature_numpy(dem, res)

    results = {}
    layer_data = {
        "slope":     (slope_deg, "float32"),
        "aspect":    (aspect,    "float32"),
        "tri":       (tri,       "float32"),
        "plan_curv": (plan_curv, "float32"),
        "prof_curv": (prof_curv, "float32"),
    }

    profile.update(dtype="float32", count=1, compress="deflate", nodata=-9999.0)

    for name, (data, dtype) in layer_data.items():
        out = out_dir / f"{name}.tif"
        if not out.exists():
            arr = data.astype(dtype)
            arr = np.where(np.isnan(arr), -9999.0, arr)
            with rasterio.open(out, "w", **profile) as dst:
                dst.write(arr, 1)
            print(f"[derivatives] Written {name} → {out}")
        else:
            print(f"[derivatives] {name} already exists, skipping.")
        results[name] = out

    return results


def _tri_numpy(dem: np.ndarray) -> np.ndarray:
    """Wilson et al. TRI: RMSD of the 8-neighbour elevation differences."""
    padded = np.pad(dem, 1, mode="edge")
    diffs_sq = np.zeros_like(dem)
    n = 0
    for dr in (-1, 0, 1):
        for dc in (-1, 0, 1):
            if dr == 0 and dc == 0:
                continue
            nb = padded[1+dr:1+dr+dem.shape[0], 1+dc:1+dc+dem.shape[1]]
            diffs_sq += (dem - nb) ** 2
            n += 1
    return np.sqrt(diffs_sq / n)


def _curvature_numpy(dem: np.ndarray, res: float) -> tuple[np.ndarray, np.ndarray]:
    """
    Zevenbergen & Thorne (1987) 3×3 quadratic surface curvature.
    Returns (planform_curvature, profile_curvature) in units of 1/100m.
    """
    Z = np.pad(dem, 1, mode="edge")
    # 3×3 neighbourhood coefficients
    Z1 = Z[0:-2, 0:-2]; Z2 = Z[0:-2, 1:-1]; Z3 = Z[0:-2, 2:]
    Z4 = Z[1:-1, 0:-2]; Z5 = Z[1:-1, 1:-1]; Z6 = Z[1:-1, 2:]
    Z7 = Z[2:,   0:-2]; Z8 = Z[2:,   1:-1]; Z9 = Z[2:,   2:]

    L = res
    D = (Z4 + Z6) / 2 - Z5
    E = (Z2 + Z8) / 2 - Z5
    F = (-Z1 + Z3 + Z7 - Z9) / 4
    G = (-Z4 + Z6) / 2
    H = (Z2 - Z8) / 2

    # Planform (contour) curvature: positive = concave across contours (convergent)
    denom_plan = (G**2 + H**2 + 1e-10)
    plan_curv = -2 * (D * H**2 - F * G * H + E * G**2) / (L**2 * denom_plan)

    # Profile curvature: positive = concave in direction of slope (deceleration)
    denom_prof = ((G**2 + H**2) * (1 + G**2 + H**2) + 1e-10)
    prof_curv = -2 * (D * G**2 + F * G * H + E * H**2) / (L**2 * denom_prof)

    return plan_curv, prof_curv


if __name__ == "__main__":
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from config import OUTPUT_DIR, DATA_DIR
    dem_path = DATA_DIR / "dem_10m.tif"
    compute_all(dem_path, out_dir=OUTPUT_DIR)
