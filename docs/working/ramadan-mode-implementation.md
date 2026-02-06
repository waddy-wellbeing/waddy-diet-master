# Fasting Mode Implementation Plan (V3)

## 📋 1. Architecture: Presentation-Layer Mapping

This document outlines the implementation of a user-controlled **Fasting Mode**. This approach is simpler and more flexible than previous versions, focusing on remapping the display of existing data rather than changing the data itself.

- **Core Principle:** The user's meal data (`daily_plans`) remains unchanged. A boolean flag in the user's profile (`is_fasting_mode`) controls how that data is presented in the UI.
- **Trigger:** A simple toggle switch in the user's profile settings. This is not tied to the Ramadan calendar and can be used for any type of fasting.
- **No Data Duplication:** A user's plan is created once. It can be _viewed_ as a regular plan or a fasting plan.

---

## 🗄️ 2. Schema & Type Changes

### 2.1. `profiles` Table (`preferences` JSONB)

Add a single boolean flag to the `ProfilePreferences` type. This is the **only database change required**.

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

No other database migrations are necessary. The `daily_plans` and `recipes` tables are not modified.

---

## 📁 3. Core Logic & Implementation

The logic is primarily handled in the UI and a new configuration file.

### 3.1. Configuration: `lib/config/fasting-mode-map.ts`

This new file will define how regular meals are mapped to fasting meals.

```typescript
// lib/config/fasting-mode-map.ts

export interface MealDisplayMapping {
  source: string; // The original meal name (e.g., 'breakfast')
  label: string; // The new display label (e.g., 'Suhoor')
  label_ar: string;
  order: number; // Display order for the UI
}

export interface FastingModeConfig {
  mapping: MealDisplayMapping[];
  redistribute: {
    from: string[]; // Meals to hide and take calories from
    to: string; // Meal to add the calories to
  };
}

export const FASTING_MODE_CONFIG: FastingModeConfig = {
  // Defines how to remap meals when fasting mode is ON
  mapping: [
    { source: "breakfast", label: "Suhoor", label_ar: "سحور", order: 1 },
    { source: "lunch", label: "Iftar", label_ar: "إفطار", order: 2 },
    { source: "snacks", label: "Snacks", label_ar: "سناكس", order: 3 },
  ],

  // Defines how to handle calorie redistribution for hidden meals
  redistribute: {
    from: ["dinner"], // Hide the 'dinner' meal
    to: "lunch", // Add its calories to 'lunch' (which is displayed as Iftar)
  },
};
```

### 3.2. Service Layer: `lib/services/meal-display.ts`

This new service will process a `daily_plan` and apply the fasting mode logic for the UI.

```typescript
// lib/services/meal-display.ts
import {
  FASTING_MODE_CONFIG,
  type MealDisplayMapping,
} from "@/lib/config/fasting-mode-map";
import type { DailyPlan, MealSlot } from "@/lib/types/nutri";

export interface DisplayMeal extends MealSlot {
  displayLabel: string;
  displayLabelAr: string;
  order: number;
  originalName: string;
}

/**
 * Takes a standard daily plan and transforms it for display based on fasting mode.
 * This function DOES NOT modify the database. It's for UI presentation only.
 */
export function getDisplayMeals(
  plan: DailyPlan,
  isFasting: boolean,
): DisplayMeal[] {
  const originalMeals = plan.plan; // The array of meals from the DB

  if (!isFasting) {
    // If not fasting, return meals as they are with default labels.
    return originalMeals.map((meal) => ({
      ...meal,
      displayLabel: meal.label || meal.name,
      displayLabelAr: meal.label_ar || meal.name,
      order: getOrderForMeal(meal.name),
      originalName: meal.name,
    }));
  }

  // --- Fasting Mode Logic ---
  const { mapping, redistribute } = FASTING_MODE_CONFIG;

  // 1. Calculate calories to redistribute from hidden meals
  const redistributedCalories = originalMeals
    .filter((meal) => redistribute.from.includes(meal.name))
    .reduce((sum, meal) => sum + (meal.target_calories || 0), 0);

  // 2. Create a new array of meals to be displayed
  const displayMeals: DisplayMeal[] = [];

  for (const meal of originalMeals) {
    const mapInfo = mapping.find((m) => m.source === meal.name);

    if (mapInfo) {
      // This meal should be displayed with a new label
      let finalCalories = meal.target_calories || 0;

      // If this is the target for redistribution, add the extra calories
      if (meal.name === redistribute.to) {
        finalCalories += redistributedCalories;
      }

      displayMeals.push({
        ...meal,
        target_calories: finalCalories,
        displayLabel: mapInfo.label,
        displayLabelAr: mapInfo.label_ar,
        order: mapInfo.order,
        originalName: meal.name,
      });
    }
    // Meals not in the mapping are implicitly hidden (e.g., 'dinner')
  }

  // 3. Sort the meals by the specified display order
  return displayMeals.sort((a, b) => a.order - b.order);
}

// Helper to provide a default sort order for regular mode
function getOrderForMeal(name: string): number {
  const orderMap: Record<string, number> = {
    breakfast: 1,
    lunch: 2,
    snacks: 3,
    dinner: 4,
  };
  return orderMap[name] || 99;
}
```

---

## 👣 4. Phased Implementation Plan

### Phase 1: Foundation (1 Day)

- [ ] **Task:** Update `lib/types/nutri.ts` to add `is_fasting_mode?: boolean` to the `ProfilePreferences` interface.
- [ ] **Task:** Create `lib/config/fasting-mode-map.ts` with the content from section 3.1.
- [ ] **Task:** Create `lib/services/meal-display.ts` with the content from section 3.2.

### Phase 2: UI Integration (1-2 Days)

- [ ] **Task:** Create a `FastingModeToggle` component.
  - **Location:** `components/profile/fasting-mode-toggle.tsx`.
  - **Functionality:** A simple Switch component that reads `user.preferences.is_fasting_mode` and calls a server action to update it.
- [ ] **Task:** Add the `FastingModeToggle` to the user's profile page (`app/(app)/profile/page.tsx`).
- [ ] **Task:** Refactor the dashboard (`app/(app)/dashboard/page.tsx`).
  - **Data Fetching:** Fetch the `daily_plan` and the user's `is_fasting_mode` preference.
  - **Transformation:** In the server component, call `getDisplayMeals(plan, is_fasting_mode)`.
  - **Rendering:** Map over the transformed `displayMeals` array to render the meal cards. Use `meal.displayLabel` and `meal.target_calories` for the UI.

### Phase 3: Polish & Testing (1 Day)

- [ ] **Task:** Test the toggle functionality. Ensure the dashboard updates immediately (or on refresh) when the mode is changed.
- [ ] **Task:** Verify that the calorie redistribution is correct (e.g., Iftar's calories are higher when Dinner is hidden).
- [ ] **Task:** Check that Arabic labels are displayed correctly.
- [ ] **Task:** Ensure that when a user adds a recipe to "Iftar", it is correctly saved to the `lunch` slot in the `daily_plans` table in the database, using the `originalName` property from the `DisplayMeal` type.

This plan is significantly simpler, requires almost no database changes, and provides a much more flexible and user-friendly experience.
