-- =============================================================================
-- Migration: 006_fix_spice_quantity_constraint
-- Description: Fix the migrate function and constraint for spice quantities
-- Created: 2025-11-29
-- =============================================================================

-- Option 1: Update the migration function to NULL out spice quantities
-- (This is needed to re-run the migration)

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
  v_quantity DECIMAL;
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
      
      -- For spices, set quantity to NULL (per constraint)
      IF v_is_spice THEN
        v_quantity := NULL;
      ELSE
        v_quantity := NULLIF((ing->>'quantity')::DECIMAL, 0);
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
        v_quantity,  -- NULL for spices
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
-- Now you can run: SELECT * FROM migrate_recipe_ingredients();
-- =============================================================================
