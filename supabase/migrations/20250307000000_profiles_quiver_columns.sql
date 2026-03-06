-- Quiver and ski photo columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ski_model text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ski_year integer;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS binding_model text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS binding_year integer;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ski_photo_url text;
