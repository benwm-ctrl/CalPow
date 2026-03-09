#!/usr/bin/env python3
import os, json, time, requests
from pathlib import Path

def load_env():
    env_path = Path(__file__).parent.parent / '.env'
    tokens = {}
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if '=' in line and not line.startswith('#'):
                key, val = line.split('=', 1)
                tokens[key.strip()] = val.strip()
    return tokens

env = load_env()
MAPBOX_TOKEN = env.get('VITE_MAPBOX_UPLOAD_TOKEN', '')
MAPBOX_USERNAME = env.get('VITE_MAPBOX_USERNAME', 'benwm')
OUTPUT_DIR = Path(__file__).parent / 'output'
TILESETS_FILE = OUTPUT_DIR / 'tilesets.json'

if not MAPBOX_TOKEN:
    print("ERROR: VITE_MAPBOX_UPLOAD_TOKEN not found in .env")
    exit(1)

tilesets = json.loads(TILESETS_FILE.read_text()) \
    if TILESETS_FILE.exists() else {}

LAYERS = [
    ('slope',     'CalPow Slope Angle'),
    ('aspect',    'CalPow Aspect'),
    ('tri',       'CalPow Terrain Ruggedness'),
    ('composite', 'CalPow Composite Risk'),
]
REGIONS = [
    'mount_shasta', 'lake_tahoe',
    'bridgeport', 'eastern_sierra',
]

def get_credentials():
    r = requests.post(
        f"https://api.mapbox.com/uploads/v1/{MAPBOX_USERNAME}/credentials",
        params={'access_token': MAPBOX_TOKEN})
    r.raise_for_status()
    return r.json()

def upload_s3(filepath, creds):
    import boto3
    from botocore.config import Config
    s3 = boto3.client(
        's3',
        aws_access_key_id=creds['accessKeyId'],
        aws_secret_access_key=creds['secretAccessKey'],
        aws_session_token=creds['sessionToken'],
        region_name='us-east-1',
        config=Config(signature_version='s3v4'))
    print(f"    Uploading to S3...")
    s3.upload_file(str(filepath), creds['bucket'], creds['key'],
        ExtraArgs={'ContentType': 'image/tiff'})
    return f"https://{creds['bucket']}.s3.amazonaws.com/{creds['key']}"

def create_upload(url, tileset_id, name):
    r = requests.post(
        f"https://api.mapbox.com/uploads/v1/{MAPBOX_USERNAME}",
        json={'url': url, 'tileset': tileset_id, 'name': name},
        params={'access_token': MAPBOX_TOKEN})
    r.raise_for_status()
    return r.json()

def poll(upload_id, timeout=600):
    start = time.time()
    while time.time() - start < timeout:
        time.sleep(15)
        r = requests.get(
            f"https://api.mapbox.com/uploads/v1/{MAPBOX_USERNAME}/{upload_id}",
            params={'access_token': MAPBOX_TOKEN})
        if r.status_code == 404:
            print(f"    Waiting for upload to register...")
            continue
        r.raise_for_status()
        d = r.json()
        if d.get('error'): raise Exception(d['error'])
        if d.get('complete'): return d
        print(f"    {d.get('progress',0)*100:.0f}%...")
    raise Exception("Timed out")


def upload_layer(region, layer_key, layer_name):
    filepath = OUTPUT_DIR / f'{layer_key}_{region}_rgb.tif'
    if not filepath.exists():
        print(f"  Skipping {filepath.name} (not found)")
        return

    cache_key = f"{layer_key}_{region}"
    if cache_key in tilesets:
        print(f"  Already uploaded: {cache_key}")
        return

    # Mapbox tileset ID rules:
    # - format: username.tileset_name
    # - tileset_name: lowercase, numbers, underscores only
    # - use _r suffix for RGB tilesets
    region_short = region[:6].replace('-', '_')
    layer_short = layer_key[:5]
    tileset_name = f"calpow_{layer_short}_{region_short}_r"
    tileset_id = f"{MAPBOX_USERNAME}.{tileset_name}"

    size_mb = filepath.stat().st_size // 1024 // 1024
    print(f"  {filepath.name} ({size_mb}MB) → {tileset_id}")

    creds = get_credentials()
    s3_url = upload_s3(filepath, creds)
    try:
        upload = create_upload(s3_url, tileset_id,
                               f"{layer_name} {region}")
    except requests.exceptions.HTTPError as e:
        print(f"    Create upload failed: {e}")
        print(f"    Response: {e.response.text}")
        return
    print(f"    Upload ID: {upload['id']}, polling...")
    poll(upload['id'])

    tilesets[cache_key] = {
        'tileset_id': tileset_id,
        'region': region,
        'layer': layer_key,
    }
    TILESETS_FILE.write_text(json.dumps(tilesets, indent=2))
    print(f"    ✅ Done: {tileset_id}")

if __name__ == '__main__':
    print(f"CalPow Mapbox Upload — user: {MAPBOX_USERNAME}")
    print(f"{len(REGIONS)} regions x {len(LAYERS)} layers = "
          f"{len(REGIONS)*len(LAYERS)} tilesets\n")

    for region in REGIONS:
        print(f"\nRegion: {region}")
        for layer_key, layer_name in LAYERS:
            upload_layer(region, layer_key, layer_name)

    print("\n✅ All uploads complete!")
    print(f"Tileset config: {TILESETS_FILE}")
