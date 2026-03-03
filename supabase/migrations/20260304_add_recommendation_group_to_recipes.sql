-- Add recommendation_group column to recipes table
-- Used for tagging recipes with themed recommendation groups (e.g., 'ramadan')
ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS recommendation_group TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS recipes_recommendation_group_idx ON recipes USING GIN(recommendation_group);
