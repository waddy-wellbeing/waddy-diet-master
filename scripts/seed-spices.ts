/**
 * Spices Seeder
 * 
 * Parses spices_dataset.csv and upserts into spices table
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { SpiceCsvRow, SpiceInsert, SeedResult, DryRunResult } from './types'
import { parseCSV, cleanText, log, CSV_FILES, createLookupVariants } from './utils'

// =============================================================================
// CSV Parsing
// =============================================================================

function parseSpiceRow(row: SpiceCsvRow): SpiceInsert | null {
  const name = cleanText(row['English Name'])
  if (!name) return null

  return {
    name,
    name_ar: cleanText(row['Arabic Name']),
    aliases: [], // Could be populated from variations in the data
    is_default: true,
  }
}

function formatSpiceRowSample(rowNumber: number, row: SpiceCsvRow): string {
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

export async function dryRunSpices(supabase: SupabaseClient): Promise<DryRunResult> {
  log.subheader('Spices - Dry Run')
  
  const rows = parseCSV<SpiceCsvRow>(CSV_FILES.spices)
  const warnings: string[] = []
  const errors: string[] = []
  const emptyNameRows: Array<{ index: number; row: SpiceCsvRow }> = []
  
  // Parse all rows
  const spices: SpiceInsert[] = []
  rows.forEach((row, idx) => {
    const spice = parseSpiceRow(row)
    if (spice) {
      spices.push(spice)
    } else {
      emptyNameRows.push({ index: idx + 2, row })
    }
  })

  // Check for duplicates in CSV
  const nameCount = new Map<string, number>()
  const nameSamples = new Map<string, string>()
  for (const spice of spices) {
    const key = spice.name.toLowerCase()
    nameCount.set(key, (nameCount.get(key) || 0) + 1)
    if (!nameSamples.has(key)) {
      nameSamples.set(key, spice.name)
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
    .from('spices')
    .select('name')
  
  if (error) {
    errors.push(`Database error: ${error.message}`)
    return { table: 'spices', wouldInsert: 0, wouldUpdate: 0, warnings, errors }
  }

  const existingNames = new Set((existing || []).map(s => s.name.toLowerCase()))
  
  let wouldInsert = 0
  let wouldUpdate = 0
  
  for (const spice of spices) {
    if (existingNames.has(spice.name.toLowerCase())) {
      wouldUpdate++
    } else {
      wouldInsert++
    }
  }

  log.info(`Parsed ${spices.length} spices from CSV`)
  log.info(`Would insert: ${wouldInsert}, Would update: ${wouldUpdate}`)
  
  if (emptyNameRows.length > 0) {
    const samples = emptyNameRows
      .slice(0, 5)
      .map(({ index, row }) => formatSpiceRowSample(index, row))
      .join(' | ')
    warnings.push(`Skipped ${emptyNameRows.length} rows with empty English name. Samples: ${samples}`)
  }

  if (duplicateEntries.length > 0) {
    const sampleNames = duplicateEntries
      .slice(0, 5)
      .map(entry => `"${entry.name}" (${entry.count}x)`)
      .join(', ')
    warnings.push(`Found ${duplicateEntries.length} duplicated spice names. Examples: ${sampleNames}`)
  }

  if (warnings.length > 0) {
    log.warning(`${warnings.length} warnings`)
  }

  return { table: 'spices', wouldInsert, wouldUpdate, warnings, errors }
}

// =============================================================================
// Seed Execution
// =============================================================================

export async function seedSpices(supabase: SupabaseClient): Promise<SeedResult> {
  log.subheader('Spices - Seeding')
  
  const rows = parseCSV<SpiceCsvRow>(CSV_FILES.spices)
  const errors: string[] = []
  
  // Parse all rows and deduplicate by name (case-insensitive)
  const spiceMap = new Map<string, SpiceInsert>()
  for (const row of rows) {
    const spice = parseSpiceRow(row)
    if (spice) {
      const key = spice.name.toLowerCase()
      if (!spiceMap.has(key)) {
        spiceMap.set(key, spice)
      }
    }
  }
  
  const spices = Array.from(spiceMap.values())
  log.info(`Parsed ${spices.length} unique spices, upserting...`)

  // Upsert all at once (small dataset)
  const { data, error } = await supabase
    .from('spices')
    .upsert(spices, { 
      onConflict: 'name',
      ignoreDuplicates: false 
    })
    .select('id')

  if (error) {
    errors.push(`Upsert error: ${error.message}`)
    log.error(`Failed to seed spices: ${error.message}`)
    return { table: 'spices', inserted: 0, updated: 0, skipped: spices.length, errors }
  }

  const inserted = data?.length || spices.length
  log.success(`Spices seeded: ${inserted} inserted/updated`)
  
  return { table: 'spices', inserted, updated: 0, skipped: 0, errors }
}

// =============================================================================
// Build Spice Lookup Set
// =============================================================================

export async function buildSpiceLookup(supabase: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('spices')
    .select('name, name_ar')

  if (error) {
    throw new Error(`Failed to fetch spices: ${error.message}`)
  }

  const lookup = new Set<string>()
  
  for (const spice of data || []) {
    // Add lookup by English name
    if (spice.name) {
      for (const key of createLookupVariants(spice.name)) {
        lookup.add(key)
      }
    }
    // Add lookup by Arabic name
    if (spice.name_ar) {
      for (const key of createLookupVariants(spice.name_ar)) {
        lookup.add(key)
      }
    }
  }

  return lookup
}

// =============================================================================
// Build Spice Lookup from CSV (for dry run without DB)
// =============================================================================

export function buildSpiceLookupFromCSV(): Set<string> {
  const rows = parseCSV<SpiceCsvRow>(CSV_FILES.spices)
  const lookup = new Set<string>()
  
  for (const row of rows) {
    const spice = parseSpiceRow(row)
    if (!spice) continue
    
    // Add lookup by English name
    for (const key of createLookupVariants(spice.name)) {
      lookup.add(key)
    }
    
    // Add lookup by Arabic name
    if (spice.name_ar) {
      for (const key of createLookupVariants(spice.name_ar)) {
        lookup.add(key)
      }
    }
  }

  return lookup
}
