-- Migration: Fix existing mobile numbers and update uniqueness constraint
-- Purpose: Extract country codes from existing formatted phone numbers and update constraint
-- Date: 2026-02-02

-- Extract country code from existing mobile numbers and populate the country_code column
-- This handles common dial codes from the formatted phone numbers stored in the database
UPDATE profiles
SET country_code = CASE
  -- Middle East & Gulf Countries
  WHEN mobile LIKE '+20%' THEN 'EG'    -- Egypt
  WHEN mobile LIKE '+966%' THEN 'SA'   -- Saudi Arabia
  WHEN mobile LIKE '+971%' THEN 'AE'   -- UAE
  WHEN mobile LIKE '+965%' THEN 'KW'   -- Kuwait
  WHEN mobile LIKE '+968%' THEN 'OM'   -- Oman
  WHEN mobile LIKE '+973%' THEN 'BH'   -- Bahrain
  WHEN mobile LIKE '+974%' THEN 'QA'   -- Qatar
  WHEN mobile LIKE '+962%' THEN 'JO'   -- Jordan
  WHEN mobile LIKE '+961%' THEN 'LB'   -- Lebanon
  WHEN mobile LIKE '+963%' THEN 'SY'   -- Syria
  WHEN mobile LIKE '+964%' THEN 'IQ'   -- Iraq
  WHEN mobile LIKE '+967%' THEN 'YE'   -- Yemen
  WHEN mobile LIKE '+970%' THEN 'PS'   -- Palestine
  
  -- North Africa
  WHEN mobile LIKE '+212%' THEN 'MA'   -- Morocco
  WHEN mobile LIKE '+213%' THEN 'DZ'   -- Algeria
  WHEN mobile LIKE '+216%' THEN 'TN'   -- Tunisia
  WHEN mobile LIKE '+218%' THEN 'LY'   -- Libya
  WHEN mobile LIKE '+249%' THEN 'SD'   -- Sudan
  
  -- North America
  WHEN mobile LIKE '+1%' THEN 'US'     -- USA/Canada
  
  -- Europe
  WHEN mobile LIKE '+44%' THEN 'GB'    -- United Kingdom
  WHEN mobile LIKE '+33%' THEN 'FR'    -- France
  WHEN mobile LIKE '+49%' THEN 'DE'    -- Germany
  WHEN mobile LIKE '+39%' THEN 'IT'    -- Italy
  WHEN mobile LIKE '+34%' THEN 'ES'    -- Spain
  
  -- South Asia
  WHEN mobile LIKE '+91%' THEN 'IN'    -- India
  WHEN mobile LIKE '+92%' THEN 'PK'    -- Pakistan
  WHEN mobile LIKE '+880%' THEN 'BD'   -- Bangladesh
  WHEN mobile LIKE '+94%' THEN 'LK'    -- Sri Lanka
  
  -- Southeast Asia
  WHEN mobile LIKE '+60%' THEN 'MY'    -- Malaysia
  WHEN mobile LIKE '+62%' THEN 'ID'    -- Indonesia
  WHEN mobile LIKE '+63%' THEN 'PH'    -- Philippines
  WHEN mobile LIKE '+65%' THEN 'SG'    -- Singapore
  WHEN mobile LIKE '+66%' THEN 'TH'    -- Thailand
  WHEN mobile LIKE '+84%' THEN 'VN'    -- Vietnam
  
  -- East Asia
  WHEN mobile LIKE '+86%' THEN 'CN'    -- China
  WHEN mobile LIKE '+81%' THEN 'JP'    -- Japan
  WHEN mobile LIKE '+82%' THEN 'KR'    -- South Korea
  
  -- Sub-Saharan Africa
  WHEN mobile LIKE '+234%' THEN 'NG'   -- Nigeria
  WHEN mobile LIKE '+27%' THEN 'ZA'    -- South Africa
  WHEN mobile LIKE '+254%' THEN 'KE'   -- Kenya
  WHEN mobile LIKE '+233%' THEN 'GH'   -- Ghana
  WHEN mobile LIKE '+251%' THEN 'ET'   -- Ethiopia
  
  -- Turkey
  WHEN mobile LIKE '+90%' THEN 'TR'    -- Turkey
  
  -- If no match found, leave as NULL
  ELSE NULL
END
WHERE mobile IS NOT NULL AND country_code IS NULL;

-- Drop the old unique constraint on mobile only
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_mobile_unique;

-- Create new composite unique constraint
-- This allows the same local number in different countries (e.g., +20 100 123 456 and +966 100 123 456)
ALTER TABLE profiles
ADD CONSTRAINT profiles_mobile_country_unique 
UNIQUE (country_code, mobile);

-- Add constraint documentation
COMMENT ON CONSTRAINT profiles_mobile_country_unique ON profiles 
IS 'Ensures mobile number is unique within each country. Same local number can exist in different countries.';

-- Log migration completion
DO $$
DECLARE
  total_count INTEGER;
  updated_count INTEGER;
  null_country_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM profiles WHERE mobile IS NOT NULL;
  SELECT COUNT(*) INTO updated_count FROM profiles WHERE mobile IS NOT NULL AND country_code IS NOT NULL;
  SELECT COUNT(*) INTO null_country_count FROM profiles WHERE mobile IS NOT NULL AND country_code IS NULL;
  
  RAISE NOTICE 'Migration completed:';
  RAISE NOTICE '  Total profiles with mobile: %', total_count;
  RAISE NOTICE '  Successfully extracted country code: %', updated_count;
  RAISE NOTICE '  Could not detect country code: %', null_country_count;
END $$;
