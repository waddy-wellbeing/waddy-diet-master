-- =============================================================================
-- Migration: Add indexes for cooking difficulty and time fields on recipes
-- WAD-48: Link cooking level and cooking time to recipe ranking/suggestions
-- =============================================================================

-- Index on difficulty for filtering easy/medium/hard recipes
CREATE INDEX IF NOT EXISTS recipes_difficulty_idx ON recipes(difficulty)
  WHERE difficulty IS NOT NULL;

-- Index on prep_time_minutes for time-based filtering
CREATE INDEX IF NOT EXISTS recipes_prep_time_idx ON recipes(prep_time_minutes)
  WHERE prep_time_minutes IS NOT NULL;

-- Index on cook_time_minutes for time-based filtering
CREATE INDEX IF NOT EXISTS recipes_cook_time_idx ON recipes(cook_time_minutes)
  WHERE cook_time_minutes IS NOT NULL;

-- Index on is_public + difficulty to speed up the common query pattern:
-- "fetch public recipes filtered by difficulty"
CREATE INDEX IF NOT EXISTS recipes_public_difficulty_idx ON recipes(is_public, difficulty)
  WHERE is_public = TRUE AND difficulty IS NOT NULL;
