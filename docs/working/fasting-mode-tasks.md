# Fasting Mode - Implementation Tasks (V3)

## 📖 Story Overview

**User Story:**
As a user, I want to toggle "Fasting Mode" in my profile settings so that my meal plans adapt to fasting schedules (Pre-Iftar, Iftar, Suhoor) instead of regular meals (Breakfast, Lunch, Dinner), while preserving both meal plans independently so I can switch between them without losing data.

**Implementation Approach:**
We will implement fasting mode by **reusing the exact same logic as the current regular plan system**, but with:

- Different meal names (`pre-iftar`, `iftar`, `suhoor` instead of `breakfast`, `lunch`, `dinner`)
- Different percentage templates for fasting schedules
- A separate JSONB column (`fasting_plan`) to store the fasting meal structure
- **Same UI flow**: Recommendations → User browses → User saves explicitly

This approach ensures scalability and consistency - no new complex logic, just applying existing patterns to a new data structure.

---

## 🔄 **User Flow Comparison**

### **Regular Mode Flow:**

1. User navigates to dashboard
2. System fetches `daily_plans.plan` for today
3. If empty → Show recipe **recommendations** (not saved yet)
4. User browses recommendations, swaps meals
5. User clicks **SAVE button** → Saves to `daily_plans.plan`
6. Dashboard now shows saved plan

### **Fasting Mode Flow (EXACTLY THE SAME):**

1. **User toggles ON in profile** → Sets mode, checks `fasting_meals_per_day` (prompts if not set)
2. User navigates to dashboard
3. System fetches `daily_plans.fasting_plan` for today
4. If empty → Show recipe **recommendations** (not saved yet) using fasting templates
5. User browses recommendations, swaps meals
6. User clicks **SAVE button** → Saves to `daily_plans.fasting_plan`
7. Dashboard now shows saved fasting plan

**Key Point:** Toggle just switches WHERE to fetch data from (`plan` vs `fasting_plan`). Everything else is identical.

---

## ✅ Implementation Tasks

### 📚 HOW REGULAR MODE CHOOSES RECIPES

**Understanding the existing logic before implementing fasting mode:**

#### **1. Calorie Calculation**

- User has `daily_calories` target (e.g., 2000 kcal)
- Meal structure defines percentages (e.g., breakfast: 25%, lunch: 35%, dinner: 30%, snacks: 10%)
- Target calories per meal = `daily_calories * (percentage / 100)`
  - Example: Breakfast = 2000 \* 0.25 = **500 calories**

#### **2. Meal Type Filtering (Recipe Type Mapping)**

Each meal slot maps to acceptable recipe types from the database:

```typescript
const mealTypeMapping = {
  breakfast: ["breakfast", "smoothies"],
  lunch: ["lunch", "one pot", "dinner", "side dishes"],
  dinner: ["dinner", "lunch", "one pot", "side dishes", "breakfast"],
  snacks: ["snack", "snacks & sweetes", "smoothies"],
};
```

**Logic:**

- For user's "lunch" meal, system searches recipes with `meal_type` IN `['lunch', 'one pot', 'dinner', 'side dishes']`
- This allows flexibility (e.g., dinner recipes can be used for lunch)
- Database stores `meal_type` as array: `['lunch', 'dinner']`

#### **3. Dynamic Scaling (Scale Factor)**

Recipes can be scaled up or down to hit exact calorie targets:

```typescript
const baseCalories = recipe.nutrition_per_serving.calories; // e.g., 400 cal
const targetCalories = 500; // User's breakfast target
const scaleFactor = targetCalories / baseCalories; // 500 / 400 = 1.25x

// Limits: 0.5x - 2.0x (from system settings)
if (scaleFactor < 0.5 || scaleFactor > 2.0) {
  // Skip recipe - can't scale enough to hit target
}
```

**Example:**

- Recipe: Omelette (400 cal base)
- User needs: 500 cal breakfast
- Scale factor: 1.25x (add more ingredients)

#### **4. Macro Similarity Scoring**

Recipes are scored based on how well they match user's macro targets:

```typescript
// Calculate target macro percentages (from user's daily targets)
const targetProteinPct = ((dailyProtein * 4) / dailyCalories) * 100; // e.g., 30%
const targetCarbsPct = ((dailyCarbs * 4) / dailyCalories) * 100; // e.g., 40%
const targetFatPct = ((dailyFat * 9) / dailyCalories) * 100; // e.g., 30%

// Calculate recipe macro percentages
const recipeProteinPct = ((recipeProtein * 4) / baseCalories) * 100;
// ... same for carbs/fat

// Similarity score (0-100, higher = better match)
const proteinScore = max(
  0,
  100 - abs(targetProteinPct - recipeProteinPct) * 1.5,
);
const carbsScore = max(0, 100 - abs(targetCarbsPct - recipeCarbsPct) * 1.5);
const fatScore = max(0, 100 - abs(targetFatPct - recipeFatPct) * 1.5);

const macroSimilarityScore =
  proteinScore * 0.5 + carbsScore * 0.3 + fatScore * 0.2;
// Protein weighted 50%, Carbs 30%, Fat 20%
```

#### **5. Recipe Sorting Priority**

1. **Macro similarity** (highest score first) - difference > 5 points
2. **Primary meal type** (exact match preferred: "breakfast" for breakfast slot)
3. **Scale factor closest to 1.0** (less modification needed)

#### **6. Recipe Swapping**

- User can swap entire recipes within the same meal slot
- System shows alternatives with similar calories/macros
- Tracks `original_recipe_id` if swapped

#### **7. Ingredient Swapping**

- User can swap individual ingredients within a recipe
- Tracks swapped ingredients with quantities
- Recalculates nutrition based on swaps

---

### **Fasting Mode Differences:**

- ✅ **Same calorie calculation** (daily_calories \* percentage)
- ✅ **Same scaling logic** (0.5x - 2.0x)
- ✅ **Same macro similarity scoring**
- ✅ **Same sorting priority**
- ❌ **SKIP meal type filtering for now** - Will be implemented later
  - Fasting mode will use ALL recipes initially (no type restriction)
  - Future: Define mappings like `iftar: ['dinner', 'lunch', 'one pot']`
- ✅ Different meal names: `iftar`, `suhoor`, `pre-iftar` instead of `breakfast`, `lunch`, `dinner`

---

### Phase 1: Database Schema (Foundation)

**Task 1.1: Create Migration File** ✅ COMPLETED

- [x] Migration already exists with mode column and fasting_plan
- [x] `daily_plans.mode` column tracks 'regular' or 'fasting' per plan
- [x] `daily_plans.fasting_plan` JSONB column stores fasting meal structure
- [x] **NOTE**: Only ONE `daily_totals` column for both modes (no `fasting_daily_totals`)

**Task 1.2: Update TypeScript Types** ✅ COMPLETED

- [x] File: `lib/types/nutri.ts`
- [x] Added to `ProfilePreferences`:
  ```typescript
  is_fasting?: boolean                    // Toggle state (true = fasting mode)
  fasting_selected_meals?: string[]       // Selected fasting meal types
  ```
- [x] Updated `DailyPlan` interface:
  ```typescript
  mode?: 'regular' | 'fasting'           // Historical record of which mode was used
  // Regular meals
  breakfast?: PlanMealSlot
  lunch?: PlanMealSlot
  dinner?: PlanMealSlot
  snacks?: PlanSnackItem[]
  // Fasting meals
  'pre-iftar'?: PlanMealSlot
  iftar?: PlanMealSlot
  'full-meal-taraweeh'?: PlanMealSlot
  'snack-taraweeh'?: PlanSnackItem[]
  suhoor?: PlanMealSlot
  ```
- [x] **IMPORTANT**: `daily_totals` used for BOTH regular and fasting (no separate column)

**Architecture Notes:**

- `preferences.is_fasting`: **Boolean toggle** stored in user preferences for cross-device sync
  - Values: `true` (fasting mode) | `false` (regular mode)
  - Default: `false` for all users
  - **Primary mode indicator** - dashboard checks this to decide which UI to show
- `preferences.fasting_selected_meals`: **String array** storing selected fasting meal types
  - Example: `['pre-iftar', 'iftar', 'suhoor']` for 3-meal fasting
  - Dynamically built based on user selection in onboarding/profile
  - Used to determine which meals to display in fasting dashboard
- `daily_plans.mode`: **Database column** storing which mode was active when plan was saved
  - Values: `'regular'` | `'fasting'` (TEXT with CHECK constraint)
  - Default: `'regular'` for all new/existing records
  - **Historical record** - tracks which mode generated the plan (for future analytics)
- `targets`: Uses **same** `daily_calories` for both modes (no separate fasting calories - too complex for now)
- `daily_plans`: Stores BOTH `plan` (regular recipes) AND `fasting_plan` (fasting recipes) in same row
  - **IMPORTANT**: Only ONE `daily_totals` column used for BOTH modes (no separate `fasting_daily_totals`)
  - When saving fasting plan → updates `fasting_plan` + `daily_totals` columns
  - When saving regular plan → updates `plan` + `daily_totals` columns
  - `daily_totals` gets overwritten based on which mode is currently active
- **Dashboard Logic**:
  - Check `preferences.is_fasting` to decide which dashboard component to render
  - FastingDashboardContent fetches from `fasting_plan` column
  - DashboardContent fetches from `plan` column
  - Both use same `daily_totals` for calorie tracking

---

### Phase 2: Fasting Templates Configuration

**Task 2.1: Create Fasting Templates Config File**

- [ ] Create file: `lib/config/fasting-templates.ts`
- [ ] Define fasting meal templates (mirroring regular templates from `lib/actions/users.ts`):
  ```typescript
  export const FASTING_TEMPLATES = {
    3: [
      {
        name: "pre-iftar",
        label: "Pre-Iftar",
        label_ar: "كسر صيام",
        percentage: 10,
      },
      { name: "iftar", label: "Iftar", label_ar: "إفطار", percentage: 45 },
      { name: "suhoor", label: "Suhoor", label_ar: "سحور", percentage: 45 },
    ],
    4: [
      {
        name: "pre-iftar",
        label: "Pre-Iftar",
        label_ar: "كسر صيام",
        percentage: 10,
      },
      { name: "iftar", label: "Iftar", label_ar: "إفطار", percentage: 40 },
      { name: "snacks", label: "Snacks", label_ar: "سناكس", percentage: 15 },
      { name: "suhoor", label: "Suhoor", label_ar: "سحور", percentage: 35 },
    ],
    // ... add templates for 5, 6 meals
  };
  ```
- [ ] Export helper function:
  ```typescript
  export function getFastingTemplate(mealsPerDay: number): MealSlot[] | null;
  ```
- [ ] Test: Import and verify templates return correct structure

**Task 2.2: Document Template Percentages**

- [ ] Add comment in config file explaining percentage constraints:
  - `pre-iftar`: Always 10% max (light meal to break fast)
  - `iftar`: 25%-45% range (main meal)
  - `suhoor`: 25%-45% range (pre-dawn meal)
  - Other meals: Fill remaining percentage

---

### Phase 3: Fasting Plan Generation Logic

**Task 3.1: Create Fasting Mode Preference Functions** ✅

- [x] File: `lib/actions/users.ts`
- [x] Create function: `setFastingModePreferences(userId: string, fastingMealsPerDay: number)` ~~, fastingDailyCalories?: number~~ **REMOVED**
  - Sets `preferences.fasting_meals_per_day` (2-5)
  - ~~Sets `targets.fasting_daily_calories`~~ **SKIPPED** - Uses same `daily_calories` for both modes
  - Validates meal count range
- [x] Simplified pattern:
  - Regular: `preferences.meals_per_day` + `targets.daily_calories`
  - Fasting: `preferences.fasting_meals_per_day` + **same** `targets.daily_calories` (no separate calculation)

**Task 3.2: Create Toggle Function** ✅

- [x] File: `lib/actions/users.ts`
- [x] Create function: `togglePlanMode(userId: string, planDate: string, mode: 'regular' | 'fasting')`
- [x] Logic:
  1. Update `daily_plans.mode` column for specific date ✅
  2. NO automatic plan generation (plans already exist in both columns) ✅
  3. Dashboard uses `mode` value to decide which plan column to display ✅
  4. Return success/error status ✅
- [x] Add server action decorator: `'use server'` ✅

**Implementation Notes:**

- Toggle updates `daily_plans.mode` column (NOT user preferences) ✅
- Mode stored **per plan** - allows different modes for different days ✅
- NO meal structure stored in preferences (only count) ✅
- NO automatic plan generation in toggle (keeps performance high) ✅
- Both `plan` and `fasting_plan` exist in same row - toggle just switches display ✅
- **Regular mode logic unchanged** - only check when `mode === 'fasting'` ✅

**Task 3.3: Create Fasting Plan Save Function** ✅

- [x] File: `lib/actions/fasting-plans.ts` (new file)
- [x] Create function: `generateFastingPlan(userId: string, planDate: string)` (note: naming kept for consistency but it's really a SAVE function)
- [x] Logic implemented:
  1. Fetch user's `targets.daily_calories` and `preferences.fasting_meals_per_day` ✅
  2. Get fasting template from `getFastingTemplate(fasting_meals_per_day)` ✅
  3. Calculate target calories per meal: `daily_calories * (percentage / 100)` ✅
  4. Fetch all public recipes from database ✅
  5. Assign recipes to each fasting meal (iftar, suhoor, etc.) ✅
  6. Save to `daily_plans.fasting_plan` column ✅
  7. Return success/error status ✅
- [x] Mirrored regular plan generation logic (scaling, macro scoring, sorting) ✅
- [x] Added server action decorator: `'use server'` ✅

**Recipe Assignment Strategy:**

- ✅ Dynamic scaling (0.5x - 2.0x) to hit exact calorie targets
- ✅ Macro similarity scoring (protein 50%, carbs 30%, fat 20%)
- ✅ Sorting by: macro score → scale factor closest to 1.0
- ❌ **NO meal type filtering** (as requested) - will add mapping later
- ✅ Uses ALL public recipes for now (breakfast recipes can be used for iftar, etc.)

**IMPORTANT - Flow Clarification:**

- ❌ **NOT auto-called** on toggle (removed auto-generation)
- ✅ Called **explicitly when user clicks SAVE button** in dashboard
- ✅ Same flow as regular mode: Show recommendations → User browses → User saves
- ✅ Dashboard shows recipe recommendations until user explicitly saves
- ✅ Toggle just switches UI state between regular/fasting data sources

---

### Phase 4: UI Components ✅ COMPLETED

**Task 4.1: Fasting Mode Toggle** ✅ COMPLETED

- [x] Toggle moved to profile page (not dashboard)
- [x] Stores state in `preferences.is_fasting` (boolean)
- [x] Dashboard routing based on `is_fasting` flag
- [x] Separate dashboards: `FastingDashboardContent` and `DashboardContent`

**Task 4.2: Dashboard Split** ✅ COMPLETED

- [x] `FastingDashboardContent` - Fasting meals with ordered slots
- [x] `DashboardContent` - Regular meals only
- [x] Page.tsx routes based on `preferences.is_fasting`
- [x] Each dashboard independent and maintainable

**Task 4.3: MealPlanSheet Component** ✅ COMPLETED

- [x] Updated to support both regular and fasting modes
- [x] Added `isFastingMode` prop (boolean, defaults to false)
- [x] Conditional meal types:
  - Regular: Breakfast 🍳, Lunch 🍱, Dinner 🍽️, Snacks 🍎
  - Fasting: كسر صيام 🥤, إفطار 🍽️, وجبة بعد التراويح 🍱, سناك بعد التراويح 🍎, سحور 🌙
- [x] Passes `isFastingMode` to all server actions
- [x] FastingDashboardContent passes `isFastingMode={true}`
- [x] DashboardContent passes `isFastingMode={false}`

---

### Phase 5: Server Actions ✅ COMPLETED

**Task 5.1: Save Actions Updated** ✅ COMPLETED

- [x] `saveMealToPlan()` - Accepts `isFastingMode` parameter
  - Saves to `fasting_plan` if true, `plan` if false
  - **Uses `daily_totals` for both modes** (no separate fasting_daily_totals)
  - Sets `mode` column to 'fasting' or 'regular'
- [x] `saveFullDayPlan()` - Accepts `isFastingMode` parameter
  - Same dual-column logic as saveMealToPlan
- [x] File: `lib/actions/daily-plans.ts`

**Task 5.2: Get Actions Updated** ✅ COMPLETED

- [x] `getPlan()` - Accepts `isFastingMode` parameter
  - Fetches from `fasting_plan` if true, `plan` if false
  - Returns correct meal structure based on mode
- [x] File: `lib/actions/meal-planning.ts`

**Task 5.3: Remove Actions Updated** ✅ COMPLETED

- [x] `removePlanMeal()` - Accepts `isFastingMode` parameter
  - Removes from correct column based on mode
  - Handles both regular and fasting meal structures
- [x] File: `lib/actions/meal-planning.ts`

**Current Database Schema:**

```
daily_plans:
  - plan (JSONB) - Regular meals
  - fasting_plan (JSONB) - Fasting meals
  - daily_totals (JSONB) - Shared totals for BOTH modes
  - mode (TEXT) - 'regular' or 'fasting' (historical record)
```

---

### Phase 6: Current Status & Remaining Work

**✅ COMPLETED:**

1. Dashboard split into separate components (FastingDashboardContent + DashboardContent)
2. Routing based on `preferences.is_fasting` flag
3. Fasting meal ordering: pre-iftar → iftar → full-meal-taraweeh → snack-taraweeh → suhoor
4. Recipe recommendations working for fasting meals
5. Calorie distribution for fasting meals (10% pre-iftar, 40% iftar, etc.)
6. Pre-iftar uses unique "pre-iftar" meal_type from database
7. Save/load actions use correct columns (plan vs fasting_plan)
8. MealPlanSheet component supports both modes
9. Auto-save functionality for both modes
10. Swap functionality working in fasting mode
11. **Database uses single `daily_totals` column for both modes**

**🔧 KNOWN LIMITATIONS:**

- ❌ No separate `fasting_daily_totals` column (uses same `daily_totals` for both)
- ❌ No meal type filtering for fasting (all recipes available for all fasting meals)
- ❌ Future: May need separate calorie calculations for fasting vs regular

**📋 TESTING NEEDED:**

- [ ] Test: Switch modes and verify correct meals appear
- [ ] Test: Save plan in fasting mode → Check database `fasting_plan` column
- [ ] Test: Save plan in regular mode → Check database `plan` column
- [ ] Test: MealPlanSheet shows Arabic labels in fasting mode
- [ ] Test: Both modes share same `daily_totals` (no separate totals)
- [ ] Test: Swap functionality in both modes
- [ ] Test: Auto-save in both modes

**🚀 READY FOR:**

- User testing with both regular and fasting modes
- Verifying calorie calculations are accurate
- Confirming UI displays correct meal types
- Testing mode switching doesn't lose data

---

## 🔄 Future Work (Not in This Phase)

**1. Separate Fasting Calorie Calculations** - Deferred due to complexity:

- `targets.fasting_daily_calories` field (separate from regular `daily_calories`)
- Different TDEE/BMR calculation logic for fasting periods
- **Reason for delay**: Requires nutritional research and validation
- **Current approach**: Use same `daily_calories` for both modes (simpler, safe)
- **Future enhancement**: Allow users to set different calorie targets for fasting vs regular modes

**2. Mode Column Enhancement** - Consider ENUM instead of boolean:

- Replace `is_fasting_mode` boolean with `mode` ENUM column
- Values: `'regular'` | `'fasting'` | `'bulking'` | `'cutting'` | `'maintenance'`
- Enables future diet modes without schema changes
- Allows database filtering: `WHERE mode = 'fasting'` (cleaner than `WHERE is_fasting_mode = true`)

**3. Meal Removal Feature** - Will be implemented later with scalability:

- Option A: Auto-recalculate all meals
- Option B: Add calories to specific meal
- Option C: Manual recipe selection
- This will be added as a separate feature that works for BOTH regular and fasting modes

---

## 📝 Implementation Notes

### Key Principles

1. **Reuse Existing Logic**: The fasting plan generation should mirror the current `assignMealStructure()` exactly
2. **Dual Storage**: Both plans live in the same `daily_plans` row - no separate tables
3. **Simple Toggle**: UI just picks which plan to display based on a boolean flag
4. **No Data Loss**: Toggling modes preserves both meal structures

### Code Patterns to Follow

- Use the same Supabase query patterns as existing code
- Use the same calorie calculation formulas
- Use the same server action patterns (`'use server'`, revalidatePath, etc.)
- Use the same UI component patterns (shadcn/ui, Tailwind classes)

### Estimated Timeline

- Phase 1: 1-2 hours
- Phase 2: 1-2 hours
- Phase 3: 3-4 hours
- Phase 4: 2-3 hours
- Phase 5: 1-2 hours
- Phase 6: 2-3 hours
- **Total: ~1.5-2 days**

---

## ✅ Definition of Done

- [ ] User can toggle fasting mode in profile settings
- [ ] Dashboard displays correct meal names based on mode (regular vs fasting)
- [ ] Both meal plans are preserved when toggling
- [ ] Calorie calculations are accurate for fasting templates
- [ ] Arabic labels display correctly
- [ ] No TypeScript errors
- [ ] All tests pass
- [ ] Code follows existing patterns and conventions
