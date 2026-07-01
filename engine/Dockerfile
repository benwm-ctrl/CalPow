# CalPow terrain-physics routing engine
# osgeo/gdal base provides GDAL + libgdal without conda.

FROM ghcr.io/osgeo/gdal:ubuntu-small-3.9.0

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3-pip python3-venv python3-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Use a venv to avoid conflicts with the GDAL image's system Python packages
RUN python3 -m venv /venv
ENV PATH="/venv/bin:$PATH"

# Install dependencies inside the venv (clean slate — no system-package conflicts)
COPY requirements.txt .
RUN pip install --no-cache-dir \
    "rasterio>=1.4" \
    "numpy>=1.26,<2.0" \
    "scipy>=1.12" \
    "scikit-image>=0.22" \
    "shapely>=2.0" \
    "requests>=2.31" \
    "fastapi>=0.111" \
    "uvicorn[standard]>=0.29" \
    "pydantic>=2.7" \
    "tqdm>=4.66"

# Copy engine source (demo_data/ included — bundled synthetic tiles)
COPY . .

ENV PORT=8000
EXPOSE $PORT

CMD ["sh", "-c", "uvicorn api.app:app --host 0.0.0.0 --port ${PORT}"]
