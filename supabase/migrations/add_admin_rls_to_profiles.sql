-- =============================================================================
-- Add Admin RLS Policies for Profiles Table
-- =============================================================================
-- Allow admins to view, create, update, and delete all profiles

-- Admin can SELECT all profiles
CREATE POLICY profiles_admin_select ON profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
  );

-- Admin can INSERT profiles (for creating user profiles manually if needed)
CREATE POLICY profiles_admin_insert ON profiles
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
  );

-- Admin can UPDATE all profiles
CREATE POLICY profiles_admin_update ON profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
  );

-- Admin can DELETE profiles
CREATE POLICY profiles_admin_delete ON profiles
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
  );

-- Verify policies
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY policyname;
