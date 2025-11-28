# Database Mock CSVs

This folder contains **sample CSVs that mirror the exact Supabase table structures**. Each file demonstrates what the seeded data looks like after transformation.

> **Note:** These are example snapshots—actual seeding is done from `docs/datasets/` source files.

## Files

| File | Table | Description |
|------|-------|-------------|
| `ingredients.csv` | `ingredients` | Sample ingredient rows with macros/micros JSONB |
| `spices.csv` | `spices` | Sample spice rows (no nutritional data) |
| `recipes.csv` | `recipes` | Sample recipe rows with ingredients/instructions JSONB |

## Column Mapping to Schema

### ingredients.csv
```
id, name, name_ar, brand, category, food_group, subgroup,
serving_size, serving_unit, macros (JSONB), micros (JSONB),
is_verified, source, created_by, is_public, created_at, updated_at
```

### spices.csv
```
id, name, name_ar, aliases (ARRAY), is_default, created_at, updated_at
```

### recipes.csv
```
id, name, description, image_url, meal_type (ARRAY), cuisine, tags (ARRAY),
prep_time_minutes, cook_time_minutes, servings, difficulty,
ingredients (JSONB), instructions (JSONB), nutrition_per_serving (JSONB),
is_vegetarian, is_vegan, is_gluten_free, is_dairy_free,
admin_notes, created_by, is_public, created_at, updated_at
```

## JSONB Structure Examples

### macros (ingredients)
```json
{"calories": 165, "protein_g": 31, "carbs_g": 0, "fat_g": 3.6}
```

### ingredients (recipes)
```json
[
  {"ingredient_id": "uuid", "raw_name": "صدر دجاج", "quantity": 150, "unit": "g", "is_spice": false, "is_optional": false},
  {"ingredient_id": null, "raw_name": "ملح", "quantity": null, "unit": null, "is_spice": true, "is_optional": false}
]
```

### instructions (recipes)
```json
[
  {"step": 1, "instruction": "Season chicken with salt"},
  {"step": 2, "instruction": "Grill for 6-7 minutes per side"}
]
```

## Usage

Use these files to understand the data format before connecting to Supabase. For actual seeding, run:

```bash
npm run seed:dry-run   # Validate without inserting
npm run seed           # Insert data into Supabase
```
