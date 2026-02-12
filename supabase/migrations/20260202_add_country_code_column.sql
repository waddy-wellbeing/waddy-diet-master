-- Migration: Add country_code column to profiles table
-- Purpose: Store ISO country code separately for proper uniqueness constraint
-- Date: 2026-02-02

-- Add country_code column to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS country_code VARCHAR(2);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS profiles_country_code_idx 
ON profiles(country_code) 
WHERE country_code IS NOT NULL;

-- Add documentation
COMMENT ON COLUMN profiles.country_code IS 'ISO 3166-1 alpha-2 country code (e.g., EG, SA, AE). Used for mobile number uniqueness per country.';
