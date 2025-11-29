/**
 * BiteRight Database Types
 * 
 * TypeScript interfaces for all JSONB structures in the database.
 * These types match the schema defined in supabase/schema.sql.
 */

// =============================================================================
// PROFILES
// =============================================================================

/** User's basic profile information */
export interface ProfileBasicInfo {
  name?: string
  age?: number
  height_cm?: number
  weight_kg?: number
  sex?: 'male' | 'female' | 'other'
  activity_level?: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
}

/** Calculated nutritional targets */
export interface ProfileTargets {
  calories?: number
  protein_g?: number
  carbs_g?: number
  fat_g?: number
  fiber_g?: number
}

/** User dietary preferences and restrictions */
export interface ProfilePreferences {
  diet_type?: 'omnivore' | 'vegetarian' | 'vegan' | 'pescatarian' | 'keto' | 'paleo'
  allergies?: string[]
  dislikes?: string[]
  cuisine_preferences?: string[]
  cooking_skill?: 'beginner' | 'intermediate' | 'advanced'
  max_prep_time_minutes?: number
}

/** User goal information */
export interface ProfileGoals {
  goal_type?: 'lose_weight' | 'maintain' | 'build_muscle'
  target_weight_kg?: number
  pace?: 'slow' | 'moderate' | 'aggressive'
}

// =============================================================================
// INGREDIENTS
// =============================================================================

/** Macronutrients per serving */
export interface IngredientMacros {
  calories?: number
  protein_g?: number
  carbs_g?: number
  fat_g?: number
  fiber_g?: number
  sugar_g?: number
  saturated_fat_g?: number
}

/** Micronutrients per serving (extensible) */
export interface IngredientMicros {
  vitamin_a_iu?: number
  vitamin_c_mg?: number
  vitamin_d_iu?: number
  calcium_mg?: number
  iron_mg?: number
  potassium_mg?: number
  sodium_mg?: number
  [key: string]: number | undefined // Allow additional micronutrients
}

// =============================================================================
// SPICES
// =============================================================================

/** A spice from the spices reference table */
export interface Spice {
  id: string
  name: string
  name_ar?: string | null
  aliases: string[]
  is_default: boolean
  created_at: string
  updated_at: string
}

// =============================================================================
// RECIPES
// =============================================================================

/** Recipe status enum (matches recipe_status in database) */
export type RecipeStatus = 'draft' | 'complete' | 'needs_review' | 'error'

/** 
 * Single ingredient in a recipe form (used for validation and form handling)
 * 
 * For regular ingredients: ingredient_id is set, quantity/unit are required
 * For spices: spice_id is set, is_spice is true, quantity/unit can be null (meaning "as desired")
 */
export interface RecipeIngredient {
  ingredient_id: string | null
  spice_id: string | null
  raw_name: string
  quantity: number | null
  unit: string | null
  is_spice: boolean
  is_optional: boolean
  // Linked ingredient/spice info (for display in UI)
  linked_name?: string | null
  linked_name_ar?: string | null
}

/** 
 * Recipe ingredient junction table row (stored in recipe_ingredients table)
 * Links recipes to ingredients/spices with quantity and ordering
 */
export interface RecipeIngredientRecord {
  id: string
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
  created_at: string
  updated_at: string
}

/** Single instruction step */
export interface RecipeInstruction {
  step: number
  instruction: string
}

/** Nutrition information per serving */
export interface RecipeNutrition {
  calories?: number
  protein_g?: number
  carbs_g?: number
  fat_g?: number
}

// =============================================================================
// DAILY PLANS
// =============================================================================

/** A single meal slot in the plan */
export interface PlanMealSlot {
  recipe_id: string
  servings: number
  swapped?: boolean
  original_recipe_id?: string
}

/** A snack item (can be recipe or ingredient) */
export interface PlanSnackItem {
  recipe_id?: string
  ingredient_id?: string
  servings?: number
  amount?: number
  unit?: string
}

/** Full daily plan structure */
export interface DailyPlan {
  breakfast?: PlanMealSlot
  lunch?: PlanMealSlot
  dinner?: PlanMealSlot
  snacks?: PlanSnackItem[]
}

/** Daily nutrition totals */
export interface DailyTotals {
  calories?: number
  protein_g?: number
  carbs_g?: number
  fat_g?: number
}

// =============================================================================
// DAILY LOGS
// =============================================================================

/** A logged item (ingredient or recipe) */
export interface LoggedItem {
  type: 'recipe' | 'ingredient'
  recipe_id?: string
  ingredient_id?: string
  servings?: number
  amount?: number
  unit?: string
  from_plan?: boolean
}

/** A logged meal */
export interface LoggedMeal {
  logged_at?: string // ISO timestamp
  items: LoggedItem[]
}

/** Full daily log structure */
export interface DailyLog {
  breakfast?: LoggedMeal
  lunch?: LoggedMeal
  dinner?: LoggedMeal
  snacks?: LoggedMeal
}

// =============================================================================
// MEAL TYPES (shared constant)
// =============================================================================

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snacks'] as const
export type MealType = typeof MEAL_TYPES[number]

// =============================================================================
// DATABASE ROW TYPES
// =============================================================================

/** Full profiles row (for reference - use Supabase generated types in production) */
export interface ProfileRecord {
  id: string
  user_id: string
  basic_info: ProfileBasicInfo
  targets: ProfileTargets
  preferences: ProfilePreferences
  goals: ProfileGoals
  onboarding_completed: boolean
  onboarding_step: number
  created_at: string
  updated_at: string
}

/** Full ingredients row */
export interface IngredientRecord {
  id: string
  name: string
  name_ar?: string
  brand?: string
  category?: string
  food_group?: string
  subgroup?: string
  serving_size: number
  serving_unit: string
  macros: IngredientMacros
  micros?: IngredientMicros
  is_verified: boolean
  source?: string
  created_by?: string
  is_public: boolean
  created_at: string
  updated_at: string
}

/** Full recipes row */
export interface RecipeRecord {
  id: string
  name: string
  description?: string
  image_url?: string
  meal_type?: string[]
  cuisine?: string
  tags?: string[]
  prep_time_minutes?: number
  cook_time_minutes?: number
  servings: number
  difficulty?: 'easy' | 'medium' | 'hard'
  instructions: RecipeInstruction[]
  nutrition_per_serving: RecipeNutrition
  is_vegetarian?: boolean
  is_vegan?: boolean
  is_gluten_free?: boolean
  is_dairy_free?: boolean
  admin_notes?: string | null
  status: RecipeStatus
  validation_errors?: unknown[]
  last_validated_at?: string
  created_by?: string
  is_public: boolean
  created_at: string
  updated_at: string
}

/** Recipe record with ingredients loaded from junction table */
export interface RecipeWithIngredients extends RecipeRecord {
  ingredients: RecipeIngredient[]
}

/** Full daily_plans row */
export interface DailyPlanRecord {
  id: string
  user_id: string
  plan_date: string // DATE as ISO string
  plan: DailyPlan
  daily_totals: DailyTotals
  is_generated: boolean
  created_at: string
  updated_at: string
}

/** Full daily_logs row */
export interface DailyLogRecord {
  id: string
  user_id: string
  log_date: string // DATE as ISO string
  log: DailyLog
  logged_totals: DailyTotals
  meals_logged: number
  adherence_score?: number
  notes?: string
  created_at: string
  updated_at: string
}
