-- Add country_code column and fix mobile uniqueness constraint
-- Previously: UNIQUE (mobile) - globally unique across all countries
-- Now: UNIQUE (country_code, mobile) - unique per country

-- Step 1: Add country_code column
ALTER TABLE profiles
ADD COLUMN country_code VARCHAR(2);

-- Step 2: Extract country code from existing mobile numbers and populate the column
-- This handles common dial codes from the formatted phone numbers
UPDATE profiles
SET country_code = CASE
  WHEN mobile LIKE '+20%' THEN 'EG'
  WHEN mobile LIKE '+966%' THEN 'SA'
  WHEN mobile LIKE '+971%' THEN 'AE'
  WHEN mobile LIKE '+965%' THEN 'KW'
  WHEN mobile LIKE '+968%' THEN 'OM'
  WHEN mobile LIKE '+973%' THEN 'BH'
  WHEN mobile LIKE '+974%' THEN 'QA'
  WHEN mobile LIKE '+962%' THEN 'JO'
  WHEN mobile LIKE '+961%' THEN 'LB'
  WHEN mobile LIKE '+1%' THEN 'US'
  WHEN mobile LIKE '+44%' THEN 'GB'
  WHEN mobile LIKE '+91%' THEN 'IN'
  WHEN mobile LIKE '+92%' THEN 'PK'
  WHEN mobile LIKE '+880%' THEN 'BD'
  WHEN mobile LIKE '+60%' THEN 'MY'
  WHEN mobile LIKE '+62%' THEN 'ID'
  WHEN mobile LIKE '+63%' THEN 'PH'
  WHEN mobile LIKE '+84%' THEN 'VN'
  WHEN mobile LIKE '+86%' THEN 'CN'
  WHEN mobile LIKE '+81%' THEN 'JP'
  WHEN mobile LIKE '+82%' THEN 'KR'
  WHEN mobile LIKE '+234%' THEN 'NG'
  WHEN mobile LIKE '+27%' THEN 'ZA'
  WHEN mobile LIKE '+254%' THEN 'KE'
  WHEN mobile LIKE '+233%' THEN 'GH'
  WHEN mobile LIKE '+212%' THEN 'MA'
  WHEN mobile LIKE '+213%' THEN 'DZ'
  WHEN mobile LIKE '+216%' THEN 'TN'
  WHEN mobile LIKE '+218%' THEN 'LY'
  WHEN mobile LIKE '+249%' THEN 'SD'
  ELSE NULL
END
WHERE mobile IS NOT NULL;

-- Step 3: Drop the old unique constraint
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_mobile_unique;

-- Step 4: Create new composite unique constraint
-- This allows the same local number in different countries
ALTER TABLE profiles
ADD CONSTRAINT profiles_mobile_country_unique UNIQUE (country_code, mobile);

-- Step 5: Create index for better query performance
CREATE INDEX IF NOT EXISTS profiles_country_code_idx ON profiles(country_code) WHERE country_code IS NOT NULL;

-- Step 6: Add comment for documentation
COMMENT ON COLUMN profiles.country_code IS 'ISO 3166-1 alpha-2 country code (e.g., EG, SA, AE)';
COMMENT ON CONSTRAINT profiles_mobile_country_unique ON profiles IS 'Ensures mobile number is unique within each country';
