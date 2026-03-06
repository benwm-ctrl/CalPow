-- Add columns for full forecast cache (travel_advice, forecast_url, zones)
ALTER TABLE avalanche_forecasts
  ADD COLUMN IF NOT EXISTS travel_advice text,
  ADD COLUMN IF NOT EXISTS forecast_url text,
  ADD COLUMN IF NOT EXISTS zones jsonb;

-- Unique constraint for cache upsert (region + date)
ALTER TABLE avalanche_forecasts
  DROP CONSTRAINT IF EXISTS unique_region_date;

ALTER TABLE avalanche_forecasts
  ADD CONSTRAINT unique_region_date UNIQUE (region, forecast_date);

-- Allow insert/update for caching (anon can write this table for cache)
DROP POLICY IF EXISTS "Anyone can read forecasts" ON avalanche_forecasts;
CREATE POLICY "Anyone can read forecasts" ON avalanche_forecasts FOR SELECT USING (true);
CREATE POLICY "Anyone can insert forecasts" ON avalanche_forecasts FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update forecasts" ON avalanche_forecasts FOR UPDATE USING (true);
