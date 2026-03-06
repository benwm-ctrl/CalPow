-- Skier profile fields for CalPow
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS home_mountain text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS years_backcountry integer;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS skis text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bindings text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS beacon text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ability_level text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS favorite_zone text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS touring_style text[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS aiare_level text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS aiare_year integer;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS wfa_certified boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avy_experience_years integer;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sponsor_me text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS favorite_route_id uuid REFERENCES routes(id);
