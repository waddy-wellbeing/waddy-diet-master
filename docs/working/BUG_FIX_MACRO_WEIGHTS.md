# Bug Fix: Macro Similarity Weights Not Loading from Database

## Issue Description
User reported that even after setting `macro_similarity_weights` in admin settings to `{protein: 0.1, carbs: 0.3, fat: 0.2}`, the system was still showing high similarity scores (95/100) for recipes with significantly different protein percentages (14% vs 20%). This indicated that the hardcoded default weights were being used instead of the database settings.

## Root Cause
The `getRecipeAlternatives()` and `getIngredientSwaps()` functions in `/lib/actions/test-console.ts` were calling `calculateMacroSimilarity()` without loading and passing the custom weights from the database settings. The function had a default parameter `weights: { protein: 0.5, carbs: 0.3, fat: 0.2 }` which was always being used.

## Files Modified

### 1. `/lib/types/nutri.ts`
**Change**: Added macro comparison settings to `SystemSettingsMap` interface
```typescript
export interface SystemSettingsMap {
  meal_distribution: MealDistribution
  deviation_tolerance: number
  default_meals_per_day: number
  default_snacks_per_day: number
  min_calories_per_day: number
  max_calories_per_day: number
  scaling_limits: ScalingLimits
  macro_similarity_weights: { protein: number; carbs: number; fat: number }  // ✅ Added
  min_macro_similarity_threshold: number  // ✅ Added
}
```

### 2. `/lib/actions/test-console.ts`

#### getRecipeAlternatives() - Lines 348-378
**Before**:
```typescript
// No weight loading - used hardcoded defaults
const macroSimilarityScore = calculateMacroSimilarity(
  originalMacroProfile,
  altMacroProfile
  // Missing weights parameter
)
```

**After**:
```typescript
// Load macro similarity weights from settings (default to 50/30/20 if not set)
const { data: macroWeights } = await getSystemSetting('macro_similarity_weights')
const weights = macroWeights || { protein: 0.5, carbs: 0.3, fat: 0.2 }

// ... later in the loop ...
const macroSimilarityScore = calculateMacroSimilarity(
  originalMacroProfile,
  altMacroProfile,
  weights  // ✅ Now passing custom weights
)
```

#### getIngredientSwaps() - Lines 511-556
**Before**:
```typescript
// No weight loading - used hardcoded defaults
const macroSimilarityScore = calculateMacroSimilarity(
  originalMacroProfile,
  altMacroProfile
  // Missing weights parameter
)
```

**After**:
```typescript
// Get macro similarity weights from settings (default to 50/30/20 if not set)
const { data: macroWeights } = await getSystemSetting('macro_similarity_weights')
const weights = macroWeights || { protein: 0.5, carbs: 0.3, fat: 0.2 }

// ... later in the loop ...
const macroSimilarityScore = calculateMacroSimilarity(
  originalMacroProfile,
  altMacroProfile,
  weights  // ✅ Now passing custom weights
)
```

## Testing Instructions

### Test Case from Bug Report
1. Navigate to Admin → Settings
2. Set `macro_similarity_weights` to: `{"protein": 0.1, "carbs": 0.3, "fat": 0.2}`
3. Set `min_macro_similarity_threshold` to: `50`
4. Navigate to Test Console → Recipe Alternatives
5. Search for recipe: "جبنة بيضاء بالزعتر + توست بالعسل"

**Expected Results**:
- Original recipe macros: P:14% C:62% F:31%
- Alternative "زبادي بالشيا والتفاح والقرفة": P:20% C:62% F:33%
- **New similarity score**: ~74/100 (instead of 95/100)
  - Protein diff: 6% → score 94 × weight 0.1 = 9.4
  - Carbs diff: 0% → score 100 × weight 0.3 = 30.0
  - Fat diff: 2% → score 98 × weight 0.2 = 19.6
  - **Total: 59/100** (below threshold, should be filtered out)

### Comprehensive Testing Checklist

✅ **Recipe Alternatives Page** (`/admin/test-console/alternatives`)
- [ ] Change `protein` weight to 0.1 → verify protein-different recipes get lower scores
- [ ] Change `protein` weight to 0.8 → verify protein-different recipes are heavily penalized
- [ ] Change `carbs` weight to 0.8 → verify carb-different recipes are heavily penalized
- [ ] Change `fat` weight to 0.8 → verify fat-different recipes are heavily penalized
- [ ] Set `min_macro_similarity_threshold` to 80 → verify only high-similarity recipes shown
- [ ] Set `min_macro_similarity_threshold` to 30 → verify more alternatives shown

✅ **Ingredient Swaps Page** (`/admin/test-console/swaps`)
- [ ] Change weights → verify sorting changes based on macro priorities
- [ ] High protein weight → verify high-protein alternatives ranked higher
- [ ] Low protein weight → verify protein differences less important in ranking
- [ ] Threshold changes → verify filtering responds correctly

## Build Status
✅ **Build successful** - All TypeScript errors resolved
✅ **No runtime errors** - Code properly handles null/undefined cases with fallback defaults

## Commit Message
```
fix: Load macro similarity weights from database settings

- Add macro_similarity_weights and min_macro_similarity_threshold to SystemSettingsMap
- Load weights from database in getRecipeAlternatives() and getIngredientSwaps()
- Pass custom weights to calculateMacroSimilarity() instead of using defaults
- Fixes issue where admin-configured weights were ignored during calculations
```

## Related Files
- Migration: `/supabase/migrations/20251219_add_macro_similarity_settings.sql`
- Testing Guide: `/docs/working/TESTING_PHASE_3_4.md`
- Implementation Plan: `/docs/working/swap-alternative-implementation-plan.md` (Phases 3 & 4)
