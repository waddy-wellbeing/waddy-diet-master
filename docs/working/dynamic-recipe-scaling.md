# Dynamic Recipe Scaling System

> **Status**: Planning  
> **Last Updated**: November 30, 2025  
> **Discussion**: System design for calorie-adjusted recipe delivery

## Overview

The core goal of BiteRight is to provide personalized meal plans where recipes are **dynamically scaled** to match each user's calorie budget per meal. Users don't just pick recipes—they see all available options automatically adjusted to fit their nutritional targets.

## User Journey

1. **Onboarding** → User completes TDEE calculation, sets daily calorie target
2. **Meal Preferences** → User chooses number of meals (e.g., 3 meals + 2 snacks)
3. **System Calculates** → Daily calories distributed across meals
4. **Browse Options** → User swipes through meal options, all pre-scaled to their budget
5. **Weekly Plan** → Same plan daily by default; user can customize specific days
6. **Grocery List** → Aggregated shopping list from selected meals

## Calorie Distribution

### Admin-Controlled Global Settings

| Setting | Description | Example |
|---------|-------------|---------|
| `breakfast_pct` | % of daily calories for breakfast | 25% |
| `lunch_pct` | % of daily calories for lunch | 35% |
| `dinner_pct` | % of daily calories for dinner | 30% |
| `snacks_pct` | % of daily calories for snacks (split across snack count) | 10% |
| `deviation_tolerance` | Show recipes within ±X% of target | 25% |

### Example Calculation

**User Profile:**
- Daily target: 2000 cal
- Meals: 3 meals + 2 snacks

**Meal Budgets (using default distribution):**
| Meal | Percentage | Calories | With ±25% Deviation |
|------|------------|----------|---------------------|
| Breakfast | 25% | 500 cal | 375-625 cal |
| Lunch | 35% | 700 cal | 525-875 cal |
| Dinner | 30% | 600 cal | 450-750 cal |
| Snack 1 | 5% | 100 cal | 75-125 cal |
| Snack 2 | 5% | 100 cal | 75-125 cal |

## Recipe Scaling Logic

### How It Works

1. **Base Recipe**: Has ingredients with quantities and calculated `nutrition_per_serving`
2. **Target Calories**: User's meal budget (e.g., 500 cal for breakfast)
3. **Scale Factor**: `targetCalories / baseRecipeCalories`
4. **Scaled Ingredients**: Multiply each ingredient quantity by scale factor

### What Scales vs. What Doesn't

| Type | Scales? | Notes |
|------|---------|-------|
| Regular ingredients | ✅ Yes | Chicken, rice, vegetables, etc. |
| Spices (`is_spice: true`) | ❌ No | Already have no quantity (taste-based) |
| Optional ingredients | ⚠️ TBD | May need `is_scalable` flag later |

### Example Scaling

**Base Recipe: Grilled Chicken Salad**
- Base calories: 400 cal
- Target: 500 cal
- Scale factor: 1.25

| Ingredient | Base Qty | Scaled Qty |
|------------|----------|------------|
| Chicken breast | 150g | 187g |
| Mixed greens | 100g | 125g |
| Olive oil | 15ml | 19ml |
| Lemon juice | 10ml | 12ml |
| Salt | - | - (spice, no scaling) |
| Pepper | - | - (spice, no scaling) |

## Database Requirements

### New: System Settings Table

```sql
CREATE TABLE system_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Default settings
INSERT INTO system_settings (key, value, description) VALUES
('meal_distribution', '{
  "breakfast": 0.25,
  "lunch": 0.35,
  "dinner": 0.30,
  "snacks": 0.10
}', 'Default calorie distribution across meal types'),
('deviation_tolerance', '0.25', 'Show recipes within ±X of target calories');
```

### User Profile Fields (in `profiles.preferences`)

```jsonc
{
  "meals_per_day": 3,           // Number of main meals
  "snacks_per_day": 2,          // Number of snacks
  "custom_distribution": null,  // Optional override of global distribution
  // ... other preferences
}
```

### User Profile Fields (in `profiles.targets`)

```jsonc
{
  "daily_calories": 2000,
  "protein_g": 150,
  "carbs_g": 200,
  "fat_g": 65,
  // Computed meal budgets (cached, recalculated on target change)
  "meal_budgets": {
    "breakfast": 500,
    "lunch": 700,
    "dinner": 600,
    "snack": 100
  }
}
```

## Components to Build

### Phase 1: Foundation (Admin Panel Completion)
- [ ] `system_settings` table + seed default values
- [ ] Admin UI for managing system settings
- [ ] Recipe nutrition auto-calculation from ingredients
- [ ] Ingredients "Has Issues" filter (missing food_group, unverified, etc.)
- [ ] Ensure all ingredients have food_group assigned

### Phase 2: Admin Test Console
- [ ] **TDEE Calculator**: Input user params → see calculated TDEE & meal budgets
- [ ] **Meal Plan Preview**: Select TDEE + meals/snacks → see suggested recipes with scaling
- [ ] **Recipe Alternatives**: Pick a recipe → see same-meal-type alternatives
- [ ] **Ingredient Swaps**: Pick an ingredient → see same-food-group alternatives

### Phase 3: Scaling Engine
- [ ] `scaleRecipeToCalories(recipe, targetCalories)` function
- [ ] `getScalableRecipesForMeal(mealType, targetCalories, deviation)` query
- [ ] Cache scaled nutrition per serving

### Phase 4: User Experience (Post-Onboarding)
- [ ] Onboarding flow (TDEE calculator, meal preferences)
- [ ] Meal browsing with swipe UI
- [ ] Scaled ingredient display
- [ ] **Recipe alternatives by meal_type** (when user swipes to change)
- [ ] **Ingredient substitution by food_group** (same group alternatives)

### Phase 5: Planning & Shopping
- [ ] Weekly plan view (same daily, customizable)
- [ ] Grocery list aggregation
- [ ] Export/share shopping list

## Open Questions (To Resolve in Onboarding Phase)

1. **TDEE Calculation Inputs**: What data do we collect? (weight, height, age, activity level, goal)
2. **Macro Targets**: Just calories, or also protein/carbs/fat targets?
3. **User Override**: Can users manually adjust their meal distribution?
4. **Snack Flexibility**: Fixed snack count, or "1-3 snacks" range?

## Future Enhancements (Deferred)

- `is_scalable` flag per ingredient for edge cases
- `min_quantity` / `max_quantity` constraints
- Recipe variety enforcement (don't repeat same meal within X days)
- Dietary restrictions filtering (vegetarian, gluten-free, etc.)
- AI-powered meal suggestions based on preferences

---

## References

- [Database ERD](../main/database-erd.md)
- [User Story](../main/user-story.md)
- [Architecture](../main/architecture.md)
