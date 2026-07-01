"""
forecast.py — Tier-B live avalanche forecast coupling.

Fetches the current forecast from the AFP (avalanche.org v2 API) and
returns a ForecastContext suitable for passing to the routing endpoint.
Also provides the hazard cost scaler that the router applies to the
precomputed Tier-A cost surface at request time.

Architecture (corpus §0.5, §7.1):
  - Fetching and parsing = Tier B. Always at request time, never cached to COG.
  - The scaler modifies a copy of the in-memory cost array; it is discarded
    after each request. Nothing is written to disk.
  - Observations/photos are NOT used here — they belong in the display layer
    (corpus §7.1 "architecture rule: hard").

AFP endpoints used:
  Tier 1 (documented): https://api.avalanche.org/v2/public/products/map-layer
  Tier 2 (undocumented, stable): https://api.avalanche.org/v2/public/product?
                                   type=forecast&center_id={ID}&zone_id={ID}

CA center IDs (corpus §7.1):
  SAC  = sierra-avalanche-center
  MSAC = mt-shasta-avalanche-center
  BAC  = bridgeport-avalanche-center
  ESAC = eastern-sierra-avalanche-center
"""

from __future__ import annotations

import math
import re
import time
from typing import Optional

import numpy as np
import requests

from .models import ForecastContext, ForecastProblem


# ── AFP constants ─────────────────────────────────────────────────────────────

AFP_MAP_LAYER = "https://api.avalanche.org/v2/public/products/map-layer"
AFP_PRODUCT   = "https://api.avalanche.org/v2/public/product"

CA_CENTERS = {
    "SAC":  "sierra-avalanche-center",
    "MSAC": "mt-shasta-avalanche-center",
    "BAC":  "bridgeport-avalanche-center",
    "ESAC": "eastern-sierra-avalanche-center",
}

# Aspect name → median azimuth (degrees from N)
ASPECT_AZ = {
    "N": 0, "NE": 45, "E": 90, "SE": 135,
    "S": 180, "SW": 225, "W": 270, "NW": 315,
}

# NAADS danger → scalar multiplier on hazard cost
# Chosen so: Low → 0.5× (terrain physics still shows geometry),
#            Considerable → 1.5×, Extreme → 3× (nearly impassable on active aspects)
DANGER_MULTIPLIER = {1: 0.5, 2: 0.8, 3: 1.5, 4: 2.2, 5: 3.0}

# Likelihood → probability weight [0, 1]
LIKELIHOOD_WEIGHT = {
    "unlikely": 0.15,
    "possible": 0.40,
    "likely": 0.65,
    "very_likely": 0.85,
    "almost_certain": 1.0,
}

_REQUEST_TIMEOUT = 8   # seconds


# ── Public API ────────────────────────────────────────────────────────────────

def fetch_forecast(center_id: str, zone_id: int) -> Optional[ForecastContext]:
    """
    Fetch the current forecast for a single zone from the AFP.

    Parameters
    ----------
    center_id : AFP center slug (e.g. "sierra-avalanche-center")
    zone_id   : numeric feature ID for the zone (NOT a string slug)

    Returns
    -------
    ForecastContext or None if the forecast cannot be retrieved / is off-season.
    """
    try:
        url = AFP_PRODUCT
        params = {
            "type":      "forecast",
            "center_id": center_id,
            "zone_id":   zone_id,
        }
        r = requests.get(url, params=params, timeout=_REQUEST_TIMEOUT)
        r.raise_for_status()
        data = r.json()
        return _parse_product(data, zone_id)
    except Exception as exc:
        print(f"[forecast] Could not fetch AFP forecast: {exc}")
        return None


def fetch_map_layer_danger(center_id: Optional[str] = None) -> list[dict]:
    """
    Fetch the Tier-1 danger map layer (all zones or one center).

    Returns the raw feature list from the GeoJSON response.
    This is the documented endpoint — safe to call without worrying about
    undocumented schema changes.
    """
    try:
        url = AFP_MAP_LAYER
        if center_id:
            url += f"/{center_id}"
        r = requests.get(url, timeout=_REQUEST_TIMEOUT)
        r.raise_for_status()
        data = r.json()
        return data.get("features", [])
    except Exception as exc:
        print(f"[forecast] Could not fetch AFP map layer: {exc}")
        return []


def apply_forecast_scaling(
    cost: np.ndarray,
    aspect: np.ndarray,
    elevation: np.ndarray,
    ctx: ForecastContext,
    treeline_lo: float = 2440.0,   # ~8,000 ft — Sierra approximate
    treeline_hi: float = 3050.0,   # ~10,000 ft
) -> np.ndarray:
    """
    Apply Tier-B forecast scaling to the in-memory cost surface.

    This is called once per request; it operates on a copy of the precomputed
    Tier-A cost array and the result is discarded after the response is sent.
    It is NEVER written back to disk.

    Scaling logic:
      For each active problem in ctx.problems:
        1. Identify cells whose aspect falls within ±22.5° of any active aspect.
        2. Identify cells in the active elevation band(s).
        3. Scale hazard cost of matching cells by:
               danger_multiplier × likelihood_weight × (1 + (size_max - 1) / 4)
           where size_max encodes avalanche destructive size (D-scale 1-5).

    Parameters
    ----------
    cost       : (R, C) float64 array — Tier-A cost surface (modified copy)
    aspect     : (R, C) float64 array — aspect in degrees from N (0–360)
    elevation  : (R, C) float64 array — elevation in metres
    ctx        : ForecastContext from the request
    treeline_lo: lower treeline elevation (metres)
    treeline_hi: upper treeline elevation (metres)

    Returns
    -------
    Scaled cost array (same shape, same dtype).
    """
    cost = cost.copy()
    base_mult = DANGER_MULTIPLIER.get(ctx.danger_level, 1.0)

    for problem in ctx.problems:
        # Aspect mask: which cells match this problem's aspect list?
        aspect_mask = _aspect_mask(aspect, problem.aspects)

        # Elevation band mask
        elev_mask = _elevation_mask(elevation, problem.elevation_bands,
                                    treeline_lo, treeline_hi)

        # Combined mask
        active = aspect_mask & elev_mask & ~np.isnan(cost)
        if not active.any():
            continue

        # Likelihood and size scalers
        lh = LIKELIHOOD_WEIGHT.get(problem.likelihood or "possible", 0.4)
        d_max = problem.size_max or 2
        size_scaler = 1.0 + (d_max - 1) / 4.0   # 1.0 (D1) → 2.0 (D5)

        scaler = base_mult * lh * size_scaler
        cost[active] *= scaler

    return cost


# ── Parsing helpers ───────────────────────────────────────────────────────────

def _parse_product(data: dict, zone_id: int) -> Optional[ForecastContext]:
    """
    Parse an AFP product JSON into a ForecastContext.

    The AFP Tier-2 schema is undocumented and has changed before.  We parse
    defensively: any missing field silently defaults to None / empty list.
    """
    if not data:
        return None

    # Danger rating — may be a flat int or an elevation-banded dict
    danger = data.get("danger") or data.get("danger_rating") or {}
    if isinstance(danger, list) and danger:
        danger = danger[0]  # some products nest in a list
    if isinstance(danger, dict):
        overall = (
            danger.get("lower") or danger.get("middle") or
            danger.get("upper") or danger.get("danger_level") or 1
        )
        d_above = danger.get("upper") or danger.get("alp")
        d_near  = danger.get("middle") or danger.get("tln")
        d_below = danger.get("lower") or danger.get("btl")
    else:
        overall = int(danger or 1)
        d_above = d_near = d_below = None

    # Avalanche problems
    raw_problems = data.get("avalanche_problems") or data.get("problems") or []
    problems = [_parse_problem(p) for p in raw_problems]
    problems = [p for p in problems if p is not None]

    return ForecastContext(
        zone_id=zone_id,
        danger_level=max(1, min(5, int(overall))),
        danger_above_treeline=d_above,
        danger_near_treeline=d_near,
        danger_below_treeline=d_below,
        problems=problems,
    )


def _parse_problem(p: dict) -> Optional[ForecastProblem]:
    if not isinstance(p, dict):
        return None

    # Problem type — normalise to snake_case
    ptype = str(p.get("problem_type") or p.get("type") or "").lower()
    ptype = re.sub(r"[\s\-]+", "_", ptype) or None

    # Aspects — AFP usually sends a compass rose dict like {"N": true, "NE": false, ...}
    aspect_data = p.get("aspects") or p.get("aspect") or {}
    if isinstance(aspect_data, dict):
        aspects = [k for k, v in aspect_data.items() if v and k in ASPECT_AZ]
    elif isinstance(aspect_data, list):
        aspects = [a for a in aspect_data if a in ASPECT_AZ]
    else:
        aspects = []

    # Elevation bands
    elev_data = p.get("elevation") or p.get("elevations") or {}
    if isinstance(elev_data, dict):
        band_map = {
            "alp":           "above_treeline",
            "above":         "above_treeline",
            "above_treeline":"above_treeline",
            "tln":           "near_treeline",
            "near":          "near_treeline",
            "near_treeline": "near_treeline",
            "btl":           "below_treeline",
            "below":         "below_treeline",
            "below_treeline":"below_treeline",
        }
        bands = [band_map[k] for k, v in elev_data.items() if v and k in band_map]
    elif isinstance(elev_data, list):
        bands = elev_data
    else:
        bands = []

    likelihood = str(p.get("likelihood") or "").lower().replace(" ", "_") or None
    sz = p.get("size") or {}
    size_min = sz.get("min") if isinstance(sz, dict) else None
    size_max = sz.get("max") if isinstance(sz, dict) else None

    return ForecastProblem(
        problem_type=ptype,
        aspects=aspects or None,
        elevation_bands=bands or None,
        likelihood=likelihood,
        size_min=size_min,
        size_max=size_max,
    )


def _aspect_mask(aspect: np.ndarray, aspects: Optional[list[str]]) -> np.ndarray:
    """Return boolean mask of cells within ±22.5° of any active aspect."""
    if not aspects:
        return np.ones(aspect.shape, dtype=bool)
    mask = np.zeros(aspect.shape, dtype=bool)
    for name in aspects:
        az = ASPECT_AZ.get(name)
        if az is None:
            continue
        delta = np.abs((aspect - az + 180) % 360 - 180)
        mask |= delta <= 22.5
    return mask


def _elevation_mask(
    elevation: np.ndarray,
    bands: Optional[list[str]],
    lo: float,
    hi: float,
) -> np.ndarray:
    """Return boolean mask of cells in any active elevation band."""
    if not bands:
        return np.ones(elevation.shape, dtype=bool)
    mask = np.zeros(elevation.shape, dtype=bool)
    for band in bands:
        if band == "below_treeline":
            mask |= elevation < lo
        elif band == "near_treeline":
            mask |= (elevation >= lo) & (elevation < hi)
        elif band == "above_treeline":
            mask |= elevation >= hi
    return mask
