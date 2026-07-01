"""
live_data.py — Tier-B live data auto-fetch for the /route/auto endpoint.

Fetches two things at request time and combines them into a ForecastContext:

  1. Current wind (Open-Meteo) — direction + speed at a point.
     Used to select the nearest precomputed Sx tile and to annotate the
     response ("loading NE-E faces at 35 mph").

  2. Avalanche danger + problem rose (AFP Tier-1 / Tier-2) — for the zone
     that contains the midpoint of the requested route.

Both are Tier-B (dynamic, fetched at request time, never written to disk).
Wind is used for Sx tile selection; danger + problems are used for the cost
scaler in apply_forecast_scaling().

Architecture note (corpus §0.5):
  These fetches happen inside the request handler, operate on in-memory
  arrays, and are discarded after the response. Nothing here touches or
  modifies the COG tiles on disk.

Open-Meteo API (corpus §7.2):
  No key required. Hourly wind fields from GFS/HRRR-derived model.
  Endpoint: https://api.open-meteo.com/v1/forecast
  Parameters: latitude, longitude, hourly=windspeed_10m,winddirection_10m
              current=windspeed_10m,winddirection_10m

AFP Tier-1 (corpus §7.1):
  Documented endpoint, returns danger per zone.
  https://api.avalanche.org/v2/public/products/map-layer
"""

from __future__ import annotations

import math
from typing import Optional

import requests

from .models import ForecastContext, ForecastProblem
from .forecast import (
    AFP_MAP_LAYER, AFP_PRODUCT,
    fetch_forecast, _parse_product,
    CA_CENTERS,
)

_TIMEOUT = 8  # seconds


# ── Wind ──────────────────────────────────────────────────────────────────────

class WindObservation:
    """Current wind at a point, from Open-Meteo."""
    def __init__(self, direction_deg: float, speed_ms: float):
        self.direction_deg = direction_deg   # degrees from N (meteorological: FROM)
        self.speed_ms      = speed_ms        # m/s at 10 m
        self.speed_mph     = speed_ms * 2.237

    def __repr__(self):
        return (f"Wind({self.direction_deg:.0f}° @ "
                f"{self.speed_ms:.1f} m/s / {self.speed_mph:.0f} mph)")


def fetch_wind(lat: float, lon: float) -> Optional[WindObservation]:
    """
    Fetch current surface wind from Open-Meteo.

    Returns None on network error (caller should fall back to config default).
    """
    try:
        r = requests.get(
            "https://api.open-meteo.com/v1/forecast",
            params={
                "latitude":  lat,
                "longitude": lon,
                "current":   "windspeed_10m,winddirection_10m",
                "wind_speed_unit": "ms",
                "forecast_days": 1,
            },
            timeout=_TIMEOUT,
        )
        r.raise_for_status()
        data    = r.json()
        current = data.get("current", {})
        speed   = current.get("windspeed_10m")
        dirn    = current.get("winddirection_10m")
        if speed is None or dirn is None:
            return None
        return WindObservation(direction_deg=float(dirn), speed_ms=float(speed))
    except Exception as exc:
        print(f"[live_data] Open-Meteo fetch failed: {exc}")
        return None


# ── AFP zone lookup ───────────────────────────────────────────────────────────

def find_zone_for_point(lat: float, lon: float) -> Optional[dict]:
    """
    Find the AFP forecast zone containing a lat/lon point.

    Iterates the Tier-1 map-layer features and does a simple bounding-box
    check (sufficient for the CA zones which don't overlap). Returns the
    feature dict or None if no zone found or network is unavailable.

    ⚠ The Tier-1 endpoint returns one entry per zone with center_id, zone_id,
    danger_level, and a bounding polygon. Full geometry is in the GeoJSON
    properties — we use the bbox for speed.
    """
    try:
        r = requests.get(AFP_MAP_LAYER, timeout=_TIMEOUT)
        r.raise_for_status()
        features = r.json().get("features", [])
    except Exception as exc:
        print(f"[live_data] AFP map-layer fetch failed: {exc}")
        return None

    best = None
    for feat in features:
        props = feat.get("properties", {})
        geom  = feat.get("geometry", {})

        # Quick state filter: only CA zones
        state = str(props.get("state", "")).upper()
        if state not in ("CA", "NV"):  # ESAC straddles CA/NV
            continue

        # Bounding-box check using feature geometry coordinates
        coords = _flatten_coords(geom)
        if not coords:
            continue
        lons = [c[0] for c in coords]
        lats = [c[1] for c in coords]
        if min(lons) <= lon <= max(lons) and min(lats) <= lat <= max(lats):
            best = feat
            break

    return best


def _flatten_coords(geom: dict) -> list:
    """Recursively flatten a GeoJSON geometry's coordinate list."""
    t = geom.get("type", "")
    c = geom.get("coordinates", [])
    if t == "Point":
        return [c]
    if t in ("MultiPoint", "LineString"):
        return c
    if t in ("Polygon", "MultiLineString"):
        return [pt for ring in c for pt in ring]
    if t == "MultiPolygon":
        return [pt for poly in c for ring in poly for pt in ring]
    return []


# ── Full auto-fetch ───────────────────────────────────────────────────────────

class LiveContext:
    """
    Everything fetched from live sources for one route request.
    All Tier-B — discarded after the response.
    """
    def __init__(
        self,
        wind:              Optional[WindObservation],
        forecast:          Optional[ForecastContext],
        zone_name:         Optional[str],
        center_id:         Optional[str],
        sx_azimuth_used:   float,
        open_meteo_ok:     bool,
        afp_ok:            bool,
        warnings:          list[str],
    ):
        self.wind            = wind
        self.forecast        = forecast
        self.zone_name       = zone_name
        self.center_id       = center_id
        self.sx_azimuth_used = sx_azimuth_used
        self.open_meteo_ok   = open_meteo_ok
        self.afp_ok          = afp_ok
        self.warnings        = warnings

    def summary(self) -> dict:
        return {
            "wind": {
                "direction_deg": self.wind.direction_deg if self.wind else None,
                "speed_ms":      self.wind.speed_ms      if self.wind else None,
                "speed_mph":     round(self.wind.speed_mph, 1) if self.wind else None,
            },
            "sx_azimuth_used": self.sx_azimuth_used,
            "zone_name":   self.zone_name,
            "center_id":   self.center_id,
            "danger_level": self.forecast.danger_level if self.forecast else None,
            "n_problems":   len(self.forecast.problems) if self.forecast else 0,
            "open_meteo_ok": self.open_meteo_ok,
            "afp_ok":        self.afp_ok,
            "warnings":      self.warnings,
        }


def fetch_live_context(
    lat: float,
    lon: float,
    available_sx_azimuths: list[int],
    default_wind_az: float = 315.0,
) -> LiveContext:
    """
    Fetch all Tier-B live context for a route midpoint.

    Parameters
    ----------
    lat, lon               : midpoint of the requested route (WGS84)
    available_sx_azimuths  : list of precomputed Sx wind azimuths (from TILES.sx)
    default_wind_az        : fallback if Open-Meteo is unavailable

    Returns
    -------
    LiveContext — always returns something (degrades gracefully if APIs fail).
    """
    warnings = []

    # ── 1. Wind ───────────────────────────────────────────────────────────────
    wind = fetch_wind(lat, lon)
    open_meteo_ok = wind is not None
    if not open_meteo_ok:
        warnings.append(
            f"Open-Meteo unavailable — using default wind azimuth {default_wind_az}°"
        )

    wind_az = wind.direction_deg if wind else default_wind_az

    # Select nearest precomputed Sx azimuth
    sx_az = _nearest_azimuth(wind_az, available_sx_azimuths) if available_sx_azimuths else wind_az
    if available_sx_azimuths and abs(_az_diff(wind_az, sx_az)) > 45:
        warnings.append(
            f"Current wind {wind_az:.0f}° — nearest Sx tile is {sx_az}° "
            f"(>{abs(_az_diff(wind_az, sx_az)):.0f}° off). "
            f"Recompute Sx tiles for better accuracy: run_pipeline.py --wind-az {wind_az:.0f}"
        )

    # ── 2. AFP zone + forecast ────────────────────────────────────────────────
    zone_feat  = find_zone_for_point(lat, lon)
    afp_ok     = zone_feat is not None
    zone_name  = None
    center_id  = None
    forecast   = None

    if zone_feat:
        props     = zone_feat.get("properties", {})
        zone_name = props.get("name") or props.get("zone_name")
        center_id = props.get("center_id")
        zone_id   = props.get("id") or props.get("zone_id")

        if center_id and zone_id:
            try:
                zone_id_int = int(zone_id)
                forecast = fetch_forecast(center_id=center_id, zone_id=zone_id_int)
            except (ValueError, TypeError):
                warnings.append(f"zone_id '{zone_id}' is not numeric — cannot fetch full forecast.")
                afp_ok = False

        if forecast is None:
            # Fall back to Tier-1 danger level with no problem detail
            danger = props.get("danger_level") or props.get("rating")
            if danger:
                try:
                    forecast = ForecastContext(
                        zone_id=int(zone_id) if zone_id else 0,
                        danger_level=max(1, min(5, int(danger))),
                        problems=[],
                    )
                    warnings.append(
                        "Using Tier-1 danger level only (no problem rose) — "
                        "aspect/elevation cost scaling will not be applied."
                    )
                except (ValueError, TypeError):
                    pass
    else:
        warnings.append(
            "No AFP zone found for this location. "
            "Check that the route midpoint is within a CA forecast zone. "
            "Routing will use static Tier-A terrain cost only."
        )
        afp_ok = False

    return LiveContext(
        wind=wind,
        forecast=forecast,
        zone_name=zone_name,
        center_id=center_id,
        sx_azimuth_used=sx_az,
        open_meteo_ok=open_meteo_ok,
        afp_ok=afp_ok,
        warnings=warnings,
    )


# ── Azimuth helpers ───────────────────────────────────────────────────────────

def _az_diff(a: float, b: float) -> float:
    """Signed angular difference a − b, in (−180, 180]."""
    d = (a - b) % 360
    return d - 360 if d > 180 else d


def _nearest_azimuth(target: float, available: list[int]) -> int:
    """Return the azimuth in available closest to target (circular)."""
    return min(available, key=lambda az: abs(_az_diff(target, az)))
