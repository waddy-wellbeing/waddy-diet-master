-- =============================================================================
-- Recreate RLS Policies for Profiles Table
-- =============================================================================
-- Admins/Moderators can do anything, other roles can only access their own profile

-- First, drop all existing policies on profiles
DROP POLICY IF EXISTS profiles_select_own ON profiles;
DROP POLICY IF EXISTS profiles_insert_own ON profiles;
DROP POLICY IF EXISTS profiles_update_own ON profiles;
DROP POLICY IF EXISTS profiles_delete_own ON profiles;
DROP POLICY IF EXISTS profiles_admin_select ON profiles;
DROP POLICY IF EXISTS profiles_admin_insert ON profiles;
DROP POLICY IF EXISTS profiles_admin_update ON profiles;
DROP POLICY IF EXISTS profiles_admin_delete ON profiles;
DROP POLICY IF EXISTS profiles_select ON profiles;
DROP POLICY IF EXISTS profiles_insert ON profiles;
DROP POLICY IF EXISTS profiles_update ON profiles;
DROP POLICY IF EXISTS profiles_delete ON profiles;

-- Create new consolidated policies using is_admin_or_moderator()

-- SELECT: User can see own profile OR admin/moderator can see all
CREATE POLICY profiles_select ON profiles
  FOR SELECT USING (
    auth.uid() = user_id 
    OR 
    is_admin_or_moderator()
  );

-- INSERT: User can insert own profile OR admin/moderator can insert any
CREATE POLICY profiles_insert ON profiles
  FOR INSERT WITH CHECK (
    auth.uid() = user_id 
    OR 
    is_admin_or_moderator()
  );

-- UPDATE: User can update own profile OR admin/moderator can update any
CREATE POLICY profiles_update ON profiles
  FOR UPDATE USING (
    auth.uid() = user_id 
    OR 
    is_admin_or_moderator()
  );

-- DELETE: Only admin/moderator can delete profiles
CREATE POLICY profiles_delete ON profiles
  FOR DELETE USING (
    is_admin_or_moderator()
  );

-- Verify policies
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY policyname;
