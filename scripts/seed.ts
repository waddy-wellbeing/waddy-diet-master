#!/usr/bin/env tsx
/**
 * BiteRight Database Seeder
 * 
 * Seeds the database with foods, spices, and recipes from CSV files.
 * 
 * Usage:
 *   npm run seed           # Run full seed
 *   npm run seed:dry-run   # Validate without inserting
 * 
 * Environment variables required:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import * as dotenv from 'dotenv'
import { createSeedClient, log } from './utils'
import { dryRunFoods, seedFoods } from './seed-foods'
import { dryRunSpices, seedSpices } from './seed-spices'
import { dryRunRecipes, seedRecipes, validateFKs } from './seed-recipes'
import type { SeedResult, DryRunResult, FKValidationResult } from './types'

// Load environment variables
dotenv.config({ path: '.env.local' })

// =============================================================================
// Main Orchestrator
// =============================================================================

async function main() {
  const args = process.argv.slice(2)
  const isDryRun = args.includes('--dry-run')

  log.header(`BiteRight Database Seeder ${isDryRun ? '(DRY RUN)' : ''}`)

  // Validate environment
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    log.error('NEXT_PUBLIC_SUPABASE_URL is not set')
    process.exit(1)
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    log.error('SUPABASE_SERVICE_ROLE_KEY is not set')
    log.info('Add it to your .env.local file')
    process.exit(1)
  }

  // Create Supabase client
  const supabase = createSeedClient()
  log.success('Connected to Supabase')

  if (isDryRun) {
    await runDryRun(supabase)
  } else {
    await runSeed(supabase)
  }
}

// =============================================================================
// Dry Run Mode
// =============================================================================

async function runDryRun(supabase: ReturnType<typeof createSeedClient>) {
  log.header('🔍 DRY RUN MODE - No data will be modified')

  const results: DryRunResult[] = []
  let fkValidation: FKValidationResult | null = null

  try {
    // 1. Validate Foods
    results.push(await dryRunFoods(supabase))

    // 2. Validate Spices
    results.push(await dryRunSpices(supabase))

    // 3. Validate FK references (without DB)
    fkValidation = validateFKs()

    // 4. Validate Recipes
    results.push(await dryRunRecipes(supabase))

  } catch (error) {
    log.error(`Dry run failed: ${error}`)
    process.exit(1)
  }

  // Print summary
  log.header('📊 DRY RUN SUMMARY')

  console.log('\n--- Table Operations ---')
  console.table(results.map(r => ({
    Table: r.table,
    'Would Insert': r.wouldInsert,
    'Would Update': r.wouldUpdate,
    Warnings: r.warnings.length,
    Errors: r.errors.length,
  })))

  // FK Validation summary
  if (fkValidation) {
    console.log('\n--- FK Validation ---')
    console.log(`  Total ingredients: ${fkValidation.totalIngredients}`)
    console.log(`  ✅ Matched to foods: ${fkValidation.matchedToFood}`)
    console.log(`  ✅ Matched to spices: ${fkValidation.matchedToSpice}`)
    console.log(`  ⚠️  Unmatched: ${fkValidation.unmatched.length}`)
    
    const matchRate = ((fkValidation.matchedToFood + fkValidation.matchedToSpice) / fkValidation.totalIngredients * 100).toFixed(1)
    console.log(`  📈 Match rate: ${matchRate}%`)
  }

  // Print all warnings
  const allWarnings = results.flatMap(r => r.warnings)
  if (allWarnings.length > 0) {
    console.log('\n--- Warnings ---')
    allWarnings.slice(0, 20).forEach(w => log.warning(w))
    if (allWarnings.length > 20) {
      log.warning(`... and ${allWarnings.length - 20} more warnings`)
    }
  }

  // Print all errors
  const allErrors = results.flatMap(r => r.errors)
  if (allErrors.length > 0) {
    console.log('\n--- Errors ---')
    allErrors.forEach(e => log.error(e))
    process.exit(1)
  }

  // Final verdict
  console.log('')
  if (allErrors.length === 0) {
    log.success('✅ Dry run passed! Safe to run: npm run seed')
  } else {
    log.error('❌ Dry run found errors. Fix them before seeding.')
    process.exit(1)
  }
}

// =============================================================================
// Seed Mode
// =============================================================================

async function runSeed(supabase: ReturnType<typeof createSeedClient>) {
  log.header('🌱 SEEDING DATABASE')

  const results: SeedResult[] = []

  try {
    // 1. Seed Foods (must be first - recipes depend on food IDs)
    results.push(await seedFoods(supabase))

    // 2. Seed Spices
    results.push(await seedSpices(supabase))

    // 3. Seed Recipes (uses food IDs for FK)
    results.push(await seedRecipes(supabase))

  } catch (error) {
    log.error(`Seeding failed: ${error}`)
    process.exit(1)
  }

  // Print summary
  log.header('📊 SEED SUMMARY')

  console.table(results.map(r => ({
    Table: r.table,
    Inserted: r.inserted,
    Updated: r.updated,
    Skipped: r.skipped,
    Errors: r.errors.length,
  })))

  // Print errors if any
  const allErrors = results.flatMap(r => r.errors)
  if (allErrors.length > 0) {
    console.log('\n--- Errors ---')
    allErrors.forEach(e => log.error(e))
  }

  // Final status
  console.log('')
  const totalInserted = results.reduce((sum, r) => sum + r.inserted, 0)
  const totalErrors = allErrors.length

  if (totalErrors === 0) {
    log.success(`✅ Seeding complete! ${totalInserted} records inserted/updated.`)
  } else {
    log.warning(`⚠️ Seeding complete with ${totalErrors} errors. ${totalInserted} records inserted/updated.`)
  }
}

// =============================================================================
// Run
// =============================================================================

main().catch(error => {
  log.error(`Unexpected error: ${error}`)
  process.exit(1)
})
