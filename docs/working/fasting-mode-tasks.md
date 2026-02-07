# Fasting Mode - Implementation Tasks (V3)

## 📖 Story Overview

**User Story:**
As a user, I want to toggle "Fasting Mode" in my profile settings so that my meal plans adapt to fasting schedules (Pre-Iftar, Iftar, Suhoor) instead of regular meals (Breakfast, Lunch, Dinner), while preserving both meal plans independently so I can switch between them without losing data.

**Implementation Approach:**
We will implement fasting mode by **reusing the exact same logic as the current regular plan system**, but with:
- Different meal names (`pre-iftar`, `iftar`, `suhoor` instead of `breakfast`, `lunch`, `dinner`)
- Different percentage templates for fasting schedules
- A separate JSONB column (`fasting_plan`) to store the fasting meal structure

This approach ensures scalability and consistency - no new complex logic, just applying existing patterns to a new data structure.

---

## ✅ Implementation Tasks

### Phase 1: Database Schema (Foundation)

**Task 1.1: Create Migration File**
- [ ] Create file: `supabase/migrations/<timestamp>_add_fasting_plan_column.sql`
- [ ] Add SQL command:
  ```sql
  ALTER TABLE public.daily_plans
  ADD COLUMN fasting_plan JSONB DEFAULT NULL;
  
  COMMENT ON COLUMN public.daily_plans.fasting_plan IS 'Stores fasting-mode meal structure separately from regular plan';
  ```
- [ ] Test: Run migration locally and verify column exists in `daily_plans` table

**Task 1.2: Update TypeScript Types**
- [ ] File: `lib/types/nutri.ts`
- [ ] Add to `ProfilePreferences` interface:
  ```typescript
  is_fasting_mode?: boolean; // true = fasting, false/null = regular
  ```
- [ ] Add to `DailyPlan` interface:
  ```typescript
  fasting_plan?: MealSlot[]; // Separate fasting meal structure
  ```
- [ ] Test: Run `npm run build` to ensure no type errors

---

### Phase 2: Fasting Templates Configuration

**Task 2.1: Create Fasting Templates Config File**
- [ ] Create file: `lib/config/fasting-templates.ts`
- [ ] Define fasting meal templates (mirroring regular templates from `lib/actions/users.ts`):
  ```typescript
  export const FASTING_TEMPLATES = {
    3: [
      { name: 'pre-iftar', label: 'Pre-Iftar', label_ar: 'كسر صيام', percentage: 10 },
      { name: 'iftar', label: 'Iftar', label_ar: 'إفطار', percentage: 45 },
      { name: 'suhoor', label: 'Suhoor', label_ar: 'سحور', percentage: 45 },
    ],
    4: [
      { name: 'pre-iftar', label: 'Pre-Iftar', label_ar: 'كسر صيام', percentage: 10 },
      { name: 'iftar', label: 'Iftar', label_ar: 'إفطار', percentage: 40 },
      { name: 'snacks', label: 'Snacks', label_ar: 'سناكس', percentage: 15 },
      { name: 'suhoor', label: 'Suhoor', label_ar: 'سحور', percentage: 35 },
    ],
    // ... add templates for 5, 6 meals
  };
  ```
- [ ] Export helper function:
  ```typescript
  export function getFastingTemplate(mealsPerDay: number): MealSlot[] | null
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

**Task 3.1: Copy and Adapt `assignMealStructure` Function**
- [ ] File: `lib/actions/users.ts` (or create new `lib/actions/fasting.ts`)
- [ ] Create new function: `assignFastingMealStructure(userId: string, dates: string[])`
- [ ] Copy the EXACT logic from existing `assignMealStructure()` function
- [ ] Replace:
  - Regular templates → Fasting templates (from `FASTING_TEMPLATES`)
  - `plan` column → `fasting_plan` column in database update
- [ ] Keep the same:
  - Calorie calculation logic
  - Recipe search/assignment logic (if exists)
  - Database query structure
- [ ] Test: Call function manually and verify `fasting_plan` column is populated

**Task 3.2: Create Toggle Function**
- [ ] File: `lib/actions/users.ts`
- [ ] Create function: `toggleFastingMode(userId: string, isFasting: boolean)`
- [ ] Logic:
  1. Update `profiles.preferences.is_fasting_mode` to the new value
  2. If toggling ON and `fasting_plan` is null → call `assignFastingMealStructure()`
  3. Return success/error status
- [ ] Add server action decorator: `'use server'`
- [ ] Test: Call function and verify preference is updated + fasting plan generated

---

### Phase 4: UI Components

**Task 4.1: Create Fasting Mode Toggle Component**
- [ ] Create file: `components/profile/fasting-mode-toggle.tsx`
- [ ] Use existing Switch/Toggle component from shadcn/ui
- [ ] Component props:
  ```typescript
  interface Props {
    userId: string;
    currentValue: boolean;
  }
  ```
- [ ] On toggle change → call `toggleFastingMode()` server action
- [ ] Show loading state during server action
- [ ] Show success toast on completion
- [ ] Test: Toggle switch and verify database updates

**Task 4.2: Add Toggle to Profile Page**
- [ ] File: `app/(app)/profile/page.tsx`
- [ ] Fetch user's current `is_fasting_mode` preference from database
- [ ] Render `<FastingModeToggle userId={user.id} currentValue={isFastingMode} />`
- [ ] Add section label: "Meal Planning Mode" or "نمط تخطيط الوجبات"
- [ ] Test: Navigate to profile, see toggle, verify it works

---

### Phase 5: Dashboard Display Logic

**Task 5.1: Update Dashboard Data Fetching**
- [ ] File: `app/(app)/dashboard/page.tsx`
- [ ] Fetch both `plan` and `fasting_plan` from `daily_plans` table
- [ ] Fetch `is_fasting_mode` from `profiles.preferences`
- [ ] Add conditional logic:
  ```typescript
  const displayPlan = user.preferences.is_fasting_mode 
    ? dailyPlan.fasting_plan 
    : dailyPlan.plan;
  ```
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

**Meal Removal Feature** - Will be implemented later with scalability:
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
