-- =============================================================================
-- System Settings Table
-- =============================================================================
-- Stores system-wide configuration for meal distribution, scaling, etc.

CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- RLS: Only admins can read/write
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Allow admins to read settings
CREATE POLICY "Admins can read settings" ON system_settings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Allow admins to insert settings
CREATE POLICY "Admins can insert settings" ON system_settings
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Allow admins to update settings
CREATE POLICY "Admins can update settings" ON system_settings
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Allow admins to delete settings
CREATE POLICY "Admins can delete settings" ON system_settings
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Trigger for updated_at
CREATE TRIGGER system_settings_updated_at
  BEFORE UPDATE ON system_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- Seed Default Settings
-- =============================================================================

INSERT INTO system_settings (key, value, description) VALUES
(
  'meal_distribution',
  '{
    "breakfast": 0.25,
    "lunch": 0.35,
    "dinner": 0.30,
    "snacks": 0.10
  }',
  'Default calorie distribution percentages across meal types. Must sum to 1.0.'
),
(
  'deviation_tolerance',
  '0.25',
  'Allow recipes within ±X% of target calories (e.g., 0.25 = ±25%)'
),
(
  'default_meals_per_day',
  '3',
  'Default number of main meals per day for new users'
),
(
  'default_snacks_per_day',
  '2',
  'Default number of snacks per day for new users'
),
(
  'min_calories_per_day',
  '1200',
  'Minimum allowed daily calorie target for safety'
),
(
  'max_calories_per_day',
  '5000',
  'Maximum allowed daily calorie target'
),
(
  'scaling_limits',
  '{
    "min_scale_factor": 0.5,
    "max_scale_factor": 2.0
  }',
  'Limits for recipe scaling to prevent unrealistic portions'
)
ON CONFLICT (key) DO NOTHING;

-- Verify seed data
SELECT key, value, description FROM system_settings ORDER BY key;
