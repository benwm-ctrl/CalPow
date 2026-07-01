"""
CalPow Engine — central configuration.

All physical parameters reference the corpus (CALPOW_CORPUS.md).
Change values here for calibration experiments; do not hardcode in pipeline modules.
"""

from pathlib import Path

# ── Paths ───────────────────────────────────────────────────────────────────
ROOT = Path(__file__).parent
DATA_DIR = ROOT / "data"
OUTPUT_DIR = ROOT / "outputs"
DATA_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

# ── Test area: Carson Pass / Red Lake Peak, Sierra Nevada ───────────────────
# Site of the original Algorithmic Alpinism field test.
# WGS84 (lon_min, lat_min, lon_max, lat_max)
TEST_BBOX = (-119.95, 38.65, -119.82, 38.76)

# DEM resolution to request (metres). 10 m is the sweet spot per corpus §1.
DEM_RESOLUTION = 10

# ── PRA (Veitinger 2016) ─────────────────────────────────────────────────────
# Generalised bell membership function params per input variable.
# ⚠ THESE ARE FROM SECONDARY LITERATURE (Swiss Alps calibration).
# Read from primary paper (DOI 10.5194/nhess-16-2211-2016) before
# treating as authoritative for Sierra Nevada.
PRA = {
    # slope membership: peak ~38°, low below ~30°, low above ~55°
    "slope_a": 10.0,   # controls width (degrees)
    "slope_b": 4,      # controls steepness of the bell
    "slope_c": 38.0,   # centre (degrees) — peak release probability
    # roughness membership: high roughness = low PRA (anchoring)
    # expressed as TRI-equivalent (metres); higher TRI → lower membership
    "rough_a": 0.5,
    "rough_b": 2,
    "rough_c": 0.0,
    # combined membership threshold below which cells are excluded from PRA
    "min_membership": 0.1,
    # hard slope limits (degrees) — cells outside are always excluded
    "slope_min": 28.0,
    "slope_max": 60.0,
}

# ── Flow-Py (D'Amboise et al. 2022) ─────────────────────────────────────────
# Implements Holmgren (1994) routing + z_δ stopping.
# ⚠ alpha=25° is the AvaFrame default, calibrated on Alpine paths.
# Recalibrate against Sierra Nevada historical runout before safety use.
FLOWPY = {
    "alpha": 25.0,   # stopping angle (degrees) — calibrate for CA
    "exp": 8,        # Holmgren divergence exponent (8 = avalanche default)
    "min_flux": 1e-4,  # prune paths below this flux fraction
}

# ── Winstral Sx (Winstral & Marks 2002) ─────────────────────────────────────
# ⚠ dmax=300m is the Reynolds Mountain East (Idaho) site default.
# Calibrate against observed wind-loading patterns for the Sierra.
SX = {
    "dmax": 300.0,          # max upwind search distance (metres)
    "az_window": 25.0,      # ± degrees around prevailing wind for mean Sx
    "az_step": 5.0,         # azimuth step for sector averaging
}

# ── Cost surface weights ─────────────────────────────────────────────────────
# Hazard layer weights — initial AHP-informed values, needs expert calibration.
# All weights sum to 1.0 within the hazard term.
# Effort (slope traversal) vs hazard ratio controls overall path tendency.
COST = {
    "effort_weight": 0.3,   # fraction of total cost from slope/effort
    "hazard_weight": 0.7,   # fraction from hazard layers
    # within hazard term (must sum to 1.0):
    "w_pra": 0.30,          # PRA membership
    "w_zdelta": 0.30,       # Flow-Py z_δ (overhead intensity)
    "w_cell_counts": 0.20,  # Flow-Py cell_counts (overhead exposure)
    "w_sx": 0.20,           # Winstral Sx (wind loading)
    # slope traversal cost form: quadratic per Rees (2004)
    # cost = 1 + slope_k * (slope_deg ** 2)
    "slope_k": 0.002,
    # penalty multiplier applied when forecast danger is Considerable+
    # (Tier-B live coupling: scaled at request time, not baked into COG)
    "danger_multiplier": 2.0,
}

# ── Solar (pvlib + WhiteboxTools) ────────────────────────────────────────────
SOLAR = {
    # timezone for the test area
    "tz": "America/Los_Angeles",
    # hours at which to compute insolation (local time)
    "hours": [9, 11, 13, 15],
}
