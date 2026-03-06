-- CalPow Supabase schema
-- Run this in the SQL Editor in your Supabase project dashboard (or via supabase db push)

-- 1. profiles (extends auth.users)
CREATE TABLE profiles (
  id uuid REFERENCES auth.users(id) PRIMARY KEY,
  username text,
  full_name text,
  avatar_url text,
  home_region text CHECK (home_region IN ('sierra', 'shasta', 'bridgeport', 'eastern_sierra')),
  created_at timestamptz DEFAULT now()
);

-- 2. routes
CREATE TABLE routes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  region text CHECK (region IN ('sierra', 'shasta', 'bridgeport', 'eastern_sierra')),
  location_label text,
  date_toured date,
  gpx_url text,
  gpx_data jsonb,
  distance_km numeric,
  elevation_gain_m numeric,
  max_elevation_m numeric,
  difficulty_rating text CHECK (difficulty_rating IN ('beginner','intermediate','advanced','expert')),
  avalanche_risk text CHECK (avalanche_risk IN ('low','moderate','considerable','high','extreme')),
  danger_segments jsonb,
  notes text,
  is_public boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. route_images
CREATE TABLE route_images (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id uuid REFERENCES routes(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  image_url text,
  caption text,
  created_at timestamptz DEFAULT now()
);

-- 4. avalanche_forecasts
CREATE TABLE avalanche_forecasts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  region text CHECK (region IN ('sierra', 'shasta', 'bridgeport', 'eastern_sierra')),
  forecast_date date,
  danger_level integer CHECK (danger_level BETWEEN 1 AND 5),
  danger_label text,
  problem_types jsonb,
  dangerous_aspects jsonb,
  dangerous_elevations jsonb,
  raw_html text,
  fetched_at timestamptz DEFAULT now()
);

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own routes" ON routes FOR ALL USING (auth.uid() = user_id);

ALTER TABLE route_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own images" ON route_images FOR ALL USING (auth.uid() = user_id);

ALTER TABLE avalanche_forecasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read forecasts" ON avalanche_forecasts FOR SELECT USING (true);

-- Trigger: create profile when a new user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
