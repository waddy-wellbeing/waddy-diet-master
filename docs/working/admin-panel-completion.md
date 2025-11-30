# Admin Panel Completion Plan

> **Status**: In Progress  
> **Last Updated**: November 30, 2025  
> **Goal**: Complete admin panel with all tools needed before onboarding implementation

## Current State ✅

| Feature | Status | Location |
|---------|--------|----------|
| Recipe CRUD | ✅ Done | `/admin/recipes` |
| Recipe images | ✅ Done | Upload + auto-delete old |
| Ingredient matching | ✅ Done | In recipe form |
| "Has Issues" filter | ✅ Done | Recipes without image/ingredients |
| Ingredient CRUD | ✅ Done | `/admin/ingredients` |
| Spice CRUD | ✅ Done | `/admin/spices` |
| User listing | ✅ Done | `/admin/users` |
| System Settings | ✅ Done | `/admin/settings` |

## Remaining Tasks

### 1. Recipe Nutrition Auto-Calculation
**Priority**: High  
**Description**: Calculate `nutrition_per_serving` from matched ingredients

```typescript
// For each matched ingredient:
// 1. Get ingredient's macros/micros per serving
// 2. Calculate ratio: recipe_qty / ingredient_serving_size
// 3. Multiply macros/micros by ratio
// 4. Sum all ingredients
// 5. Divide by servings to get per-serving nutrition
```

**UI**: 
- "Calculate Nutrition" button in recipe form
- Show calculated vs. manual values
- Flag large discrepancies

### 2. Ingredients "Has Issues" Filter
**Priority**: Medium  
**Description**: Add filter to ingredients table

**Issues to detect**:
- Missing `food_group`
- Missing `name_ar` (Arabic name)
- Unverified (`is_verified = false`)
- Missing macros (all zeros)
- Suspicious values (e.g., calories > 1000/100g)

### 3. System Settings Management
**Priority**: High  
**Description**: Admin-editable system settings

**Settings to manage**:
| Key | Default | Description |
|-----|---------|-------------|
| `meal_distribution` | `{breakfast: 0.25, lunch: 0.35, dinner: 0.30, snacks: 0.10}` | Calorie % per meal |
| `deviation_tolerance` | `0.25` | ±25% calorie matching |
| `default_meals_per_day` | `3` | Default meal count |
| `default_snacks_per_day` | `2` | Default snack count |

**UI**: Simple key-value editor at `/admin/settings`

### 4. Admin Test Console 🆕
**Priority**: High  
**Description**: Simulate user scenarios to validate the scaling engine

#### 4.1 TDEE Calculator
**Path**: `/admin/test-console/tdee-calculator`

**Inputs**:
- Age, gender, weight, height
- Activity level (sedentary → very active)
- Goal (lose/maintain/gain)

**Outputs**:
- BMR calculation
- TDEE calculation
- Suggested daily calories
- Meal budget breakdown

#### 4.2 Meal Plan Preview
**Path**: `/admin/test-console/meal-planner`

**Inputs**:
- Daily calorie target
- Meal structure (from user profile)
- Optional: dietary restrictions

**Outputs**:
- Suggested meals for each slot
- Each recipe scaled to calorie budget
- Daily nutrition totals
- Visual meal cards with images

#### 4.3 Recipe Alternatives
**Path**: `/admin/test-console/alternatives`

**Inputs**:
- Select a recipe
- Target calorie budget

**Outputs**:
- List of alternative recipes (same `meal_type`)
- All scaled to target calories
- Show within deviation tolerance
- Preview scaled ingredients

#### 4.4 Ingredient Swaps
**Path**: `/admin/test-console/swaps`

**Inputs**:
- Select an ingredient
- Show context (which recipe)

**Outputs**:
- Alternatives in same `food_group`
- Nutritional comparison
- Quantity adjustment for calorie match

### 5. User Plan Assignment 🆕
**Priority**: High  
**Description**: Coach assigns meal structure to users after onboarding

**Path**: `/admin/users/[id]/assign-plan`

**Flow**:
1. User completes onboarding → `plan_status = 'pending_assignment'`
2. Coach sees pending users list
3. Coach views user's TDEE + requested meal count
4. Coach assigns meal structure with percentages
5. User's `plan_status` → `'active'`
6. User can now see their personalized meals

**Meal Structure Example** (stored in `profiles.preferences.meal_structure`):
```json
{
  "meals": [
    { "name": "breakfast", "label": "الإفطار", "percentage": 0.20 },
    { "name": "mid_morning", "label": "وجبة منتصف الصباح", "percentage": 0.15 },
    { "name": "lunch", "label": "الغداء", "percentage": 0.25 },
    { "name": "afternoon", "label": "وجبة بعد الظهر", "percentage": 0.15 },
    { "name": "dinner", "label": "العشاء", "percentage": 0.25 }
  ]
}
```

---

## Database Requirements

### New Table: `system_settings`

```sql
CREATE TABLE system_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- RLS: Only admins can read/write
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage settings" ON system_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );
```

### Migration: Add missing food_groups

See: `supabase/migrations/update_supplements_food_group.sql`

---

## Food Groups Reference

Standard food groups for ingredient categorization:

| Food Group | Subgroups |
|------------|-----------|
| Proteins | Poultry, Red Meat, Fish & Seafood, Eggs, Legumes |
| Dairy | Milk, Cheese, Yogurt |
| Grains | Bread, Rice, Pasta, Cereals |
| Vegetables | Leafy Greens, Root Vegetables, Cruciferous |
| Fruits | Citrus, Berries, Tropical, Stone Fruits |
| Fats & Oils | Cooking Oils, Nuts, Seeds |
| Supplements | Vitamins, Minerals, Amino Acids, Multivitamins |
| Beverages | Water, Coffee, Tea, Juices |
| Condiments | Sauces, Dressings, Spreads |
| Sweeteners | Sugar, Honey, Artificial |

---

## User Experience Notes

### Recipe Alternatives (User Swipe)
When a user swipes to change a meal:
- **Only show recipes with matching `meal_type`**
- Pre-filter by dietary restrictions
- Already scaled to their meal budget
- Show variety (don't repeat same recipe in a week)

### Ingredient Substitution
When a user wants to swap an ingredient:
- **Only show ingredients in same `food_group`**
- Optionally narrow to same `subgroup`
- Show nutritional comparison
- Auto-adjust quantity for calorie equivalence

---

## Implementation Order

1. **System Settings table + seed** (enables configuration)
2. **Ingredients "Has Issues" filter** (find data quality issues)
3. **Recipe nutrition calculation** (core feature)
4. **Test Console: TDEE Calculator** (validate calculations)
5. **Test Console: Meal Planner** (test recipe selection)
6. **Test Console: Alternatives** (test filtering logic)
7. **Test Console: Swaps** (test ingredient matching)

---

## Success Criteria

Before moving to onboarding, admin should be able to:

- [ ] See all recipes with calculated nutrition
- [ ] Filter ingredients/recipes by issues
- [ ] Configure meal distribution percentages
- [ ] Simulate a user's TDEE calculation
- [ ] Preview a meal plan for any calorie target
- [ ] See recipe alternatives for any meal
- [ ] See ingredient swap options

---

## References

- [Dynamic Recipe Scaling](./dynamic-recipe-scaling.md)
- [Architecture](../main/architecture.md)
- [Database ERD](../main/database-erd.md)
