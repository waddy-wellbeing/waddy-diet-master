-- =============================================================================
-- BiteRight Migration: Add User Roles & Auto-Profile Trigger
-- =============================================================================
-- Run this migration in Supabase SQL Editor to add role-based auth support.
-- Date: 2025-11-28
-- =============================================================================

-- 1. Create the user_role enum type
CREATE TYPE user_role AS ENUM ('admin', 'moderator', 'client');

-- 2. Add role column to profiles table
ALTER TABLE profiles 
ADD COLUMN role user_role NOT NULL DEFAULT 'client';

-- 3. Create index on role for faster queries
CREATE INDEX profiles_role_idx ON profiles(role);

-- 4. Create function to auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, role)
  VALUES (NEW.id, 'client');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create trigger to call the function on new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- =============================================================================
-- Optional: Admin RLS Policies
-- =============================================================================
-- These policies allow admins/moderators to access all data.
-- Uncomment and run if you want admins to bypass normal RLS restrictions.

-- -- Allow admins to select all profiles
-- CREATE POLICY profiles_admin_select ON profiles
--   FOR SELECT USING (
--     EXISTS (
--       SELECT 1 FROM profiles p 
--       WHERE p.user_id = auth.uid() 
--       AND p.role IN ('admin', 'moderator')
--     )
--   );

-- -- Allow admins to update all profiles
-- CREATE POLICY profiles_admin_update ON profiles
--   FOR UPDATE USING (
--     EXISTS (
--       SELECT 1 FROM profiles p 
--       WHERE p.user_id = auth.uid() 
--       AND p.role IN ('admin', 'moderator')
--     )
--   );

-- -- Allow admins to select all ingredients
-- CREATE POLICY ingredients_admin_select ON ingredients
--   FOR SELECT USING (
--     EXISTS (
--       SELECT 1 FROM profiles p 
--       WHERE p.user_id = auth.uid() 
--       AND p.role IN ('admin', 'moderator')
--     )
--   );

-- -- Allow admins to insert/update/delete all ingredients
-- CREATE POLICY ingredients_admin_all ON ingredients
--   FOR ALL USING (
--     EXISTS (
--       SELECT 1 FROM profiles p 
--       WHERE p.user_id = auth.uid() 
--       AND p.role IN ('admin', 'moderator')
--     )
--   );

-- -- Allow admins to manage all recipes
-- CREATE POLICY recipes_admin_all ON recipes
--   FOR ALL USING (
--     EXISTS (
--       SELECT 1 FROM profiles p 
--       WHERE p.user_id = auth.uid() 
--       AND p.role IN ('admin', 'moderator')
--     )
--   );

-- -- Allow admins to manage all spices
-- CREATE POLICY spices_admin_all ON spices
--   FOR ALL USING (
--     EXISTS (
--       SELECT 1 FROM profiles p 
--       WHERE p.user_id = auth.uid() 
--       AND p.role IN ('admin', 'moderator')
--     )
--   );

-- =============================================================================
-- Verification Queries (run after migration to verify)
-- =============================================================================
-- Check if role column was added:
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'profiles' AND column_name = 'role';

-- Check if trigger was created:
-- SELECT trigger_name, event_manipulation, action_statement 
-- FROM information_schema.triggers 
-- WHERE trigger_name = 'on_auth_user_created';

-- Check if function was created:
-- SELECT routine_name, routine_type 
-- FROM information_schema.routines 
-- WHERE routine_name = 'handle_new_user';
