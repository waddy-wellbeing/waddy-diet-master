# Ramadan Mode Implementation Plan (V2 - Single Table Architecture)

## 📋 1. Final Architecture: Single Table with Logical Separation

This document outlines the definitive implementation plan for the Ramadan feature. We will use a **single-table architecture**, which is more scalable, maintainable, and efficient than creating parallel tables.

- **Core Principle:** All data (recipes, plans) lives in the existing tables. A `mode` flag on `daily_plans` and `tags` on `recipes` provide the logical separation.
- **No Data Duplication:** A recipe suitable for both regular lunch and Ramadan iftar exists only once.
- **Simplified Maintenance:** Schema changes are made to one set of tables, not two.
- **Powerful Analytics:** All historical data is in one place, making it easy to analyze trends across all modes.

---

## 🗄️ 2. Schema & Type Changes

### 2.1. `daily_plans` Table

Add a `mode` column to track if a plan was generated for a regular or Ramadan day.

**Migration SQL (`supabase/migrations/<timestamp>_add_mode_to_daily_plans.sql`):**

```sql
-- Add a 'mode' column to daily_plans to distinguish between regular and ramadan plans.
ALTER TABLE public.daily_plans
ADD COLUMN mode TEXT NOT NULL DEFAULT 'regular';

-- Add a check constraint to ensure data integrity.
ALTER TABLE public.daily_plans
ADD CONSTRAINT daily_plans_mode_check CHECK (mode IN ('regular', 'ramadan'));

COMMENT ON COLUMN public.daily_plans.mode IS 'Indicates the context in which the plan was created (e.g., regular, ramadan).';
```

### 2.2. `recipes` Table (Tagging Strategy)

No schema change is needed. We will leverage the existing `tags` array column.

- **Action:** Admin must tag recipes with appropriate meal types.
- **Examples:**
  - Oats: `tags: ['breakfast', 'suhoor']`
  - Lentil Soup: `tags: ['lunch', 'dinner', 'iftar']`
  - Date Smoothie: `tags: ['snack', 'fasting_breaking']`

### 2.3. `profiles` Table (`preferences` JSONB)

Add one optional field to the `ProfilePreferences` type to allow users to manually override the automatic Ramadan detection.

**Type Change (`lib/types/nutri.ts`):**

```typescript
export interface ProfilePreferences {
  // ... existing fields
  meals_per_day?: number;
  meal_structure?: MealSlot[];

  // NEW: User override for Ramadan mode
  ramadan_mode_override?: boolean | null; // true=force ON, false=force OFF, null=auto-detect
}
```

---

## 📁 3. New Files & Core Logic

### 3.1. Package Installation

```bash
npm install @tabby_ai/hijri-converter
```

### 3.2. Utility: `lib/utils/ramadan.ts`

This file handles date detection only. It is simple and has no dependencies on our app's logic.

```typescript
// lib/utils/ramadan.ts
import { Hijri } from "@tabby_ai/hijri-converter";

const RAMADAN_MONTH = 9;

/**
 * Checks if a given Gregorian date falls within the month of Ramadan.
 * @param date The date to check (defaults to now).
 * @returns True if the date is in Ramadan, false otherwise.
 */
export function isRamadan(date: Date = new Date()): boolean {
  try {
    const hijri = Hijri.fromGregorian(
      date.getFullYear(),
      date.getMonth() + 1, // Gregorian months are 0-indexed
      date.getDate(),
    );
    return hijri.month === RAMADAN_MONTH;
  } catch (error) {
    console.error("Error converting date to Hijri:", error);
    return false;
  }
}
```

### 3.3. Configuration: `lib/config/meal-modes.ts`

This file contains **static data only**. It defines the different meal structures and has no complex logic.

```typescript
// lib/config/meal-modes.ts
import type { MealSlot } from "@/lib/types/nutri";

export type MealMode = "regular" | "ramadan";

export interface MealSlotOption {
  value: string;
  label: string;
  label_ar: string;
}

export interface MealModeConfig {
  mode: MealMode;
  mealSlotOptions: MealSlotOption[];
  templates: Record<string, Omit<MealSlot, "target_calories">[]>;
}

// --- REGULAR MODE ---
export const REGULAR_MEAL_SLOT_OPTIONS: MealSlotOption[] = [
  { value: "breakfast", label: "Breakfast", label_ar: "الإفطار" },
  { value: "lunch", label: "Lunch", label_ar: "الغداء" },
  { value: "dinner", label: "Dinner", label_ar: "العشاء" },
  { value: "snacks", label: "Snacks", label_ar: "وجبات خفيفة" },
];
export const REGULAR_MODE_CONFIG: MealModeConfig = {
  mode: "regular",
  mealSlotOptions: REGULAR_MEAL_SLOT_OPTIONS,
  templates: {
    "3_meals": [
      { name: "breakfast", percentage: 30 },
      { name: "lunch", percentage: 40 },
      { name: "dinner", percentage: 30 },
    ],
    "4_meals": [
      { name: "breakfast", percentage: 25 },
      { name: "lunch", percentage: 35 },
      { name: "dinner", percentage: 25 },
      { name: "snacks", percentage: 15 },
    ],
  },
};

// --- RAMADAN MODE ---
export const RAMADAN_MEAL_SLOT_OPTIONS: MealSlotOption[] = [
  {
    value: "fasting_breaking",
    label: "Fasting Breaking",
    label_ar: "كسر صيام",
  },
  { value: "iftar", label: "Iftar", label_ar: "إفطار" },
  { value: "suhoor", label: "Suhoor", label_ar: "سحور" },
  { value: "snacks", label: "Snacks", label_ar: "سناكس" },
];
export const RAMADAN_MODE_CONFIG: MealModeConfig = {
  mode: "ramadan",
  mealSlotOptions: RAMADAN_MEAL_SLOT_OPTIONS,
  templates: {
    "2_meals": [
      { name: "iftar", percentage: 55 },
      { name: "suhoor", percentage: 45 },
    ],
    "3_meals": [
      { name: "fasting_breaking", percentage: 10 },
      { name: "iftar", percentage: 50 },
      { name: "suhoor", percentage: 40 },
    ],
    "4_meals": [
      { name: "fasting_breaking", percentage: 10 },
      { name: "iftar", percentage: 40 },
      { name: "suhoor", percentage: 35 },
      { name: "snacks", percentage: 15 },
    ],
  },
};
```

### 3.4. Service Layer: `lib/services/meal-planning.ts`

This new file will contain all the complex business logic, keeping it separate from UI components and simple configs.

```typescript
// lib/services/meal-planning.ts
import { createClient } from "@/lib/supabase/server";
import { isRamadan } from "@/lib/utils/ramadan";
import {
  REGULAR_MODE_CONFIG,
  RAMADAN_MODE_CONFIG,
  type MealModeConfig,
} from "@/lib/config/meal-modes";
import type { MealSlot, Recipe } from "@/lib/types/nutri";

/**
 * Determines which meal configuration to use based on date and user preference.
 */
export function getActiveMealConfig(
  userOverride?: boolean | null,
): MealModeConfig {
  const useRamadan =
    userOverride === null || userOverride === undefined
      ? isRamadan()
      : userOverride;
  return useRamadan ? RAMADAN_MODE_CONFIG : REGULAR_MODE_CONFIG;
}

/**
 * Generates a meal structure with calculated target calories.
 */
export function generateMealStructure(
  mealsPerDay: 2 | 3 | 4 | 5,
  dailyCalories: number,
  config: MealModeConfig,
): MealSlot[] {
  const template = config.templates[`${mealsPerDay}_meals`];
  if (!template) {
    // Fallback to a default if template for count doesn't exist
    const defaultKey = Object.keys(config.templates)[0];
    return config.templates[defaultKey].map((slot) => ({
      ...slot,
      target_calories: Math.round((slot.percentage / 100) * dailyCalories),
    }));
  }
  return template.map((slot) => ({
    ...slot,
    target_calories: Math.round((slot.percentage / 100) * dailyCalories),
  }));
}

/**
 * Finds suitable recipes from the database to substitute a meal.
 */
export async function findSubstituteRecipes(
  targetCalories: number,
  mealType: string,
  limit: number = 5,
): Promise<Recipe[]> {
  const supabase = await createClient();
  const tolerance = 0.15; // 15% calorie variance
  const lowerBound = targetCalories * (1 - tolerance);
  const upperBound = targetCalories * (1 + tolerance);

  // Map Ramadan types to regular types for broader matching
  const tagMap: Record<string, string> = {
    iftar: "dinner",
    suhoor: "breakfast",
    fasting_breaking: "snacks",
  };
  const searchTags = [mealType, tagMap[mealType]].filter(Boolean).join(",");

  const { data, error } = await supabase
    .from("recipes")
    .select("*, nutrition_per_serving->calories")
    .gte("nutrition_per_serving->calories", lowerBound)
    .lte("nutrition_per_serving->calories", upperBound)
    .or(`tags.cs.{${searchTags}}`) // Search for recipes containing any of the tags
    .limit(limit);

  if (error) {
    console.error("Error finding substitute recipes:", error);
    return [];
  }

  return (data as Recipe[]) ?? [];
}
```

---

## 👣 4. Phased Implementation Plan

### Phase 1: Foundation (1-2 Days)

- [ ] **Task:** Create migration file `..._add_mode_to_daily_plans.sql` with the content from section 2.1.
- [ ] **Task:** Run `npm install @tabby_ai/hijri-converter`.
- [ ] **Task:** Create `lib/utils/ramadan.ts` with the code from section 3.2.
- [ ] **Task:** Create `lib/config/meal-modes.ts` with the code from section 3.3.
- [ ] **Task:** Create `lib/services/meal-planning.ts` with the code from section 3.4.
- [ ] **Task:** Update `lib/types/nutri.ts` to add `ramadan_mode_override` to `ProfilePreferences`.

### Phase 2: Integration (2-3 Days)

- [ ] **Task:** Refactor `lib/actions/onboarding.ts`.
  - Import `getActiveMealConfig` and `generateMealStructure` from the new service.
  - Use them to create the initial `meal_structure` for the user.
- [ ] **Task:** Refactor `lib/actions/users.ts` (`assignMealStructure` function).
  - Update it to accept a `mode` parameter and use the service functions.
- [ ] **Task:** Refactor `app/(app)/dashboard/page.tsx`.
  - Fetch user's `ramadan_mode_override` preference.
  - Call `getActiveMealConfig` to get the correct `mealSlotOptions`.
  - Use these options to render the correct meal labels (e.g., "Iftar" instead of "Dinner").
- [ ] **Task:** Refactor `components/admin/plan-assignment-dialog.tsx`.
  - Allow admin to select "Regular" or "Ramadan" mode.
  - Use the appropriate config from `meal-modes.ts` to populate templates.

### Phase 3: User Controls & UX (1-2 Days)

- [ ] **Task:** Create a `RamadanModeToggle` component in `components/ui` or `components/profile`.
  - This component will have three states: On, Off, Auto.
  - It updates the `ramadan_mode_override` field in `profiles.preferences`.
- [ ] **Task:** Add the toggle to the user's profile/settings page.
- [ ] **Task:** In the main layout or dashboard header, display a 🌙 icon if `getActiveMealConfig().mode === 'ramadan'`.
- [ ] **Task:** During onboarding, if `isRamadan()` is true, show a prompt: "It's currently Ramadan. Would you like to start with a Ramadan meal plan?"

### Phase 4: Meal Substitution Feature (2-3 Days)

- [ ] **Task:** In the admin panel, create a simple interface for adding/editing `tags` on recipes. Ensure key recipes are tagged with `iftar`, `suhoor`, etc.
- [ ] **Task:** On the dashboard meal card, add a "..." menu with a "Remove Meal" option.
- [ ] **Task:** When "Remove Meal" is clicked, open a bottom sheet (`Sheet` component).
  - **UI:** Show options: "Distribute calories to other meals" or "Replace with another recipe".
  - **Logic (Distribute):** Call a server action that uses the (to-be-created) `redistributeCalories` function in the meal planning service.
  - **Logic (Replace):** Call a server action that uses `findSubstituteRecipes` to fetch options. Display these options in the sheet for the user to choose from.
- [ ] **Task:** Upon confirmation, update the `daily_plans` record for that day with the new meal structure and recipes.

This structured plan ensures all logic is properly separated, the database remains clean, and the feature is implemented in manageable, testable phases.
