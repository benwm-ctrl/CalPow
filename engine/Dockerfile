# CalPow terrain-physics routing engine
# Uses osgeo/gdal base for rasterio/GDAL support without conda.
# GDAL image: https://github.com/OSGeo/gdal/pkgs/container/gdal

FROM ghcr.io/osgeo/gdal:ubuntu-small-3.9.0

# Python 3.11 is included in the GDAL ubuntu image
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3-pip python3-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies (rasterio uses system GDAL via the base image)
COPY requirements.txt .
RUN pip3 install --no-cache-dir --break-system-packages \
    rasterio>=1.4 \
    numpy>=1.26 \
    scipy>=1.12 \
    scikit-image>=0.22 \
    shapely>=2.0 \
    requests>=2.31 \
    fastapi>=0.111 \
    "uvicorn[standard]>=0.29" \
    pydantic>=2.7 \
    tqdm>=4.66

# Copy engine source (demo_data/ included — bundled synthetic tiles)
COPY . .

# Railway injects PORT; default 8000 for local dev
ENV PORT=8000

EXPOSE $PORT

# Run the FastAPI service
CMD ["sh", "-c", "uvicorn api.app:app --host 0.0.0.0 --port ${PORT}"]
