/**
 * Seed Script Types
 * 
 * Types for CSV parsing and database seeding
 */

// =============================================================================
// CSV Row Types (as parsed from CSV files)
// =============================================================================

export interface IngredientCsvRow {
  'English Name': string
  'Amount': string
  'English Unit': string
  'Calories': string
  'Fats': string
  'Carbs': string
  'Protein': string
  'Arabic Name': string
  'Arabic Unit': string
  'Vit A (µg)': string
  'Vit C (mg)': string
  'Vit D (µg)': string
  'Vit K (µg)': string
  'Folate (µg)': string
  'Vit B12 (µg)': string
  'Calcium (mg)': string
  'Iron (mg)': string
  'Magnesium (mg)': string
  'Potassium (mg)': string
  'Zinc (mg)': string
  'Selenium (µg)': string
  'FoodGroup': string
  'SubGroup': string
}

export interface SpiceCsvRow {
  'English Name': string
  'Amount': string
  'English Unit': string
  'Arabic Name': string
  'Arabic Unit': string
}

export interface RecipeCsvRow {
  'Recipe Name': string
  'Ingredient': string
  'Quantity': string
  'Unit': string
  'Preparation Steps': string
  'breakfast': string // This column indicates meal type
}

// =============================================================================
// Seed Result Types
// =============================================================================

export interface SeedResult {
  table: string
  inserted: number
  updated: number
  skipped: number
  errors: string[]
}

export interface DryRunResult {
  table: string
  wouldInsert: number
  wouldUpdate: number
  warnings: string[]
  errors: string[]
}

export interface FKValidationResult {
  valid: boolean
  totalIngredients: number
  matchedToIngredient: number
  matchedToSpice: number
  unmatched: string[]
  unmatchedDetails: Array<{
    recipe: string
    ingredient: string
  }>
}

// =============================================================================
// Database Insert Types
// =============================================================================

export interface IngredientInsert {
  name: string
  name_ar: string | null
  brand: string | null
  category: string | null
  food_group: string | null
  subgroup: string | null
  serving_size: number
  serving_unit: string
  macros: {
    calories: number
    protein_g: number
    carbs_g: number
    fat_g: number
    fiber_g?: number
    sugar_g?: number
    saturated_fat_g?: number
  }
  micros: Record<string, number>
  is_verified: boolean
  source: string
  is_public: boolean
}

export interface SpiceInsert {
  name: string
  name_ar: string | null
  aliases: string[]
  is_default: boolean
}

export interface RecipeInsert {
  name: string
  description: string | null
  image_url: string | null
  meal_type: string[]
  cuisine: string | null
  tags: string[]
  prep_time_minutes: number | null
  cook_time_minutes: number | null
  servings: number
  difficulty: string | null
  ingredients: Array<{
    ingredient_id: string | null
    raw_name: string
    quantity: number | null
    unit: string | null
    is_spice: boolean
    is_optional: boolean
  }>
  instructions: Array<{
    step: number
    instruction: string
  }>
  nutrition_per_serving: {
    calories: number
    protein_g: number
    carbs_g: number
    fat_g: number
  }
  is_vegetarian: boolean
  is_vegan: boolean
  is_gluten_free: boolean
  is_dairy_free: boolean
  admin_notes: string | null
  is_public: boolean
  status?: 'draft' | 'complete' | 'needs_review' | 'error'
}

// Type for recipe_ingredients junction table
export interface RecipeIngredientInsert {
  recipe_id: string
  ingredient_id: string | null
  spice_id: string | null
  raw_name: string
  quantity: number | null
  unit: string | null
  is_spice: boolean
  is_optional: boolean
  sort_order: number
  is_matched: boolean
  notes: string | null
}

