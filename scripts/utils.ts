/**
 * Seed Utilities
 * 
 * Shared utilities for CSV parsing and database operations
 */

import { createClient } from '@supabase/supabase-js'
import { parse } from 'csv-parse/sync'
import * as fs from 'fs'
import * as path from 'path'

// =============================================================================
// Supabase Client (with Service Role for seeding)
// =============================================================================

export function createSeedClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing environment variables. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.'
    )
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// =============================================================================
// CSV Parsing
// =============================================================================

export function parseCSV<T>(filePath: string): T[] {
  const absolutePath = path.resolve(filePath)
  const fileContent = fs.readFileSync(absolutePath, 'utf-8')
  
  // Parse CSV with headers
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true, // Handle inconsistent column counts
  })

  return records as T[]
}

// =============================================================================
// Data Cleaning Utilities
// =============================================================================

/**
 * Parse a numeric value from CSV, handling various formats
 */
export function parseNumber(value: string | undefined | null): number | null {
  if (!value || value === '' || value === '-' || value === 'N/A') {
    return null
  }
  
  // Remove any non-numeric characters except decimal point and minus
  const cleaned = value.toString().replace(/[^\d.-]/g, '')
  const num = parseFloat(cleaned)
  
  return isNaN(num) ? null : num
}

/**
 * Parse a numeric value with a default fallback
 */
export function parseNumberOrDefault(value: string | undefined | null, defaultValue: number): number {
  const parsed = parseNumber(value)
  return parsed ?? defaultValue
}

/**
 * Clean and normalize text
 */
export function cleanText(value: string | undefined | null): string | null {
  if (!value || value.trim() === '' || value === '-') {
    return null
  }
  return value.trim()
}

/**
 * Normalize Arabic text for matching
 * Removes diacritics, normalizes characters, trims whitespace
 */
export function normalizeArabic(text: string): string {
  return text
    .trim()
    .toLowerCase()
    // Normalize Arabic characters
    .replace(/[أإآا]/g, 'ا')
    .replace(/[ىي]/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    // Remove diacritics (tashkeel)
    .replace(/[\u064B-\u065F]/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
}

/**
 * Create a lookup key for matching ingredients to foods
 */
export function createLookupKey(name: string): string {
  return normalizeArabic(name)
}

// =============================================================================
// Logging Utilities
// =============================================================================

export const log = {
  info: (msg: string) => console.log(`ℹ️  ${msg}`),
  success: (msg: string) => console.log(`✅ ${msg}`),
  warning: (msg: string) => console.log(`⚠️  ${msg}`),
  error: (msg: string) => console.log(`❌ ${msg}`),
  header: (msg: string) => console.log(`\n${'='.repeat(60)}\n${msg}\n${'='.repeat(60)}`),
  subheader: (msg: string) => console.log(`\n--- ${msg} ---`),
  table: (data: Record<string, unknown>[]) => console.table(data),
}

// =============================================================================
// Batch Processing
// =============================================================================

/**
 * Process items in batches to avoid overwhelming the database
 */
export async function processBatch<T, R>(
  items: T[],
  batchSize: number,
  processor: (batch: T[]) => Promise<R[]>
): Promise<R[]> {
  const results: R[] = []
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const batchResults = await processor(batch)
    results.push(...batchResults)
    
    // Log progress
    const progress = Math.min(i + batchSize, items.length)
    process.stdout.write(`\r  Processing: ${progress}/${items.length}`)
  }
  
  console.log() // New line after progress
  return results
}

// =============================================================================
// File Paths
// =============================================================================

export const DATASETS_PATH = path.join(process.cwd(), 'docs', 'datasets')
export const IMAGES_PATH = path.join(process.cwd(), 'images')

export const CSV_FILES = {
  foods: path.join(DATASETS_PATH, 'food_dataset.csv'),
  spices: path.join(DATASETS_PATH, 'spices_dataset.csv'),
  recipes: path.join(DATASETS_PATH, 'recipies_dataset.csv'),
}
