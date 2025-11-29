-- =============================================================================
-- Migration: 004_recipe_ingredients_table
-- Description: Create proper junction table for recipe-ingredient relationships
--              with referential integrity, replacing JSONB approach
-- Created: 2025-11-29
-- =============================================================================

-- =============================================================================
-- Step 1: Add status/validation fields to recipes table (1:1 relationship)
-- =============================================================================

-- Create enum type for recipe validation status
DO $$ BEGIN
  CREATE TYPE recipe_status AS ENUM ('draft', 'complete', 'needs_review', 'error');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add status columns directly to recipes table (no separate table needed for 1:1)
ALTER TABLE recipes 
  ADD COLUMN IF NOT EXISTS status recipe_status NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS validation_errors JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS last_validated_at TIMESTAMPTZ;

COMMENT ON COLUMN recipes.status IS 'Recipe validation status: draft=incomplete, complete=ready, needs_review=admin attention, error=has issues';
COMMENT ON COLUMN recipes.validation_errors IS 'Array of validation error messages for admin review';
COMMENT ON COLUMN recipes.last_validated_at IS 'Timestamp of last validation check';

-- =============================================================================
-- Step 2: Create recipe_ingredients junction table (many-to-many relationship)
-- =============================================================================

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign keys with referential integrity
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES ingredients(id) ON DELETE SET NULL,
  spice_id UUID REFERENCES spices(id) ON DELETE SET NULL,
  
  -- Ingredient details
  raw_name TEXT NOT NULL,                    -- Original name (for display/fallback)
  quantity DECIMAL(10, 2),                   -- Amount (null for "حسب الرغبة")
  unit VARCHAR(50),                          -- Unit of measurement
  
  -- Flags
  is_spice BOOLEAN NOT NULL DEFAULT FALSE,
  is_optional BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Order in recipe
  sort_order INTEGER NOT NULL DEFAULT 0,
  
  -- For unmatched ingredients (admin review needed)
  is_matched BOOLEAN NOT NULL DEFAULT FALSE,
  match_confidence DECIMAL(3, 2),            -- 0.00 to 1.00 confidence score
  suggested_ingredient_id UUID REFERENCES ingredients(id) ON DELETE SET NULL,
  suggested_spice_id UUID REFERENCES spices(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT check_ingredient_or_spice CHECK (
    (is_spice = FALSE AND (ingredient_id IS NOT NULL OR is_matched = FALSE)) OR
    (is_spice = TRUE AND (spice_id IS NOT NULL OR is_matched = FALSE))
  ),
  CONSTRAINT check_spice_no_quantity CHECK (
    is_spice = FALSE OR (quantity IS NULL OR quantity = 0)
  )
);

-- Prevent duplicate ingredients in same recipe
CREATE UNIQUE INDEX IF NOT EXISTS idx_recipe_ingredients_unique 
  ON recipe_ingredients(recipe_id, ingredient_id) 
  WHERE ingredient_id IS NOT NULL AND is_spice = FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_recipe_spices_unique 
  ON recipe_ingredients(recipe_id, spice_id) 
  WHERE spice_id IS NOT NULL AND is_spice = TRUE;

-- =============================================================================
-- Step 3: Indexes for common queries
-- =============================================================================

-- Find all ingredients for a recipe
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe 
  ON recipe_ingredients(recipe_id, sort_order);

-- Find all recipes using an ingredient
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_ingredient 
  ON recipe_ingredients(ingredient_id) WHERE ingredient_id IS NOT NULL;

-- Find all recipes using a spice
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_spice 
  ON recipe_ingredients(spice_id) WHERE spice_id IS NOT NULL;

-- Find unmatched ingredients for admin review
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_unmatched 
  ON recipe_ingredients(is_matched, created_at) WHERE is_matched = FALSE;

-- =============================================================================
-- Step 4: RLS Policies
-- =============================================================================

ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;

-- Public recipes' ingredients are readable by all
CREATE POLICY "Public recipe ingredients are viewable by everyone"
  ON recipe_ingredients
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM recipes 
      WHERE recipes.id = recipe_ingredients.recipe_id 
      AND recipes.is_public = TRUE
    )
  );

-- Users can view ingredients of their own recipes
CREATE POLICY "Users can view their own recipe ingredients"
  ON recipe_ingredients
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM recipes 
      WHERE recipes.id = recipe_ingredients.recipe_id 
      AND recipes.created_by = auth.uid()
    )
  );

-- Admin/moderator full access
CREATE POLICY "Admins can manage all recipe ingredients"
  ON recipe_ingredients
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'moderator')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'moderator')
    )
  );

-- =============================================================================
-- Step 5: Trigger to update recipe status when ingredients change
-- =============================================================================

CREATE OR REPLACE FUNCTION update_recipe_validation()
RETURNS TRIGGER AS $$
DECLARE
  v_recipe_id UUID;
  v_unmatched_count INTEGER;
  v_errors JSONB;
BEGIN
  -- Get the recipe ID
  IF TG_OP = 'DELETE' THEN
    v_recipe_id := OLD.recipe_id;
  ELSE
    v_recipe_id := NEW.recipe_id;
  END IF;
  
  -- Count unmatched ingredients
  SELECT COUNT(*) INTO v_unmatched_count
  FROM recipe_ingredients
  WHERE recipe_id = v_recipe_id AND is_matched = FALSE;
  
  -- Build validation errors
  v_errors := '[]'::JSONB;
  
  IF v_unmatched_count > 0 THEN
    v_errors := v_errors || jsonb_build_array(
      jsonb_build_object(
        'type', 'unmatched_ingredients',
        'message', format('%s ingredient(s) not matched to database', v_unmatched_count),
        'count', v_unmatched_count
      )
    );
  END IF;
  
  -- Check if recipe has image
  IF NOT EXISTS (
    SELECT 1 FROM recipes 
    WHERE id = v_recipe_id AND image_url IS NOT NULL AND image_url != ''
  ) THEN
    v_errors := v_errors || jsonb_build_array(
      jsonb_build_object(
        'type', 'missing_image',
        'message', 'Recipe is missing cover image'
      )
    );
  END IF;
  
  -- Update recipe status
  UPDATE recipes SET
    validation_errors = v_errors,
    last_validated_at = NOW(),
    status = CASE
      WHEN jsonb_array_length(v_errors) > 0 THEN 'needs_review'::recipe_status
      ELSE 'complete'::recipe_status
    END
  WHERE id = v_recipe_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_recipe_ingredients_validation
  AFTER INSERT OR UPDATE OR DELETE ON recipe_ingredients
  FOR EACH ROW
  EXECUTE FUNCTION update_recipe_validation();

-- =============================================================================
-- Step 6: Migration function to convert existing JSONB to new table
-- =============================================================================

CREATE OR REPLACE FUNCTION migrate_recipe_ingredients()
RETURNS TABLE(
  recipe_id UUID,
  recipe_name TEXT,
  total_ingredients INTEGER,
  matched INTEGER,
  unmatched INTEGER
) AS $$
DECLARE
  r RECORD;
  ing JSONB;
  v_ingredient_id UUID;
  v_spice_id UUID;
  v_is_spice BOOLEAN;
  v_is_matched BOOLEAN;
  v_sort_order INTEGER;
  v_total INTEGER;
  v_matched INTEGER;
  v_unmatched INTEGER;
BEGIN
  -- Process each recipe
  FOR r IN SELECT id, name, ingredients FROM recipes WHERE ingredients IS NOT NULL AND jsonb_array_length(ingredients) > 0
  LOOP
    v_sort_order := 0;
    v_total := 0;
    v_matched := 0;
    v_unmatched := 0;
    
    -- Process each ingredient in the JSONB array
    FOR ing IN SELECT * FROM jsonb_array_elements(r.ingredients)
    LOOP
      v_sort_order := v_sort_order + 1;
      v_total := v_total + 1;
      v_is_spice := COALESCE((ing->>'is_spice')::BOOLEAN, FALSE);
      v_ingredient_id := NULL;
      v_spice_id := NULL;
      v_is_matched := FALSE;
      
      -- Try to match ingredient
      IF v_is_spice THEN
        -- Look for spice by ID first, then by name
        IF ing->>'ingredient_id' IS NOT NULL THEN
          SELECT id INTO v_spice_id FROM spices WHERE id = (ing->>'ingredient_id')::UUID;
        END IF;
        
        IF v_spice_id IS NULL AND ing->>'raw_name' IS NOT NULL THEN
          SELECT id INTO v_spice_id FROM spices 
          WHERE LOWER(name) = LOWER(ing->>'raw_name')
             OR LOWER(name_ar) = LOWER(ing->>'raw_name')
             OR LOWER(ing->>'raw_name') = ANY(SELECT LOWER(unnest(aliases)));
        END IF;
        
        v_is_matched := v_spice_id IS NOT NULL;
      ELSE
        -- Look for ingredient by ID first, then by name
        IF ing->>'ingredient_id' IS NOT NULL THEN
          SELECT id INTO v_ingredient_id FROM ingredients WHERE id = (ing->>'ingredient_id')::UUID;
        END IF;
        
        IF v_ingredient_id IS NULL AND ing->>'raw_name' IS NOT NULL THEN
          SELECT id INTO v_ingredient_id FROM ingredients 
          WHERE LOWER(name) = LOWER(ing->>'raw_name')
             OR LOWER(name_ar) = LOWER(ing->>'raw_name');
        END IF;
        
        v_is_matched := v_ingredient_id IS NOT NULL;
      END IF;
      
      IF v_is_matched THEN
        v_matched := v_matched + 1;
      ELSE
        v_unmatched := v_unmatched + 1;
      END IF;
      
      -- Insert into new table (skip if already exists)
      INSERT INTO recipe_ingredients (
        recipe_id,
        ingredient_id,
        spice_id,
        raw_name,
        quantity,
        unit,
        is_spice,
        is_optional,
        sort_order,
        is_matched
      ) VALUES (
        r.id,
        v_ingredient_id,
        v_spice_id,
        COALESCE(ing->>'raw_name', 'Unknown'),
        NULLIF((ing->>'quantity')::DECIMAL, 0),
        NULLIF(ing->>'unit', ''),
        v_is_spice,
        COALESCE((ing->>'is_optional')::BOOLEAN, FALSE),
        v_sort_order,
        v_is_matched
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
    
    -- Return stats for this recipe
    recipe_id := r.id;
    recipe_name := r.name;
    total_ingredients := v_total;
    matched := v_matched;
    unmatched := v_unmatched;
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Step 7: View for unmatched ingredients (admin dashboard)
-- =============================================================================

CREATE OR REPLACE VIEW unmatched_ingredients_view AS
SELECT 
  ri.id,
  ri.recipe_id,
  r.name AS recipe_name,
  ri.raw_name,
  ri.quantity,
  ri.unit,
  ri.is_spice,
  ri.created_at,
  -- Suggested matches (fuzzy search could be added here)
  CASE 
    WHEN ri.is_spice THEN (
      SELECT jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name))
      FROM spices s 
      WHERE s.name ILIKE '%' || ri.raw_name || '%' 
         OR s.name_ar ILIKE '%' || ri.raw_name || '%'
      LIMIT 5
    )
    ELSE (
      SELECT jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name, 'name_ar', i.name_ar))
      FROM ingredients i 
      WHERE i.name ILIKE '%' || ri.raw_name || '%' 
         OR i.name_ar ILIKE '%' || ri.raw_name || '%'
      LIMIT 5
    )
  END AS suggested_matches
FROM recipe_ingredients ri
JOIN recipes r ON r.id = ri.recipe_id
WHERE ri.is_matched = FALSE
ORDER BY ri.created_at DESC;

-- =============================================================================
-- Step 8: Helper function to match an ingredient
-- =============================================================================

CREATE OR REPLACE FUNCTION match_recipe_ingredient(
  p_recipe_ingredient_id UUID,
  p_ingredient_id UUID DEFAULT NULL,
  p_spice_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_is_spice BOOLEAN;
BEGIN
  -- Get is_spice flag
  SELECT is_spice INTO v_is_spice FROM recipe_ingredients WHERE id = p_recipe_ingredient_id;
  
  IF v_is_spice AND p_spice_id IS NOT NULL THEN
    UPDATE recipe_ingredients SET
      spice_id = p_spice_id,
      is_matched = TRUE,
      updated_at = NOW()
    WHERE id = p_recipe_ingredient_id;
    RETURN TRUE;
  ELSIF NOT v_is_spice AND p_ingredient_id IS NOT NULL THEN
    UPDATE recipe_ingredients SET
      ingredient_id = p_ingredient_id,
      is_matched = TRUE,
      updated_at = NOW()
    WHERE id = p_recipe_ingredient_id;
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Step 9: Grant permissions
-- =============================================================================

GRANT SELECT ON recipe_ingredients TO authenticated;
GRANT SELECT ON unmatched_ingredients_view TO authenticated;
GRANT ALL ON recipe_ingredients TO service_role;
GRANT EXECUTE ON FUNCTION migrate_recipe_ingredients TO service_role;
GRANT EXECUTE ON FUNCTION match_recipe_ingredient TO service_role;

-- =============================================================================
-- Step 10: Comments
-- =============================================================================

COMMENT ON TABLE recipe_ingredients IS 'Junction table linking recipes to ingredients/spices with proper FK relationships';
COMMENT ON FUNCTION migrate_recipe_ingredients IS 'One-time migration to convert JSONB ingredients to new table structure';
COMMENT ON FUNCTION match_recipe_ingredient IS 'Admin function to match unmatched ingredient to a database ingredient/spice';
COMMENT ON VIEW unmatched_ingredients_view IS 'Admin view showing all unmatched ingredients needing review';

-- =============================================================================
-- IMPORTANT: After running this migration, execute:
-- SELECT * FROM migrate_recipe_ingredients();
-- This will migrate existing JSONB data to the new table.
-- Then verify the data before dropping the ingredients JSONB column.
-- =============================================================================
