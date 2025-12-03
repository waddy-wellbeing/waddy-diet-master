-- =============================================================================
-- BiteRight Database Schema (prefix-free)
-- =============================================================================
-- Tables, functions, and policies without the historic `nutri_` prefix.
-- JSONB columns remain for flexible nested data structures.
-- =============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE user_role AS ENUM ('admin', 'moderator', 'client');
CREATE TYPE plan_status AS ENUM ('pending_assignment', 'active', 'paused', 'expired');

-- =============================================================================
-- PROFILES
-- =============================================================================
-- Stores user profile data including basic info, targets, and preferences

CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255),
  email VARCHAR(255),
  mobile TEXT,
  avatar_url TEXT,
  role user_role NOT NULL DEFAULT 'client',
  plan_status plan_status NOT NULL DEFAULT 'pending_assignment',
  basic_info JSONB NOT NULL DEFAULT '{}',
  targets JSONB NOT NULL DEFAULT '{}',
  preferences JSONB NOT NULL DEFAULT '{}',
  goals JSONB NOT NULL DEFAULT '{}',
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  onboarding_step INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT profiles_user_id_unique UNIQUE (user_id),
  CONSTRAINT profiles_mobile_unique UNIQUE (mobile)
);

CREATE INDEX profiles_user_id_idx ON profiles(user_id);
CREATE INDEX profiles_role_idx ON profiles(role);
CREATE INDEX profiles_name_idx ON profiles(name);
CREATE INDEX profiles_mobile_idx ON profiles(mobile) WHERE mobile IS NOT NULL;

-- =============================================================================
-- INGREDIENTS
-- =============================================================================
-- Ingredient database with nutritional information per serving

CREATE TABLE ingredients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  name_ar TEXT,
  brand VARCHAR(255),
  category VARCHAR(100),
  food_group TEXT,
  subgroup TEXT,
  serving_size DECIMAL(10, 2) NOT NULL,
  serving_unit VARCHAR(50) NOT NULL,
  macros JSONB NOT NULL DEFAULT '{}',
  micros JSONB DEFAULT '{}',
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  source VARCHAR(100),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ingredients_name_unique UNIQUE (name)
);

CREATE INDEX ingredients_name_idx ON ingredients(name);
CREATE INDEX ingredients_category_idx ON ingredients(category);
CREATE INDEX ingredients_created_by_idx ON ingredients(created_by);

-- =============================================================================
-- SPICES
-- =============================================================================
-- Reference spice table for recipe ingredient autocomplete

CREATE TABLE spices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  name_ar TEXT,
  aliases TEXT[] DEFAULT '{}',
  is_default BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT spices_name_unique UNIQUE (name)
);

CREATE INDEX spices_name_idx ON spices(name);
CREATE INDEX spices_is_default_idx ON spices(is_default);

-- =============================================================================
-- RECIPES
-- =============================================================================
-- Recipes with JSONB ingredients/instructions and nutrition metadata

CREATE TABLE recipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  image_url VARCHAR(500),
  meal_type VARCHAR(50)[],
  cuisine VARCHAR(100),
  tags VARCHAR(100)[],
  prep_time_minutes INTEGER,
  cook_time_minutes INTEGER,
  servings INTEGER NOT NULL DEFAULT 1,
  difficulty VARCHAR(20),
  ingredients JSONB NOT NULL DEFAULT '[]',
  instructions JSONB NOT NULL DEFAULT '[]',
  nutrition_per_serving JSONB NOT NULL DEFAULT '{}',
  is_vegetarian BOOLEAN DEFAULT FALSE,
  is_vegan BOOLEAN DEFAULT FALSE,
  is_gluten_free BOOLEAN DEFAULT FALSE,
  is_dairy_free BOOLEAN DEFAULT FALSE,
  admin_notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT recipes_name_unique UNIQUE (name)
);

CREATE INDEX recipes_meal_type_idx ON recipes USING GIN(meal_type);
CREATE INDEX recipes_tags_idx ON recipes USING GIN(tags);
CREATE INDEX recipes_created_by_idx ON recipes(created_by);
CREATE INDEX recipes_cuisine_idx ON recipes(cuisine);

-- =============================================================================
-- DAILY PLANS
-- =============================================================================
-- Daily meal plans with full plan stored as JSONB

CREATE TABLE daily_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_date DATE NOT NULL,
  plan JSONB NOT NULL DEFAULT '{}',
  daily_totals JSONB NOT NULL DEFAULT '{}',
  is_generated BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT daily_plans_user_date_unique UNIQUE (user_id, plan_date)
);

CREATE INDEX daily_plans_user_id_idx ON daily_plans(user_id);
CREATE INDEX daily_plans_plan_date_idx ON daily_plans(plan_date);
CREATE INDEX daily_plans_user_date_idx ON daily_plans(user_id, plan_date);

-- =============================================================================
-- DAILY LOGS
-- =============================================================================
-- Daily food logging with flexible JSONB payload

CREATE TABLE daily_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  log JSONB NOT NULL DEFAULT '{}',
  logged_totals JSONB NOT NULL DEFAULT '{}',
  meals_logged INTEGER NOT NULL DEFAULT 0,
  adherence_score DECIMAL(5, 2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT daily_logs_user_date_unique UNIQUE (user_id, log_date)
);

CREATE INDEX daily_logs_user_id_idx ON daily_logs(user_id);
CREATE INDEX daily_logs_log_date_idx ON daily_logs(log_date);
CREATE INDEX daily_logs_user_date_idx ON daily_logs(user_id, log_date);

-- =============================================================================
-- SYSTEM SETTINGS
-- =============================================================================
-- Stores system-wide configuration for meal distribution, scaling, etc.

CREATE TABLE system_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE spices ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Profiles: User can access own profile, Admin/Moderator can access all
CREATE POLICY profiles_select ON profiles
  FOR SELECT USING (
    auth.uid() = user_id 
    OR 
    is_admin_or_moderator()
  );

CREATE POLICY profiles_insert ON profiles
  FOR INSERT WITH CHECK (
    auth.uid() = user_id 
    OR 
    is_admin_or_moderator()
  );

CREATE POLICY profiles_update ON profiles
  FOR UPDATE USING (
    auth.uid() = user_id 
    OR 
    is_admin_or_moderator()
  );

CREATE POLICY profiles_delete ON profiles
  FOR DELETE USING (
    is_admin_or_moderator()
  );

CREATE POLICY ingredients_select ON ingredients
  FOR SELECT USING (is_public = TRUE OR auth.uid() = created_by);

CREATE POLICY ingredients_insert ON ingredients
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY ingredients_update_own ON ingredients
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY ingredients_delete_own ON ingredients
  FOR DELETE USING (auth.uid() = created_by);

CREATE POLICY spices_select_default ON spices
  FOR SELECT USING (is_default = TRUE);

CREATE POLICY recipes_select ON recipes
  FOR SELECT USING (is_public = TRUE OR auth.uid() = created_by);

CREATE POLICY recipes_insert ON recipes
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY recipes_update_own ON recipes
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY recipes_delete_own ON recipes
  FOR DELETE USING (auth.uid() = created_by);

CREATE POLICY daily_plans_select_own ON daily_plans
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY daily_plans_insert_own ON daily_plans
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY daily_plans_update_own ON daily_plans
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY daily_plans_delete_own ON daily_plans
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY daily_logs_select_own ON daily_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY daily_logs_insert_own ON daily_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY daily_logs_update_own ON daily_logs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY daily_logs_delete_own ON daily_logs
  FOR DELETE USING (auth.uid() = user_id);

-- System settings: Only admins can manage
CREATE POLICY system_settings_admin_select ON system_settings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY system_settings_admin_insert ON system_settings
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY system_settings_admin_update ON system_settings
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY system_settings_admin_delete ON system_settings
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- =============================================================================
-- TRIGGERS
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER ingredients_updated_at
  BEFORE UPDATE ON ingredients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER spices_updated_at
  BEFORE UPDATE ON spices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER recipes_updated_at
  BEFORE UPDATE ON recipes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER daily_plans_updated_at
  BEFORE UPDATE ON daily_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER daily_logs_updated_at
  BEFORE UPDATE ON daily_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER system_settings_updated_at
  BEFORE UPDATE ON system_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- AUTO-CREATE PROFILE ON USER SIGNUP
-- =============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, role)
  VALUES (NEW.id, 'client');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
