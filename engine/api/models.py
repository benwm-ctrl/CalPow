"""
models.py — Pydantic request/response models for the CalPow routing API.

Design note (corpus §0.5):
  RouteRequest.forecast is the ONLY place Tier-B data enters the compute path.
  It is applied as a multiplicative scaler to the pre-loaded Tier-A cost surface
  at request time — it is never written back to the COG on disk.
"""

from typing import Optional
from pydantic import BaseModel, Field, field_validator


# ── Tier-B forecast input (optional) ─────────────────────────────────────────

class ForecastProblem(BaseModel):
    """
    One avalanche problem from the daily forecast rose.

    Maps to the AFP product JSON structure (corpus §7.1, Tier 2 endpoint).
    All fields are optional; omitted fields produce no cost adjustment.
    """
    problem_type: Optional[str] = Field(
        None,
        description="e.g. 'wind_slab', 'storm_slab', 'persistent_slab', 'wet_slab'"
    )
    # Aspect flags: True = this problem is active on that aspect
    aspects: Optional[list[str]] = Field(
        None,
        description="Active aspects, e.g. ['N', 'NE', 'E', 'W'] (8-point compass)"
    )
    # Elevation bands: True = active at that band
    elevation_bands: Optional[list[str]] = Field(
        None,
        description="Active elevation bands: 'below_treeline', 'near_treeline', 'above_treeline'"
    )
    likelihood: Optional[str] = Field(
        None,
        description="'unlikely', 'possible', 'likely', 'very_likely', 'almost_certain'"
    )
    size_min: Optional[int] = Field(None, ge=1, le=5, description="Min destructive size (D-scale)")
    size_max: Optional[int] = Field(None, ge=1, le=5, description="Max destructive size (D-scale)")


class ForecastContext(BaseModel):
    """
    Tier-B live forecast snapshot for a single zone.

    danger_level uses the NAADS 5-point scale (1=Low → 5=Extreme).
    problems is the list of current avalanche problems from the AFP problem rose.
    """
    zone_id: int = Field(..., description="AFP zone feature ID (numeric)")
    danger_level: int = Field(..., ge=1, le=5, description="NAADS danger (1–5)")
    danger_above_treeline: Optional[int] = Field(None, ge=1, le=5)
    danger_near_treeline: Optional[int] = Field(None, ge=1, le=5)
    danger_below_treeline: Optional[int] = Field(None, ge=1, le=5)
    problems: list[ForecastProblem] = Field(
        default_factory=list,
        description="Active avalanche problems from the forecast rose"
    )


# ── Route request ─────────────────────────────────────────────────────────────

class RouteRequest(BaseModel):
    """
    Request body for POST /route.

    start and end are [longitude, latitude] in WGS84 (GeoJSON convention).
    forecast is optional; when omitted the API returns the static Tier-A route.
    When provided it applies Tier-B scaling on the static cost surface.
    """
    start: list[float] = Field(
        ..., min_length=2, max_length=2,
        description="[longitude, latitude] WGS84"
    )
    end: list[float] = Field(
        ..., min_length=2, max_length=2,
        description="[longitude, latitude] WGS84"
    )
    forecast: Optional[ForecastContext] = Field(
        None,
        description="Live forecast context for Tier-B hazard scaling. "
                    "If omitted, routing uses static Tier-A terrain cost only."
    )
    wind_azimuth: float = Field(
        315.0, ge=0.0, lt=360.0,
        description="Prevailing wind direction (degrees from N) for Sx selection. "
                    "Used to pick the closest precomputed Sx tile."
    )

    @field_validator("start", "end")
    @classmethod
    def validate_lonlat(cls, v: list[float]) -> list[float]:
        lon, lat = v
        if not (-180 <= lon <= 180):
            raise ValueError(f"Longitude {lon} out of range [-180, 180]")
        if not (-90 <= lat <= 90):
            raise ValueError(f"Latitude {lat} out of range [-90, 90]")
        return v


# ── Route response ────────────────────────────────────────────────────────────

class SegmentStat(BaseModel):
    """Terrain statistics for one route segment (~10 cells)."""
    slope_deg: float
    pra_membership: float
    z_delta_m: float
    cell_counts: float
    mean_cost: float


class RouteResponse(BaseModel):
    """
    Response from POST /route.

    geometry is a GeoJSON LineString feature.
    segment_stats gives per-segment hazard breakdown for the UI "why" panel.
    disclaimer is always included and must be displayed to the user.
    """
    geometry: dict = Field(..., description="GeoJSON LineString feature")
    total_cost: float
    n_cells: int
    segment_stats: list[SegmentStat]
    forecast_applied: bool = Field(
        False,
        description="True if Tier-B forecast scaling was applied"
    )
    disclaimer: str = Field(
        default=(
            "This route is a terrain-physics planning aid based on precomputed "
            "static terrain layers and (when provided) the most recent daily "
            "avalanche forecast. It is NOT a real-time safety assessment. "
            "Conditions change rapidly. Always check the current forecast at "
            "avalanche.org, carry proper rescue equipment, travel with trained "
            "partners, and apply your own judgment in the field. "
            "This tool does not replace AIARE training or professional guidance."
        )
    )
