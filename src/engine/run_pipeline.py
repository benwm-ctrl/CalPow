"""
run_pipeline.py — Batch terrain pipeline orchestrator.

Runs the full Tier-A precompute sequence for a test area:
  1. Download 3DEP DEM (USGS, public domain)
  2. Compute terrain derivatives (slope, aspect, curvature, TRI)
  3. Compute PRA (Veitinger 2016 fuzzy logic)
  4. Compute Winstral Sx wind exposure
  5. Run Flow-Py runout (Holmgren + z_δ, D'Amboise 2022)
  6. Build cost surface (Rees 2004 effort + terrain hazard)
  7. Trace one LCP between two test points

This is the "prove the engine on a single tile" step from the corpus build
order (§6.5). Run it, eyeball the outputs against terrain you know, and
validate before wiring to FastAPI or the frontend.

Usage:
  python run_pipeline.py [--wind-az DEGREES] [--alpha DEGREES] [--no-plot]

Outputs: engine/outputs/*.tif  +  engine/outputs/route.geojson
"""

import argparse
import json
import sys
import time
from pathlib import Path

# Add engine root to path
sys.path.insert(0, str(Path(__file__).parent))

from config import (
    TEST_BBOX, DEM_RESOLUTION, DATA_DIR, OUTPUT_DIR,
    FLOWPY, SX, COST,
)
from pipeline.fetch_dem    import fetch_dem
from pipeline.derivatives  import compute_all as compute_derivatives
from pipeline.pra          import compute_pra
from pipeline.sx           import compute_sx
from pipeline.flowpy       import compute_flowpy
from pipeline.cost_surface import build_cost_surface
from pipeline.lcp          import find_lcp, result_to_geojson


# ── Test route: Carson Pass area ─────────────────────────────────────────────
# Roughly: start near Caples Lake trailhead → end near Red Lake Peak saddle
# Adjust these to taste once you have the DEM and know the terrain.
START_LONLAT = (-119.915, 38.706)   # Caples Lake area
END_LONLAT   = (-119.878, 38.693)   # toward Red Lake Peak


def main():
    parser = argparse.ArgumentParser(description="CalPow terrain pipeline")
    parser.add_argument("--wind-az", type=float, default=315.0,
                        help="Prevailing wind azimuth (degrees from N). "
                             "315° = NW (common Sierra storm track).")
    parser.add_argument("--alpha", type=float, default=FLOWPY["alpha"],
                        help=f"Flow-Py stopping angle in degrees "
                             f"(default {FLOWPY['alpha']}°, Alpine calibration).")
    parser.add_argument("--no-plot", action="store_true",
                        help="Skip matplotlib visualisation.")
    args = parser.parse_args()

    t0 = time.time()
    print("=" * 60)
    print("CalPow terrain pipeline — Carson Pass test run")
    print(f"  bbox:     {TEST_BBOX}")
    print(f"  res:      {DEM_RESOLUTION} m")
    print(f"  wind az:  {args.wind_az}°")
    print(f"  α (Flow-Py stopping): {args.alpha}°  ⚠ Alpine calibration")
    print("=" * 60)

    # ── 1. DEM ────────────────────────────────────────────────────────────────
    dem_path = fetch_dem(TEST_BBOX, resolution=DEM_RESOLUTION)

    # ── 2. Derivatives ────────────────────────────────────────────────────────
    deriv_paths = compute_derivatives(dem_path, out_dir=OUTPUT_DIR)

    # ── 3. PRA ────────────────────────────────────────────────────────────────
    pra_path = OUTPUT_DIR / "pra.tif"
    compute_pra(
        slope_path=deriv_paths["slope"],
        tri_path=deriv_paths["tri"],
        out_path=pra_path,
    )

    # ── 4. Winstral Sx ────────────────────────────────────────────────────────
    sx_path = OUTPUT_DIR / f"sx_{int(args.wind_az)}.tif"
    compute_sx(
        dem_path=dem_path,
        wind_azimuth=args.wind_az,
        out_path=sx_path,
        dmax=SX["dmax"],
        az_window=SX["az_window"],
        az_step=SX["az_step"],
    )

    # ── 5. Flow-Py ────────────────────────────────────────────────────────────
    fp_paths = compute_flowpy(
        dem_path=dem_path,
        pra_path=pra_path,
        out_dir=OUTPUT_DIR,
        alpha=args.alpha,
        exp=FLOWPY["exp"],
        min_flux=FLOWPY["min_flux"],
    )

    # ── 6. Cost surface ───────────────────────────────────────────────────────
    cost_path = OUTPUT_DIR / "cost_surface.tif"
    build_cost_surface(
        slope_path=deriv_paths["slope"],
        pra_path=pra_path,
        z_delta_path=fp_paths["z_delta"],
        cell_counts_path=fp_paths["cell_counts"],
        sx_path=sx_path,
        out_path=cost_path,
    )

    # ── 7. LCP ────────────────────────────────────────────────────────────────
    print(f"\n[main] Finding LCP from {START_LONLAT} → {END_LONLAT} …")
    result = find_lcp(
        cost_path=cost_path,
        start_lonlat=START_LONLAT,
        end_lonlat=END_LONLAT,
        extra_layer_paths={
            "slope":       deriv_paths["slope"],
            "pra":         pra_path,
            "z_delta":     fp_paths["z_delta"],
            "cell_counts": fp_paths["cell_counts"],
        },
    )

    # Save route as GeoJSON
    route_path = OUTPUT_DIR / "route.geojson"
    gj = result_to_geojson(result)
    route_path.write_text(json.dumps(gj, indent=2))
    print(f"[main] Route saved to {route_path}")
    print(f"[main] Total cost: {result.total_cost:.4f}  |  {len(result.path_rc)} cells")

    elapsed = time.time() - t0
    print(f"\n{'=' * 60}")
    print(f"Pipeline complete in {elapsed:.1f}s")
    print(f"Outputs in: {OUTPUT_DIR}/")
    print("=" * 60)

    if not args.no_plot:
        _plot_results(deriv_paths, pra_path, fp_paths, cost_path, sx_path, result)


def _plot_results(deriv_paths, pra_path, fp_paths, cost_path, sx_path, result):
    """Quick 6-panel validation plot. Not production code."""
    try:
        import matplotlib.pyplot as plt
        import matplotlib.colors as mcolors
        import rasterio
        import numpy as np

        fig, axes = plt.subplots(2, 3, figsize=(15, 9))
        fig.suptitle("CalPow Engine — Carson Pass validation", fontsize=13, fontweight="bold")

        def load(p):
            with rasterio.open(p) as src:
                arr = src.read(1).astype("float64")
                nd = src.nodata or -9999.0
            return np.where(arr == nd, np.nan, arr)

        panels = [
            ("Slope (°)",            load(deriv_paths["slope"]),  "YlOrRd",   False),
            ("PRA membership",       load(pra_path),              "Reds",     False),
            ("Flow-Py z_δ (m)",      load(fp_paths["z_delta"]),   "plasma",   False),
            ("Winstral Sx (°)",      load(sx_path),               "RdBu_r",   True),
            ("Flow-Py cell_counts",  load(fp_paths["cell_counts"]),"Blues",   False),
            ("Cost surface",         load(cost_path),             "hot_r",    False),
        ]

        for ax, (title, arr, cmap, symm) in zip(axes.flat, panels):
            vmin = -np.nanmax(np.abs(arr)) if symm else np.nanmin(arr)
            vmax = np.nanmax(np.abs(arr)) if symm else np.nanmax(arr)
            im = ax.imshow(arr, cmap=cmap, vmin=vmin, vmax=vmax, origin="upper")
            ax.set_title(title, fontsize=9)
            plt.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
            ax.axis("off")

            # Overlay LCP on all panels
            if result.path_rc:
                rows = [r for r, c in result.path_rc]
                cols = [c for r, c in result.path_rc]
                ax.plot(cols, rows, "c-", linewidth=1.5, alpha=0.8)
                ax.plot(cols[0], rows[0], "go", markersize=6)   # start
                ax.plot(cols[-1], rows[-1], "rs", markersize=6)  # end

        plt.tight_layout()
        plot_path = OUTPUT_DIR / "validation_plot.png"
        plt.savefig(plot_path, dpi=150, bbox_inches="tight")
        print(f"[plot] Saved to {plot_path}")
        plt.show()

    except ImportError:
        print("[plot] matplotlib not available, skipping plot.")


if __name__ == "__main__":
    main()
