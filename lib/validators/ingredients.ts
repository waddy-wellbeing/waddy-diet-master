import { z } from 'zod'

/**
 * Zod schema for ingredient macros
 */
export const ingredientMacrosSchema = z.object({
  calories: z.coerce.number().min(0).optional(),
  protein_g: z.coerce.number().min(0).optional(),
  carbs_g: z.coerce.number().min(0).optional(),
  fat_g: z.coerce.number().min(0).optional(),
  fiber_g: z.coerce.number().min(0).optional(),
  sugar_g: z.coerce.number().min(0).optional(),
  saturated_fat_g: z.coerce.number().min(0).optional(),
})

/**
 * Zod schema for ingredient micros
 */
export const ingredientMicrosSchema = z.object({
  vitamin_a_iu: z.coerce.number().min(0).optional(),
  vitamin_c_mg: z.coerce.number().min(0).optional(),
  vitamin_d_iu: z.coerce.number().min(0).optional(),
  calcium_mg: z.coerce.number().min(0).optional(),
  iron_mg: z.coerce.number().min(0).optional(),
  potassium_mg: z.coerce.number().min(0).optional(),
  sodium_mg: z.coerce.number().min(0).optional(),
}).passthrough() // Allow additional micronutrients

/**
 * Zod schema for creating/updating an ingredient
 */
export const ingredientSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  name_ar: z.string().max(255).optional().nullable(),
  brand: z.string().max(255).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  food_group: z.string().optional().nullable(),
  subgroup: z.string().optional().nullable(),
  serving_size: z.coerce.number().min(0.01, 'Serving size must be greater than 0'),
  serving_unit: z.string().min(1, 'Serving unit is required').max(50),
  macros: ingredientMacrosSchema.default({}),
  micros: ingredientMicrosSchema.optional().nullable(),
  is_verified: z.boolean().default(false),
  source: z.string().max(100).optional().nullable(),
  is_public: z.boolean().default(true),
})

export type IngredientFormData = z.infer<typeof ingredientSchema>

/**
 * Common food groups for filtering
 */
export const FOOD_GROUPS = [
  'Proteins',
  'Vegetables',
  'Fruits',
  'Grains',
  'Dairy',
  'Fats & Oils',
  'Legumes',
  'Nuts & Seeds',
  'Beverages',
  'Condiments',
  'Sweets',
  'Other',
] as const

/**
 * Common serving units
 */
export const SERVING_UNITS = [
  'g',
  'ml',
  'oz',
  'cup',
  'tbsp',
  'tsp',
  'piece',
  'slice',
  'serving',
] as const
