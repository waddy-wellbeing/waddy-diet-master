-- Disable RLS on analytics tables
-- These tables are only written to via server-side operations
-- Disabling RLS prevents constraint violations during upsert operations

ALTER TABLE analytics_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_error_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_page_views DISABLE ROW LEVEL SECURITY;

-- Drop problematic policies that were blocking upserts
DROP POLICY IF EXISTS analytics_sessions_admin_view ON analytics_sessions;
DROP POLICY IF EXISTS analytics_sessions_insert ON analytics_sessions;
DROP POLICY IF EXISTS analytics_sessions_upsert ON analytics_sessions;
DROP POLICY IF EXISTS analytics_events_admin_view ON analytics_events;
DROP POLICY IF EXISTS analytics_events_insert ON analytics_events;
DROP POLICY IF EXISTS analytics_error_logs_admin_view ON analytics_error_logs;
DROP POLICY IF EXISTS analytics_error_logs_insert ON analytics_error_logs;
DROP POLICY IF EXISTS analytics_page_views_admin_view ON analytics_page_views;
DROP POLICY IF EXISTS analytics_page_views_upsert ON analytics_page_views;
DROP POLICY IF EXISTS analytics_page_views_update ON analytics_page_views;
