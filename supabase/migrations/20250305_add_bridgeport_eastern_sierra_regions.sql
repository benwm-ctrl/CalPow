-- Add bridgeport and eastern_sierra to region CHECK constraints.
-- Run this in the Supabase SQL Editor if you already have routes/avalanche_forecasts tables.

ALTER TABLE routes DROP CONSTRAINT IF EXISTS routes_region_check;
ALTER TABLE routes ADD CONSTRAINT routes_region_check
  CHECK (region IN ('sierra','shasta','bridgeport','eastern_sierra'));

ALTER TABLE avalanche_forecasts DROP CONSTRAINT IF EXISTS avalanche_forecasts_region_check;
ALTER TABLE avalanche_forecasts ADD CONSTRAINT avalanche_forecasts_region_check
  CHECK (region IN ('sierra','shasta','bridgeport','eastern_sierra'));

-- If profiles has a home_region check:
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_home_region_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_home_region_check
  CHECK (home_region IN ('sierra','shasta','bridgeport','eastern_sierra'));
