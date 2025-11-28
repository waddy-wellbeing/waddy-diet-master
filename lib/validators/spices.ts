import { z } from 'zod'

/**
 * Zod schema for creating/updating a spice
 */
export const spiceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  name_ar: z.string().max(255).optional().nullable(),
  aliases: z.array(z.string()).default([]),
  is_default: z.boolean().default(true),
})

export type SpiceFormData = {
  name: string
  name_ar?: string | null
  aliases: string[]
  is_default: boolean
}
