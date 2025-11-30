-- =============================================================================
-- Add plan_status to profiles table
-- =============================================================================
-- This migration adds a plan_status column to track user's meal plan assignment

-- Create the plan_status enum type
DO $$ BEGIN
  CREATE TYPE plan_status AS ENUM ('pending_assignment', 'active', 'paused', 'expired');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add the plan_status column to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS plan_status plan_status NOT NULL DEFAULT 'pending_assignment';

-- Create index for filtering by plan status
CREATE INDEX IF NOT EXISTS profiles_plan_status_idx ON profiles(plan_status);

-- Update existing users who completed onboarding to 'pending_assignment'
-- (They still need coach to assign meal structure)
UPDATE profiles 
SET plan_status = 'pending_assignment' 
WHERE onboarding_completed = true AND plan_status IS NULL;

-- Verify
SELECT 
  plan_status, 
  COUNT(*) as count 
FROM profiles 
GROUP BY plan_status;
