-- =============================================================================
-- SHOPPING LISTS TABLE
-- =============================================================================
-- Stores weekly shopping lists aggregated from user's meal plans
-- Each user can have one shopping list per week

CREATE TABLE shopping_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  items JSONB NOT NULL DEFAULT '{}',
  checked_items TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT shopping_lists_user_week_unique UNIQUE (user_id, week_start_date)
);

CREATE INDEX shopping_lists_user_id_idx ON shopping_lists(user_id);
CREATE INDEX shopping_lists_week_start_idx ON shopping_lists(week_start_date);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE shopping_lists ENABLE ROW LEVEL SECURITY;

-- Users can only access their own shopping lists
CREATE POLICY shopping_lists_select_own ON shopping_lists
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY shopping_lists_insert_own ON shopping_lists
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY shopping_lists_update_own ON shopping_lists
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY shopping_lists_delete_own ON shopping_lists
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

CREATE TRIGGER shopping_lists_updated_at
  BEFORE UPDATE ON shopping_lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE shopping_lists IS 'Weekly shopping lists aggregated from users meal plans';
COMMENT ON COLUMN shopping_lists.items IS 'JSONB object grouped by food_group containing aggregated ingredients';
COMMENT ON COLUMN shopping_lists.checked_items IS 'Array of ingredient_ids that have been marked as purchased';
COMMENT ON COLUMN shopping_lists.week_start_date IS 'Start date of the week (typically Monday)';
COMMENT ON COLUMN shopping_lists.week_end_date IS 'End date of the week (typically Sunday)';
