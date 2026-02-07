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

**Task 1.1: Create Migration File**

- [ ] Create file: `supabase/migrations/<timestamp>_add_fasting_mode_to_daily_plans.sql`
- [ ] Add SQL commands:

  ```sql
  -- Add mode column to track regular vs fasting mode per plan
  ALTER TABLE public.daily_plans
  ADD COLUMN mode TEXT NOT NULL DEFAULT 'regular';

  -- Add fasting_plan column to store fasting meal structure
  ALTER TABLE public.daily_plans
  ADD COLUMN fasting_plan JSONB DEFAULT NULL;

  -- Add check constraint for valid modes
  ALTER TABLE public.daily_plans
  ADD CONSTRAINT daily_plans_mode_check CHECK (mode IN ('regular', 'fasting'));

  -- Set all existing records to 'regular' mode
  UPDATE public.daily_plans SET mode = 'regular' WHERE mode IS NULL;

  -- Add comments
  COMMENT ON COLUMN public.daily_plans.mode IS 'Meal planning mode: regular or fasting';
  COMMENT ON COLUMN public.daily_plans.fasting_plan IS 'Stores fasting-mode meal structure separately from regular plan';

  -- Add index for mode filtering
  CREATE INDEX daily_plans_mode_idx ON daily_plans(mode);
  ```

- [ ] Test: Run migration locally and verify columns exist in `daily_plans` table

**Task 1.2: Update TypeScript Types** ✅

- [x] File: `lib/types/nutri.ts`
- [x] Add to `ProfilePreferences` interface:
  ```typescript
  fasting_meals_per_day?: number   // Number of fasting meals (2-5)
  ```
- [ ] ~~Add to `ProfileTargets` interface~~ **SKIPPED - Too Complex**:
  ```typescript
  // fasting_daily_calories?: number  // FUTURE: Separate calorie calculation for fasting
  // NOTE: For now, we use the same daily_calories for both regular and fasting modes
  // Different calorie targets require different calculation logic (too complex for Phase 1)
  ```
- [x] Update `DailyPlan` interface:
  ```typescript
  mode?: 'regular' | 'fasting'     // Meal planning mode (stored per plan)
  fasting_plan?: MealSlot[]        // Fasting meal plan (only used when mode='fasting')
  ```
- [x] Test: Run `npm run build` to ensure no type errors

**Architecture Notes:**

- `preferences`: Stores only `fasting_meals_per_day` (number), NOT meal structure or mode toggle
- `daily_plans.mode`: **Database column** for cross-device sync (toggle on laptop = toggle on mobile)
  - Values: `'regular'` | `'fasting'` (TEXT with CHECK constraint)
  - Default: `'regular'` for all new/existing records
  - Stored **per plan** (not in user preferences) - allows different modes for different days
  - Future-proof: Can add more modes (`'bulking'`, `'cutting'`) without schema changes
- `targets`: Uses **same** `daily_calories` for both modes (no separate fasting calories for now - too complex)
- `daily_plans`: Stores BOTH `plan` (regular recipes) AND `fasting_plan` (fasting recipes) in same row
- **Dashboard Logic**: If `mode === 'fasting'` → use `fasting_plan`, otherwise use `plan` (NO check needed for regular mode)

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

### Phase 4: UI Components ✅

**Task 4.1: Create Fasting Mode Toggle Component** ✅

- [x] Create file: `components/profile/fasting-mode-toggle.tsx`
- [x] Component with toggle switch using shadcn/ui button + motion
- [x] Component props:
  ```typescript
  interface Props {
    userId: string;
    currentMode: "regular" | "fasting";
    fastingMealsPerDay?: number;
    onModeChange?: (mode) => void;
  }
  ```
- [x] On toggle change → call `togglePlanMode(userId, date, mode)` server action
- [x] Check if `fasting_meals_per_day` is configured before switching to fasting mode
- [x] Show configuration dialog if not set
- [x] Show loading state during server action
- [x] Show success toast on completion ("تم التبديل إلى نمط رمضان ✨")
- [x] Include settings button to reconfigure meal count
- [x] Test: Toggle switch and verify database updates

**Task 4.2: Meal Configuration Dialog** ✅

- [x] Dialog with 4 options (2-5 meals) with Arabic labels
- [x] Custom radio-style selection (no RadioGroup component needed)
- [x] Visual selection with purple accent
- [x] Calls `setFastingModePreferences(userId, mealCount)` on save
- [x] Auto-toggles to fasting mode after saving config
- [x] Can be reopened via settings icon on toggle component

**Task 4.3: Add Toggle to Profile Page** ✅

- [x] File: `app/(app)/profile/profile-content.tsx`
- [x] Fetch user's current plan mode from `daily_plans` table for today
- [x] Added state management for `currentMode`
- [x] Render `<FastingModeToggle />` between Preferences and Account Stats sections
- [x] Auto-fetch mode on component mount
- [x] Update mode state when toggle changes
- [x] Test: Navigate to profile, see toggle, verify it works

**Implementation Details:**

- Toggle design: Purple moon icon for fasting mode, lime green lightning for regular
- Smooth animation using Framer Motion
- Arabic text with RTL support
- Shows meal count below mode name (e.g., "2 وجبات يومياً")
- Settings button only visible when in fasting mode with configured meals
- Loading spinner appears in toggle during mode switch
- Toast notifications for success/error states

---

### Phase 5: Dashboard Display Logic

**Task 5.1: Update Dashboard Data Fetching**

- [ ] File: `app/(app)/dashboard/page.tsx`
- [ ] Fetch `plan`, `fasting_plan`, AND `mode` from `daily_plans` table
- [ ] Add conditional logic (ONLY check for fasting mode):

  ```typescript
  // Use fasting plan if mode is 'fasting', otherwise use regular plan
  const displayPlan =
    dailyPlan.mode === "fasting" ? dailyPlan.fasting_plan : dailyPlan.plan;

  // Alternative (more explicit):
  const displayPlan =
    dailyPlan.mode === "fasting" && dailyPlan.fasting_plan
      ? dailyPlan.fasting_plan
      : dailyPlan.plan;
  ```

- [ ] **NO changes to regular mode logic** - it works as-is using `plan` column
- [ ] Test: Toggle mode and refresh dashboard - verify different meal names appear

**Task 5.2: Update Meal Cards Rendering**

- [ ] File: `components/dashboard/dashboard-components.tsx` (or wherever meal cards are)
- [ ] Ensure meal cards display:
  - `meal.label` (will be "Iftar" or "Lunch" depending on mode)
  - `meal.label_ar` (Arabic labels)
  - `meal.target_calories` (calculated calories)
- [ ] No code changes needed if already using `meal.label` - just verify
- [ ] Test: In fasting mode, verify cards show "Pre-Iftar", "Iftar", "Suhoor"

---

### Phase 6: Testing & Validation

**Task 6.1: End-to-End Testing**

- [ ] Test Scenario 1: New User
  1. Complete onboarding with 4 meals
  2. Verify `plan` column has regular meals
  3. Toggle fasting mode ON
  4. Verify `fasting_plan` column is populated
  5. Verify dashboard shows fasting meals
- [ ] Test Scenario 2: Toggle Back
  1. Toggle fasting mode OFF
  2. Verify dashboard shows regular meals again
  3. Toggle fasting mode ON again
  4. Verify same fasting plan appears (preserved)
- [ ] Test Scenario 3: Different Meal Counts
  1. Test with 3, 4, 5 meals per day
  2. Verify percentages sum to 100%
  3. Verify calorie calculations are correct

**Task 6.2: Edge Cases**

- [ ] Test: User with no `plan` yet (new user) - should generate both plans
- [ ] Test: User changes `meals_per_day` after fasting plan exists - decide behavior (regenerate or keep?)
- [ ] Test: Arabic labels display correctly in UI
- [ ] Test: Empty fasting plan (all meals have no recipes) - verify empty state UI

**Task 6.3: Data Validation**

- [ ] Verify: Both `plan` and `fasting_plan` can coexist in same row
- [ ] Verify: Percentages in fasting templates sum to 100%
- [ ] Verify: Calorie totals match user's `daily_calories` target
- [ ] Verify: No data loss when toggling modes multiple times

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
