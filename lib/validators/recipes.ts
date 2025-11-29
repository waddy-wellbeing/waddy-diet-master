import { z } from 'zod'

// =============================================================================
// Constants
// =============================================================================

export const MEAL_TYPES = [
  'breakfast',
  'lunch',
  'dinner',
  'snack',
] as const

export const CUISINES = [
  'Egyptian',
  'Middle Eastern',
  'Mediterranean',
  'Asian',
  'Indian',
  'Italian',
  'Mexican',
  'American',
  'International',
  'Other',
] as const

export const DIFFICULTIES = [
  'easy',
  'medium',
  'hard',
] as const

// =============================================================================
// Sub-schemas
// =============================================================================

/**
 * Recipe ingredient schema (for junction table)
 */
export const recipeIngredientSchema = z.object({
  ingredient_id: z.string().uuid().nullable(),
  spice_id: z.string().uuid().nullable(),
  raw_name: z.string().min(1, 'Name is required'),
  quantity: z.number().min(0).nullable(),
  unit: z.string().nullable(),
  is_spice: z.boolean().default(false),
  is_optional: z.boolean().default(false),
  // Optional linked names (for display only, not saved)
  linked_name: z.string().nullable().optional(),
  linked_name_ar: z.string().nullable().optional(),
})

/**
 * Recipe instruction step schema
 */
export const recipeInstructionSchema = z.object({
  step: z.number().min(1),
  instruction: z.string().min(1, 'Instruction is required'),
})

/**
 * Recipe nutrition schema (per serving)
 */
export const recipeNutritionSchema = z.object({
  calories: z.number().min(0).optional(),
  protein_g: z.number().min(0).optional(),
  carbs_g: z.number().min(0).optional(),
  fat_g: z.number().min(0).optional(),
})

// =============================================================================
// Main Recipe Schema
// =============================================================================

export const recipeSchema = z.object({
  // Basic Info
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().optional().nullable(),
  image_url: z.string().url('Invalid URL').optional().nullable().or(z.literal('')),
  
  // Classification
  meal_type: z.array(z.string()).default([]),
  cuisine: z.string().optional().nullable(),
  tags: z.array(z.string()).default([]),
  
  // Timing & Servings
  prep_time_minutes: z.coerce.number().min(0).optional().nullable(),
  cook_time_minutes: z.coerce.number().min(0).optional().nullable(),
  servings: z.coerce.number().min(1, 'At least 1 serving required').default(1),
  difficulty: z.string().optional().nullable(),
  
  // Content (JSONB fields)
  ingredients: z.array(recipeIngredientSchema).default([]),
  instructions: z.array(recipeInstructionSchema).default([]),
  nutrition_per_serving: recipeNutritionSchema.default({}),
  
  // Dietary Flags
  is_vegetarian: z.boolean().default(false),
  is_vegan: z.boolean().default(false),
  is_gluten_free: z.boolean().default(false),
  is_dairy_free: z.boolean().default(false),
  
  // Admin
  admin_notes: z.string().optional().nullable(),
  is_public: z.boolean().default(false),
})

// =============================================================================
// Types
// =============================================================================

export type RecipeFormData = z.infer<typeof recipeSchema>
export type RecipeIngredientData = z.infer<typeof recipeIngredientSchema>
export type RecipeInstructionData = z.infer<typeof recipeInstructionSchema>
export type RecipeNutritionData = z.infer<typeof recipeNutritionSchema>
