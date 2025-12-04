/**
 * Supabase Migration: Add Analytics Tables
 * Date: 2025-12-04
 * 
 * This migration adds comprehensive analytics infrastructure:
 * - analytics_sessions: User visit context tracking
 * - analytics_events: Granular event logging
 * - analytics_error_logs: Application error logging
 * - analytics_page_views: Aggregated daily metrics
 * 
 * All tables include RLS policies restricting access to admin/moderator only
 */

-- ============================================================================
-- ANALYTICS_SESSIONS
-- ============================================================================
-- Purpose: Track user sessions and aggregate behavior
-- Tracks: Device info, referrals, features used, engagement metrics

CREATE TABLE IF NOT EXISTS analytics_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT NOT NULL UNIQUE,
  
  -- Session timing
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  total_duration_seconds INTEGER,
  
  -- Device/Environment metadata
  device_type VARCHAR(50),
  browser VARCHAR(100),
  os VARCHAR(100),
  screen_resolution VARCHAR(20),
  user_agent TEXT,
  ip_address INET,
  
  -- Referrer/Campaign tracking
  referrer TEXT,
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),
  utm_term VARCHAR(100),
  utm_content VARCHAR(100),
  
  -- Navigation metadata
  landing_page VARCHAR(255),
  exit_page VARCHAR(255),
  pages_visited TEXT[] DEFAULT '{}',
  
  -- Bite Right specific: Feature engagement
  features_used TEXT[] DEFAULT '{}',
  completed_onboarding BOOLEAN DEFAULT FALSE,
  logged_meals_count INTEGER DEFAULT 0,
  recipes_swapped_count INTEGER DEFAULT 0,
  
  -- Engagement quality
  engagement_score DECIMAL(5, 2),
  session_type VARCHAR(50),
  
  -- Admin metadata
  notes TEXT,
  archived BOOLEAN DEFAULT FALSE,
  
  CONSTRAINT sessions_user_or_anon CHECK (user_id IS NOT NULL OR session_id IS NOT NULL)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS analytics_sessions_user_id_idx ON analytics_sessions(user_id);
CREATE INDEX IF NOT EXISTS analytics_sessions_session_id_idx ON analytics_sessions(session_id);
CREATE INDEX IF NOT EXISTS analytics_sessions_created_at_idx ON analytics_sessions(created_at);
CREATE INDEX IF NOT EXISTS analytics_sessions_device_type_idx ON analytics_sessions(device_type);

-- ============================================================================
-- ANALYTICS_EVENTS
-- ============================================================================
-- Purpose: Log individual user actions and interactions
-- Tracks: Page views, button clicks, feature usage, form interactions

CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT NOT NULL REFERENCES analytics_sessions(session_id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Event timing
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  time_since_session_start_ms INTEGER,
  
  -- Event categorization (hierarchical)
  event_type VARCHAR(100) NOT NULL,
  event_category VARCHAR(100) NOT NULL,
  event_action VARCHAR(100),
  event_label VARCHAR(255),
  
  -- Location context
  page_path VARCHAR(255) NOT NULL,
  page_section VARCHAR(100),
  
  -- Event data (flexible JSONB for extensibility)
  event_data JSONB DEFAULT '{}',
  
  -- Performance metrics
  time_since_page_load_ms INTEGER,
  
  -- UX signals
  is_error BOOLEAN DEFAULT FALSE,
  error_code VARCHAR(100),
  
  -- Admin
  archived BOOLEAN DEFAULT FALSE
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS analytics_events_session_id_idx ON analytics_events(session_id);
CREATE INDEX IF NOT EXISTS analytics_events_user_id_idx ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS analytics_events_event_type_idx ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS analytics_events_event_category_idx ON analytics_events(event_category);
CREATE INDEX IF NOT EXISTS analytics_events_created_at_idx ON analytics_events(created_at);
CREATE INDEX IF NOT EXISTS analytics_events_page_path_idx ON analytics_events(page_path);

-- ============================================================================
-- ANALYTICS_ERROR_LOGS
-- ============================================================================
-- Purpose: Detailed error tracking with context for debugging
-- Tracks: Error type, severity, stack trace, affected resources, resolution status

CREATE TABLE IF NOT EXISTS analytics_error_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT REFERENCES analytics_sessions(session_id) ON DELETE SET NULL,
  
  -- Error categorization
  error_type VARCHAR(100) NOT NULL,
  error_code VARCHAR(50),
  severity VARCHAR(50) NOT NULL,
  
  -- Error message & stack
  error_message TEXT NOT NULL,
  error_stack TEXT,
  
  -- Context
  component VARCHAR(100),
  action VARCHAR(100),
  page_path VARCHAR(255),
  
  -- Related resources (nullable for flexibility)
  recipe_id UUID,
  ingredient_id UUID,
  daily_plan_id UUID,
  
  -- Environment
  device_type VARCHAR(50),
  browser_info JSONB,
  screen_resolution VARCHAR(20),
  viewport_size VARCHAR(20),
  
  -- Request context (if API error)
  api_endpoint VARCHAR(255),
  http_method VARCHAR(10),
  http_status_code INTEGER,
  request_payload JSONB,
  response_data JSONB,
  
  -- User input (for validation errors, sanitized)
  user_input JSONB,
  
  -- Admin workflow
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  
  -- Metadata
  metadata JSONB,
  tags TEXT[] DEFAULT '{}',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived BOOLEAN DEFAULT FALSE
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS analytics_error_logs_user_id_idx ON analytics_error_logs(user_id);
CREATE INDEX IF NOT EXISTS analytics_error_logs_session_id_idx ON analytics_error_logs(session_id);
CREATE INDEX IF NOT EXISTS analytics_error_logs_error_type_idx ON analytics_error_logs(error_type);
CREATE INDEX IF NOT EXISTS analytics_error_logs_severity_idx ON analytics_error_logs(severity);
CREATE INDEX IF NOT EXISTS analytics_error_logs_created_at_idx ON analytics_error_logs(created_at);
CREATE INDEX IF NOT EXISTS analytics_error_logs_is_resolved_idx ON analytics_error_logs(is_resolved);

-- ============================================================================
-- ANALYTICS_PAGE_VIEWS
-- ============================================================================
-- Purpose: Aggregated daily page view metrics for dashboard performance
-- Updated via Edge Functions or batch jobs to avoid heavy computation

CREATE TABLE IF NOT EXISTS analytics_page_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  page_path VARCHAR(255) NOT NULL,
  event_date DATE NOT NULL,
  
  -- Aggregate metrics
  total_views INTEGER DEFAULT 0,
  unique_sessions INTEGER DEFAULT 0,
  unique_users INTEGER DEFAULT 0,
  avg_time_on_page_ms DECIMAL(10, 2),
  bounce_rate DECIMAL(5, 2),
  
  -- Device breakdown
  mobile_views INTEGER DEFAULT 0,
  tablet_views INTEGER DEFAULT 0,
  desktop_views INTEGER DEFAULT 0,
  
  -- Conversion metrics (Bite Right specific)
  onboarding_completions INTEGER DEFAULT 0,
  meal_logs_initiated INTEGER DEFAULT 0,
  recipe_swaps_count INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT analytics_page_views_unique UNIQUE (page_path, event_date)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS analytics_page_views_page_path_idx ON analytics_page_views(page_path);
CREATE INDEX IF NOT EXISTS analytics_page_views_event_date_idx ON analytics_page_views(event_date);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
-- Analytics tables are read-restricted to admin/moderator only
-- Insert is allowed from server-side actions only

-- Enable RLS on all analytics tables
ALTER TABLE analytics_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_page_views ENABLE ROW LEVEL SECURITY;

-- ANALYTICS_SESSIONS: Admin/Moderator read only
CREATE POLICY analytics_sessions_admin_view ON analytics_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

CREATE POLICY analytics_sessions_insert ON analytics_sessions
  FOR INSERT WITH CHECK (true);

-- ANALYTICS_EVENTS: Admin/Moderator read only
CREATE POLICY analytics_events_admin_view ON analytics_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

CREATE POLICY analytics_events_insert ON analytics_events
  FOR INSERT WITH CHECK (true);

-- ANALYTICS_ERROR_LOGS: Admin/Moderator read only
CREATE POLICY analytics_error_logs_admin_view ON analytics_error_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

CREATE POLICY analytics_error_logs_insert ON analytics_error_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY analytics_error_logs_update ON analytics_error_logs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

-- ANALYTICS_PAGE_VIEWS: Admin/Moderator read only
CREATE POLICY analytics_page_views_admin_view ON analytics_page_views
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

CREATE POLICY analytics_page_views_insert ON analytics_page_views
  FOR INSERT WITH CHECK (true);

CREATE POLICY analytics_page_views_update ON analytics_page_views
  FOR UPDATE USING (true);
