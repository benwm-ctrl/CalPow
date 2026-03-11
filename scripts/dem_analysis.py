#!/usr/bin/env python3
"""
CalPow DEM Analysis Pipeline
Downloads USGS 3DEP DEM for any bounding box,
computes slope, aspect, TRI, and composite risk.
Usage: python3 dem_analysis.py --bbox west south east north --name region_name
"""

import numpy as np
import rasterio
import rasterio.transform
from rasterio.crs import CRS
import requests
import os
import json
import argparse
from scipy.ndimage import uniform_filter, generic_filter

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), 'output')
os.makedirs(OUTPUT_DIR, exist_ok=True)

SLOPE_COLORMAP = [
    # (degrees, R, G, B)
    (0, 46, 204, 113),   # green   flat safe
    (25, 241, 196, 15),  # yellow  watch
    (30, 230, 126, 34),  # orange  avalanche terrain
    (35, 231, 76, 60),   # red     high consequence
    (45, 142, 68, 173),  # purple  extreme
    (60, 26, 26, 46),    # black   cliff
]

ASPECT_DIRECTIONS = {
    'N':  [(337.5, 360), (0, 22.5)],
    'NE': [(22.5, 67.5)],
    'E':  [(67.5, 112.5)],
    'SE': [(112.5, 157.5)],
    'S':  [(157.5, 202.5)],
    'SW': [(202.5, 247.5)],
    'W':  [(247.5, 292.5)],
    'NW': [(292.5, 337.5)],
}

ASPECT_COLORMAP = [
    (0, 41, 128, 185),    # N   blue
    (45, 26, 188, 156),   # NE  teal
    (90, 39, 174, 96),    # E   green
    (135, 243, 156, 18),  # SE  yellow
    (180, 231, 76, 60),   # S   red
    (225, 233, 30, 99),   # SW  pink
    (270, 155, 89, 182),  # W   purple
    (315, 52, 152, 219),  # NW  light blue
    (360, 41, 128, 185),  # N   blue (wraps)
]

TRI_COLORMAP = [
    (0, 247, 251, 255),   # white  smooth
    (50, 198, 219, 239),  # light blue
    (150, 107, 174, 214), # medium blue
    (300, 33, 113, 181),  # dark blue
    (600, 8, 48, 107),    # navy  very rugged
]

COMPOSITE_COLORMAP = [
    (0, 46, 204, 113),    # green   low risk
    (25, 241, 196, 15),   # yellow  moderate
    (50, 230, 126, 34),   # orange  considerable
    (75, 231, 76, 60),    # red     high
    (100, 142, 68, 173),  # purple  extreme
]


def download_dem(west, south, east, north, name, resolution=10):
    print(f"Downloading DEM for {name}...")

    safe_name = name.lower().replace(' ', '_')
    output_path = os.path.join(OUTPUT_DIR, f'dem_{safe_name}.tif')

    # Special case: use pre-merged California DEM
    california_dem = os.path.join(OUTPUT_DIR, 'dem_california.tif')
    if safe_name == 'california' and os.path.exists(california_dem):
        print(f"  Using pre-merged California DEM ({os.path.getsize(california_dem)//1024//1024}MB)")
        import shutil
        if os.path.abspath(california_dem) != os.path.abspath(output_path):
            shutil.copy(california_dem, output_path)
        return output_path, None, None

    if os.path.exists(output_path):
        size_mb = os.path.getsize(output_path) // 1024 // 1024
        print(f"  Using existing DEM: {output_path} ({size_mb}MB)")
        return output_path, None, None

    lat_center = (north + south) / 2
    meters_per_deg_lon = 111320 * np.cos(np.radians(lat_center))
    meters_per_deg_lat = 110540

    width = int((east - west) * meters_per_deg_lon / resolution)
    height = int((north - south) * meters_per_deg_lat / resolution)
    width = min(width, 2048)
    height = min(height, 2048)

    print(f"  Grid: {width}x{height} at {resolution}m resolution")

    # Try USGS 3DEP REST endpoint (more reliable than WCS)
    url = (
        "https://elevation.nationalmap.gov/arcgis/rest/services/"
        "3DEPElevation/ImageServer/exportImage"
    )
    params = {
        'bbox': f"{west},{south},{east},{north}",
        'bboxSR': 4326,
        'size': f"{width},{height}",
        'imageSR': 4326,
        'format': 'tiff',
        'pixelType': 'F32',
        'noDataInterpretation': 'esriNoDataMatchAny',
        'interpolation': '+RSP_BilinearInterpolation',
        'f': 'image',
    }

    try:
        response = requests.get(url, params=params, timeout=120, stream=True)
        response.raise_for_status()
        with open(output_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        # Verify it's a valid GeoTIFF
        with rasterio.open(output_path) as src:
            test = src.read(1)
        print(f"  Downloaded real DEM: {output_path}")
        return output_path, width, height
    except Exception as e:
        print(f"  USGS download failed: {e}")
        print(f"  Falling back to synthetic DEM...")
        return generate_synthetic_dem(
            name, west, south, east, north, width, height), width, height

def generate_synthetic_dem(name, west, south, east, north, width, height):
    print(f"  Generating {width}x{height} synthetic DEM...")
    x = np.linspace(0, 1, width)
    y = np.linspace(0, 1, height)
    xx, yy = np.meshgrid(x, y)

    # Generic mountain terrain
    cx, cy = 0.5, 0.5
    dist = np.sqrt((xx - cx)**2 + (yy - cy)**2)
    elevation = 3000 - dist * 4000
    elevation = np.maximum(elevation, 800)
    elevation += 300 * np.sin(xx * 8) * np.cos(yy * 6) * (1 - dist)
    elevation += 150 * np.sin(xx * 15) * np.sin(yy * 12)
    noise = np.random.normal(0, 20, elevation.shape)
    elevation = uniform_filter(elevation + noise, size=3)

    safe_name = name.lower().replace(' ', '_')
    output_path = os.path.join(OUTPUT_DIR, f'dem_{safe_name}.tif')
    transform = rasterio.transform.from_bounds(
        west, south, east, north, width, height)
    with rasterio.open(
        output_path, 'w', driver='GTiff',
        height=height, width=width, count=1,
        dtype=np.float32, crs=CRS.from_epsg(4326),
        transform=transform,
    ) as dst:
        dst.write(elevation.astype(np.float32), 1)
    return output_path

def compute_slope(dem, transform):
    print("  Computing slope...")
    lat_center = 37  # approximate, good enough for CONUS
    cell_size_x = abs(transform.a) * 111320 * np.cos(np.radians(lat_center))
    cell_size_y = abs(transform.e) * 110540
    dz_dy, dz_dx = np.gradient(dem, cell_size_y, cell_size_x)
    slope = np.degrees(np.arctan(np.sqrt(dz_dx**2 + dz_dy**2)))
    return slope.astype(np.float32)

def compute_aspect(dem, transform):
    print("  Computing aspect...")
    cell_size_x = abs(transform.a) * 111320 * np.cos(np.radians(37))
    cell_size_y = abs(transform.e) * 110540
    dz_dy, dz_dx = np.gradient(dem, cell_size_y, cell_size_x)
    aspect = np.degrees(np.arctan2(-dz_dy, dz_dx))
    aspect = (90 - aspect) % 360
    return aspect.astype(np.float32)

def compute_tri(dem):
    print("  Computing TRI...")
    def tri_kernel(values):
        center = values[4]
        neighbors = np.delete(values, 4)
        return np.sqrt(np.sum((center - neighbors)**2))
    tri = generic_filter(dem.astype(np.float32), tri_kernel, size=3)
    return tri.astype(np.float32)

def compute_composite_risk(slope, aspect, tri, elevation,
                            dangerous_aspects=None, danger_level=2):
    print("  Computing composite risk...")

    slope_score = np.zeros_like(slope)
    slope_score = np.where(slope < 25, slope / 25 * 20, slope_score)
    slope_score = np.where((slope>=25)&(slope<30), 20+(slope-25)/5*30, slope_score)
    slope_score = np.where((slope>=30)&(slope<35), 50+(slope-30)/5*30, slope_score)
    slope_score = np.where((slope>=35)&(slope<45), 80+(slope-35)/10*20, slope_score)
    slope_score = np.where(slope >= 45, 100, slope_score)

    if dangerous_aspects is None:
        dangerous_aspects = ['N', 'NE', 'NW']

    aspect_danger_map = {
        'N': (337.5, 22.5), 'NE': (22.5, 67.5),
        'E': (67.5, 112.5), 'SE': (112.5, 157.5),
        'S': (157.5, 202.5), 'SW': (202.5, 247.5),
        'W': (247.5, 292.5), 'NW': (292.5, 337.5),
    }
    aspect_score = np.ones_like(aspect) * 20
    for asp in dangerous_aspects:
        if asp in aspect_danger_map:
            lo, hi = aspect_danger_map[asp]
            mask = ((aspect >= 337.5) | (aspect < 22.5)) if asp == 'N' \
                   else ((aspect >= lo) & (aspect < hi))
            aspect_score = np.where(mask, 20 + (danger_level/5)*80, aspect_score)

    tri_max = np.percentile(tri, 95)
    tri_score = np.clip(tri / (tri_max + 1e-6) * 100, 0, 100)

    elev_score = np.zeros_like(elevation)
    elev_score = np.where(elevation < 2400, danger_level/5*40, elev_score)
    elev_score = np.where((elevation>=2400)&(elevation<2900),
                          danger_level/5*70, elev_score)
    elev_score = np.where(elevation >= 2900, danger_level/5*100, elev_score)

    composite = (0.40*slope_score + 0.30*aspect_score +
                 0.20*tri_score + 0.10*elev_score)
    return np.clip(composite, 0, 100).astype(np.float32)

def export_geotiff(data, transform, crs, output_path):
    with rasterio.open(
        output_path, 'w', driver='GTiff',
        height=data.shape[0], width=data.shape[1],
        count=1, dtype=data.dtype,
        crs=crs, transform=transform, compress='lzw',
    ) as dst:
        dst.write(data, 1)
    print(f"  Exported: {output_path}")

def export_8bit(data, transform, crs, output_path,
                data_min=None, data_max=None):
    """
    Normalize float32 data to uint8 (0-255) for Mapbox upload.
    Saves metadata about the original range for back-conversion.
    """
    if data_min is None:
        data_min = float(np.percentile(data, 2))
    if data_max is None:
        data_max = float(np.percentile(data, 98))

    normalized = (data - data_min) / (data_max - data_min + 1e-6)
    uint8_data = np.clip(normalized * 255, 0, 255).astype(np.uint8)

    with rasterio.open(
        output_path, 'w', driver='GTiff',
        height=uint8_data.shape[0],
        width=uint8_data.shape[1],
        count=1,
        dtype=np.uint8,
        crs=crs,
        transform=transform,
        compress='lzw',
    ) as dst:
        dst.write(uint8_data, 1)
        dst.update_tags(
            data_min=str(data_min),
            data_max=str(data_max),
        )
    print(f"  Exported 8-bit: {output_path}")
    return data_min, data_max


def export_rgb_colorized(data, colormap, transform, crs, output_path,
                         data_min, data_max):
    """
    Converts float data to a 3-band RGB GeoTIFF
    using a custom colormap. Mapbox displays RGB
    tilesets directly with no color expression needed.
    colormap = list of (value, r, g, b) tuples,
    value in same units as data.
    """
    norm = np.clip(
        (data - data_min) / (data_max - data_min + 1e-6),
        0, 1)

    r_out = np.zeros_like(norm, dtype=np.uint8)
    g_out = np.zeros_like(norm, dtype=np.uint8)
    b_out = np.zeros_like(norm, dtype=np.uint8)

    cm = sorted(colormap, key=lambda x: x[0])

    for i in range(len(cm) - 1):
        v0, r0, g0, b0 = cm[i]
        v1, r1, g1, b1 = cm[i + 1]
        n0 = (v0 - data_min) / (data_max - data_min + 1e-6)
        n1 = (v1 - data_min) / (data_max - data_min + 1e-6)
        mask = (norm >= n0) & (norm < n1)
        t = np.where(mask, (norm - n0) / (n1 - n0 + 1e-6), 0)
        r_out = np.where(mask,
                         np.clip(r0 + t * (r1 - r0), 0, 255).astype(np.uint8), r_out)
        g_out = np.where(mask,
                         np.clip(g0 + t * (g1 - g0), 0, 255).astype(np.uint8), g_out)
        b_out = np.where(mask,
                         np.clip(b0 + t * (b1 - b0), 0, 255).astype(np.uint8), b_out)

    v_last, r_last, g_last, b_last = cm[-1]
    n_last = (v_last - data_min) / (data_max - data_min + 1e-6)
    mask_last = norm >= n_last
    r_out = np.where(mask_last, r_last, r_out)
    g_out = np.where(mask_last, g_last, g_out)
    b_out = np.where(mask_last, b_last, b_out)

    with rasterio.open(
        output_path, 'w', driver='GTiff',
        height=data.shape[0], width=data.shape[1],
        count=3, dtype=np.uint8,
        crs=crs, transform=transform, compress='lzw',
    ) as dst:
        dst.write(r_out, 1)
        dst.write(g_out, 2)
        dst.write(b_out, 3)
    print(f"  Exported RGB: {output_path}")


def export_rgba_slope(slope_data, colormap, transform, crs, output_path):
    """
    4-band RGBA GeoTIFF for slope.
    Pixels below 25° are fully transparent (alpha=0).
    Pixels 25-28° fade in from 0-255 alpha.
    Pixels above 28° are fully opaque (alpha=255).
    """
    data_min, data_max = 0, 60
    norm = np.clip(
        (slope_data - data_min) / (data_max - data_min + 1e-6),
        0, 1)

    r_out = np.zeros_like(norm, dtype=np.uint8)
    g_out = np.zeros_like(norm, dtype=np.uint8)
    b_out = np.zeros_like(norm, dtype=np.uint8)
    a_out = np.zeros_like(norm, dtype=np.uint8)

    cm = sorted(colormap, key=lambda x: x[0])

    for i in range(len(cm) - 1):
        v0, r0, g0, b0 = cm[i]
        v1, r1, g1, b1 = cm[i + 1]
        n0 = v0 / 60.0
        n1 = v1 / 60.0
        mask = (norm >= n0) & (norm < n1)
        t = np.where(mask, (norm - n0) / (n1 - n0 + 1e-6), 0)
        r_out = np.where(mask,
                         np.clip(r0 + t * (r1 - r0), 0, 255).astype(np.uint8), r_out)
        g_out = np.where(mask,
                         np.clip(g0 + t * (g1 - g0), 0, 255).astype(np.uint8), g_out)
        b_out = np.where(mask,
                         np.clip(b0 + t * (b1 - b0), 0, 255).astype(np.uint8), b_out)

    v_last, r_last, g_last, b_last = cm[-1]
    mask_last = norm >= (v_last / 60.0)
    r_out = np.where(mask_last, r_last, r_out)
    g_out = np.where(mask_last, g_last, g_out)
    b_out = np.where(mask_last, b_last, b_out)

    # Alpha channel:
    # below 25° = 0 (transparent)
    # 25-28° = fade in 0-255
    # above 28° = 255 (opaque)
    a_out = np.where(slope_data < 25, 0, a_out)
    a_out = np.where(
        (slope_data >= 25) & (slope_data < 28),
        ((slope_data - 25) / 3 * 255).astype(np.uint8),
        a_out)
    a_out = np.where(slope_data >= 28, 255, a_out)
    a_out = a_out.astype(np.uint8)

    with rasterio.open(
        output_path, 'w', driver='GTiff',
        height=slope_data.shape[0],
        width=slope_data.shape[1],
        count=4,
        dtype=np.uint8,
        crs=crs,
        transform=transform,
        compress='lzw',
    ) as dst:
        dst.write(r_out, 1)
        dst.write(g_out, 2)
        dst.write(b_out, 3)
        dst.write(a_out, 4)
    print(f"  Exported RGBA slope: {output_path}")


def export_aspect_mask(aspect, dir_key, ranges, transform, crs, output_path):
    """
    Export a binary RGB mask GeoTIFF for one aspect direction.
    Pixels within any (lo, hi) in ranges are white (255,255,255), else black (0,0,0).
    ranges: list of (lo, hi) in degrees; lo > hi means wraparound (e.g. N).
    """
    mask = np.zeros_like(aspect, dtype=bool)
    for (lo, hi) in ranges:
        if lo > hi:
            mask |= (aspect >= lo) | (aspect < hi)
        else:
            mask |= (aspect >= lo) & (aspect < hi)
    r = np.where(mask, 255, 0).astype(np.uint8)
    g = np.where(mask, 255, 0).astype(np.uint8)
    b = np.where(mask, 255, 0).astype(np.uint8)
    with rasterio.open(
        output_path, 'w', driver='GTiff',
        height=aspect.shape[0], width=aspect.shape[1],
        count=3, dtype=np.uint8,
        crs=crs, transform=transform, compress='lzw',
    ) as dst:
        dst.write(r, 1)
        dst.write(g, 2)
        dst.write(b, 3)
    print(f"  Exported aspect mask {dir_key}: {output_path}")


def export_rgba_tri(tri_data, colormap, transform, crs, output_path):
    """
    4-band RGBA GeoTIFF for TRI.
    Pixels below 20th percentile (of tri > 0) are fully transparent.
    Pixels from 20th–40th percentile fade in (alpha 0→255).
    Pixels above 40th percentile are fully opaque.
    """
    tri_valid = tri_data[tri_data > 0]
    if tri_valid.size == 0:
        p20, p40 = 0.0, 1.0
        data_max = 1.0
    else:
        p20 = float(np.percentile(tri_valid, 20))
        p40 = float(np.percentile(tri_valid, 40))
        data_max = float(np.percentile(tri_valid, 98))
    data_min = 0.0

    norm = np.clip(
        (tri_data - data_min) / (data_max - data_min + 1e-6),
        0, 1)

    r_out = np.zeros_like(norm, dtype=np.uint8)
    g_out = np.zeros_like(norm, dtype=np.uint8)
    b_out = np.zeros_like(norm, dtype=np.uint8)
    a_out = np.zeros_like(norm, dtype=np.uint8)

    cm = sorted(colormap, key=lambda x: x[0])
    for i in range(len(cm) - 1):
        v0, r0, g0, b0 = cm[i]
        v1, r1, g1, b1 = cm[i + 1]
        n0 = (v0 - data_min) / (data_max - data_min + 1e-6)
        n1 = (v1 - data_min) / (data_max - data_min + 1e-6)
        mask = (norm >= n0) & (norm < n1)
        t = np.where(mask, (norm - n0) / (n1 - n0 + 1e-6), 0)
        r_out = np.where(mask,
                         np.clip(r0 + t * (r1 - r0), 0, 255).astype(np.uint8), r_out)
        g_out = np.where(mask,
                         np.clip(g0 + t * (g1 - g0), 0, 255).astype(np.uint8), g_out)
        b_out = np.where(mask,
                         np.clip(b0 + t * (b1 - b0), 0, 255).astype(np.uint8), b_out)
    v_last, r_last, g_last, b_last = cm[-1]
    n_last = (v_last - data_min) / (data_max - data_min + 1e-6)
    mask_last = norm >= n_last
    r_out = np.where(mask_last, r_last, r_out)
    g_out = np.where(mask_last, g_last, g_out)
    b_out = np.where(mask_last, b_last, b_out)

    # Alpha: below p20 = 0, p20–p40 = fade in, above p40 = 255
    a_out = np.where(tri_data <= 0, 0, a_out)
    a_out = np.where(tri_data > 0, np.where(tri_data < p20, 0, a_out), a_out)
    a_out = np.where(
        (tri_data >= p20) & (tri_data < p40),
        np.clip((tri_data - p20) / (p40 - p20 + 1e-6) * 255, 0, 255).astype(np.uint8),
        a_out)
    a_out = np.where(tri_data >= p40, 255, a_out)
    a_out = a_out.astype(np.uint8)

    with rasterio.open(
        output_path, 'w', driver='GTiff',
        height=tri_data.shape[0],
        width=tri_data.shape[1],
        count=4,
        dtype=np.uint8,
        crs=crs,
        transform=transform,
        compress='lzw',
    ) as dst:
        dst.write(r_out, 1)
        dst.write(g_out, 2)
        dst.write(b_out, 3)
        dst.write(a_out, 4)
    print(f"  Exported RGBA TRI: {output_path}")


def process(west, south, east, north, name,
            dangerous_aspects=None, danger_level=2):
    safe_name = name.lower().replace(' ', '_')
    print(f"\n{'='*50}")
    print(f"Processing: {name}")
    print(f"Bbox: {west},{south},{east},{north}")
    print(f"{'='*50}")

    dem_path, width, height = download_dem(
        west, south, east, north, name)

    with rasterio.open(dem_path) as src:
        dem = src.read(1).astype(np.float64)
        transform = src.transform
        crs = src.crs
        if width is None:
            height, width = dem.shape

    print(f"  DEM: {dem.shape}, "
          f"elev {dem.min():.0f}-{dem.max():.0f}m")

    slope = compute_slope(dem, transform)
    aspect = compute_aspect(dem, transform)
    tri = compute_tri(dem.astype(np.float32))
    composite = compute_composite_risk(
        slope, aspect, tri, dem.astype(np.float32),
        dangerous_aspects=dangerous_aspects,
        danger_level=danger_level)

    print("Exporting GeoTIFFs...")
    for data, suffix in [
        (slope,     f'slope_{safe_name}.tif'),
        (aspect,    f'aspect_{safe_name}.tif'),
        (tri,       f'tri_{safe_name}.tif'),
        (composite, f'composite_{safe_name}.tif'),
    ]:
        export_geotiff(data, transform, crs,
                       os.path.join(OUTPUT_DIR, suffix))

    # Export 8-bit versions for Mapbox upload
    print("Exporting 8-bit GeoTIFFs for Mapbox...")

    # Slope: 0-60 degrees is the meaningful range
    export_8bit(slope, transform, crs,
        os.path.join(OUTPUT_DIR, f'slope_{safe_name}_8bit.tif'),
        data_min=0, data_max=60)

    # Aspect: 0-360 degrees
    export_8bit(aspect, transform, crs,
        os.path.join(OUTPUT_DIR, f'aspect_{safe_name}_8bit.tif'),
        data_min=0, data_max=360)

    # TRI: use percentile range
    export_8bit(tri, transform, crs,
        os.path.join(OUTPUT_DIR, f'tri_{safe_name}_8bit.tif'))

    # Composite: 0-100 score
    export_8bit(composite, transform, crs,
        os.path.join(OUTPUT_DIR, f'composite_{safe_name}_8bit.tif'),
        data_min=0, data_max=100)

    # Export RGB colorized for Mapbox (no client-side color expression)
    print("Exporting RGB colorized GeoTIFFs for Mapbox...")
    export_rgba_slope(slope, SLOPE_COLORMAP, transform, crs,
        os.path.join(OUTPUT_DIR, f'slope_{safe_name}_rgb.tif'))
    export_rgb_colorized(aspect, ASPECT_COLORMAP, transform, crs,
        os.path.join(OUTPUT_DIR, f'aspect_{safe_name}_rgb.tif'),
        data_min=0, data_max=360)
    print("Exporting aspect direction masks...")
    for dir_key, ranges in ASPECT_DIRECTIONS.items():
        export_aspect_mask(
            aspect, dir_key, ranges, transform, crs,
            os.path.join(OUTPUT_DIR,
                f'aspect_{dir_key.lower()}_california_rgb.tif'))
    export_rgba_tri(tri.astype(np.float64), TRI_COLORMAP, transform, crs,
        os.path.join(OUTPUT_DIR, f'tri_{safe_name}_rgb.tif'))
    export_rgb_colorized(composite.astype(np.float64), COMPOSITE_COLORMAP,
        transform, crs,
        os.path.join(OUTPUT_DIR, f'composite_{safe_name}_rgb.tif'),
        data_min=0, data_max=100)

    stats = {
        'region': safe_name,
        'name': name,
        'bbox': [west, south, east, north],
        'shape': list(dem.shape),
        'elevation': {
            'min': float(dem.min()),
            'max': float(dem.max()),
            'mean': float(dem.mean()),
        },
        'slope': {
            'mean': float(slope.mean()),
            'pct_above_25': float((slope>25).sum()/slope.size*100),
            'pct_above_30': float((slope>30).sum()/slope.size*100),
            'pct_above_35': float((slope>35).sum()/slope.size*100),
            'pct_above_45': float((slope>45).sum()/slope.size*100),
        },
        'layers': {
            'dem':       f'dem_{safe_name}.tif',
            'slope':     f'slope_{safe_name}.tif',
            'aspect':    f'aspect_{safe_name}.tif',
            'tri':       f'tri_{safe_name}.tif',
            'composite': f'composite_{safe_name}.tif',
        }
    }

    stats_path = os.path.join(OUTPUT_DIR, f'stats_{safe_name}.json')
    with open(stats_path, 'w') as f:
        json.dump(stats, f, indent=2)

    print(f"\nSummary for {name}:")
    print(f"  {stats['slope']['pct_above_25']:.1f}% above 25° (watch)")
    print(f"  {stats['slope']['pct_above_30']:.1f}% above 30° (avalanche terrain)")
    print(f"  {stats['slope']['pct_above_35']:.1f}% above 35° (high consequence)")
    print(f"  {stats['slope']['pct_above_45']:.1f}% above 45° (extreme)")

    return stats

if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description='CalPow DEM Analysis Pipeline')
    parser.add_argument('--bbox', nargs=4, type=float,
        metavar=('WEST','SOUTH','EAST','NORTH'),
        help='Bounding box in WGS84')
    parser.add_argument('--name', type=str,
        help='Region name (used for output filenames)')
    parser.add_argument('--aspects', nargs='+',
        default=['N','NE','NW'],
        help='Dangerous aspects from forecast')
    parser.add_argument('--danger', type=int, default=2,
        help='Danger level 1-5')
    parser.add_argument('--preset', type=str,
        choices=['shasta','tahoe','bridgeport','eastern_sierra','california'],
        help='Use a preset region')
    args = parser.parse_args()

    PRESETS = {
        'shasta':         (-122.35, 41.25, -121.95, 41.55, 'Mount Shasta'),
        'tahoe':          (-120.35, 38.85, -119.85, 39.35, 'Lake Tahoe'),
        'bridgeport':     (-119.45, 38.15, -119.10, 38.45, 'Bridgeport'),
        'eastern_sierra': (-119.05, 37.45, -118.65, 37.85, 'Eastern Sierra'),
        'california':     (-122.35, 36.42, -118.09, 41.50, 'California'),
    }

    if args.preset:
        w, s, e, n, name = PRESETS[args.preset]
    elif args.bbox and args.name:
        w, s, e, n = args.bbox
        name = args.name
    else:
        # Default: run all 4 CA regions
        print("No region specified — running all 4 CA preset regions\n")
        for key, (w, s, e, n, name) in PRESETS.items():
            process(w, s, e, n, name,
                    dangerous_aspects=args.aspects,
                    danger_level=args.danger)
        exit(0)

    process(w, s, e, n, name,
            dangerous_aspects=args.aspects,
            danger_level=args.danger)
