import { z } from 'zod'

// =============================================================================
// Supplement Schemas
// =============================================================================

export const supplementTimingSchema = z.enum(['before', 'with', 'after'])

export const mealSupplementSchema = z.object({
  name: z.string().min(1).max(200),
  dosage: z.string().min(1).max(100),
  timing: supplementTimingSchema,
  after_minutes: z.number().int().min(1).max(240).optional(),
  note: z.string().max(500).optional(),
})

export const mealSupplementsArraySchema = z.array(mealSupplementSchema).max(10)

export type MealSupplementInput = z.infer<typeof mealSupplementSchema>
