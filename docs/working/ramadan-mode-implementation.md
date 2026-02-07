# Fasting Mode Implementation Plan (V3)

## 📋 1. Architecture: Presentation-Layer Mapping

This document outlines the implementation of a user-controlled **Fasting Mode**. This approach is simpler and more flexible than previous versions, focusing on remapping the display of existing data rather than changing the data itself.

- **Core Principle:** The user's meal data (`daily_plans`) remains unchanged. A boolean flag in the user's profile (`is_fasting_mode`) controls how that data is presented in the UI.
- **Trigger:** A simple toggle switch in the user's profile settings. This is not tied to the Ramadan calendar and can be used for any type of fasting.
- **No Data Duplication:** A user's plan is created once. It can be _viewed_ as a regular plan or a fasting plan.

---

## 🗄️ 2. Schema & Type Changes

### 2.1. `profiles` Table (`preferences` JSONB)

Add a single boolean flag to the `ProfilePreferences` type.

**Type Change (`lib/types/nutri.ts`):**

```typescript
export interface ProfilePreferences {
  // ... existing fields
  meals_per_day?: number;
  meal_structure?: MealSlot[];

  // NEW: User-controlled fasting mode flag
  is_fasting_mode?: boolean; // true = fasting, false/null = regular
}
```

### 2.2. `daily_plans` Table (CRITICAL CHANGE)

Add a new JSONB column to store the fasting plan separately from the regular plan. This preserves both meal structures without data loss when toggling modes.

**Migration (`supabase/migrations/<timestamp>_add_fasting_plan_column.sql`):**

```sql
-- Add fasting_plan column to daily_plans table
ALTER TABLE public.daily_plans
ADD COLUMN fasting_plan JSONB DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.daily_plans.fasting_plan IS 'Stores fasting-mode meal structure (pre-iftar, iftar, suhoor, etc.) separately from regular plan';
```

**Table Structure:**

- `plan` (existing): Stores regular meal plan (breakfast, lunch, dinner, snacks)
- `fasting_plan` (new): Stores fasting meal plan (pre-iftar, iftar, suhoor, etc.)
- **UI determines which plan to display** based on `profiles.preferences.is_fasting_mode`

---

## 📁 3. Core Logic & Implementation

The logic is primarily handled in the UI and a new configuration file.

### 3.1. Configuration: `lib/config/fasting-mode-templates.ts`

This new file defines fasting-specific meal templates with percentage ranges and constraints.

```typescript
// lib/config/fasting-mode-templates.ts

export interface MealTemplate {
  name: string;
  label: string;
  label_ar: string;
  percentage: number; // Default percentage
  min_percentage: number;
  max_percentage: number;
  is_required: boolean;
}

export interface FastingMealConfig {
  meals_count: number;
  templates: MealTemplate[];
}

// Fasting mode templates for different meal counts
export const FASTING_TEMPLATES: Record<number, FastingMealConfig> = {
  3: {
    meals_count: 3,
    templates: [
      {
        name: "pre-iftar",
        label: "Pre-Iftar",
        label_ar: "كسر صيام",
        percentage: 10,
        min_percentage: 5,
        max_percentage: 10,
        is_required: true,
      },
      {
        name: "iftar",
        label: "Iftar",
        label_ar: "إفطار",
        percentage: 45,
        min_percentage: 35,
        max_percentage: 50,
        is_required: true,
      },
      {
        name: "suhoor",
        label: "Suhoor",
        label_ar: "سحور",
        percentage: 45,
        min_percentage: 35,
        max_percentage: 50,
        is_required: true,
      },
    ],
  },
  4: {
    meals_count: 4,
    templates: [
      {
        name: "pre-iftar",
        label: "Pre-Iftar",
        label_ar: "كسر صيام",
        percentage: 10,
        min_percentage: 5,
        max_percentage: 10,
        is_required: true,
      },
      {
        name: "iftar",
        label: "Iftar",
        label_ar: "إفطار",
        percentage: 40,
        min_percentage: 25,
        max_percentage: 45,
        is_required: true,
      },
      {
        name: "snacks",
        label: "Snacks",
        label_ar: "سناكس",
        percentage: 15,
        min_percentage: 10,
        max_percentage: 20,
        is_required: false,
      },
      {
        name: "suhoor",
        label: "Suhoor",
        label_ar: "سحور",
        percentage: 35,
        min_percentage: 25,
        max_percentage: 45,
        is_required: true,
      },
    ],
  },
  5: {
    meals_count: 5,
    templates: [
      {
        name: "pre-iftar",
        label: "Pre-Iftar",
        label_ar: "كسر صيام",
        percentage: 10,
        min_percentage: 5,
        max_percentage: 10,
        is_required: true,
      },
      {
        name: "iftar",
        label: "Iftar",
        label_ar: "إفطار",
        percentage: 35,
        min_percentage: 25,
        max_percentage: 40,
        is_required: true,
      },
      {
        name: "snacks",
        label: "Snacks",
        label_ar: "سناكس",
        percentage: 10,
        min_percentage: 10,
        max_percentage: 15,
        is_required: false,
      },
      {
        name: "full-meal",
        label: "Full Meal",
        label_ar: "وجبة متكاملة",
        percentage: 15,
        min_percentage: 15,
        max_percentage: 20,
        is_required: false,
      },
      {
        name: "suhoor",
        label: "Suhoor",
        label_ar: "سحور",
        percentage: 30,
        min_percentage: 25,
        max_percentage: 35,
        is_required: true,
      },
    ],
  },
};

// Meal removal redistribution options
export type MealRemovalStrategy =
  | "auto-recalculate"
  | "add-to-specific"
  | "manual-select";

export interface MealRemovalOption {
  strategy: MealRemovalStrategy;
  label: string;
  label_ar: string;
  description: string;
}

export const MEAL_REMOVAL_OPTIONS: MealRemovalOption[] = [
  {
    strategy: "auto-recalculate",
    label: "Recalculate All Meals",
    label_ar: "إعادة حساب جميع الوجبات",
    description:
      "Redistribute calories across all remaining meals and auto-pick new recipes",
  },
  {
    strategy: "add-to-specific",
    label: "Add to Specific Meal",
    label_ar: "إضافة إلى وجبة معينة",
    description:
      "Choose which meal gets the extra calories (it will get a bigger recipe)",
  },
  {
    strategy: "manual-select",
    label: "Manual Selection",
    label_ar: "اختيار يدوي",
    description: "See recipe recommendations for each meal and choose manually",
  },
];
```

### 3.2. Service Layer: `lib/services/recipe-search.ts`

This new service searches for recipes based on calorie targets when generating fasting plans.

```typescript
// lib/services/recipe-search.ts
import type { Recipe } from "@/lib/types/nutri";

/**
 * Search for recipes that match a specific calorie target (±10% tolerance)
 */
export async function findRecipesByCalories(
  targetCalories: number,
  tolerance: number = 0.1, // 10% tolerance
): Promise<Recipe[]> {
  const minCalories = targetCalories * (1 - tolerance);
  const maxCalories = targetCalories * (1 + tolerance);

  // Query Supabase for recipes within calorie range
  const { data: recipes } = await supabase
    .from("recipes")
    .select("*")
    .gte("nutrition_per_serving->calories", minCalories)
    .lte("nutrition_per_serving->calories", maxCalories)
    .eq("is_public", true)
    .order("created_at", { ascending: false });

  return recipes || [];
}

/**
 * Auto-pick best recipe for a meal based on calories and macros
 */
export async function autoPickRecipe(
  targetCalories: number,
  userPreferences?: { protein_priority?: boolean; low_carb?: boolean },
): Promise<Recipe | null> {
  const recipes = await findRecipesByCalories(targetCalories);

  if (recipes.length === 0) return null;

  // Simple scoring: prefer recipes closest to target
  const scored = recipes.map((recipe) => ({
    recipe,
    score: Math.abs(recipe.nutrition_per_serving.calories - targetCalories),
  }));

  scored.sort((a, b) => a.score - b.score);
  return scored[0].recipe;
}
```

### 3.3. Service Layer: `lib/services/meal-removal.ts`

Handles the three meal removal strategies.

```typescript
// lib/services/meal-removal.ts
import {
  MEAL_REMOVAL_OPTIONS,
  type MealRemovalStrategy,
} from "@/lib/config/fasting-mode-templates";
import type { MealSlot } from "@/lib/types/nutri";

/**
 * Recalculate meal percentages after removing a meal
 */
export function recalculateMealPercentages(
  remainingMeals: MealSlot[],
  removedMealPercentage: number,
): MealSlot[] {
  const totalRemainingPercentage = remainingMeals.reduce(
    (sum, meal) => sum + meal.percentage,
    0,
  );

  // Distribute removed percentage proportionally
  return remainingMeals.map((meal) => ({
    ...meal,
    percentage:
      meal.percentage +
      (meal.percentage / totalRemainingPercentage) * removedMealPercentage,
  }));
}

/**
 * Add removed meal's calories to a specific target meal
 */
export function addCaloriesToMeal(
  meals: MealSlot[],
  targetMealName: string,
  caloriesToAdd: number,
): MealSlot[] {
  return meals.map((meal) => {
    if (meal.name === targetMealName) {
      return {
        ...meal,
        target_calories: (meal.target_calories || 0) + caloriesToAdd,
      };
    }
    return meal;
  });
}
```

---

## 👣 4. Phased Implementation Plan

### Phase 1: Foundation (1-2 Days)

- [ ] **Task:** Create database migration `supabase/migrations/<timestamp>_add_fasting_plan_column.sql` to add `fasting_plan` JSONB column to `daily_plans` table.
- [ ] **Task:** Update `lib/types/nutri.ts` to add `is_fasting_mode?: boolean` to the `ProfilePreferences` interface.
- [ ] **Task:** Update `lib/types/nutri.ts` to add `fasting_plan?: MealSlot[]` to the `DailyPlan` interface.
- [ ] **Task:** Create `lib/config/fasting-mode-templates.ts` with fasting templates and meal removal options from section 3.1.
- [ ] **Task:** Create `lib/services/recipe-search.ts` with recipe search functions from section 3.2.
- [ ] **Task:** Create `lib/services/meal-removal.ts` with meal removal logic from section 3.3.

### Phase 2: Fasting Plan Generation (2-3 Days)

- [ ] **Task:** Create server action `lib/actions/fasting.ts` → `generateFastingPlan(userId, date)`
  - Read user's `meals_per_day` and `daily_calories`
  - Select fasting template from `FASTING_TEMPLATES`
  - Calculate calories per meal
  - Auto-search and pick recipes using `findRecipesByCalories()`
  - Save to `daily_plans.fasting_plan` column
- [ ] **Task:** Create toggle action `lib/actions/users.ts` → `toggleFastingMode(userId, isFasting)`
  - Update `profiles.preferences.is_fasting_mode`
  - Trigger fasting plan generation if `fasting_plan` is null

### Phase 3: UI Integration (2-3 Days)

- [ ] **Task:** Create `components/profile/fasting-mode-toggle.tsx`
  - Switch component that calls `toggleFastingMode()`
- [ ] **Task:** Add toggle to profile page `app/(app)/profile/page.tsx`
- [ ] **Task:** Update dashboard `app/(app)/dashboard/page.tsx`
  - Read `is_fasting_mode` preference
  - Display `plan` or `fasting_plan` based on the flag
  - No transformation needed - just show the appropriate data
- [ ] **Task:** Update meal cards to display correct meal names and calories

### Phase 4: Meal Removal Feature (2-3 Days)

- [ ] **Task:** Create `components/dashboard/meal-removal-dialog.tsx`
  - Show 3 options (auto-recalculate, add-to-specific, manual-select)
  - Handle each strategy differently
- [ ] **Task:** Create server actions for each removal strategy:
  - `autoRecalculateMeals(userId, date, removedMealName, mode)` - Redistribute and auto-pick recipes
  - `addCaloriesToSpecificMeal(userId, date, removedMealName, targetMealName, mode)` - Increase one meal
  - `getRecipeRecommendations(userId, date, removedMealName, mode)` - Return options for user to choose
- [ ] **Task:** Add "Remove Meal" button to meal cards

### Phase 5: Testing & Polish (1-2 Days)

- [ ] **Task:** Test toggling between modes - verify both plans are preserved
- [ ] **Task:** Test fasting plan generation with different meal counts (3, 4, 5)
- [ ] **Task:** Test all 3 meal removal strategies
- [ ] **Task:** Verify calorie calculations are accurate
- [ ] **Task:** Test with users who have no existing plans
- [ ] **Task:** Arabic label verification

**Total Estimated Time: 8-13 days**

---

## 🧠 5. Data & Logic Flow Explained (Component Map)

This section explains the end-to-end flow of data, from plan creation to how the "Fasting Mode" toggle interacts with the database and UI. Each step lists the responsible component/file.

### Part 1: Initial Meal Plan Creation (After Onboarding)

This flow happens **once** when a user's plan is first generated.

1.  **Onboarding Complete & Data Saved**
    - **Component:** `app/get-started/onboarding/page.tsx` or `components/onboarding/guest-onboarding-flow.tsx`
    - **Action:** The onboarding component calls a server action from `lib/actions/onboarding.ts`
    - **Database:** The action saves a new row to the `profiles` table:
      - `targets` column: `'{"daily_calories": 2000, "tdee": 2000, "bmr": 1600, ...}'`
      - `preferences` column: `'{"meals_per_day": 4, "cooking_skill": "intermediate", ...}'`

2.  **Plan Generation Triggered**
    - **Action:** `lib/actions/users.ts` → `assignMealStructure()` function
    - **Trigger:** Called automatically after onboarding completion or manually by admin

3.  **Data Retrieval**
    - **Action:** `assignMealStructure()` in `lib/actions/users.ts`
    - **Data Source:** Queries the `profiles` table for the user
    - **Parsing:**
      - Reads `preferences.meals_per_day` (e.g., 4)
      - Reads `targets.daily_calories` (e.g., 2000)

4.  **Template Selection & Calculation**
    - **Action:** `assignMealStructure()` in `lib/actions/users.ts`
    - **Logic:**
      - Selects a hardcoded template based on `meals_per_day` (e.g., 4 meals → `{breakfast: 25%, lunch: 35%, dinner: 25%, snacks: 15%}`)
      - Calculates target calories per meal (e.g., Breakfast: 25% of 2000 = 500 kcal)

5.  **Create `daily_plans` for the User**
    - **Action:** `assignMealStructure()` in `lib/actions/users.ts`
    - **Database:** Inserts rows into the `daily_plans` table
    - **Data Structure:** The `plan` JSONB column contains:
      ```json
      [
        { "name": "breakfast", "target_calories": 500, "label": "Breakfast", ... },
        { "name": "lunch", "target_calories": 700, "label": "Lunch", ... },
        { "name": "dinner", "target_calories": 500, "label": "Dinner", ... },
        { "name": "snacks", "target_calories": 300, "label": "Snacks", ... }
      ]
      ```

**Key Takeaway:** The database **always** stores the plan with standard meal names (`breakfast`, `lunch`, etc.). It has no knowledge of "Iftar" or "Suhoor".

---

### Part 2: Fasting Plan Generation (When User Enables Fasting Mode)

This flow happens when a user **toggles fasting mode ON for the first time** or when their fasting plan needs to be regenerated.

1.  **User Toggles "Fasting Mode" ON**
    - **Component:** `components/profile/fasting-mode-toggle.tsx`
    - **Location:** Displayed in `app/(app)/profile/page.tsx`
    - **Action:** Calls server action `lib/actions/users.ts` → `toggleFastingMode(userId, true)`
    - **Database Update:** Updates `profiles.preferences.is_fasting_mode` to `true`

2.  **Check if Fasting Plan Exists**
    - **Action:** `toggleFastingMode()` queries `daily_plans` table
    - **Logic:** If `fasting_plan` column is `null` → trigger generation
    - **Logic:** If `fasting_plan` already exists → skip to step 7 (just display it)

3.  **Fasting Plan Generation Triggered**
    - **Action:** `lib/actions/fasting.ts` → `generateFastingPlan(userId, dates[])`
    - **Data Retrieved:**
      - Reads `profiles.preferences.meals_per_day` (e.g., 4)
      - Reads `profiles.targets.daily_calories` (e.g., 2000)

4.  **Fasting Template Selection & Calculation**
    - **Config:** `lib/config/fasting-mode-templates.ts` → `FASTING_TEMPLATES[meals_per_day]`
    - **Logic:**
      - Selects template for 4 meals: `pre-iftar: 10%, iftar: 40%, snacks: 15%, suhoor: 35%`
      - Calculates target calories:
        - `pre-iftar`: 10% of 2000 = 200 kcal
        - `iftar`: 40% of 2000 = 800 kcal
        - `snacks`: 15% of 2000 = 300 kcal
        - `suhoor`: 35% of 2000 = 700 kcal

5.  **Recipe Search & Auto-Selection**
    - **Service:** `lib/services/recipe-search.ts` → `autoPickRecipe(targetCalories)`
    - **Data Source:** Queries `recipes` table (NOT user's existing plans)
    - **Logic:**
      - For each fasting meal, search for recipes matching calorie target (±10% tolerance)
      - Auto-pick best matching recipe based on calories and macros
      - Example: For `iftar` (800 kcal), find recipes between 720-880 kcal
    - **Fallback:** If no recipe found, leave meal empty (user fills manually later)

6.  **Save Fasting Plan to Database**
    - **Action:** `generateFastingPlan()` in `lib/actions/fasting.ts`
    - **Database:** Updates `daily_plans.fasting_plan` column (does NOT touch `plan` column)
    - **Data Structure:**
      ```json
      {
        \"fasting_plan\": [
          { \"name\": \"pre-iftar\", \"target_calories\": 200, \"label\": \"Pre-Iftar\", \"label_ar\": \"كسر صيام\", \"recipe_id\": \"abc123\", ... },
          { \"name\": \"iftar\", \"target_calories\": 800, \"label\": \"Iftar\", \"label_ar\": \"إفطار\", \"recipe_id\": \"def456\", ... },
          { \"name\": \"snacks\", \"target_calories\": 300, \"label\": \"Snacks\", \"label_ar\": \"سناكس\", \"recipe_id\": \"ghi789\", ... },
          { \"name\": \"suhoor\", \"target_calories\": 700, \"label\": \"Suhoor\", \"label_ar\": \"سحور\", \"recipe_id\": \"jkl012\", ... }
        ]
      }
      ```

7.  **User Navigates to Dashboard**
    - **Component:** `app/(app)/dashboard/page.tsx` (Server Component)
    - **Data Fetching:** Queries `daily_plans` table
    - **Logic:**
      - Reads `profiles.preferences.is_fasting_mode` → `true`
      - Reads `daily_plans.fasting_plan` (contains fasting meals)
      - Reads `daily_plans.plan` (contains regular meals, but won't display)

8.  **Display Fasting Plan**
    - **Component:** `app/(app)/dashboard/page.tsx` + `components/dashboard/dashboard-components.tsx`
    - **Logic:** Simple conditional: `const displayPlan = isFasting ? dailyPlan.fasting_plan : dailyPlan.plan`
    - **Display:**
      - Shows fasting meal cards: "Pre-Iftar (كسر صيام)", "Iftar (إفطار)", "Snacks (سناكس)", "Suhoor (سحور)"
      - Shows calories: 200, 800, 300, 700 kcal
      - Shows auto-selected recipes (or empty state if none found)

**Key Takeaway:** Both `plan` and `fasting_plan` are stored simultaneously. The UI just picks which one to display based on the `is_fasting_mode` flag.

---

### Part 3: Toggling Back to Regular Mode

When the user toggles fasting mode OFF, no regeneration is needed.

1.  **User Toggles "Fasting Mode" OFF**
    - **Component:** `components/profile/fasting-mode-toggle.tsx`
    - **Action:** Calls `toggleFastingMode(userId, false)`
    - **Database Update:** Updates `profiles.preferences.is_fasting_mode` to `false`
    - **Important:** Does NOT delete or modify `daily_plans.fasting_plan` (it's preserved)

2.  **Dashboard Displays Regular Plan**
    - **Component:** `app/(app)/dashboard/page.tsx`
    - **Data Fetching:** Reads `is_fasting_mode` → `false`
    - **Logic:** `const displayPlan = daily_plans.plan` (uses regular plan)
    - **Display:** Shows regular meals (breakfast, lunch, dinner, snacks) exactly as they were before

3.  **Toggling Back to Fasting**
    - If user toggles fasting mode ON again, the system checks if `fasting_plan` exists
    - Since it was preserved, it immediately displays the previously generated fasting plan
    - No regeneration needed unless the user explicitly requests it

**Benefit:** Zero data loss when toggling modes. User can switch back and forth freely.

---

### Part 4: Meal Removal with 3 Strategy Options

When a user removes a meal from either regular or fasting mode.

1.  **User Clicks "Remove Meal"**
    - **Component:** Meal card has a remove button
    - **Action:** Opens `components/dashboard/meal-removal-dialog.tsx`
    - **Dialog Shows:** 3 radio button options with descriptions

2.  **Option A: Auto-Recalculate (Strategy: `auto-recalculate`)**
    - **User Choice:** "Recalculate All Meals"
    - **Action:** `lib/actions/meal-removal.ts` → `autoRecalculateMeals(userId, date, removedMealName, mode)`
    - **Logic:**
      - Removes the meal from the plan
      - Recalculates percentages for remaining meals (proportional distribution)
      - Example: User has 4 meals (25%, 35%, 25%, 15%) and removes the 35% meal
        - Remaining percentages: 25%, 25%, 15% (total 65%)
        - New distribution: 25/65 = 38.5%, 25/65 = 38.5%, 15/65 = 23%
      - For each remaining meal, calls `autoPickRecipe()` to find new recipes matching new calorie targets
    - **Service:** `lib/services/meal-removal.ts` → `recalculateMealPercentages()`
    - **Database Update:** Updates either `plan` or `fasting_plan` based on current mode

3.  **Option B: Add to Specific Meal (Strategy: `add-to-specific`)**
    - **User Choice:** "Add to Specific Meal"
    - **UI:** Shows dropdown to select which meal gets the extra calories
    - **Action:** `addCaloriesToSpecificMeal(userId, date, removedMealName, targetMealName, mode)`
    - **Logic:**
      - Removes the meal
      - Adds its calories to the chosen target meal
      - Example: Remove "snacks" (300 kcal), add to "iftar" (800 kcal) → New iftar: 1100 kcal
      - Searches for a new recipe matching the new calorie target for that meal
    - **Service:** `lib/services/meal-removal.ts` → `addCaloriesToMeal()`
    - **Database Update:** Updates the target meal's `target_calories` and `recipe_id`

4.  **Option C: Manual Selection (Strategy: `manual-select`)**
    - **User Choice:** "Manual Selection"
    - **Action:** `getRecipeRecommendations(userId, date, removedMealName, mode)`
    - **Logic:**
      - Recalculates percentages (same as Option A)
      - For each remaining meal, searches for 5-10 recipe recommendations
      - Shows a multi-step UI where user picks a recipe for each meal
    - **UI Flow:**
      - Step 1: "Pick recipe for Breakfast (new target: 540 kcal)" → Shows 10 options
      - Step 2: "Pick recipe for Lunch (new target: 750 kcal)" → Shows 10 options
      - Step 3: "Pick recipe for Dinner (new target: 710 kcal)" → Shows 10 options
    - **Service:** `lib/services/recipe-search.ts` → `findRecipesByCalories()` (returns multiple)
    - **Database Update:** Updates all meals with user-selected recipes

5.  **Confirmation & Update**
    - **Action:** After user confirms their choice, the selected strategy is executed
    - **Database:** Either `plan` or `fasting_plan` is updated based on current mode
    - **UI Refresh:** Dashboard reloads and shows the new meal structure

**Key Takeaway:** All 3 strategies work for both regular and fasting modes. The logic is mode-agnostic; it just operates on whichever plan is currently active.
