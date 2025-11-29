/**
 * Recipes Seeder (Updated for Junction Table)
 * 
 * Parses recipies_dataset.csv, resolves FKs, calculates nutrition,
 * and upserts into recipes table AND recipe_ingredients junction table
 * 
 * Updated: 2024-11-29 for Phase 4.5 migration
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { RecipeCsvRow, RecipeInsert, SeedResult, DryRunResult, FKValidationResult, IngredientInsert, RecipeIngredientInsert } from './types'
import { parseCSV, parseNumber, cleanText, log, CSV_FILES, createLookupKey, createLookupVariants, IMAGES_PATH } from './utils'
import { buildIngredientLookup, buildIngredientLookupFromCSV } from './seed-ingredients'
import { buildSpiceLookup, buildSpiceLookupFromCSV } from './seed-spices'
import * as fs from 'fs'
import * as path from 'path'

// =============================================================================
// Types for intermediate processing
// =============================================================================

interface ParsedIngredient {
  raw_name: string
  quantity: number | null
  unit: string | null
}

interface GroupedRecipe {
  name: string
  ingredients: ParsedIngredient[]
  instructions: string
  meal_type: string
}

// =============================================================================
// CSV Parsing - Group rows by recipe
// =============================================================================

// Skip header/placeholder row names
const PLACEHOLDER_RECIPE_NAMES = new Set(['recipe name', 'اسم الوصفة'])

function groupRecipeRows(rows: RecipeCsvRow[]): Map<string, GroupedRecipe> {
  const recipes = new Map<string, GroupedRecipe>()

  for (const row of rows) {
    const recipeName = cleanText(row['Recipe Name'])
    if (!recipeName) continue
    
    // Skip placeholder/header rows
    if (PLACEHOLDER_RECIPE_NAMES.has(recipeName.toLowerCase())) continue

    // Get or create recipe
    if (!recipes.has(recipeName)) {
      recipes.set(recipeName, {
        name: recipeName,
        ingredients: [],
        instructions: cleanText(row['Preparation Steps']) || '',
        meal_type: cleanText(row['breakfast']) || 'lunch', // Column name is 'breakfast' but contains meal type
      })
    }

    const recipe = recipes.get(recipeName)!

    // Add ingredient
    const ingredientName = cleanText(row['Ingredient'])
    if (ingredientName) {
      recipe.ingredients.push({
        raw_name: ingredientName,
        quantity: parseNumber(row['Quantity']),
        unit: cleanText(row['Unit']),
      })
    }
  }

  return recipes
}

// =============================================================================
// Build Recipe with FK Resolution & Nutrition Calculation
// =============================================================================

// Extended lookup data with IDs
interface IngredientLookupData {
  id: string
  macros: IngredientInsert['macros']
}

interface SpiceLookupData {
  id: string
  name: string
}

interface RecipeBuildContext {
  ingredientLookup: Map<string, IngredientLookupData>
  spiceLookup: Map<string, SpiceLookupData>
  imageLookup?: Map<string, string>
}

interface RecipeBuildResult {
  recipe: RecipeInsert
  junctionRecords: Omit<RecipeIngredientInsert, 'recipe_id'>[]
  unmatchedIngredients: string[]
  hasUnmatched: boolean
}

function buildRecipe(
  grouped: GroupedRecipe,
  context: RecipeBuildContext
): RecipeBuildResult {
  const unmatchedIngredients: string[] = []
  const junctionRecords: Omit<RecipeIngredientInsert, 'recipe_id'>[] = []

  let imagePath: string | null = null
  if (context.imageLookup) {
    for (const key of createLookupVariants(grouped.name)) {
      const match = context.imageLookup.get(key)
      if (match) {
        imagePath = match
        break
      }
    }
  }
  
  // Initialize nutrition totals
  let totalCalories = 0
  let totalProtein = 0
  let totalCarbs = 0
  let totalFat = 0

  // Process each ingredient and build junction records
  let sortOrder = 0
  for (const ing of grouped.ingredients) {
    sortOrder++
    const lookupKeys = createLookupVariants(ing.raw_name)
    
    let isSpice = false
    let ingredientData: IngredientLookupData | undefined
    let spiceData: SpiceLookupData | undefined

    // Try to match to spice or ingredient
    for (const key of lookupKeys) {
      // Check spices first
      if (!spiceData && context.spiceLookup.has(key)) {
        spiceData = context.spiceLookup.get(key)
        isSpice = true
      }
      // Check ingredients
      if (!ingredientData && context.ingredientLookup.has(key)) {
        ingredientData = context.ingredientLookup.get(key)
      }
      // Stop if we found spice (spice takes precedence)
      if (spiceData) break
    }

    // Build junction record
    const junctionRecord: Omit<RecipeIngredientInsert, 'recipe_id'> = {
      ingredient_id: null,
      spice_id: null,
      raw_name: ing.raw_name,
      quantity: ing.quantity,
      unit: ing.unit,
      is_spice: isSpice,
      is_optional: false,
      sort_order: sortOrder,
      is_matched: false,
      notes: null,
    }

    if (isSpice && spiceData) {
      // Matched to spice
      junctionRecord.spice_id = spiceData.id
      junctionRecord.is_matched = true
      // Spices don't contribute to nutrition
    } else if (!isSpice && ingredientData) {
      // Matched to ingredient
      junctionRecord.ingredient_id = ingredientData.id
      junctionRecord.is_matched = true
      
      // Calculate nutrition contribution
      const servingMultiplier = (ing.quantity || 100) / 100
      totalCalories += (ingredientData.macros.calories || 0) * servingMultiplier
      totalProtein += (ingredientData.macros.protein_g || 0) * servingMultiplier
      totalCarbs += (ingredientData.macros.carbs_g || 0) * servingMultiplier
      totalFat += (ingredientData.macros.fat_g || 0) * servingMultiplier
    } else {
      // Unmatched ingredient
      unmatchedIngredients.push(ing.raw_name)
      junctionRecord.is_matched = false
      junctionRecord.notes = `Unmatched ${isSpice ? 'spice' : 'ingredient'} from seed import - needs admin review`
    }

    junctionRecords.push(junctionRecord)
  }

  // Parse instructions into steps
  const instructions: RecipeInsert['instructions'] = []
  const instructionText = grouped.instructions
  
  if (instructionText) {
    // Split by emoji or numbered pattern, or just use as single step
    const steps = instructionText.split(/(?=🔥|🍳|🥒|🥚|🥩|🫒|😋|\d+\.|اولا|ثانيا|ثالثا)/).filter(s => s.trim())
    
    if (steps.length > 1) {
      steps.forEach((step, index) => {
        const cleanedStep = step.trim()
        if (cleanedStep) {
          instructions.push({ step: index + 1, instruction: cleanedStep })
        }
      })
    } else {
      // Single instruction
      instructions.push({ step: 1, instruction: instructionText })
    }
  }

  // Determine dietary flags (simplified - would need more sophisticated logic in production)
  const ingredientNames = grouped.ingredients.map(i => i.raw_name.toLowerCase()).join(' ')
  const hasChicken = /دجاج|فراخ|chicken/i.test(ingredientNames)
  const hasMeat = /لحم|لحمة|meat|beef/i.test(ingredientNames)
  const hasFish = /سمك|سلمون|fish|salmon/i.test(ingredientNames)
  const hasEgg = /بيض|egg/i.test(ingredientNames)
  const hasDairy = /لبن|حليب|جبن|زبادي|milk|cheese|yogurt/i.test(ingredientNames)

  const isVegetarian = !hasChicken && !hasMeat && !hasFish
  const isVegan = isVegetarian && !hasEgg && !hasDairy

  const hasUnmatched = unmatchedIngredients.length > 0
  const adminNotes = hasUnmatched
    ? `Unmatched ingredients: ${unmatchedIngredients.join(', ')}`
    : null

  // Build recipe (without ingredients JSONB - we use junction table now)
  const recipe: RecipeInsert = {
    name: grouped.name,
    description: null,
    image_url: imagePath,
    meal_type: [grouped.meal_type],
    cuisine: 'egyptian',
    tags: [],
    prep_time_minutes: null,
    cook_time_minutes: null,
    servings: 1,
    difficulty: null,
    ingredients: [], // Empty - using junction table instead
    instructions,
    nutrition_per_serving: {
      calories: Math.round(totalCalories),
      protein_g: Math.round(totalProtein * 10) / 10,
      carbs_g: Math.round(totalCarbs * 10) / 10,
      fat_g: Math.round(totalFat * 10) / 10,
    },
    is_vegetarian: isVegetarian,
    is_vegan: isVegan,
    is_gluten_free: false,
    is_dairy_free: !hasDairy,
    admin_notes: adminNotes,
    is_public: true,
    status: hasUnmatched ? 'error' : 'complete', // Mark as error if unmatched
  }

  return { recipe, junctionRecords, unmatchedIngredients, hasUnmatched }
}

// =============================================================================
// Image Lookup Helpers
// =============================================================================

const ALLOWED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif'])

function buildImageLookupFromDisk(): Map<string, string> {
  const lookup = new Map<string, string>()

  if (!fs.existsSync(IMAGES_PATH)) {
    return lookup
  }

  const walk = (dir: string) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        walk(entryPath)
        continue
      }

      if (!entry.isFile()) continue

      const ext = path.extname(entry.name).toLowerCase()
      if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) continue

      const baseName = path.parse(entry.name).name
      const relativeToImages = path.relative(IMAGES_PATH, entryPath).replace(/\\/g, '/')
      const datasetPath = `docs/datasets/images/${relativeToImages}`

      for (const key of createLookupVariants(baseName)) {
        if (!lookup.has(key)) {
          lookup.set(key, datasetPath)
        }
      }
    }
  }

  walk(IMAGES_PATH)
  return lookup
}

// =============================================================================
// Build Spice Lookup with IDs (for junction table)
// =============================================================================

async function buildSpiceLookupWithIds(supabase: SupabaseClient): Promise<Map<string, SpiceLookupData>> {
  const { data, error } = await supabase
    .from('spices')
    .select('id, name, name_ar, aliases')

  if (error) {
    throw new Error(`Failed to fetch spices: ${error.message}`)
  }

  const lookup = new Map<string, SpiceLookupData>()
  
  for (const spice of data || []) {
    const spiceData = { id: spice.id, name: spice.name }
    
    // Add lookup by English name
    if (spice.name) {
      for (const key of createLookupVariants(spice.name)) {
        if (!lookup.has(key)) {
          lookup.set(key, spiceData)
        }
      }
    }
    // Add lookup by Arabic name
    if (spice.name_ar) {
      for (const key of createLookupVariants(spice.name_ar)) {
        if (!lookup.has(key)) {
          lookup.set(key, spiceData)
        }
      }
    }
    // Add lookup by aliases
    if (spice.aliases && Array.isArray(spice.aliases)) {
      for (const alias of spice.aliases) {
        for (const key of createLookupVariants(alias)) {
          if (!lookup.has(key)) {
            lookup.set(key, spiceData)
          }
        }
      }
    }
  }

  return lookup
}

// =============================================================================
// FK Validation (for dry run)
// =============================================================================

export function validateFKs(): FKValidationResult {
  log.subheader('FK Validation')

  const rows = parseCSV<RecipeCsvRow>(CSV_FILES.recipes)
  const groupedRecipes = groupRecipeRows(rows)
  
  const ingredientLookup = buildIngredientLookupFromCSV()
  const spiceLookup = buildSpiceLookupFromCSV()

  let totalIngredients = 0
  let matchedToIngredient = 0
  let matchedToSpice = 0
  const unmatchedSet = new Set<string>()
  const unmatchedDetails: FKValidationResult['unmatchedDetails'] = []

  for (const [recipeName, grouped] of groupedRecipes) {
    for (const ing of grouped.ingredients) {
      totalIngredients++
      const lookupKeys = createLookupVariants(ing.raw_name)
      let matched = false

      for (const key of lookupKeys) {
        if (spiceLookup.has(key)) {
          matchedToSpice++
          matched = true
          break
        }
        if (ingredientLookup.has(key)) {
          matchedToIngredient++
          matched = true
          break
        }
      }

      if (!matched) {
        if (!unmatchedSet.has(ing.raw_name)) {
          unmatchedSet.add(ing.raw_name)
          unmatchedDetails.push({ recipe: recipeName, ingredient: ing.raw_name })
        }
      }
    }
  }

  const unmatched = Array.from(unmatchedSet)
  const valid = unmatched.length === 0

  log.info(`Total ingredients: ${totalIngredients}`)
  log.info(`Matched to ingredients: ${matchedToIngredient}`)
  log.info(`Matched to spices: ${matchedToSpice}`)
  
  if (unmatched.length > 0) {
    log.warning(`Unmatched ingredients: ${unmatched.length}`)
    const previewDetails = unmatchedDetails.slice(0, 20)
    previewDetails.forEach(({ ingredient, recipe }) => {
      log.warning(`  - ${ingredient} (e.g. recipe: ${recipe})`)
    })
    if (unmatched.length > 20) {
      log.warning(`  ... and ${unmatched.length - 20} more`)
    }
  } else {
    log.success('All ingredients matched!')
  }

  return {
    valid,
    totalIngredients,
    matchedToIngredient,
    matchedToSpice,
    unmatched,
    unmatchedDetails,
  }
}

// =============================================================================
// Dry Run
// =============================================================================

export async function dryRunRecipes(supabase: SupabaseClient): Promise<DryRunResult> {
  log.subheader('Recipes - Dry Run')
  
  const rows = parseCSV<RecipeCsvRow>(CSV_FILES.recipes)
  const groupedRecipes = groupRecipeRows(rows)
  const warnings: string[] = []
  const errors: string[] = []

  log.info(`Parsed ${groupedRecipes.size} unique recipes from ${rows.length} CSV rows`)

  // Run FK validation
  const fkResult = validateFKs()
  
  if (!fkResult.valid) {
    const sample = fkResult.unmatched.slice(0, 5).join(', ')
    warnings.push(`${fkResult.unmatched.length} ingredients could not be matched. Examples: ${sample}`)
    warnings.push(`Unmatched ingredients will be inserted with null FK and marked for admin review.`)
  }

  const recipesWithUnmatched = new Set(fkResult.unmatchedDetails.map(detail => detail.recipe))
  const fullyMatchedCount = groupedRecipes.size - recipesWithUnmatched.size
  log.info(`Recipes with all ingredients matched: ${fullyMatchedCount}`)
  log.info(`Recipes with unmatched ingredients (will have status='error'): ${recipesWithUnmatched.size}`)

  // Validate image availability
  const imageLookup = buildImageLookupFromDisk()
  const missingImages: string[] = []
  const foundImages: string[] = []

  for (const [recipeName] of groupedRecipes) {
    const hasImage = createLookupVariants(recipeName).some(key => imageLookup.has(key))
    if (hasImage) {
      foundImages.push(recipeName)
    } else {
      missingImages.push(recipeName)
    }
  }

  log.info(`Images found: ${foundImages.length}, missing: ${missingImages.length}`)

  if (missingImages.length > 0) {
    const preview = missingImages.slice(0, 5).join(', ')
    warnings.push(`${missingImages.length} recipes are missing matching images in docs/datasets/images. Examples: ${preview}`)
  }

  // Check existing records in database
  const { data: existing, error } = await supabase
    .from('recipes')
    .select('name')
  
  if (error) {
    errors.push(`Database error: ${error.message}`)
    return { table: 'recipes', wouldInsert: 0, wouldUpdate: 0, warnings, errors }
  }

  const existingNames = new Set((existing || []).map(r => r.name.toLowerCase()))
  
  let wouldInsert = 0
  let wouldUpdate = 0
  
  for (const [recipeName] of groupedRecipes) {
    if (existingNames.has(recipeName.toLowerCase())) {
      wouldUpdate++
    } else {
      wouldInsert++
    }
  }

  log.info(`Would insert: ${wouldInsert}, Would update: ${wouldUpdate}`)

  return { table: 'recipes', wouldInsert, wouldUpdate, warnings, errors }
}

// =============================================================================
// Seed Execution (Updated for Junction Table)
// =============================================================================

export async function seedRecipes(supabase: SupabaseClient, skipUnmatched: boolean = false): Promise<SeedResult> {
  log.subheader('Recipes - Seeding (with Junction Table)')
  
  const rows = parseCSV<RecipeCsvRow>(CSV_FILES.recipes)
  const groupedRecipes = groupRecipeRows(rows)
  const errors: string[] = []
  
  log.info(`Parsed ${groupedRecipes.size} unique recipes`)
  
  // Build lookups from database
  log.info('Building ingredient lookup from database...')
  const ingredientLookup = await buildIngredientLookup(supabase)
  log.info(`  Ingredient lookup: ${ingredientLookup.size} entries`)
  
  log.info('Building spice lookup from database (with IDs)...')
  const spiceLookup = await buildSpiceLookupWithIds(supabase)
  log.info(`  Spice lookup: ${spiceLookup.size} entries`)
  
  log.info('Building image lookup from dataset...')
  const imageLookup = buildImageLookupFromDisk()
  log.info(`  Image lookup: ${imageLookup.size} entries`)
  
  // Build all recipes with junction data
  const recipeBuilds: Array<{ build: RecipeBuildResult; grouped: GroupedRecipe }> = []
  let totalUnmatched = 0
  let skippedForUnmatched = 0
  let recipesWithErrors = 0
  
  for (const [, grouped] of groupedRecipes) {
    const build = buildRecipe(grouped, { ingredientLookup, spiceLookup, imageLookup })
    
    // Skip recipes with unmatched ingredients if flag is set
    if (skipUnmatched && build.hasUnmatched) {
      skippedForUnmatched++
      continue
    }
    
    if (build.hasUnmatched) {
      recipesWithErrors++
    }
    
    recipeBuilds.push({ build, grouped })
    totalUnmatched += build.unmatchedIngredients.length
  }
  
  if (skipUnmatched && skippedForUnmatched > 0) {
    log.info(`Skipped ${skippedForUnmatched} recipes with unmatched ingredients`)
  }
  
  if (!skipUnmatched && recipesWithErrors > 0) {
    log.warning(`${recipesWithErrors} recipes have unmatched ingredients (status='error')`)
    log.warning(`${totalUnmatched} total unmatched ingredient references`)
  }
  
  log.info(`Upserting ${recipeBuilds.length} recipes...`)
  
  // Step 1: Upsert recipes
  const batchSize = 50
  let inserted = 0
  let skippedDueToErrors = 0
  const recipeIdMap = new Map<string, string>() // name -> id
  
  for (let i = 0; i < recipeBuilds.length; i += batchSize) {
    const batch = recipeBuilds.slice(i, i + batchSize)
    const recipeBatch = batch.map(b => b.build.recipe)
    
    const { data, error } = await supabase
      .from('recipes')
      .upsert(recipeBatch, { 
        onConflict: 'name',
        ignoreDuplicates: false 
      })
      .select('id, name')
  
    if (error) {
      errors.push(`Batch ${Math.floor(i / batchSize) + 1} error: ${error.message}`)
      skippedDueToErrors += batch.length
    } else {
      inserted += data?.length || batch.length
      // Store IDs for junction table insertion
      for (const recipe of data || []) {
        recipeIdMap.set(recipe.name, recipe.id)
      }
    }
  
    process.stdout.write(`\r  Recipes progress: ${Math.min(i + batchSize, recipeBuilds.length)}/${recipeBuilds.length}`)
  }
  
  console.log()
  log.success(`Recipes upserted: ${inserted} inserted/updated, ${skippedDueToErrors} skipped`)

  // Step 2: Insert junction table records
  log.info('Inserting recipe_ingredients junction records...')
  
  // First, delete existing junction records for these recipes (to avoid duplicates on re-run)
  const recipeIds = Array.from(recipeIdMap.values())
  if (recipeIds.length > 0) {
    const { error: deleteError } = await supabase
      .from('recipe_ingredients')
      .delete()
      .in('recipe_id', recipeIds)
    
    if (deleteError) {
      log.warning(`Could not clear existing junction records: ${deleteError.message}`)
    }
  }
  
  // Build all junction records with recipe IDs
  const allJunctionRecords: RecipeIngredientInsert[] = []
  
  for (const { build, grouped } of recipeBuilds) {
    const recipeId = recipeIdMap.get(grouped.name)
    if (!recipeId) continue
    
    for (const junctionRecord of build.junctionRecords) {
      allJunctionRecords.push({
        ...junctionRecord,
        recipe_id: recipeId,
      })
    }
  }
  
  log.info(`Inserting ${allJunctionRecords.length} junction records...`)
  
  // Insert junction records in batches
  let junctionInserted = 0
  const junctionBatchSize = 200
  
  for (let i = 0; i < allJunctionRecords.length; i += junctionBatchSize) {
    const batch = allJunctionRecords.slice(i, i + junctionBatchSize)
    
    const { data, error } = await supabase
      .from('recipe_ingredients')
      .insert(batch)
      .select('id')
    
    if (error) {
      errors.push(`Junction batch ${Math.floor(i / junctionBatchSize) + 1} error: ${error.message}`)
    } else {
      junctionInserted += data?.length || batch.length
    }
    
    process.stdout.write(`\r  Junction progress: ${Math.min(i + junctionBatchSize, allJunctionRecords.length)}/${allJunctionRecords.length}`)
  }
  
  console.log()
  log.success(`Junction records inserted: ${junctionInserted}`)
  
  // Summary
  log.subheader('Seed Summary')
  log.info(`Recipes: ${inserted} inserted/updated`)
  log.info(`Recipe ingredients (junction): ${junctionInserted} inserted`)
  log.info(`Recipes with errors (unmatched): ${recipesWithErrors}`)
  log.info(`Total unmatched ingredients: ${totalUnmatched}`)

  return { 
    table: 'recipes', 
    inserted, 
    updated: 0, 
    skipped: skippedDueToErrors + skippedForUnmatched, 
    errors 
  }
}
// =============================================================================
// Export Unmatched Recipes
// =============================================================================

export async function exportUnmatchedRecipes(): Promise<string> {
  const rows = parseCSV<RecipeCsvRow>(CSV_FILES.recipes)
  const groupedRecipes = groupRecipeRows(rows)
  
  const ingredientLookup = buildIngredientLookupFromCSV()
  const spiceLookup = buildSpiceLookupFromCSV()

  // Collect recipes with unmatched ingredients
  const unmatchedRecipes: Array<{
    recipeName: string
    ingredient: string
    quantity: string
    unit: string
  }> = []

  const placeholderRecipeKeys = new Set([createLookupKey('Recipe Name'), createLookupKey('اسم الوصفة')])
  const placeholderIngredientKeys = new Set([createLookupKey('Ingredient'), createLookupKey('المكون')])

  for (const [recipeName, grouped] of groupedRecipes) {
    const recipeKey = createLookupKey(recipeName)
    if (placeholderRecipeKeys.has(recipeKey)) {
      continue
    }

    for (const ing of grouped.ingredients) {
      const lookupKeys = createLookupVariants(ing.raw_name)
      const isSpice = lookupKeys.some(key => spiceLookup.has(key))
      const hasIngredient = lookupKeys.some(key => ingredientLookup.has(key))

      if (lookupKeys.some(key => placeholderIngredientKeys.has(key))) {
        continue
      }

      if (!isSpice && !hasIngredient) { // Check for unmatched ingredients
        unmatchedRecipes.push({
          recipeName,
          ingredient: ing.raw_name,
          quantity: ing.quantity?.toString() || '',
          unit: ing.unit || '',
        })
      }
    }
  }

  // Generate CSV content
  const csvLines = [
    'Recipe Name,Ingredient,Quantity,Unit,Suggested Ingredient Name',
    ...unmatchedRecipes.map(r => 
      `"${r.recipeName}","${r.ingredient}","${r.quantity}","${r.unit}",""`
    )
  ]

  const outputPath = path.join(process.cwd(), 'docs', 'datasets', 'unmatched-recipes.csv')
  fs.writeFileSync(outputPath, csvLines.join('\n'), 'utf-8')

  log.info(`Exported ${unmatchedRecipes.length} unmatched ingredient entries`)
  log.info(`Unique recipes affected: ${new Set(unmatchedRecipes.map(r => r.recipeName)).size}`)
  
  return outputPath
}

function toCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }

  let str: string

  if (typeof value === 'string') {
    str = value
  } else if (typeof value === 'number' || typeof value === 'boolean') {
    str = String(value)
  } else {
    str = JSON.stringify(value)
  }

  const needsQuotes = /[",\n]/.test(str)
  const escaped = str.replace(/"/g, '""')
  return needsQuotes ? `"${escaped}"` : escaped
}

export async function exportRecipesTable(supabase: SupabaseClient): Promise<string> {
  log.subheader('Exporting existing recipes to CSV')

  const { data, error } = await supabase
    .from('recipes')
    .select('id,name,image_url,meal_type,cuisine,tags,servings,is_public,status,instructions,nutrition_per_serving,admin_notes,created_at,updated_at')
    .order('name', { ascending: true })

  if (error) {
    throw new Error(`Database error: ${error.message}`)
  }

  const records = data ?? []
  
  // Get ingredient counts from junction table
  const { data: ingredientCounts } = await supabase
    .from('recipe_ingredients')
    .select('recipe_id')
  
  const countMap = new Map<string, number>()
  for (const rec of ingredientCounts || []) {
    countMap.set(rec.recipe_id, (countMap.get(rec.recipe_id) || 0) + 1)
  }

  const header = [
    'id',
    'name',
    'image_url',
    'meal_type',
    'cuisine',
    'tags',
    'servings',
    'is_public',
    'status',
    'ingredient_count',
    'instruction_count',
    'nutrition_per_serving',
    'admin_notes',
    'created_at',
    'updated_at'
  ]

  const csvLines = [
    header.join(','),
    ...records.map(record => {
      const instructions = Array.isArray(record?.instructions) ? record.instructions : []

      return [
        record?.id ?? '',
        record?.name ?? '',
        record?.image_url ?? '',
        Array.isArray(record?.meal_type) ? record.meal_type.join(';') : record?.meal_type ?? '',
        record?.cuisine ?? '',
        Array.isArray(record?.tags) ? record.tags.join(';') : record?.tags ?? '',
        record?.servings ?? '',
        typeof record?.is_public === 'boolean' ? record.is_public : '',
        record?.status ?? 'draft',
        countMap.get(record?.id) || 0,
        instructions.length,
        record?.nutrition_per_serving ?? {},
        record?.admin_notes ?? '',
        record?.created_at ?? '',
        record?.updated_at ?? ''
      ].map(toCsvValue).join(',')
    })
  ]

  const outputDir = path.join(process.cwd(), 'docs', 'datasets')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const outputPath = path.join(outputDir, 'existing-recipes.csv')
  fs.writeFileSync(outputPath, csvLines.join('\n'), 'utf-8')

  log.info(`Exported ${records.length} recipes to ${outputPath}`)
  return outputPath
}
