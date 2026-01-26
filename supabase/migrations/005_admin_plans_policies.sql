-- =============================================================================
-- BiteRight Migration: Admin Plans & Logs Policies
-- =============================================================================
-- Allows admins and moderators to view/edit/create/delete any user's daily plans and logs.
-- This enables the admin panel at /admin/plans to work properly.
-- Date: 2026-01-26
-- =============================================================================

-- Drop existing restrictive policies on daily_plans
DROP POLICY IF EXISTS daily_plans_select_own ON daily_plans;
DROP POLICY IF EXISTS daily_plans_insert_own ON daily_plans;
DROP POLICY IF EXISTS daily_plans_update_own ON daily_plans;
DROP POLICY IF EXISTS daily_plans_delete_own ON daily_plans;

-- Create new policies that allow owner OR admin/moderator
CREATE POLICY daily_plans_select ON daily_plans
  FOR SELECT USING (
    auth.uid() = user_id 
    OR is_admin_or_moderator()
  );

CREATE POLICY daily_plans_insert ON daily_plans
  FOR INSERT WITH CHECK (
    auth.uid() = user_id 
    OR is_admin_or_moderator()
  );

CREATE POLICY daily_plans_update ON daily_plans
  FOR UPDATE USING (
    auth.uid() = user_id 
    OR is_admin_or_moderator()
  );

CREATE POLICY daily_plans_delete ON daily_plans
  FOR DELETE USING (
    auth.uid() = user_id 
    OR is_admin_or_moderator()
  );

-- Drop existing restrictive policies on daily_logs
DROP POLICY IF EXISTS daily_logs_select_own ON daily_logs;
DROP POLICY IF EXISTS daily_logs_insert_own ON daily_logs;
DROP POLICY IF EXISTS daily_logs_update_own ON daily_logs;
DROP POLICY IF EXISTS daily_logs_delete_own ON daily_logs;

-- Create new policies that allow owner OR admin/moderator
CREATE POLICY daily_logs_select ON daily_logs
  FOR SELECT USING (
    auth.uid() = user_id 
    OR is_admin_or_moderator()
  );

CREATE POLICY daily_logs_insert ON daily_logs
  FOR INSERT WITH CHECK (
    auth.uid() = user_id 
    OR is_admin_or_moderator()
  );

CREATE POLICY daily_logs_update ON daily_logs
  FOR UPDATE USING (
    auth.uid() = user_id 
    OR is_admin_or_moderator()
  );

CREATE POLICY daily_logs_delete ON daily_logs
  FOR DELETE USING (
    auth.uid() = user_id 
    OR is_admin_or_moderator()
  );
