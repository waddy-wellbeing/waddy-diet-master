#!/usr/bin/env tsx
/**
 * BiteRight Database Seeder
 * 
 * Seeds the database with ingredients, spices, and recipes from CSV files.
 * 
 * Usage:
 *   npm run seed                      # Run full seed
 *   npm run seed:dry-run              # Validate without inserting
 *   npm run seed:skip-unmatched       # Seed only recipes with all ingredients matched
 *   npm run seed:export-unmatched     # Export unmatched recipes to CSV for manual fixing
 * 
 * Environment variables required:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import * as dotenv from 'dotenv'
import { createSeedClient, log } from './utils'
import { dryRunIngredients, seedIngredients } from './seed-ingredients'
import { dryRunSpices, seedSpices } from './seed-spices'
import { dryRunRecipes, seedRecipes, validateFKs, exportUnmatchedRecipes, exportRecipesTable } from './seed-recipes'
import type { SeedResult, DryRunResult, FKValidationResult } from './types'

// Load environment variables
dotenv.config({ path: '.env.local' })

// =============================================================================
// Main Orchestrator
// =============================================================================

async function main() {
  const args = process.argv.slice(2)
  const isDryRun = args.includes('--dry-run')
  const skipUnmatched = args.includes('--skip-unmatched')
  const exportUnmatched = args.includes('--export-unmatched')
  const exportRecipesTableFlag = args.includes('--export-recipes')

  if (exportUnmatched && exportRecipesTableFlag) {
    log.error('Cannot combine --export-unmatched with --export-recipes')
    process.exit(1)
  }

  if (exportUnmatched) {
    log.header('BiteRight Database Seeder - Export Unmatched Recipes')
    await runExportUnmatched()
    return
  }

  const modeLabel = exportRecipesTableFlag
    ? '(EXPORT RECIPES)'
    : isDryRun
      ? '(DRY RUN)'
      : skipUnmatched
        ? '(SKIP UNMATCHED)'
        : ''
  log.header(`BiteRight Database Seeder ${modeLabel}`)

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

  if (exportRecipesTableFlag) {
    await runExportRecipesTable(supabase)
    return
  }

  if (isDryRun) {
    await runDryRun(supabase)
  } else {
    await runSeed(supabase, skipUnmatched)
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
      // 1. Validate Ingredients
      results.push(await dryRunIngredients(supabase))

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
    console.log(`  ✅ Matched to ingredients: ${fkValidation.matchedToIngredient}`)
    console.log(`  ✅ Matched to spices: ${fkValidation.matchedToSpice}`)
    console.log(`  ⚠️  Unmatched: ${fkValidation.unmatched.length}`)
    
    const matchRate = ((fkValidation.matchedToIngredient + fkValidation.matchedToSpice) / fkValidation.totalIngredients * 100).toFixed(1)
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

async function runSeed(supabase: ReturnType<typeof createSeedClient>, skipUnmatched: boolean = false) {
  log.header('🌱 SEEDING DATABASE')

  if (skipUnmatched) {
    log.info('⏭️  Skip mode enabled: recipes with unmatched ingredients will be skipped')
  }

  const results: SeedResult[] = []

  try {
    // 1. Seed Ingredients (must be first - recipes depend on ingredient IDs)
    results.push(await seedIngredients(supabase))

    // 2. Seed Spices
    results.push(await seedSpices(supabase))

    // 3. Seed Recipes (uses ingredient IDs for FK)
    results.push(await seedRecipes(supabase, skipUnmatched))

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
// Export Unmatched Mode
// =============================================================================

async function runExportUnmatched() {
  log.info('Analyzing recipe ingredients and exporting unmatched entries...')
  
  try {
    const outputPath = await exportUnmatchedRecipes()
    log.success(`✅ Exported unmatched recipes to: ${outputPath}`)
    log.info('Fix the ingredient names in this file, then run: npm run seed:skip-unmatched')
  } catch (error) {
    log.error(`Export failed: ${error}`)
    process.exit(1)
  }
}

async function runExportRecipesTable(supabase: ReturnType<typeof createSeedClient>) {
  log.info('Exporting current recipes table to CSV...')

  try {
    const outputPath = await exportRecipesTable(supabase)
    log.success(`✅ Exported recipes to: ${outputPath}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log.error(`Export failed: ${message}`)
    process.exit(1)
  }
}

// =============================================================================
// Run
// =============================================================================

main().catch(error => {
  log.error(`Unexpected error: ${error}`)
  process.exit(1)
})
