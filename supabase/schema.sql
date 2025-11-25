-- =============================================================================
-- BiteRight Database Schema
-- =============================================================================
-- All tables, functions, and triggers are prefixed with `nutri_`
-- Uses JSONB for flexible nested data where appropriate
-- =============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- NUTRI_PROFILES
-- =============================================================================
-- Stores user profile data including basic info, targets, and preferences
-- All flexible/nested data stored in JSONB columns for easy extension

CREATE TABLE nutri_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Basic profile info stored as JSONB for flexibility
  -- Example: { "name": "Sarah", "age": 32, "height_cm": 165, "weight_kg": 65, 
  --            "sex": "female", "activity_level": "moderate" }
  basic_info JSONB NOT NULL DEFAULT '{}',
  
  -- Calculated nutritional targets stored as JSONB
  -- Example: { "calories": 1800, "protein_g": 120, "carbs_g": 180, "fat_g": 60,
  --            "fiber_g": 25 }
  targets JSONB NOT NULL DEFAULT '{}',
  
  -- User dietary preferences and restrictions as JSONB
  -- Example: { "diet_type": "omnivore", "allergies": ["nuts", "shellfish"],
  --            "dislikes": ["mushrooms"], "cuisine_preferences": ["mediterranean", "asian"],
  --            "cooking_skill": "intermediate", "max_prep_time_minutes": 30 }
  preferences JSONB NOT NULL DEFAULT '{}',
  
  -- Goal information
  -- Example: { "goal_type": "lose_weight", "target_weight_kg": 60, "pace": "moderate" }
  goals JSONB NOT NULL DEFAULT '{}',
  
  -- Onboarding status
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  onboarding_step INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Each user can only have one profile
  CONSTRAINT nutri_profiles_user_id_unique UNIQUE (user_id)
);

-- Index for fast user lookups
CREATE INDEX nutri_profiles_user_id_idx ON nutri_profiles(user_id);

-- =============================================================================
-- NUTRI_FOODS
-- =============================================================================
-- Food database with nutritional information
-- Macros and micros stored as JSONB for flexibility

CREATE TABLE nutri_foods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Basic food info
  name VARCHAR(255) NOT NULL,
  name_ar TEXT, -- Arabic name for i18n support
  brand VARCHAR(255),
  category VARCHAR(100), -- e.g., "protein", "grain", "vegetable", "fruit", "dairy"
  food_group TEXT, -- e.g., "Meat", "Vegetables", "Grains" (from nutrition databases)
  subgroup TEXT, -- e.g., "Poultry", "Leafy Greens" (more specific classification)
  
  -- Serving information
  serving_size DECIMAL(10, 2) NOT NULL,
  serving_unit VARCHAR(50) NOT NULL, -- e.g., "g", "ml", "piece", "cup"
  
  -- Macronutrients per serving as JSONB
  -- Example: { "calories": 165, "protein_g": 31, "carbs_g": 0, "fat_g": 3.6,
  --            "fiber_g": 0, "sugar_g": 0, "saturated_fat_g": 1 }
  macros JSONB NOT NULL DEFAULT '{}',
  
  -- Micronutrients per serving as JSONB (optional, extensible)
  -- Example: { "vitamin_a_iu": 0, "vitamin_c_mg": 0, "calcium_mg": 11,
  --            "iron_mg": 1.1, "potassium_mg": 256, "sodium_mg": 74 }
  micros JSONB DEFAULT '{}',
  
  -- Metadata
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  source VARCHAR(100), -- e.g., "usda", "user_submitted", "partner"
  
  -- For user-created foods
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX nutri_foods_name_idx ON nutri_foods(name);
CREATE INDEX nutri_foods_category_idx ON nutri_foods(category);
CREATE INDEX nutri_foods_created_by_idx ON nutri_foods(created_by);

-- =============================================================================
-- NUTRI_RECIPES
-- =============================================================================
-- Recipe storage with ingredients as JSONB array

CREATE TABLE nutri_recipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Basic recipe info
  name VARCHAR(255) NOT NULL,
  description TEXT,
  image_url VARCHAR(500),
  
  -- Categorization
  meal_type VARCHAR(50)[], -- e.g., ['breakfast', 'snack'] - can be used for multiple
  cuisine VARCHAR(100), -- e.g., "mediterranean", "asian", "american"
  tags VARCHAR(100)[], -- e.g., ['high-protein', 'quick', 'vegetarian']
  
  -- Cooking info
  prep_time_minutes INTEGER,
  cook_time_minutes INTEGER,
  servings INTEGER NOT NULL DEFAULT 1,
  difficulty VARCHAR(20), -- "easy", "medium", "hard"
  
  -- Ingredients as JSONB array for flexibility
  -- Example: [
  --   { "food_id": "uuid", "raw_name": "chicken breast", "quantity": 200, "unit": "g", "is_spice": false, "is_optional": false },
  --   { "food_id": "uuid", "raw_name": "olive oil", "quantity": 1, "unit": "tbsp", "is_spice": false, "is_optional": false },
  --   { "food_id": null, "raw_name": "salt", "quantity": 1, "unit": "pinch", "is_spice": true, "is_optional": false }
  -- ]
  ingredients JSONB NOT NULL DEFAULT '[]',
  
  -- Instructions as JSONB array
  -- Example: [
  --   { "step": 1, "instruction": "Preheat oven to 375°F" },
  --   { "step": 2, "instruction": "Season chicken with salt and pepper" }
  -- ]
  instructions JSONB NOT NULL DEFAULT '[]',
  
  -- Calculated nutrition per serving as JSONB
  -- Example: { "calories": 350, "protein_g": 45, "carbs_g": 10, "fat_g": 15 }
  nutrition_per_serving JSONB NOT NULL DEFAULT '{}',
  
  -- Dietary flags (computed from ingredients, stored for fast filtering)
  is_vegetarian BOOLEAN DEFAULT FALSE,
  is_vegan BOOLEAN DEFAULT FALSE,
  is_gluten_free BOOLEAN DEFAULT FALSE,
  is_dairy_free BOOLEAN DEFAULT FALSE,
  
  -- For user-created recipes
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX nutri_recipes_meal_type_idx ON nutri_recipes USING GIN(meal_type);
CREATE INDEX nutri_recipes_tags_idx ON nutri_recipes USING GIN(tags);
CREATE INDEX nutri_recipes_created_by_idx ON nutri_recipes(created_by);
CREATE INDEX nutri_recipes_cuisine_idx ON nutri_recipes(cuisine);

-- =============================================================================
-- NUTRI_DAILY_PLANS
-- =============================================================================
-- Daily meal plans with the full plan stored as JSONB

CREATE TABLE nutri_daily_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- The date this plan is for
  plan_date DATE NOT NULL,
  
  -- The full daily plan as JSONB
  -- Example: {
  --   "breakfast": { "recipe_id": "uuid", "servings": 1, "swapped": false },
  --   "lunch": { "recipe_id": "uuid", "servings": 1, "swapped": true, "original_recipe_id": "uuid" },
  --   "dinner": { "recipe_id": "uuid", "servings": 1, "swapped": false },
  --   "snacks": [
  --     { "recipe_id": "uuid", "servings": 1 },
  --     { "food_id": "uuid", "amount": 1, "unit": "piece" }
  --   ]
  -- }
  plan JSONB NOT NULL DEFAULT '{}',
  
  -- Calculated daily totals for quick access
  -- Example: { "calories": 1850, "protein_g": 125, "carbs_g": 175, "fat_g": 62 }
  daily_totals JSONB NOT NULL DEFAULT '{}',
  
  -- Plan status
  is_generated BOOLEAN NOT NULL DEFAULT TRUE, -- false if manually created
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Each user can only have one plan per day
  CONSTRAINT nutri_daily_plans_user_date_unique UNIQUE (user_id, plan_date)
);

-- Indexes for common queries
CREATE INDEX nutri_daily_plans_user_id_idx ON nutri_daily_plans(user_id);
CREATE INDEX nutri_daily_plans_plan_date_idx ON nutri_daily_plans(plan_date);
CREATE INDEX nutri_daily_plans_user_date_idx ON nutri_daily_plans(user_id, plan_date);

-- =============================================================================
-- NUTRI_DAILY_LOGS
-- =============================================================================
-- Daily food logging with flexible log structure

CREATE TABLE nutri_daily_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- The date this log is for
  log_date DATE NOT NULL,
  
  -- The full daily log as JSONB
  -- Example: {
  --   "breakfast": {
  --     "logged_at": "2024-11-25T08:30:00Z",
  --     "items": [
  --       { "type": "recipe", "recipe_id": "uuid", "servings": 1, "from_plan": true },
  --       { "type": "food", "food_id": "uuid", "amount": 200, "unit": "ml", "from_plan": false }
  --     ]
  --   },
  --   "lunch": { ... },
  --   "dinner": { ... },
  --   "snacks": { ... }
  -- }
  log JSONB NOT NULL DEFAULT '{}',
  
  -- Calculated daily totals for quick access
  -- Example: { "calories": 1650, "protein_g": 110, "carbs_g": 160, "fat_g": 55 }
  logged_totals JSONB NOT NULL DEFAULT '{}',
  
  -- Quick stats
  meals_logged INTEGER NOT NULL DEFAULT 0,
  adherence_score DECIMAL(5, 2), -- percentage of plan followed (0-100)
  
  -- Notes for the day (optional)
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Each user can only have one log per day
  CONSTRAINT nutri_daily_logs_user_date_unique UNIQUE (user_id, log_date)
);

-- Indexes for common queries
CREATE INDEX nutri_daily_logs_user_id_idx ON nutri_daily_logs(user_id);
CREATE INDEX nutri_daily_logs_log_date_idx ON nutri_daily_logs(log_date);
CREATE INDEX nutri_daily_logs_user_date_idx ON nutri_daily_logs(user_id, log_date);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE nutri_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutri_foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutri_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutri_daily_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutri_daily_logs ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can only access their own profile
CREATE POLICY nutri_profiles_select_own ON nutri_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY nutri_profiles_insert_own ON nutri_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY nutri_profiles_update_own ON nutri_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY nutri_profiles_delete_own ON nutri_profiles
  FOR DELETE USING (auth.uid() = user_id);

-- Foods: Users can see public foods and their own
CREATE POLICY nutri_foods_select ON nutri_foods
  FOR SELECT USING (is_public = TRUE OR auth.uid() = created_by);

CREATE POLICY nutri_foods_insert ON nutri_foods
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY nutri_foods_update_own ON nutri_foods
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY nutri_foods_delete_own ON nutri_foods
  FOR DELETE USING (auth.uid() = created_by);

-- Recipes: Users can see public recipes and their own
CREATE POLICY nutri_recipes_select ON nutri_recipes
  FOR SELECT USING (is_public = TRUE OR auth.uid() = created_by);

CREATE POLICY nutri_recipes_insert ON nutri_recipes
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY nutri_recipes_update_own ON nutri_recipes
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY nutri_recipes_delete_own ON nutri_recipes
  FOR DELETE USING (auth.uid() = created_by);

-- Daily Plans: Users can only access their own plans
CREATE POLICY nutri_daily_plans_select_own ON nutri_daily_plans
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY nutri_daily_plans_insert_own ON nutri_daily_plans
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY nutri_daily_plans_update_own ON nutri_daily_plans
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY nutri_daily_plans_delete_own ON nutri_daily_plans
  FOR DELETE USING (auth.uid() = user_id);

-- Daily Logs: Users can only access their own logs
CREATE POLICY nutri_daily_logs_select_own ON nutri_daily_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY nutri_daily_logs_insert_own ON nutri_daily_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY nutri_daily_logs_update_own ON nutri_daily_logs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY nutri_daily_logs_delete_own ON nutri_daily_logs
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION nutri_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables
CREATE TRIGGER nutri_profiles_updated_at
  BEFORE UPDATE ON nutri_profiles
  FOR EACH ROW EXECUTE FUNCTION nutri_update_updated_at();

CREATE TRIGGER nutri_foods_updated_at
  BEFORE UPDATE ON nutri_foods
  FOR EACH ROW EXECUTE FUNCTION nutri_update_updated_at();

CREATE TRIGGER nutri_recipes_updated_at
  BEFORE UPDATE ON nutri_recipes
  FOR EACH ROW EXECUTE FUNCTION nutri_update_updated_at();

CREATE TRIGGER nutri_daily_plans_updated_at
  BEFORE UPDATE ON nutri_daily_plans
  FOR EACH ROW EXECUTE FUNCTION nutri_update_updated_at();

CREATE TRIGGER nutri_daily_logs_updated_at
  BEFORE UPDATE ON nutri_daily_logs
  FOR EACH ROW EXECUTE FUNCTION nutri_update_updated_at();

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to create a profile for new users (called via trigger on auth.users)
CREATE OR REPLACE FUNCTION nutri_handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO nutri_profiles (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile on signup
-- Note: This trigger should be created in Supabase dashboard or via migration
-- as it references auth.users
-- CREATE TRIGGER nutri_on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION nutri_handle_new_user();
