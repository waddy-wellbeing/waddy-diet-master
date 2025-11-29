-- =============================================================================
-- Migration: 003_audit_log_table
-- Description: Create audit log table for tracking errors and user activity
-- Created: 2025-11-29
-- =============================================================================

-- Create enum for log levels
DO $$ BEGIN
  CREATE TYPE log_level AS ENUM ('debug', 'info', 'warn', 'error', 'fatal');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create enum for log categories
DO $$ BEGIN
  CREATE TYPE log_category AS ENUM (
    'auth',           -- Authentication events (login, logout, signup)
    'user_action',    -- User-initiated actions
    'admin_action',   -- Admin panel actions
    'system',         -- System events
    'error',          -- Application errors
    'api',            -- API calls
    'database',       -- Database operations
    'security'        -- Security-related events
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create the audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Log classification
  level log_level NOT NULL DEFAULT 'info',
  category log_category NOT NULL DEFAULT 'system',
  
  -- Actor information (who performed the action)
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  user_role TEXT,
  ip_address INET,
  user_agent TEXT,
  
  -- Event information
  action TEXT NOT NULL,                    -- e.g., 'recipe.create', 'ingredient.delete'
  resource_type TEXT,                      -- e.g., 'recipe', 'ingredient', 'user'
  resource_id TEXT,                        -- ID of the affected resource
  
  -- Request context
  request_id TEXT,                         -- For tracing requests
  request_path TEXT,                       -- URL path
  request_method TEXT,                     -- HTTP method
  
  -- Detailed data (stored as JSONB for flexibility)
  details JSONB DEFAULT '{}',              -- Additional context data
  old_values JSONB,                        -- Previous values (for updates)
  new_values JSONB,                        -- New values (for creates/updates)
  
  -- Error-specific fields
  error_message TEXT,
  error_stack TEXT,
  error_code TEXT,
  error_digest TEXT,                       -- Next.js error digest
  
  -- Performance metrics
  duration_ms INTEGER,                     -- How long the operation took
  
  -- Indexing helpers
  tags TEXT[]                              -- Custom tags for filtering
);

-- =============================================================================
-- Indexes for common queries
-- =============================================================================

-- Index for querying by user
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);

-- Index for querying by timestamp (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Index for querying by level (for finding errors)
CREATE INDEX IF NOT EXISTS idx_audit_logs_level ON audit_logs(level) WHERE level IN ('error', 'fatal');

-- Index for querying by category
CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON audit_logs(category);

-- Index for querying by action
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- Index for querying by resource
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- Composite index for dashboard queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_dashboard ON audit_logs(created_at DESC, level, category);

-- GIN index for JSONB details queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_details ON audit_logs USING GIN (details);

-- GIN index for tags array
CREATE INDEX IF NOT EXISTS idx_audit_logs_tags ON audit_logs USING GIN (tags);

-- =============================================================================
-- RLS Policies
-- =============================================================================

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view all logs
CREATE POLICY "Admins can view all audit logs"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'moderator')
    )
  );

-- Only system/service role can insert logs (prevents tampering)
-- In practice, logs are inserted via server actions using service role
CREATE POLICY "Service role can insert audit logs"
  ON audit_logs
  FOR INSERT
  WITH CHECK (true);

-- No one can update or delete audit logs (immutable)
-- This ensures audit trail integrity

-- =============================================================================
-- Helper function to log events (called from server actions)
-- =============================================================================

CREATE OR REPLACE FUNCTION log_audit_event(
  p_level log_level,
  p_category log_category,
  p_action TEXT,
  p_user_id UUID DEFAULT NULL,
  p_user_email TEXT DEFAULT NULL,
  p_user_role TEXT DEFAULT NULL,
  p_resource_type TEXT DEFAULT NULL,
  p_resource_id TEXT DEFAULT NULL,
  p_details JSONB DEFAULT '{}',
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_error_stack TEXT DEFAULT NULL,
  p_error_code TEXT DEFAULT NULL,
  p_request_path TEXT DEFAULT NULL,
  p_request_method TEXT DEFAULT NULL,
  p_duration_ms INTEGER DEFAULT NULL,
  p_tags TEXT[] DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO audit_logs (
    level,
    category,
    action,
    user_id,
    user_email,
    user_role,
    resource_type,
    resource_id,
    details,
    old_values,
    new_values,
    error_message,
    error_stack,
    error_code,
    request_path,
    request_method,
    duration_ms,
    tags
  ) VALUES (
    p_level,
    p_category,
    p_action,
    p_user_id,
    p_user_email,
    p_user_role,
    p_resource_type,
    p_resource_id,
    p_details,
    p_old_values,
    p_new_values,
    p_error_message,
    p_error_stack,
    p_error_code,
    p_request_path,
    p_request_method,
    p_duration_ms,
    p_tags
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- =============================================================================
-- Automatic cleanup of old logs (optional - run as a scheduled job)
-- Keeps logs for 90 days by default
-- =============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_audit_logs(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM audit_logs
  WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL
  AND level NOT IN ('error', 'fatal'); -- Keep error logs longer
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Log the cleanup action itself
  PERFORM log_audit_event(
    'info'::log_level,
    'system'::log_category,
    'audit_logs.cleanup',
    NULL,
    NULL,
    'system',
    'audit_logs',
    NULL,
    jsonb_build_object('deleted_count', deleted_count, 'days_kept', days_to_keep)
  );
  
  RETURN deleted_count;
END;
$$;

-- =============================================================================
-- Views for common queries
-- =============================================================================

-- Recent errors view
CREATE OR REPLACE VIEW recent_errors AS
SELECT 
  id,
  created_at,
  user_email,
  action,
  resource_type,
  error_message,
  error_code,
  request_path,
  details
FROM audit_logs
WHERE level IN ('error', 'fatal')
ORDER BY created_at DESC
LIMIT 100;

-- User activity summary view
CREATE OR REPLACE VIEW user_activity_summary AS
SELECT 
  user_id,
  user_email,
  category,
  COUNT(*) as action_count,
  MAX(created_at) as last_activity,
  MIN(created_at) as first_activity
FROM audit_logs
WHERE user_id IS NOT NULL
AND created_at > NOW() - INTERVAL '30 days'
GROUP BY user_id, user_email, category
ORDER BY action_count DESC;

-- Admin actions view
CREATE OR REPLACE VIEW admin_actions AS
SELECT 
  id,
  created_at,
  user_email,
  action,
  resource_type,
  resource_id,
  details,
  old_values,
  new_values
FROM audit_logs
WHERE category = 'admin_action'
ORDER BY created_at DESC;

-- =============================================================================
-- Grant permissions
-- =============================================================================

-- Grant usage to authenticated users (RLS will filter)
GRANT SELECT ON audit_logs TO authenticated;
GRANT SELECT ON recent_errors TO authenticated;
GRANT SELECT ON user_activity_summary TO authenticated;
GRANT SELECT ON admin_actions TO authenticated;

-- Grant insert to service role (for server actions)
GRANT INSERT ON audit_logs TO service_role;
GRANT EXECUTE ON FUNCTION log_audit_event TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_audit_logs TO service_role;

COMMENT ON TABLE audit_logs IS 'Immutable audit log for tracking all user and system activity';
COMMENT ON FUNCTION log_audit_event IS 'Helper function to insert audit log entries with proper defaults';
COMMENT ON FUNCTION cleanup_old_audit_logs IS 'Scheduled cleanup function to remove old non-error logs';
