-- =============================================================================
-- BiteRight Migration: Admin Ingredient Policies
-- =============================================================================
-- Allows admins and moderators to update/delete any ingredient.
-- Date: 2025-11-28
-- =============================================================================

-- Helper function to check if current user is admin/moderator
CREATE OR REPLACE FUNCTION is_admin_or_moderator()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'moderator')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing restrictive policies
DROP POLICY IF EXISTS ingredients_update_own ON ingredients;
DROP POLICY IF EXISTS ingredients_delete_own ON ingredients;

-- Create new policies that allow owner OR admin/moderator
CREATE POLICY ingredients_update ON ingredients
  FOR UPDATE USING (
    auth.uid() = created_by 
    OR is_admin_or_moderator()
  );

CREATE POLICY ingredients_delete ON ingredients
  FOR DELETE USING (
    auth.uid() = created_by 
    OR is_admin_or_moderator()
  );

-- Also update insert policy to allow admins to create without created_by matching
DROP POLICY IF EXISTS ingredients_insert ON ingredients;

CREATE POLICY ingredients_insert ON ingredients
  FOR INSERT WITH CHECK (
    auth.uid() = created_by 
    OR is_admin_or_moderator()
  );

-- =============================================================================
-- Same for spices table
-- =============================================================================

-- Spices policies (if they exist)
DROP POLICY IF EXISTS spices_update_own ON spices;
DROP POLICY IF EXISTS spices_delete_own ON spices;
DROP POLICY IF EXISTS spices_insert ON spices;

-- Allow admins full access to spices
CREATE POLICY spices_insert ON spices
  FOR INSERT WITH CHECK (is_admin_or_moderator());

CREATE POLICY spices_update ON spices
  FOR UPDATE USING (is_admin_or_moderator());

CREATE POLICY spices_delete ON spices
  FOR DELETE USING (is_admin_or_moderator());

-- =============================================================================
-- Same for recipes table
-- =============================================================================

DROP POLICY IF EXISTS recipes_update_own ON recipes;
DROP POLICY IF EXISTS recipes_delete_own ON recipes;
DROP POLICY IF EXISTS recipes_insert ON recipes;

CREATE POLICY recipes_insert ON recipes
  FOR INSERT WITH CHECK (
    auth.uid() = created_by 
    OR is_admin_or_moderator()
  );

CREATE POLICY recipes_update ON recipes
  FOR UPDATE USING (
    auth.uid() = created_by 
    OR is_admin_or_moderator()
  );

CREATE POLICY recipes_delete ON recipes
  FOR DELETE USING (
    auth.uid() = created_by 
    OR is_admin_or_moderator()
  );
