-- Migration: Add mobile column to profiles table
-- Description: Adds a separate 'mobile' column to the profiles table for storing
--              unique phone numbers with country codes. This column is independent
--              of the basic_info JSONB column and enforces uniqueness.
--
-- Usage locations:
-- - Onboarding flow (basic-info-step.tsx)
-- - User profile page (profile-content.tsx)
-- - Admin user management (basic-info-editor.tsx)
-- - Sign up flow (if applicable)

-- Add mobile column to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS mobile TEXT;

-- Add unique constraint to ensure no duplicate mobile numbers
ALTER TABLE profiles
ADD CONSTRAINT profiles_mobile_unique UNIQUE (mobile);

-- Add comment to document the column
COMMENT ON COLUMN profiles.mobile IS 
'User mobile phone number with country code (e.g., +1234567890). Must be unique across all profiles.';

-- Create index for faster lookups on mobile number
CREATE INDEX IF NOT EXISTS idx_profiles_mobile ON profiles (mobile) WHERE mobile IS NOT NULL;
