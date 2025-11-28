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
 * Note: Vitamins use _ug (micrograms) to match database seed data
 */
export const ingredientMicrosSchema = z.object({
  vitamin_a_ug: z.coerce.number().min(0).optional(),
  vitamin_c_mg: z.coerce.number().min(0).optional(),
  vitamin_d_ug: z.coerce.number().min(0).optional(),
  vitamin_b12_ug: z.coerce.number().min(0).optional(),
  vitamin_k_ug: z.coerce.number().min(0).optional(),
  folate_ug: z.coerce.number().min(0).optional(),
  calcium_mg: z.coerce.number().min(0).optional(),
  iron_mg: z.coerce.number().min(0).optional(),
  magnesium_mg: z.coerce.number().min(0).optional(),
  potassium_mg: z.coerce.number().min(0).optional(),
  sodium_mg: z.coerce.number().min(0).optional(),
  zinc_mg: z.coerce.number().min(0).optional(),
  selenium_ug: z.coerce.number().min(0).optional(),
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
 * Includes both singular and plural forms for flexibility
 */
export const FOOD_GROUPS = [
  'Protein',
  'Proteins',
  'Vegetables',
  'Fruits',
  'Grains',
  'Carbs',
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
 * Includes both short and long forms for flexibility
 */
export const SERVING_UNITS = [
  'g',
  'grams',
  'ml',
  'milliliters',
  'oz',
  'ounce',
  'cup',
  'cups',
  'tbsp',
  'tablespoon',
  'tsp',
  'teaspoon',
  'piece',
  'pieces',
  'slice',
  'slices',
  'serving',
  'servings',
] as const
