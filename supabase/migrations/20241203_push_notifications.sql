-- =============================================================================
-- PUSH NOTIFICATIONS SCHEMA
-- =============================================================================
-- Add this to your existing schema.sql or run as a migration

-- =============================================================================
-- PUSH SUBSCRIPTIONS
-- =============================================================================
-- Stores push notification subscriptions for each user/device

CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  device_type VARCHAR(50), -- 'web', 'android', 'ios', 'desktop'
  device_name VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT push_subscriptions_endpoint_unique UNIQUE (endpoint)
);

CREATE INDEX push_subscriptions_user_id_idx ON push_subscriptions(user_id);
CREATE INDEX push_subscriptions_is_active_idx ON push_subscriptions(is_active);

-- =============================================================================
-- NOTIFICATION SETTINGS
-- =============================================================================
-- Per-user notification preferences

CREATE TABLE notification_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  meal_reminders BOOLEAN NOT NULL DEFAULT TRUE,
  daily_summary BOOLEAN NOT NULL DEFAULT TRUE,
  weekly_report BOOLEAN NOT NULL DEFAULT TRUE,
  goal_achievements BOOLEAN NOT NULL DEFAULT TRUE,
  plan_updates BOOLEAN NOT NULL DEFAULT TRUE,
  quiet_hours_start TIME, -- e.g., '22:00'
  quiet_hours_end TIME,   -- e.g., '08:00'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX notification_settings_user_id_idx ON notification_settings(user_id);

-- =============================================================================
-- NOTIFICATIONS LOG
-- =============================================================================
-- History of sent notifications

CREATE TABLE notifications_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  icon VARCHAR(255),
  url VARCHAR(500),
  notification_type VARCHAR(50) NOT NULL, -- 'meal_reminder', 'achievement', 'admin', etc.
  is_broadcast BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(20) NOT NULL DEFAULT 'sent', -- 'sent', 'failed', 'clicked'
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  clicked_at TIMESTAMPTZ,
  error_message TEXT
);

CREATE INDEX notifications_log_user_id_idx ON notifications_log(user_id);
CREATE INDEX notifications_log_sent_at_idx ON notifications_log(sent_at);
CREATE INDEX notifications_log_type_idx ON notifications_log(notification_type);

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications_log ENABLE ROW LEVEL SECURITY;

-- Push subscriptions: users can manage their own
CREATE POLICY "Users can manage own push subscriptions"
  ON push_subscriptions FOR ALL
  USING (auth.uid() = user_id);

-- Notification settings: users can manage their own
CREATE POLICY "Users can manage own notification settings"
  ON notification_settings FOR ALL
  USING (auth.uid() = user_id);

-- Notifications log: users can view their own
CREATE POLICY "Users can view own notifications"
  ON notifications_log FOR SELECT
  USING (auth.uid() = user_id OR is_broadcast = TRUE);

-- Admin policies (for sending)
CREATE POLICY "Admins can manage all subscriptions"
  ON push_subscriptions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'moderator')
    )
  );

CREATE POLICY "Admins can insert notifications"
  ON notifications_log FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'moderator')
    )
  );

-- =============================================================================
-- TRIGGERS
-- =============================================================================

CREATE TRIGGER push_subscriptions_updated_at
  BEFORE UPDATE ON push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER notification_settings_updated_at
  BEFORE UPDATE ON notification_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- AUTO-CREATE NOTIFICATION SETTINGS ON USER SIGNUP
-- =============================================================================

CREATE OR REPLACE FUNCTION handle_new_user_notification_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notification_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created_notification_settings
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_notification_settings();
