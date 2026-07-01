"""
fetch_dem.py — Download a 3DEP 10 m DEM for a bounding box via py3dep.

Source: USGS 3D Elevation Program (3DEP), public domain, no restrictions.
Access: USGS National Map WCS endpoint (wrapped by py3dep).
Corpus: §1.1

Output: a rasterio-readable GeoTIFF saved to data/dem.tif, projected to
        UTM (auto-detected for the bbox centroid — either UTM 10N or 11N for CA).
"""

from pathlib import Path
import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.warp import calculate_default_transform, reproject, Resampling
import py3dep


def fetch_dem(
    bbox: tuple[float, float, float, float],
    resolution: int = 10,
    out_path: Path | None = None,
) -> Path:
    """
    Download a 3DEP DEM for ``bbox`` at ``resolution`` metres.

    Parameters
    ----------
    bbox : (lon_min, lat_min, lon_max, lat_max) in WGS84
    resolution : target resolution in metres (10 recommended per corpus)
    out_path : where to write the GeoTIFF; defaults to data/dem_<res>m.tif

    Returns
    -------
    Path to the written GeoTIFF in UTM CRS.
    """
    if out_path is None:
        out_path = Path(__file__).parent.parent / "data" / f"dem_{resolution}m.tif"
    out_path.parent.mkdir(parents=True, exist_ok=True)

    if out_path.exists():
        print(f"[fetch_dem] DEM already exists at {out_path}, skipping download.")
        return out_path

    print(f"[fetch_dem] Downloading 3DEP DEM for bbox={bbox} at {resolution}m …")

    # py3dep returns an xarray DataArray in EPSG:4326
    dem_wgs84 = py3dep.get_dem(bbox, resolution=resolution, crs="EPSG:4326")

    # --- reproject to UTM ---
    # California spans UTM 10N (west) and 11N (east). Corpus §P1.
    # Auto-detect from bbox centroid longitude.
    lon_centre = (bbox[0] + bbox[2]) / 2
    utm_epsg = _utm_epsg_for_lon(lon_centre)
    utm_crs = CRS.from_epsg(utm_epsg)

    print(f"[fetch_dem] Reprojecting to EPSG:{utm_epsg} (UTM) …")

    # Write intermediate WGS84 to a MemoryFile, then reproject
    wgs84_crs = CRS.from_epsg(4326)
    data = dem_wgs84.values.astype("float32")

    # py3dep may return (1, H, W) or (H, W)
    if data.ndim == 3:
        data = data[0]
    # Replace nodata
    nodata_in = float(dem_wgs84.attrs.get("_FillValue", np.nan))
    data = np.where(np.isnan(data), -9999.0, data)

    src_transform = _build_transform_from_xarray(dem_wgs84)

    dst_transform, dst_width, dst_height = calculate_default_transform(
        wgs84_crs,
        utm_crs,
        data.shape[1],   # width (cols)
        data.shape[0],   # height (rows)
        left=float(dem_wgs84.x.min()),
        bottom=float(dem_wgs84.y.min()),
        right=float(dem_wgs84.x.max()),
        top=float(dem_wgs84.y.max()),
        resolution=resolution,
    )

    dst_data = np.empty((dst_height, dst_width), dtype="float32")

    reproject(
        source=data,
        destination=dst_data,
        src_transform=src_transform,
        src_crs=wgs84_crs,
        dst_transform=dst_transform,
        dst_crs=utm_crs,
        src_nodata=-9999.0,
        dst_nodata=-9999.0,
        resampling=Resampling.bilinear,  # bilinear for elevation (not nearest-neighbour)
    )

    with rasterio.open(
        out_path,
        "w",
        driver="GTiff",
        height=dst_height,
        width=dst_width,
        count=1,
        dtype="float32",
        crs=utm_crs,
        transform=dst_transform,
        nodata=-9999.0,
        compress="deflate",
    ) as dst:
        dst.write(dst_data, 1)

    print(f"[fetch_dem] Written to {out_path}  ({dst_width}×{dst_height} px, EPSG:{utm_epsg})")
    return out_path


# ── helpers ──────────────────────────────────────────────────────────────────

def _utm_epsg_for_lon(lon: float) -> int:
    """
    Return EPSG code for the NAD83 UTM zone containing ``lon``.
    California spans UTM 10N (EPSG:26910) and 11N (EPSG:26911).
    Corpus §P1: zone boundary runs roughly through Reno / Bishop.
    """
    zone = int((lon + 180) / 6) + 1
    # NAD83 UTM zones for North America: EPSG = 26900 + zone
    return 26900 + zone


def _build_transform_from_xarray(da) -> rasterio.transform.Affine:
    """Build an Affine transform from an xarray DataArray with x/y coords."""
    from rasterio.transform import from_bounds
    x = da.x.values
    y = da.y.values
    left, right = float(x.min()), float(x.max())
    bottom, top = float(y.min()), float(y.max())
    width, height = len(x), len(y)
    return from_bounds(left, bottom, right, top, width, height)


if __name__ == "__main__":
    from config import TEST_BBOX, DEM_RESOLUTION
    fetch_dem(TEST_BBOX, resolution=DEM_RESOLUTION)
