# Dashboard & Meal Builder Updates Summary

**Date**: December 21, 2025  
**Status**: ✅ Completed  
**Build Status**: ✅ Successful

---

## Changes Implemented

### 1. Removed Macro Display from Dashboard Meal Cards ✅

**File**: [components/dashboard/dashboard-components.tsx](components/dashboard/dashboard-components.tsx)

**What Changed**:
- Removed P/C/F macro breakdown from beneath calorie display
- Kept only calories and swap indicator
- Simplified meal card layout for cleaner UI

**Before**:
```
Meal Card:
┌─────────────────────────┐
│ Recipe Name             │
│ 520 cal                 │
│ P: 32g • C: 48g • F: 19g│ ← REMOVED
└─────────────────────────┘
```

**After**:
```
Meal Card:
┌─────────────────────────┐
│ Recipe Name             │
│ 520 cal                 │
└─────────────────────────┘
```

---

### 2. Fixed Calorie Calculation Bug in Dashboard ✅

**File**: [app/(app)/dashboard/dashboard-content.tsx](app/(app)/dashboard/dashboard-content.tsx)

**Bug**: Consumed calories showed 328 instead of 586 because the code used hardcoded `* 100` instead of actual recipe calories.

**Root Cause**:
```typescript
// OLD (BROKEN):
consumedCalories: log.dinner.items.reduce((sum, item) => 
  sum + (item.servings || 1) * 100, 0)  // ❌ Hardcoded 100 calories
```

**Fix**:
```typescript
// NEW (CORRECT):
const getLoggedCalories = (mealName: string): number => {
  const mealLog = log?.[mealName as keyof DailyLog]
  if (!mealLog?.items?.length) return 0
  
  const recipes = recipesByMealType[mealName as MealName] || []
  return mealLog.items.reduce((sum, item) => {
    const recipe = recipes.find(r => r.id === item.recipe_id)
    if (!recipe) return sum
    
    // Use scaled_calories which already accounts for scale_factor
    const calories = recipe.scaled_calories || 
      (recipe.nutrition_per_serving?.calories || 0)
    
    return sum + (calories * (item.servings || 1))  // ✅ Actual calories
  }, 0)
}
```

**Result**: Consumed calories now correctly shows 586 kcal (or whatever the actual recipe calories are) instead of 328 kcal.

---

### 3. Removed Target Badge from Meal Builder ✅

**File**: [app/(app)/meal-builder/meal-builder-content.tsx](app/(app)/meal-builder/meal-builder-content.tsx)

**What Changed**:
- Removed "✓ On Track" / "⚠ Target" badge that was always visible
- Replaced with admin-only debug button

**Before**:
```
Recipe Header:
┌────────────────────────────┐
│  Recipe Name               │
│  500 cal • P:32g • C:48g   │
│  ✓ On Track                │ ← REMOVED (always visible)
└────────────────────────────┘
```

**After**:
```
Recipe Header:
┌────────────────────────────┐
│  Recipe Name        [i] [🐛]│ ← Debug button (admin only)
│  500 cal • P:32g • C:48g   │
└────────────────────────────┘
```

---

### 4. Added Admin-Only Debug Button ✅

**Files**: 
- [app/(app)/meal-builder/page.tsx](app/(app)/meal-builder/page.tsx) - Pass `userRole` prop
- [app/(app)/meal-builder/meal-builder-content.tsx](app/(app)/meal-builder/meal-builder-content.tsx) - Debug UI

**What Changed**:
1. Added `userRole` prop to `MealBuilderContent` from profile
2. Added 🐛 debug button visible only to admins and moderators
3. Clicking button toggles debug panel showing:
   - Target calories for the meal
   - Target macros (protein, carbs, fat)
   - Difference from target (e.g., "+5g protein")
   - Status: ✓ On Track or ⚠ Off Track

**Access Control**:
```typescript
{(userRole === 'admin' || userRole === 'moderator') && (
  <motion.button onClick={() => setShowDebugInfo(!showDebugInfo)}>
    <span>🐛</span>
  </motion.button>
)}
```

**Debug Panel**:
```
┌─────────────────────────────────────┐
│ 🐛 Debug Info (Admin Only)          │
│                                     │
│ Target Calories:    500 kcal        │
│ Target Protein:     35g (✓)         │
│ Target Carbs:       50g (+2g)       │
│ Target Fat:         20g             │
│                                     │
│ Status: ✓ On Track                  │
└─────────────────────────────────────┘
```

**Visibility**:
- Regular users: Button is hidden
- Admins/Moderators: Button visible, toggles debug panel

---

## Files Modified (4 total)

| File | Changes | Purpose |
|------|---------|---------|
| `components/dashboard/dashboard-components.tsx` | -25 lines | Removed macro display from meal cards |
| `app/(app)/dashboard/dashboard-content.tsx` | +18 lines | Fixed calorie calculation bug |
| `app/(app)/meal-builder/page.tsx` | +1 line | Pass userRole to content |
| `app/(app)/meal-builder/meal-builder-content.tsx` | +73 lines | Remove target badge, add debug button |

---

## Testing Checklist

### Dashboard
- [x] Consumed calories show correct values (586 instead of 328)
- [x] Macro display removed from meal cards
- [x] Swap indicator still visible
- [x] Weekly overview calculates correctly
- [x] Logging meals updates consumed calories properly

### Meal Builder
- [x] Target badge removed from regular view
- [x] Debug button visible only to admins
- [x] Debug button hidden for regular users
- [x] Debug panel toggles on/off
- [x] Target values display correctly
- [x] Difference calculations accurate (protein ±5g, carbs ±10g)
- [x] "On Track" vs "Off Track" status correct

---

## Bug Fix Details

### Original Bug Report
User noticed that despite logging a 586-calorie dinner, the dashboard showed only 328 kcal consumed.

### Investigation
The `consumedCalories` calculation in `dashboard-content.tsx` was using:
```typescript
log.dinner.items.reduce((sum, item) => sum + (item.servings || 1) * 100, 0)
```

This hardcoded `* 100` for every item, ignoring actual recipe calories.

### Solution
Created `getLoggedCalories()` helper that:
1. Finds the actual recipe by `recipe_id`
2. Uses `scaled_calories` (already accounts for scale_factor)
3. Multiplies by servings from log
4. Returns accurate calorie sum

### Result
Dashboard now correctly displays 586 kcal for the logged dinner meal.

---

## User Experience Impact

### Before Changes
- ❌ Dashboard showed wrong consumed calories
- ❌ Macro details on every meal card (information overload)
- ❌ Target badge always visible (distracting for users)
- ❌ No way for admins to debug macro targets

### After Changes
- ✅ Dashboard shows accurate consumed calories
- ✅ Cleaner meal cards (calories only)
- ✅ Target information hidden from regular users
- ✅ Admins can debug macro targets with 🐛 button
- ✅ Better separation of concerns (user view vs admin tools)

---

## Build Status

✅ **TypeScript**: No errors  
✅ **Next.js Build**: Successful (16.0.10 Turbopack)  
✅ **All Routes**: Compiling correctly  
✅ **Production Ready**: Yes

---

## Notes

- Debug button uses 🐛 emoji for easy recognition
- Debug panel styled with red border to indicate admin-only
- Target thresholds: Protein ±5g, Carbs ±10g (same as before)
- `userRole` checks both 'admin' and 'moderator' roles
- Calorie calculation now matches what `handleLogMeal` stores in database
