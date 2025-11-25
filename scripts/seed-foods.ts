/**
 * Foods Seeder
 * 
 * Parses food_dataset.csv and upserts into nutri_foods table
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { FoodCsvRow, FoodInsert, SeedResult, DryRunResult } from './types'
import { parseCSV, parseNumber, parseNumberOrDefault, cleanText, log, CSV_FILES, createLookupKey } from './utils'

// =============================================================================
// CSV Parsing
// =============================================================================

function parseFoodRow(row: FoodCsvRow): FoodInsert | null {
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
  
  const microFields: [string, keyof FoodCsvRow][] = [
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

function formatFoodRowSample(rowNumber: number, row: FoodCsvRow): string {
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

export async function dryRunFoods(supabase: SupabaseClient): Promise<DryRunResult> {
  log.subheader('Foods - Dry Run')
  
  const rows = parseCSV<FoodCsvRow>(CSV_FILES.foods)
  const warnings: string[] = []
  const errors: string[] = []
  const emptyNameRows: Array<{ index: number; row: FoodCsvRow }> = []
  
  // Parse all rows
  const foods: FoodInsert[] = []
  rows.forEach((row, idx) => {
    const food = parseFoodRow(row)
    if (food) {
      foods.push(food)
    } else {
      emptyNameRows.push({ index: idx + 2, row })
    }
  })

  // Check for duplicates in CSV
  const nameCount = new Map<string, number>()
  const nameSamples = new Map<string, string>()
  for (const food of foods) {
    const key = food.name.toLowerCase()
    nameCount.set(key, (nameCount.get(key) || 0) + 1)
    if (!nameSamples.has(key)) {
      nameSamples.set(key, food.name)
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
    .from('nutri_foods')
    .select('name')
  
  if (error) {
    errors.push(`Database error: ${error.message}`)
    return { table: 'nutri_foods', wouldInsert: 0, wouldUpdate: 0, warnings, errors }
  }

  const existingNames = new Set((existing || []).map(f => f.name.toLowerCase()))
  
  let wouldInsert = 0
  let wouldUpdate = 0
  
  for (const food of foods) {
    if (existingNames.has(food.name.toLowerCase())) {
      wouldUpdate++
    } else {
      wouldInsert++
    }
  }

  log.info(`Parsed ${foods.length} foods from CSV`)
  log.info(`Would insert: ${wouldInsert}, Would update: ${wouldUpdate}`)
  
  if (emptyNameRows.length > 0) {
    const samples = emptyNameRows
      .slice(0, 5)
      .map(({ index, row }) => formatFoodRowSample(index, row))
      .join(' | ')
    warnings.push(`Skipped ${emptyNameRows.length} rows with empty English name. Samples: ${samples}`)
  }

  if (duplicateEntries.length > 0) {
    const sampleNames = duplicateEntries
      .slice(0, 5)
      .map(entry => `"${entry.name}" (${entry.count}x)`)
      .join(', ')
    warnings.push(`Found ${duplicateEntries.length} duplicated food names. Examples: ${sampleNames}`)
  }

  if (warnings.length > 0) {
    log.warning(`${warnings.length} warnings`)
  }

  return { table: 'nutri_foods', wouldInsert, wouldUpdate, warnings, errors }
}

// =============================================================================
// Seed Execution
// =============================================================================

export async function seedFoods(supabase: SupabaseClient): Promise<SeedResult> {
  log.subheader('Foods - Seeding')
  
  const rows = parseCSV<FoodCsvRow>(CSV_FILES.foods)
  const errors: string[] = []
  
  // Parse all rows
  const foods: FoodInsert[] = []
  for (const row of rows) {
    const food = parseFoodRow(row)
    if (food) {
      foods.push(food)
    }
  }

  log.info(`Parsed ${foods.length} foods, upserting...`)

  // Upsert in batches
  const batchSize = 100
  let inserted = 0
  let updated = 0
  let skipped = 0

  for (let i = 0; i < foods.length; i += batchSize) {
    const batch = foods.slice(i, i + batchSize)
    
    const { data, error } = await supabase
      .from('nutri_foods')
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

    process.stdout.write(`\r  Progress: ${Math.min(i + batchSize, foods.length)}/${foods.length}`)
  }
  
  console.log() // New line

  log.success(`Foods seeded: ${inserted} inserted/updated, ${skipped} skipped`)
  
  return { table: 'nutri_foods', inserted, updated, skipped, errors }
}

// =============================================================================
// Build Food Lookup Map
// =============================================================================

export async function buildFoodLookup(supabase: SupabaseClient): Promise<Map<string, { id: string; macros: FoodInsert['macros'] }>> {
  const { data, error } = await supabase
    .from('nutri_foods')
    .select('id, name, name_ar, macros')

  if (error) {
    throw new Error(`Failed to fetch foods: ${error.message}`)
  }

  const lookup = new Map<string, { id: string; macros: FoodInsert['macros'] }>()
  
  for (const food of data || []) {
    // Add lookup by English name
    if (food.name) {
      lookup.set(createLookupKey(food.name), { id: food.id, macros: food.macros })
    }
    // Add lookup by Arabic name
    if (food.name_ar) {
      lookup.set(createLookupKey(food.name_ar), { id: food.id, macros: food.macros })
    }
  }

  return lookup
}

// =============================================================================
// Build Food Lookup from CSV (for dry run without DB)
// =============================================================================

export function buildFoodLookupFromCSV(): Map<string, { macros: FoodInsert['macros'] }> {
  const rows = parseCSV<FoodCsvRow>(CSV_FILES.foods)
  const lookup = new Map<string, { macros: FoodInsert['macros'] }>()
  
  for (const row of rows) {
    const food = parseFoodRow(row)
    if (!food) continue
    
    // Add lookup by English name
    lookup.set(createLookupKey(food.name), { macros: food.macros })
    
    // Add lookup by Arabic name
    if (food.name_ar) {
      lookup.set(createLookupKey(food.name_ar), { macros: food.macros })
    }
  }

  return lookup
}
