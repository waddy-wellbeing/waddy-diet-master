# BiteRight Web App — Current User Flows Audit

*Codebase analysis performed: February 14, 2026*  
*Branch: `main`*  
*Purpose: Reverse-engineer actual user interactions for mobile companion app development*

---

## 0. Onboarding (Summary)

The onboarding flow is handled in two paths:

- **Authenticated users:** [`app/(app)/onboarding/page.tsx`](../../app/(app)/onboarding/page.tsx) — checks if the user has a profile with `onboarding_completed`. If already done, redirects to `/dashboard`.
- **Guest users:** [`app/get-started/page.tsx`](../../app/get-started/page.tsx) — redirects logged-in users appropriately, or sends guests to `/get-started/onboarding`.

### What Happens During Onboarding

1. User provides basic info (name, age, weight, height, gender, activity level).
2. User sets goals (weight loss/gain/maintain).
3. User sets preferences (meals per day, cooking skill, dietary restrictions).
4. Server action in [`lib/actions/onboarding.ts`](../../lib/actions/onboarding.ts) saves to the `profiles` table: `basic_info`, `targets` (daily_calories, TDEE, BMR, macros), `preferences` (meals_per_day, cooking_skill, meal_structure).
5. [`lib/actions/users.ts`](../../lib/actions/users.ts) → `assignMealStructure()` generates a `daily_plans` row with calorie-distributed meal slots based on a hardcoded template (e.g., 4 meals → 25%/35%/25%/15%).
6. User is redirected to `/dashboard`.

**Mobile API Gap:** No onboarding API endpoint exists. Mobile would need to replicate this via new API routes or direct Supabase access.

---

## 1. The Dashboard Structure

### 1.1 Routing & Mode Selection

The server component [`app/(app)/dashboard/page.tsx`](../../app/(app)/dashboard/page.tsx) is the entry point. It:

1. Fetches the user's profile, today's log, today's plan, week logs, week plans, streak data, and all public recipes — **all in a single `Promise.all`** (lines 45–105).
2. Checks `profile.preferences?.is_fasting` (line 119 area) to determine which dashboard to render.
3. Routes to one of **two completely separate client components**:
   - **Regular mode:** [`DashboardContent`](../../app/(app)/dashboard/dashboard-content.tsx) 
   - **Fasting mode:** [`FastingDashboardContent`](../../app/(app)/dashboard/fasting-dashboard-content.tsx)

### 1.2 What the User Sees (Regular Mode)

The dashboard is structured **top-to-bottom** as:

| Section | Component | Details |
|---------|-----------|---------|
| **Header** | Inline in `DashboardContent` | Greeting ("Good morning, {firstName}! 👋"), today's date, dropdown menu with Profile/Settings/Admin/Logout links |
| **Week Selector** | [`WeekSelector`](../../components/dashboard/dashboard-components.tsx) | 7-day strip (Sun–Sat). Each day shows a progress ring (calories consumed %). Visual indicators: 🔵 planned, 🟢 logged, 🟡 both. Tapping a day loads that day's data. Tapping the "+" on a future day opens the plan sheet. |
| **Debug Panel** | Inline (admin/moderator only) | Shows consumed vs target calories, macros, macro quality scores per meal. Hidden from regular users. |
| **Meals Section** | [`MealCard`](../../components/dashboard/dashboard-components.tsx) (×N) | One card per meal slot. Title: "Today's Meals" or "{Day}'s Meals". "Plan Day" button opens `MealPlanSheet`. |
| **Quick Stats** | [`QuickStats`](../../components/dashboard/dashboard-components.tsx) | Weekly Overview: streak count, weekly average calories, weekly target. |
| **Admin Link** | Inline | "Go to Admin Panel" button (admin/moderator only). |
| **Meal Plan Sheet** | [`MealPlanSheet`](../../components/dashboard/meal-plan-sheet.tsx) | Bottom sheet for planning future days' meals. |

**The user sees a list of specific meals — NOT just a summary.** The meal slots are dynamic:

```typescript
// From dashboard-content.tsx lines 104-127
// Reads profile.preferences.meal_structure if available
// Otherwise defaults to: Breakfast, Lunch, Dinner, Snacks
```

Possible regular meal slots: `breakfast`, `mid_morning`, `lunch`, `afternoon`, `dinner`, `snacks` — depending on what `meals_per_day` the user chose during onboarding. The mapping is in [`app/(app)/dashboard/page.tsx`](../../app/(app)/dashboard/page.tsx) lines 209-228.

### 1.3 What's on a Meal Card

From [`MealCard`](../../components/dashboard/dashboard-components.tsx) (lines 391-820):

| Element | Shown? | Details |
|---------|--------|---------|
| **Emoji** | ✅ | 🥣 Breakfast, 🥗 Lunch, 🍛 Dinner, 🍎 Snacks |
| **Meal Label** | ✅ | e.g., "Breakfast", "Lunch" |
| **Recipe Name** | ✅ | From planned recipe or suggested recipe |
| **Recipe Image** | ✅ | `recipe.image_url` via Next.js `Image` component (lazy loaded, 400×300) |
| **Calories Badge** | ✅ | Shows `scaled_calories` (target-adjusted), e.g., "488 cal" with Flame icon |
| **Macros** | ❌ | **Removed** (per DASHBOARD_MEALBUILDER_UPDATES.md — was considered "information overload") |
| **Target Calories** | ❌ | Hidden from regular users (admin debug panel only) |
| **Logged Status** | ✅ | Green checkmark + "Logged" text, or logged recipe name if different from planned |
| **Swap Indicator** | ✅ | Shows "N swaps" badge if `planSlot.swapped_ingredients` exists |
| **Plan Indicator** | ✅ | Blue "Planned" badge if recipe comes from a saved plan |

**Action Buttons on a Meal Card (for today only):**

| Button | Condition | Action |
|--------|-----------|--------|
| **"✅ Log It"** | Not logged, has recipe | Calls `handleLogMeal(mealName)` |
| **"↩ Undo"** | Already logged | Calls `handleUnlogMeal(mealName)` |
| **"← →" Swap arrows** | Has >1 recipe available | Calls `handleSwapMeal(mealName, direction)` |
| **"View Recipe" link** | Has recipe | Navigates to `/meal-builder?meal={mealName}&recipe={recipeId}` |
| **"Edit Swaps" link** | Has swapped ingredients | Same navigation |

**For past days:** Only shows "Eaten" (green) or "Not logged" (grey) status — no action buttons.

**No-recipe empty state:** Shows "No recipe assigned" with the meal emoji and label.

### 1.4 Fasting Mode

**Yes, fasting mode exists and is active.** It's controlled by `profile.preferences.is_fasting` (boolean).

**Toggle location:** The toggle is referenced in [`docs/working/ramadan-mode-implementation.md`](ramadan-mode-implementation.md) as `components/profile/fasting-mode-toggle.tsx` — this would be on the profile/settings page.

**Fasting meal slots** (from [`app/(app)/dashboard/page.tsx`](../../app/(app)/dashboard/page.tsx) lines 246-252):

| Slot | Label | Calorie % | Maps to recipe types |
|------|-------|-----------|---------------------|
| `pre-iftar` | كسر صيام | 10% | Any (no calorie scaling) |
| `iftar` | إفطار | 40% | lunch recipes |
| `full-meal-taraweeh` | وجبة تراويح | 15% | lunch, dinner recipes |
| `snack-taraweeh` | سناك تراويح | 15% | snack recipes |
| `suhoor` | سحور | 20% | breakfast, dinner recipes |

**Key architecture detail:** Both `plan` and `fasting_plan` are stored **simultaneously** in the same `daily_plans` row. The dashboard simply reads one or the other based on the flag. When fasting mode is enabled, `fasting_plan` is auto-generated from available recipes on first load ([`fasting-dashboard-content.tsx`](../../app/(app)/dashboard/fasting-dashboard-content.tsx) lines 251-310).

### 1.5 Recipe Scaling Logic

Recipes are **scaled** to match meal calorie targets. From [`app/(app)/dashboard/page.tsx`](../../app/(app)/dashboard/page.tsx) lines 283-400:

- Each recipe's `nutrition_per_serving.calories` is compared to the meal's `targetCalories`.
- A `scale_factor` is computed: `targetCalories / recipeCalories`, clamped to `[0.5, 2.0]`.
- `scaled_calories` = `recipeCalories × scale_factor`.
- `macro_similarity_score` is calculated comparing scaled macros to target macro percentages.
- Recipes are **sorted by macro similarity score** (best match first).

---

## 2. The "Log Meal" Interaction

### 2.1 What the User Does

**It's a single-tap action.** The user taps "✅ Log It" on a meal card. There is:
- ❌ No weight entry
- ❌ No portion size adjustment (fixed at plan's `servings`, typically 1)
- ❌ No rating
- ❌ No confirmation dialog

It's an **instant optimistic log**.

### 2.2 Exact Code Flow (Regular Mode)

From [`dashboard-content.tsx`](../../app/(app)/dashboard/dashboard-content.tsx) `handleLogMeal` (lines 424-545):

```typescript
1. Prevent double-click (if loadingMeal is already set, return)
2. Set loadingMeal = mealName (shows spinner on that card)
3. Find the meal object and its recipe
4. Build logEntry:
   {
     type: "recipe",
     recipe_id: meal.recipe.id,
     recipe_name: meal.recipe.name,
     servings: meal.planSlot?.servings || 1,
     scale_factor: scaledRecipe.scale_factor || 1,
     from_plan: true
   }
5. Query existing daily_log for today
6. Append logEntry to the meal's items array
7. Calculate updated totals (add scaled_calories, scaled protein/carbs/fat)
8. If log exists → UPDATE, else → INSERT (upsert pattern)
9. Check achievements (async, fire-and-forget)
10. Refresh data via fetchDayData() + fetchWeekData()
11. Track analytics event
```

### 2.3 Server-Side Handling

**There is NO server action for logging from the web dashboard.** The logging happens **client-side** using the Supabase client directly ([`createClient`](../../lib/supabase/client.ts)).

The dashboard component directly calls:
```typescript
await supabase.from("daily_logs").update({...}).eq("id", existingLog.id)
// or
await supabase.from("daily_logs").insert({...})
```

**For the mobile API**, there IS a server-side route: [`app/api/mobile/log/route.ts`](../../app/api/mobile/log/route.ts) — `POST /api/mobile/log` which accepts `{ uid, date, mealType, items }` and performs the same upsert logic using the admin client.

### 2.4 Edge Case: Logging a Meal Twice

**It IS possible to log the same meal twice.** The code **appends** to the items array:

```typescript
// dashboard-content.tsx ~line 470
const mealLog = currentLog[mealName as keyof DailyLog] || { items: [] };
const updatedMealLog = {
  logged_at: new Date().toISOString(),
  items: [...(mealLog.items || []), logEntry],  // APPEND, not replace
};
```

However, the UI button changes to "Logged" + "Undo" after the first log, so the user would have to:
1. Log the meal → button becomes "Undo"
2. Navigate away and back (or change date and return)
3. If a race condition occurs, duplicates could happen

**The "Undo" action** (`handleUnlogMeal`) **completely removes** the meal entry (sets it to `{ logged_at: null, items: [] }`), so it's an all-or-nothing operation — it doesn't remove individual items.

### 2.5 Calorie Accounting Note

**Critical detail:** `scaled_calories` represents the **total meal target** (already scaled), NOT per-serving. The code explicitly documents this:

```typescript
// NOTE: scaled_calories is already the target amount (total for this meal)
// NOT per-serving, so don't multiply by servings/scale_factor!
```

This appears in both [`dashboard-content.tsx`](../../app/(app)/dashboard/dashboard-content.tsx) (line ~488) and [`fasting-dashboard-content.tsx`](../../app/(app)/dashboard/fasting-dashboard-content.tsx) (line ~515).

---

## 3. The Meal Builder

### 3.1 Entry Point

[`app/(app)/meal-builder/page.tsx`](../../app/(app)/meal-builder/page.tsx) — A server component that:

1. Reads query params: `?meal={mealType}&recipe={recipeId}`
2. Fetches: profile, all recipes (with their `recipe_ingredients` joined to `ingredients`), today's plan
3. Calculates per-meal calorie/macro targets using same logic as dashboard
4. Passes everything to `MealBuilderContent` client component

### 3.2 What the User Can Do

Based on the navigation from dashboard meal cards:

- **View full recipe details** (ingredients, instructions, nutrition breakdown)
- **Swap ingredients** within a recipe (tracked via `planSlot.swapped_ingredients`)
- **Adjust portions** (referenced in docs but controlled by scale_factor)
- **Log the meal** from the builder

The builder shows a **debug button** (🐛) for admin/moderator roles that reveals target macros and "On Track"/"Off Track" status per DASHBOARD_MEALBUILDER_UPDATES.md.

### 3.3 Recipe Swapping (from Dashboard)

`handleSwapMeal` in [`dashboard-content.tsx`](../../app/(app)/dashboard/dashboard-content.tsx) (lines 667+):

1. Gets the recipe array for that meal type
2. Cycles to next/previous recipe: `newIndex = (currentIndex ± 1 + total) % total`
3. Updates `selectedIndices` state (moves to next recipe in the pre-sorted list)
4. Saves the new recipe to the `daily_plans` table via [`saveFullDayPlan`](../../lib/actions/daily-plans.ts)
5. Tracks analytics event

This means **swapping is instant** — it just picks the next best-scoring recipe from the pre-computed list.

---

## 4. Other User-Facing Pages

### 4.1 Nutrition Page

[`app/(app)/nutrition/page.tsx`](../../app/(app)/nutrition/page.tsx):

- Shows **30-day trends** (calories, macros per day)
- Fetches from `daily_logs` for the last 30 days
- Displays: date, calories, protein, carbs, fat, meals logged count, adherence score
- Server component → passes data to [`NutritionContent`](../../app/(app)/nutrition/nutrition-content.tsx) client component

### 4.2 Plans Page

[`app/(app)/plans/page.tsx`](../../app/(app)/plans/page.tsx):

- Shows **all meal plans** for the last 2 months
- Fetches from `daily_plans` ordered by date descending
- Joins with recipe data for display (name, image, prep/cook time)
- Uses [`PlanContent`](../../app/(app)/plans/plans-content.tsx) client component

### 4.3 Profile Page

[`app/(app)/profile/page.tsx`](../../app/(app)/profile/page.tsx):

- User settings and preferences
- **Fasting mode toggle** would be here
- Profile editing (basic info, targets, preferences)

### 4.4 Bottom Navigation

[`components/app/navigation/bottom-nav.tsx`](../../components/app/navigation/bottom-nav.tsx):

| Tab | Route | Icon |
|-----|-------|------|
| Home | `/dashboard` | `Home` |
| Meals | `/meal-builder` | `UtensilsCrossed` |
| Nutrition | `/nutrition` | `BarChart3` |
| Profile | `/profile` | `User` |

---

## 5. Adherence & Progress

### 5.1 Adherence Calculation

There is **no complex adherence algorithm** in the client code. The `adherence_score` field exists on `daily_logs` and is:

- **Fetched** in the nutrition page ([`app/(app)/nutrition/page.tsx`](../../app/(app)/nutrition/page.tsx) line 84)
- **Referenced** in the daily_logs schema
- **Not calculated client-side** — it appears to be computed server-side (possibly in a Supabase function or during log updates)

The **debug panel** (admin only) shows a simpler check:

```typescript
// dashboard-content.tsx ~line 1050
Math.abs(todayConsumed - dailyCalories) <= dailyCalories * 0.05
  ? "✅ On Track"
  : todayConsumed < dailyCalories ? "⚠️ Under" : "⚠️ Over"
```

This is a **±5% tolerance** check — but it's only for admin debugging, not shown to users.

### 5.2 Streaks

**Streaks are calculated server-side** in [`app/(app)/dashboard/page.tsx`](../../app/(app)/dashboard/page.tsx) lines 134-149:

```typescript
// Count consecutive days from today backwards (up to 30 days)
let streak = 0;
const logDates = new Set(streakLogs.map(l => l.log_date));
let checkDate = today;
for (let i = 0; i < 30; i++) {
  if (logDates.has(format(checkDate, "yyyy-MM-dd"))) {
    streak++;
    checkDate = subDays(checkDate, 1);
  } else {
    break;
  }
}
```

**Logic:** Any day with a `daily_logs` row counts. The streak breaks on the first missing day going backwards from today. Maximum tracked: 30 days.

**Displayed in:** [`QuickStats`](../../components/dashboard/dashboard-components.tsx) component — shows streak count with a 🔥 emoji.

### 5.3 Achievements/Badges

There IS achievement logic: `checkAndNotifyAchievements` is called after logging a meal:

```typescript
// dashboard-content.tsx ~line 525
const { checkAndNotifyAchievements } = await import("@/lib/actions/daily-logs");
checkAndNotifyAchievements(profile.user_id, dateStr).catch(err => {
  console.error("Failed to check achievements:", err);
});
```

This is fire-and-forget (async, error-swallowed). The actual implementation is in [`lib/actions/daily-logs.ts`](../../lib/actions/daily-logs.ts). Without seeing the full file, it appears to be a server action that checks conditions and potentially creates notifications.

---

## 6. Data Schema Validation

### 6.1 Key Tables & Fields Referenced in Code

The project uses **Supabase** (not Prisma). Schema is in [`supabase/schema.sql`](../../supabase/schema.sql).

**`profiles` table** (fields actively used):

| Column | Type | Used In |
|--------|------|---------|
| `user_id` | UUID | All queries |
| `basic_info` | JSONB | `{ name, age, weight_kg, height_cm, gender, activity_level }` |
| `targets` | JSONB | `{ daily_calories, tdee, bmr, protein_g, carbs_g, fat_g, fiber_g }` |
| `preferences` | JSONB | `{ meals_per_day, cooking_skill, is_fasting, meal_structure, fasting_meal_structure }` |
| `goals` | JSONB | Goal settings |
| `role` | TEXT | `admin`, `moderator`, `user` |
| `onboarding_completed` | BOOLEAN | Redirect logic |
| `onboarding_step` | TEXT | Onboarding progress |

**`daily_plans` table:**

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | UUID | |
| `plan_date` | DATE | Primary key with user_id |
| `plan` | JSONB | Regular meal plan `{ breakfast: { recipe_id, servings, ... }, lunch: {...} }` |
| `fasting_plan` | JSONB | Fasting meal plan (same structure, different meal names) |
| `daily_totals` | JSONB | `{ calories, protein_g, carbs_g, fat_g }` — **shared between modes, overwritten by active mode** |
| `mode` | TEXT | Referenced in plan queries (line 85 of page.tsx) |

**`daily_logs` table:**

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | UUID | |
| `log_date` | DATE | Primary key with user_id |
| `log` | JSONB | `{ breakfast: { logged_at, items: [...] }, lunch: {...}, ... }` |
| `logged_totals` | JSONB | `{ calories, protein_g, carbs_g, fat_g }` |
| `meals_logged` | INTEGER | Count of meals with items |
| `adherence_score` | NUMERIC | Referenced in nutrition page |

**`recipes` table:**

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | |
| `name` | TEXT | |
| `image_url` | TEXT | |
| `nutrition_per_serving` | JSONB | `{ calories, protein_g, carbs_g, fat_g }` |
| `meal_type` | TEXT | `breakfast`, `lunch`, `dinner`, `snack`, `smoothies`, `one pot`, `side dishes`, `snacks & sweetes` |
| `is_public` | BOOLEAN | |
| `prep_time_minutes` | INTEGER | |
| `cook_time_minutes` | INTEGER | |
| `ingredients` | JSONB | |
| `instructions` | JSONB | |

### 6.2 Fields NOT Found in Active Code

Based on the code audit, these fields from the docs are **NOT actively used** in the current dashboard/meal-builder flows:

- ❌ `fasting_window` — Not referenced anywhere in the codebase
- ❌ `water_intake` — Not referenced (water tracking widget is listed as "Optional" in the implementation plan)
- ❌ Shopping list persistence — Explicitly documented as ephemeral (no DB storage)
- ❌ `daily_plans.fasting_daily_totals` — Explicitly documented as NOT existing; both modes share `daily_totals`

### 6.3 Mobile API Endpoints That Already Exist

| Endpoint | File | Method | Purpose |
|----------|------|--------|---------|
| `/api/mobile/dashboard` | [`app/api/mobile/dashboard/route.ts`](../../app/api/mobile/dashboard/route.ts) | GET | Returns targets, consumed totals, 3 recipe suggestions |
| `/api/mobile/search` | [`app/api/mobile/search/route.ts`](../../app/api/mobile/search/route.ts) | GET | Search recipes by name (up to 20 results) |
| `/api/mobile/log` | [`app/api/mobile/log/route.ts`](../../app/api/mobile/log/route.ts) | POST | Upserts a meal log entry |

**Gap analysis:** The mobile API is **minimal**. Missing endpoints for:
- Recipe listing/details with scaling
- Meal swapping
- Plan creation/management
- Week data (logs + plans for week selector)
- Profile/preferences management
- Fasting mode toggle
- Achievement checking
- Nutrition trends (30-day history)

---

## 7. Summary of Edge Cases & Gotchas for Mobile

| Issue | Detail | File Reference |
|-------|--------|---------------|
| **Double logging** | Items array is appended to, not replaced. UI prevents via button state but API doesn't deduplicate. | [`dashboard-content.tsx`](../../app/(app)/dashboard/dashboard-content.tsx) ~line 470 |
| **Undo removes all items** | Unlogging wipes the entire meal slot, not individual items. | [`dashboard-content.tsx`](../../app/(app)/dashboard/dashboard-content.tsx) ~line 600 |
| **scaled_calories is total, not per-serving** | Do NOT multiply by servings. The mobile API would need the same understanding. | Both dashboard files, explicitly commented |
| **Fasting plan auto-generation** | If no fasting_plan exists when fasting mode is on, the client generates and saves one. Mobile needs this logic too. | [`fasting-dashboard-content.tsx`](../../app/(app)/dashboard/fasting-dashboard-content.tsx) ~lines 251-310 |
| **selectedIndices vs plan** | Planned days use `dailyPlan.plan` directly; unplanned days use `selectedIndices` for suggested recipes. These are intentionally separate. | [`dashboard-content.tsx`](../../app/(app)/dashboard/dashboard-content.tsx) ~line 175 |
| **No server actions for web logging** | Web dashboard uses client Supabase directly (RLS). Mobile API uses admin client. Different auth patterns. | Client vs [`app/api/mobile/log/route.ts`](../../app/api/mobile/log/route.ts) |
| **Streak max 30 days** | Only checks backwards 30 days from today. | [`app/(app)/dashboard/page.tsx`](../../app/(app)/dashboard/page.tsx) ~line 140 |
| **meals_logged is a count** | Updated manually in the log update — it's not derived. Could desync. | Both dashboard files, in log/unlog handlers |

---

## 8. Recommended Mobile API Endpoints

Based on this audit, the following REST API endpoints should be created to achieve feature parity with the web app:

### 8.1 Priority 1 (Core Features)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /api/mobile/week-data` | GET | Returns 7 days of logs + plans (for week selector) |
| `GET /api/mobile/recipes/:id` | GET | Recipe detail with ingredients, instructions, nutrition |
| `GET /api/mobile/recipes` | GET | List all public recipes with optional filters (meal_type, tags) |
| `POST /api/mobile/plans/save` | POST | Save/update a daily plan for a specific date |
| `POST /api/mobile/meals/swap` | POST | Swap a meal to the next best recipe |
| `DELETE /api/mobile/log/:date/:meal` | DELETE | Undo/remove a logged meal |

### 8.2 Priority 2 (User Management)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /api/mobile/profile` | GET | Get user profile (targets, preferences, goals) |
| `PUT /api/mobile/profile` | PUT | Update profile settings |
| `POST /api/mobile/profile/fasting-mode` | POST | Toggle fasting mode on/off |
| `GET /api/mobile/onboarding` | GET | Get onboarding status |
| `POST /api/mobile/onboarding/complete` | POST | Complete onboarding step |

### 8.3 Priority 3 (Analytics & Progress)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /api/mobile/nutrition/history` | GET | 30-day nutrition history for trends |
| `GET /api/mobile/streaks` | GET | Current streak count |
| `GET /api/mobile/achievements` | GET | User achievements/badges |

---

## 9. Next Steps for Mobile Development

1. **Implement missing API endpoints** (Priority 1 list above)
2. **Add authentication layer** — Either:
   - Use Supabase auth tokens (recommended)
   - Or continue with `uid` query param + admin client (current approach)
3. **Implement recipe scaling logic** in mobile client (matches web dashboard lines 283-400)
4. **Handle fasting mode** — Either auto-generate or fetch pre-generated fasting_plan
5. **Sync meal logging behavior** — Ensure mobile follows the same append-to-items pattern
6. **Test edge cases** — Double logging, undo, streak calculation, adherence scoring

---

## Appendix: Key File Map

| Feature | Primary Files |
|---------|--------------|
| Dashboard (Regular) | `app/(app)/dashboard/page.tsx`, `app/(app)/dashboard/dashboard-content.tsx` |
| Dashboard (Fasting) | `app/(app)/dashboard/fasting-dashboard-content.tsx` |
| Meal Builder | `app/(app)/meal-builder/page.tsx` |
| Nutrition Trends | `app/(app)/nutrition/page.tsx` |
| Plans History | `app/(app)/plans/page.tsx` |
| Onboarding | `app/(app)/onboarding/page.tsx`, `lib/actions/onboarding.ts` |
| Mobile API | `app/api/mobile/**/route.ts` |
| Types | `lib/types/nutri.ts` |
| Database Schema | `supabase/schema.sql` |
