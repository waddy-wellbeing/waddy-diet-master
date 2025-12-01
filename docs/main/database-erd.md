# BiteRight Database Schema

> **Last updated:** 2025-12-01
> 
> ⚠️ **Keep this document in sync with `supabase/schema.sql`**
> When you modify the database schema, update the ERD diagrams below.

## Terminology

| Term | Entity | Description |
|------|--------|-------------|
| **Ingredient** | `ingredients` | Atomic items with nutrition data (chicken breast, rice, olive oil) |
| **Spice** | `spices` | Reference spices for recipes - do NOT count towards macros |
| **Recipe** | `recipes` | A dish made from multiple foods with instructions (Grilled Chicken Salad) |
| **Meal** | *Concept only* | A time slot in the day: `breakfast`, `lunch`, `dinner`, `snacks` - not a table |
| **Plan** | `daily_plans` | What you *should* eat - recipes assigned to meal slots for a day |
| **Log** | `daily_logs` | What you *actually* ate - ingredients/recipes logged to meal slots |
| **Profile** | `profiles` | User settings, nutritional targets, and preferences |

---

## Entity Relationship Diagram

```mermaid
erDiagram
    auth_users ||--o| profiles : "has one"
    auth_users ||--o{ ingredients : "creates"
    auth_users ||--o{ recipes : "creates"
    auth_users ||--o{ daily_plans : "has"
    auth_users ||--o{ daily_logs : "has"
    
    ingredients ||--o{ recipes : "used in (via ingredients JSONB)"
    spices ||--o{ recipes : "referenced in (via ingredients JSONB, is_spice=true)"
    recipes ||--o{ daily_plans : "assigned to (via plan JSONB)"
    recipes ||--o{ daily_logs : "logged in (via log JSONB)"
    ingredients ||--o{ daily_logs : "logged in (via log JSONB)"

    profiles {
        uuid id PK
        uuid user_id FK
        string name "Display name"
        string email "User email"
        string avatar_url "Profile image"
        enum role "admin, moderator, client"
        enum plan_status "pending_assignment, active, paused, expired"
        jsonb basic_info "age, height, weight, sex, activity_level"
        jsonb targets "calories, protein_g, carbs_g, fat_g"
        jsonb preferences "diet_type, allergies, dislikes, cooking_skill"
        jsonb goals "goal_type, target_weight_kg, pace"
        boolean onboarding_completed
        int onboarding_step
    }

    ingredients {
        uuid id PK
        string name
        string name_ar "Arabic name"
        string brand
        string category
        string food_group
        string subgroup
        decimal serving_size
        string serving_unit
        jsonb macros "calories, protein_g, carbs_g, fat_g"
        jsonb micros "vitamins, minerals"
        boolean is_verified
        string source
        uuid created_by FK
        boolean is_public
    }

    spices {
        uuid id PK
        string name
        string name_ar "Arabic name"
        string[] aliases "alternative names"
        boolean is_default "system vs user-created"
    }

    recipes {
        uuid id PK
        string name
        text description
        string image_url
        string[] meal_type "breakfast, lunch, dinner, snacks"
        string cuisine
        string[] tags
        int prep_time_minutes
        int cook_time_minutes
        int servings
        string difficulty
        jsonb ingredients "array of ingredient/spice references"
        jsonb instructions "array of steps"
        jsonb nutrition_per_serving "calculated macros"
        boolean is_vegetarian
        boolean is_vegan
        boolean is_gluten_free
        boolean is_dairy_free
        uuid created_by FK
        boolean is_public
    }

    daily_plans {
        uuid id PK
        uuid user_id FK
        date plan_date
        jsonb plan "breakfast, lunch, dinner, snacks slots"
        jsonb daily_totals "aggregated nutrition"
        boolean is_generated
    }

    daily_logs {
        uuid id PK
        uuid user_id FK
        date log_date
        jsonb log "what was actually eaten per meal slot"
        jsonb logged_totals "aggregated nutrition"
        int meals_logged
        decimal adherence_score
        text notes
    }
```

---

## Data Flow Diagram

This shows how data flows through the system:

```mermaid
flowchart TB
    subgraph "Reference Data (shared)"
        F[🥕 ingredients<br/>Ingredient Database]
        R[🍽️ recipes<br/>Recipe Collection]
    end
    
    subgraph "User Data (per user)"
        P[👤 profiles<br/>User Settings & Targets]
        DP[📅 daily_plans<br/>Meal Plans]
        DL[✅ daily_logs<br/>Food Diary]
    end
    
    F -->|"ingredients[]"| R
    R -->|"plan.breakfast<br/>plan.lunch<br/>plan.dinner"| DP
    R -->|"log.*.items[]<br/>(from plan)"| DL
    F -->|"log.*.items[]<br/>(ad-hoc)"| DL
    P -->|"targets guide<br/>plan generation"| DP
    DP -.->|"compare for<br/>adherence_score"| DL

    style F fill:#e8f5e9
    style R fill:#e3f2fd
    style P fill:#fff3e0
    style DP fill:#fce4ec
    style DL fill:#f3e5f5
```

**Flow explanation:**
1. **Ingredients** are the building blocks (single items)
2. **Recipes** are composed from ingredients via the `ingredients` JSONB array
3. **Plans** schedule recipes into meal slots for specific dates
4. **Logs** track what was actually eaten (can be planned recipes OR ad-hoc ingredients)
5. **Profiles** provide the nutritional targets that guide plan generation

---

## JSONB Structure Reference

### profiles.basic_info
```json
{
  "name": "Sarah",
  "age": 32,
  "height_cm": 165,
  "weight_kg": 65,
  "sex": "female",
  "activity_level": "moderate"
}
```

### profiles.targets
```json
{
  "calories": 1800,
  "protein_g": 120,
  "carbs_g": 180,
  "fat_g": 60,
  "fiber_g": 25
}
```

### recipes.ingredients
```json
[
  {
    "ingredient_id": "uuid-here",
    "raw_name": "chicken breast",
    "quantity": 200,
    "unit": "g",
    "is_spice": false,
    "is_optional": false
  },
  {
    "ingredient_id": null,
    "raw_name": "cumin",
    "quantity": null,
    "unit": null,
    "is_spice": true,
    "is_optional": false
  }
]
```

> **Note on spices:** When `is_spice: true`, the ingredient references a spice from `spices`.
> - `ingredient_id` is `null` (spices don't have macro data)
> - `quantity` and `unit` can be `null` (meaning "as desired")
> - Spices do NOT contribute to `nutrition_per_serving` calculations

### daily_plans.plan
```json
{
  "breakfast": { "recipe_id": "uuid", "servings": 1 },
  "lunch": { "recipe_id": "uuid", "servings": 1, "swapped": true },
  "dinner": { "recipe_id": "uuid", "servings": 1 },
  "snacks": [
    { "recipe_id": "uuid", "servings": 1 },
    { "ingredient_id": "uuid", "amount": 1, "unit": "piece" }
  ]
}
```

### daily_logs.log
```json
{
  "breakfast": {
    "logged_at": "2024-11-25T08:30:00Z",
    "items": [
      { "type": "recipe", "recipe_id": "uuid", "servings": 1, "from_plan": true }
    ]
  }
}
```

---

## Updating This Document

When you modify the database schema:

1. **Update `supabase/schema.sql`** with your changes
2. **Update the ERD above** to reflect new tables/columns
3. **Update `lib/types/nutri.ts`** with corresponding TypeScript types
4. **Update the JSONB examples** if structure changed
5. **Update the date** at the top of this document

### Quick checklist for schema changes:
- [ ] `supabase/schema.sql` updated
- [ ] `docs/main/database-erd.md` updated (this file)
- [ ] `lib/types/nutri.ts` types updated
- [ ] `.github/copilot-instructions.md` updated if major changes
