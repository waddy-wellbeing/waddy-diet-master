/**
 * Ingredients Seeder
 * 
 * Parses food_dataset.csv and upserts into ingredients table
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { IngredientCsvRow, IngredientInsert, SeedResult, DryRunResult } from './types'
import { parseCSV, parseNumber, parseNumberOrDefault, cleanText, log, CSV_FILES, createLookupVariants } from './utils'

// =============================================================================
// CSV Parsing
// =============================================================================

function parseIngredientRow(row: IngredientCsvRow): IngredientInsert | null {
  const name = cleanText(row['English Name'])
  if (!name) return null

  // Parse macros
  const macros = {
    calories: parseNumberOrDefault(row['Calories'], 0),
    protein_g: parseNumberOrDefault(row['Protein'], 0),
    carbs_g: parseNumberOrDefault(row['Carbs'], 0),
    fat_g: parseNumberOrDefault(row['Fats'], 0),
  }

  // Parse micros (only include non-null values)
  const micros: Record<string, number> = {}
  
  const microFields: [string, keyof IngredientCsvRow][] = [
    ['vitamin_a_ug', 'Vit A (µg)'],
    ['vitamin_c_mg', 'Vit C (mg)'],
    ['vitamin_d_ug', 'Vit D (µg)'],
    ['vitamin_k_ug', 'Vit K (µg)'],
    ['folate_ug', 'Folate (µg)'],
    ['vitamin_b12_ug', 'Vit B12 (µg)'],
    ['calcium_mg', 'Calcium (mg)'],
    ['iron_mg', 'Iron (mg)'],
    ['magnesium_mg', 'Magnesium (mg)'],
    ['potassium_mg', 'Potassium (mg)'],
    ['zinc_mg', 'Zinc (mg)'],
    ['selenium_ug', 'Selenium (µg)'],
  ]

  for (const [key, csvKey] of microFields) {
    const value = parseNumber(row[csvKey])
    if (value !== null) {
      micros[key] = value
    }
  }

  return {
    name,
    name_ar: cleanText(row['Arabic Name']),
    brand: null,
    category: null, // Could map from FoodGroup
    food_group: cleanText(row['FoodGroup']),
    subgroup: cleanText(row['SubGroup']),
    serving_size: parseNumberOrDefault(row['Amount'], 100),
    serving_unit: cleanText(row['English Unit']) || 'g',
    macros,
    micros,
    is_verified: true,
    source: 'seed_dataset',
    is_public: true,
  }
}

function formatIngredientRowSample(rowNumber: number, row: IngredientCsvRow): string {
  const english = (row['English Name'] || '').trim() || 'n/a'
  const arabic = (row['Arabic Name'] || '').trim() || 'n/a'
  const amount = (row['Amount'] || '').trim()
  const unit = (row['English Unit'] || '').trim()
  const amountText = amount ? `${amount}${unit ? ` ${unit}` : ''}` : 'n/a'
  return `row ${rowNumber}: en="${english}", ar="${arabic}", amount=${amountText}`
}

// =============================================================================
// Dry Run
// =============================================================================

export async function dryRunIngredients(supabase: SupabaseClient): Promise<DryRunResult> {
  log.subheader('Ingredients - Dry Run')
  
  const rows = parseCSV<IngredientCsvRow>(CSV_FILES.ingredients)
  const warnings: string[] = []
  const errors: string[] = []
  const emptyNameRows: Array<{ index: number; row: IngredientCsvRow }> = []
  
  // Parse all rows
  const ingredients: IngredientInsert[] = []
  rows.forEach((row, idx) => {
    const ingredient = parseIngredientRow(row)
    if (ingredient) {
      ingredients.push(ingredient)
    } else {
      emptyNameRows.push({ index: idx + 2, row })
    }
  })

  // Check for duplicates in CSV
  const nameCount = new Map<string, number>()
  const nameSamples = new Map<string, string>()
  for (const ingredient of ingredients) {
    const key = ingredient.name.toLowerCase()
    nameCount.set(key, (nameCount.get(key) || 0) + 1)
    if (!nameSamples.has(key)) {
      nameSamples.set(key, ingredient.name)
    }
  }
  
  const duplicateEntries = Array.from(nameCount.entries())
    .filter(([, count]) => count > 1)
    .map(([key, count]) => ({
      name: nameSamples.get(key) ?? key,
      count,
    }))

  // Check existing records in database
  const { data: existing, error } = await supabase
    .from('ingredients')
    .select('name')
  
  if (error) {
    errors.push(`Database error: ${error.message}`)
    return { table: 'ingredients', wouldInsert: 0, wouldUpdate: 0, warnings, errors }
  }

  const existingNames = new Set((existing || []).map(f => f.name.toLowerCase()))
  
  let wouldInsert = 0
  let wouldUpdate = 0
  
  for (const ingredient of ingredients) {
    if (existingNames.has(ingredient.name.toLowerCase())) {
      wouldUpdate++
    } else {
      wouldInsert++
    }
  }

  log.info(`Parsed ${ingredients.length} ingredients from CSV`)
  log.info(`Would insert: ${wouldInsert}, Would update: ${wouldUpdate}`)
  
  if (emptyNameRows.length > 0) {
    const samples = emptyNameRows
      .slice(0, 5)
      .map(({ index, row }) => formatIngredientRowSample(index, row))
      .join(' | ')
    warnings.push(`Skipped ${emptyNameRows.length} rows with empty English name. Samples: ${samples}`)
  }

  if (duplicateEntries.length > 0) {
    const sampleNames = duplicateEntries
      .slice(0, 5)
      .map(entry => `"${entry.name}" (${entry.count}x)`)
      .join(', ')
    warnings.push(`Found ${duplicateEntries.length} duplicated ingredient names. Examples: ${sampleNames}`)
  }

  if (warnings.length > 0) {
    log.warning(`${warnings.length} warnings`)
  }

  return { table: 'ingredients', wouldInsert, wouldUpdate, warnings, errors }
}

// =============================================================================
// Seed Execution
// =============================================================================

export async function seedIngredients(supabase: SupabaseClient): Promise<SeedResult> {
  log.subheader('Ingredients - Seeding')
  
  const rows = parseCSV<IngredientCsvRow>(CSV_FILES.ingredients)
  const errors: string[] = []
  
  // Parse all rows and deduplicate by name (case-insensitive)
  const ingredientMap = new Map<string, IngredientInsert>()
  for (const row of rows) {
    const ingredient = parseIngredientRow(row)
    if (ingredient) {
      const key = ingredient.name.toLowerCase()
      if (!ingredientMap.has(key)) {
        ingredientMap.set(key, ingredient)
      }
    }
  }
  
  const ingredients = Array.from(ingredientMap.values())
  log.info(`Parsed ${ingredients.length} unique ingredients, upserting...`)

  // Upsert in batches
  const batchSize = 100
  let inserted = 0
  let updated = 0
  let skipped = 0

  for (let i = 0; i < ingredients.length; i += batchSize) {
    const batch = ingredients.slice(i, i + batchSize)
    
    const { data, error } = await supabase
      .from('ingredients')
      .upsert(batch, { 
        onConflict: 'name',
        ignoreDuplicates: false 
      })
      .select('id')

    if (error) {
      errors.push(`Batch ${Math.floor(i / batchSize) + 1} error: ${error.message}`)
      skipped += batch.length
    } else {
      // Since upsert doesn't tell us insert vs update, we count all as inserted
      inserted += data?.length || batch.length
    }

    process.stdout.write(`\r  Progress: ${Math.min(i + batchSize, ingredients.length)}/${ingredients.length}`)
  }
  
  console.log() // New line

  log.success(`Ingredients seeded: ${inserted} inserted/updated, ${skipped} skipped`)
  
  return { table: 'ingredients', inserted, updated, skipped, errors }
}

// =============================================================================
// Build Ingredient Lookup Map
// =============================================================================

export async function buildIngredientLookup(supabase: SupabaseClient): Promise<Map<string, { id: string; macros: IngredientInsert['macros'] }>> {
  const { data, error } = await supabase
    .from('ingredients')
    .select('id, name, name_ar, macros')

  if (error) {
    throw new Error(`Failed to fetch ingredients: ${error.message}`)
  }

  const lookup = new Map<string, { id: string; macros: IngredientInsert['macros'] }>()
  
  for (const ingredient of data || []) {
    // Add lookup by English name
    if (ingredient.name) {
      for (const key of createLookupVariants(ingredient.name)) {
        if (!lookup.has(key)) {
          lookup.set(key, { id: ingredient.id, macros: ingredient.macros })
        }
      }
    }
    // Add lookup by Arabic name
    if (ingredient.name_ar) {
      for (const key of createLookupVariants(ingredient.name_ar)) {
        if (!lookup.has(key)) {
          lookup.set(key, { id: ingredient.id, macros: ingredient.macros })
        }
      }
    }
  }

  return lookup
}

// =============================================================================
// Build Ingredient Lookup from CSV (for dry run without DB)
// =============================================================================

export function buildIngredientLookupFromCSV(): Map<string, { macros: IngredientInsert['macros'] }> {
  const rows = parseCSV<IngredientCsvRow>(CSV_FILES.ingredients)
  const lookup = new Map<string, { macros: IngredientInsert['macros'] }>()
  
  for (const row of rows) {
    const ingredient = parseIngredientRow(row)
    if (!ingredient) continue
    
    // Add lookup by English name
    for (const key of createLookupVariants(ingredient.name)) {
      if (!lookup.has(key)) {
        lookup.set(key, { macros: ingredient.macros })
      }
    }
    
    // Add lookup by Arabic name
    if (ingredient.name_ar) {
      for (const key of createLookupVariants(ingredient.name_ar)) {
        if (!lookup.has(key)) {
          lookup.set(key, { macros: ingredient.macros })
        }
      }
    }
  }

  return lookup
}
