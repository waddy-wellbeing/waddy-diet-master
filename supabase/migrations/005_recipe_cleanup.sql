-- =============================================================================
-- Migration: 005_recipe_cleanup
-- Description: Drop legacy JSONB columns, add nutrition calculation trigger
-- Created: 2025-11-29
-- Depends on: 004_recipe_ingredients_table (must be run after migration completes)
-- =============================================================================

-- =============================================================================
-- Step 1: Create function to calculate recipe nutrition from junction table
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_recipe_nutrition(p_recipe_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_nutrition JSONB;
  v_servings INTEGER;
BEGIN
  -- Get servings count
  SELECT servings INTO v_servings FROM recipes WHERE id = p_recipe_id;
  v_servings := COALESCE(v_servings, 1);
  
  -- Calculate totals from matched ingredients (spices excluded)
  SELECT jsonb_build_object(
    'calories', COALESCE(ROUND(SUM(
      CASE 
        WHEN ri.is_spice = FALSE AND ri.is_matched = TRUE AND i.id IS NOT NULL THEN
          COALESCE((i.macros->>'calories')::DECIMAL, 0) * COALESCE(ri.quantity, 0) / COALESCE(i.serving_size, 100)
        ELSE 0
      END
    )::INTEGER / v_servings), 0),
    'protein_g', COALESCE(ROUND(SUM(
      CASE 
        WHEN ri.is_spice = FALSE AND ri.is_matched = TRUE AND i.id IS NOT NULL THEN
          COALESCE((i.macros->>'protein_g')::DECIMAL, 0) * COALESCE(ri.quantity, 0) / COALESCE(i.serving_size, 100)
        ELSE 0
      END
    )::DECIMAL / v_servings, 1), 0),
    'carbs_g', COALESCE(ROUND(SUM(
      CASE 
        WHEN ri.is_spice = FALSE AND ri.is_matched = TRUE AND i.id IS NOT NULL THEN
          COALESCE((i.macros->>'carbs_g')::DECIMAL, 0) * COALESCE(ri.quantity, 0) / COALESCE(i.serving_size, 100)
        ELSE 0
      END
    )::DECIMAL / v_servings, 1), 0),
    'fat_g', COALESCE(ROUND(SUM(
      CASE 
        WHEN ri.is_spice = FALSE AND ri.is_matched = TRUE AND i.id IS NOT NULL THEN
          COALESCE((i.macros->>'fat_g')::DECIMAL, 0) * COALESCE(ri.quantity, 0) / COALESCE(i.serving_size, 100)
        ELSE 0
      END
    )::DECIMAL / v_servings, 1), 0)
  ) INTO v_nutrition
  FROM recipe_ingredients ri
  LEFT JOIN ingredients i ON i.id = ri.ingredient_id
  WHERE ri.recipe_id = p_recipe_id;
  
  RETURN COALESCE(v_nutrition, '{"calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0}'::JSONB);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION calculate_recipe_nutrition IS 'Calculates nutrition per serving from junction table ingredients';

-- =============================================================================
-- Step 2: Create trigger to auto-update nutrition when ingredients change
-- =============================================================================

CREATE OR REPLACE FUNCTION update_recipe_nutrition()
RETURNS TRIGGER AS $$
DECLARE
  v_recipe_id UUID;
BEGIN
  -- Get the affected recipe ID
  IF TG_OP = 'DELETE' THEN
    v_recipe_id := OLD.recipe_id;
  ELSE
    v_recipe_id := NEW.recipe_id;
  END IF;
  
  -- Recalculate and update nutrition
  UPDATE recipes 
  SET 
    nutrition_per_serving = calculate_recipe_nutrition(v_recipe_id),
    updated_at = NOW()
  WHERE id = v_recipe_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger (runs AFTER the validation trigger)
DROP TRIGGER IF EXISTS trg_recipe_ingredients_nutrition ON recipe_ingredients;

CREATE TRIGGER trg_recipe_ingredients_nutrition
  AFTER INSERT OR UPDATE OR DELETE ON recipe_ingredients
  FOR EACH ROW
  EXECUTE FUNCTION update_recipe_nutrition();

COMMENT ON FUNCTION update_recipe_nutrition IS 'Trigger function to recalculate recipe nutrition when ingredients change';

-- =============================================================================
-- Step 3: Also recalculate when ingredient macros are updated
-- =============================================================================

CREATE OR REPLACE FUNCTION update_nutrition_on_ingredient_change()
RETURNS TRIGGER AS $$
BEGIN
  -- If macros changed, recalculate all affected recipes
  IF OLD.macros IS DISTINCT FROM NEW.macros THEN
    UPDATE recipes r
    SET 
      nutrition_per_serving = calculate_recipe_nutrition(r.id),
      updated_at = NOW()
    FROM recipe_ingredients ri
    WHERE ri.ingredient_id = NEW.id
      AND ri.recipe_id = r.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_ingredient_macros_change ON ingredients;

CREATE TRIGGER trg_ingredient_macros_change
  AFTER UPDATE ON ingredients
  FOR EACH ROW
  EXECUTE FUNCTION update_nutrition_on_ingredient_change();

-- =============================================================================
-- Step 4: Recalculate all existing recipes' nutrition
-- =============================================================================

-- This updates all recipes with recalculated nutrition from junction table
DO $$
DECLARE
  r RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR r IN SELECT id FROM recipes
  LOOP
    UPDATE recipes 
    SET nutrition_per_serving = calculate_recipe_nutrition(r.id)
    WHERE id = r.id;
    v_count := v_count + 1;
  END LOOP;
  
  RAISE NOTICE 'Recalculated nutrition for % recipes', v_count;
END $$;

-- =============================================================================
-- Step 5: Drop legacy JSONB columns (AFTER confirming junction table has data)
-- =============================================================================

-- SAFETY CHECK: Only drop if junction table has data
DO $$
DECLARE
  v_junction_count INTEGER;
  v_recipe_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_junction_count FROM recipe_ingredients;
  SELECT COUNT(*) INTO v_recipe_count FROM recipes;
  
  IF v_junction_count = 0 AND v_recipe_count > 0 THEN
    RAISE EXCEPTION 'Junction table is empty but recipes exist. Run migrate_recipe_ingredients() first!';
  END IF;
  
  -- Safe to proceed
  RAISE NOTICE 'Safety check passed: % junction records, % recipes', v_junction_count, v_recipe_count;
END $$;

-- Drop the legacy ingredients JSONB column
ALTER TABLE recipes DROP COLUMN IF EXISTS ingredients;

-- Note: We keep instructions JSONB as it's still used for recipe steps
-- Note: We keep nutrition_per_serving as it's now auto-calculated by trigger

-- =============================================================================
-- Step 6: Add index for nutrition queries
-- =============================================================================

-- Use a functional index with proper casting
CREATE INDEX IF NOT EXISTS idx_recipes_nutrition_calories 
  ON recipes ((CAST(nutrition_per_serving->>'calories' AS INTEGER)));

-- Alternative: index on the JSONB path directly (for containment queries)
CREATE INDEX IF NOT EXISTS idx_recipes_nutrition_gin
  ON recipes USING GIN (nutrition_per_serving);

-- =============================================================================
-- Step 7: Create view for recipe with full details
-- =============================================================================

CREATE OR REPLACE VIEW recipes_with_ingredients AS
SELECT 
  r.id,
  r.name,
  r.description,
  r.image_url,
  r.meal_type,
  r.cuisine,
  r.tags,
  r.prep_time_minutes,
  r.cook_time_minutes,
  r.servings,
  r.difficulty,
  r.instructions,
  r.nutrition_per_serving,
  r.is_vegetarian,
  r.is_vegan,
  r.is_gluten_free,
  r.is_dairy_free,
  r.status,
  r.validation_errors,
  r.is_public,
  r.created_at,
  r.updated_at,
  -- Aggregate ingredients as JSONB array
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', ri.id,
          'ingredient_id', ri.ingredient_id,
          'spice_id', ri.spice_id,
          'raw_name', ri.raw_name,
          'display_name', COALESCE(
            CASE WHEN ri.is_spice THEN s.name ELSE i.name END,
            ri.raw_name
          ),
          'display_name_ar', COALESCE(
            CASE WHEN ri.is_spice THEN s.name_ar ELSE i.name_ar END,
            ri.raw_name
          ),
          'quantity', ri.quantity,
          'unit', ri.unit,
          'is_spice', ri.is_spice,
          'is_optional', ri.is_optional,
          'is_matched', ri.is_matched,
          'sort_order', ri.sort_order
        ) ORDER BY ri.sort_order
      )
      FROM recipe_ingredients ri
      LEFT JOIN ingredients i ON i.id = ri.ingredient_id
      LEFT JOIN spices s ON s.id = ri.spice_id
      WHERE ri.recipe_id = r.id
    ),
    '[]'::JSONB
  ) AS ingredients_list,
  -- Count stats
  (SELECT COUNT(*) FROM recipe_ingredients WHERE recipe_id = r.id) AS ingredient_count,
  (SELECT COUNT(*) FROM recipe_ingredients WHERE recipe_id = r.id AND is_matched = FALSE) AS unmatched_count
FROM recipes r;

GRANT SELECT ON recipes_with_ingredients TO authenticated;

COMMENT ON VIEW recipes_with_ingredients IS 'Recipe with aggregated ingredients from junction table';

-- =============================================================================
-- Step 8: Update permissions
-- =============================================================================

GRANT EXECUTE ON FUNCTION calculate_recipe_nutrition TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_recipe_nutrition TO service_role;

-- =============================================================================
-- Migration Complete
-- =============================================================================
-- Summary:
-- 1. Created calculate_recipe_nutrition() function
-- 2. Created trigger to auto-update nutrition on ingredient changes
-- 3. Created trigger for ingredient macro changes
-- 4. Recalculated all existing recipes
-- 5. Dropped legacy ingredients JSONB column
-- 6. Created recipes_with_ingredients view
-- =============================================================================
