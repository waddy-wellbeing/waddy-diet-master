# Recipe Ingredients Migration Plan

> Phase 4.5: Recipe Ingredients Refactor
> Created: 2024-11-29
> Status: In Progress

## Overview

This plan addresses the migration from JSONB-based recipe ingredients to a proper junction table (`recipe_ingredients`) with full referential integrity. The goal is to ensure data integrity, enable FK constraints, and provide admin tools for managing unmatched ingredients.

---

## Completed Steps ✅

### Migration 004 (DEPLOYED)
- [x] Created `recipe_status` enum: `draft`, `complete`, `needs_review`, `error`
- [x] Added `status`, `validation_errors`, `last_validated_at` columns to `recipes`
- [x] Created `recipe_ingredients` junction table with:
  - FKs to `recipes`, `ingredients`, `spices`
  - `is_matched` flag for tracking unresolved ingredients
  - `raw_name` for display/fallback
  - Constraints for ingredient/spice validation
- [x] Created validation trigger `update_recipe_validation()`
- [x] Created migration function `migrate_recipe_ingredients()`
- [x] Created view `unmatched_ingredients_view`
- [x] Created helper function `match_recipe_ingredient()`
- [x] Set up RLS policies

### Migration 005 (READY TO DEPLOY)
- [x] Created `calculate_recipe_nutrition()` function
- [x] Created trigger `update_recipe_nutrition()` for auto-recalculation
- [x] Created trigger for ingredient macro changes
- [x] Drop legacy `ingredients` JSONB column
- [x] Created `recipes_with_ingredients` view

### Seed Script Updates (COMPLETED)
- [x] Updated `scripts/types.ts` with `RecipeIngredientInsert` type
- [x] Updated `scripts/seed-recipes.ts`:
  - [x] Added `buildSpiceLookupWithIds()` function for spice ID resolution
  - [x] Updated `buildRecipe()` to return junction records
  - [x] Updated `seedRecipes()` to:
    - Insert recipes first
    - Then insert `recipe_ingredients` junction records
    - Handle unmatched with null FK + notes + error status
  - [x] Updated `exportRecipesTable()` to use junction table counts

---

## Remaining Steps

### Step 1: Run Migration 005 📝 (READY)

**File:** `supabase/migrations/005_recipe_cleanup.sql`

Run this migration in Supabase after confirming junction table has data:
1. Creates `calculate_recipe_nutrition()` function
2. Creates triggers for auto-updating nutrition
3. Drops legacy `ingredients` JSONB column
4. Creates `recipes_with_ingredients` view

### Step 2: Update Recipe Actions 📝 (PENDING)

**File:** `lib/actions/recipes.ts`

**Changes needed:**
1. `createRecipe`: Insert into `recipe_ingredients` instead of JSONB
2. `updateRecipe`: Update junction table, not JSONB
3. `deleteRecipe`: Handled by CASCADE (already works)
4. `getRecipeIngredients`: Query junction table with joins
5. `matchIngredient`: Admin action to resolve unmatched ingredients

### Step 3: Update Recipe Form 📝 (PENDING)

**File:** `components/admin/recipe-form-dialog.tsx`

**Changes needed:**
1. Fetch ingredients from junction table (join with `ingredients`/`spices`)
2. Save ingredients to junction table
3. Show unmatched warning with resolution UI

### Step 4: Create Admin UI for Unmatched Ingredients 📝 (PENDING)

**Files:**
- `app/admin/recipes/unmatched/page.tsx`
- `components/admin/unmatched-ingredients-table.tsx`

**Features:**
- List all unmatched ingredients (from `unmatched_ingredients_view`)
- Show suggested matches (fuzzy)
- Bulk match action
- Create new ingredient from unmatched

---

## Database Commands Reference

### Run Migration (already done)
```sql
-- This was already executed
SELECT * FROM migrate_recipe_ingredients();
```

### Check Migration Status
```sql
-- Count records in junction table
SELECT COUNT(*) FROM recipe_ingredients;

-- Check recipe statuses
SELECT status, COUNT(*) 
FROM recipes 
GROUP BY status;

-- View unmatched ingredients
SELECT * FROM unmatched_ingredients_view;
```

### Manual Match Ingredient
```sql
-- Match a recipe ingredient to a database ingredient
SELECT match_recipe_ingredient(
  'recipe_ingredient_uuid',
  'ingredient_uuid',  -- or NULL for spices
  'spice_uuid'        -- or NULL for ingredients
);
```

---

## File Changes Summary

| File | Action | Status |
|------|--------|--------|
| `scripts/seed-recipes.ts` | Update to populate junction table | ✅ Done |
| `scripts/types.ts` | Add `RecipeIngredientInsert` type | ✅ Done |
| `supabase/migrations/005_recipe_cleanup.sql` | Create cleanup migration | ✅ Done (run pending) |
| `lib/types/nutri.ts` | Add junction table types | 📝 Pending |
| `lib/actions/recipes.ts` | Update CRUD operations | 📝 Pending |
| `components/admin/recipe-form-dialog.tsx` | Update form to use junction | 📝 Pending |
| `app/admin/recipes/unmatched/page.tsx` | Create admin page | 📝 Pending |

---

## Execution Order

1. **Run migration 005** in Supabase SQL Editor
2. **Re-run seed script** with `npm run seed` (will populate junction table)
3. **Update recipe actions** to use junction table
4. **Update recipe form** to use junction table  
5. **Create unmatched ingredients admin UI**

---

## Rollback Plan

If issues arise:

1. **Junction table data loss:** Re-run `migrate_recipe_ingredients()` from original JSONB
2. **JSONB column dropped too early:** The original data is in `recipe_ingredients.raw_name`
3. **Status issues:** Reset with `UPDATE recipes SET status = 'draft'`

---

## Testing Checklist

- [ ] Seed script creates junction table records correctly
- [ ] Unmatched ingredients have `is_matched = FALSE`
- [ ] Recipe status updates to `error` when unmatched
- [ ] Nutrition trigger recalculates on ingredient change
- [ ] Admin can view unmatched ingredients
- [ ] Admin can match ingredients via UI
- [ ] Recipe form saves to junction table
- [ ] Public API returns nutrition correctly

---

## Notes

- Keep `ingredients` JSONB column until all systems are migrated
- The `raw_name` field in junction table serves as fallback/display
- Consider adding full-text search for better ingredient matching
- Spices never contribute to nutrition calculations
