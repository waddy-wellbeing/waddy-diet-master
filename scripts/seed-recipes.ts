/**
 * Recipes Seeder
 * 
 * Parses recipies_dataset.csv, resolves FKs, calculates nutrition,
 * and upserts into nutri_recipes table
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { RecipeCsvRow, RecipeInsert, SeedResult, DryRunResult, FKValidationResult, FoodInsert } from './types'
import { parseCSV, parseNumber, cleanText, log, CSV_FILES, createLookupKey } from './utils'
import { buildFoodLookup, buildFoodLookupFromCSV } from './seed-foods'
import { buildSpiceLookup, buildSpiceLookupFromCSV } from './seed-spices'

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

function groupRecipeRows(rows: RecipeCsvRow[]): Map<string, GroupedRecipe> {
  const recipes = new Map<string, GroupedRecipe>()

  for (const row of rows) {
    const recipeName = cleanText(row['Recipe Name'])
    if (!recipeName) continue

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

interface RecipeBuildContext {
  foodLookup: Map<string, { id?: string; macros: FoodInsert['macros'] }>
  spiceLookup: Set<string>
}

function buildRecipe(
  grouped: GroupedRecipe,
  context: RecipeBuildContext,
  includeIds: boolean = true
): { recipe: RecipeInsert; unmatchedIngredients: string[] } {
  const unmatchedIngredients: string[] = []
  
  // Initialize nutrition totals
  let totalCalories = 0
  let totalProtein = 0
  let totalCarbs = 0
  let totalFat = 0

  // Build ingredients array
  const ingredients: RecipeInsert['ingredients'] = []

  for (const ing of grouped.ingredients) {
    const lookupKey = createLookupKey(ing.raw_name)
    const isSpice = context.spiceLookup.has(lookupKey)
    const foodData = context.foodLookup.get(lookupKey)

    let food_id: string | null = null
    
    if (!isSpice && foodData) {
      // Found matching food - get ID and add to nutrition
      if (includeIds && 'id' in foodData && foodData.id) {
        food_id = foodData.id
      }
      
      // Calculate nutrition contribution
      // Assuming serving_size is 100g in the food database
      const servingMultiplier = (ing.quantity || 100) / 100
      totalCalories += (foodData.macros.calories || 0) * servingMultiplier
      totalProtein += (foodData.macros.protein_g || 0) * servingMultiplier
      totalCarbs += (foodData.macros.carbs_g || 0) * servingMultiplier
      totalFat += (foodData.macros.fat_g || 0) * servingMultiplier
    } else if (!isSpice) {
      // Not a spice and not found in foods - track as unmatched
      unmatchedIngredients.push(ing.raw_name)
    }
    // Spices don't contribute to nutrition

    ingredients.push({
      food_id,
      raw_name: ing.raw_name,
      quantity: ing.quantity,
      unit: ing.unit,
      is_spice: isSpice,
      is_optional: false,
    })
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

  const recipe: RecipeInsert = {
    name: grouped.name,
    description: null,
    image_url: null, // Could be matched from images folder later
    meal_type: [grouped.meal_type],
    cuisine: 'egyptian', // Default for this dataset
    tags: [],
    prep_time_minutes: null,
    cook_time_minutes: null,
    servings: 1, // Single serving recipes
    difficulty: null,
    ingredients,
    instructions,
    nutrition_per_serving: {
      calories: Math.round(totalCalories),
      protein_g: Math.round(totalProtein * 10) / 10,
      carbs_g: Math.round(totalCarbs * 10) / 10,
      fat_g: Math.round(totalFat * 10) / 10,
    },
    is_vegetarian: isVegetarian,
    is_vegan: isVegan,
    is_gluten_free: false, // Would need more analysis
    is_dairy_free: !hasDairy,
    is_public: true,
  }

  return { recipe, unmatchedIngredients }
}

// =============================================================================
// FK Validation (for dry run)
// =============================================================================

export function validateFKs(): FKValidationResult {
  log.subheader('FK Validation')

  const rows = parseCSV<RecipeCsvRow>(CSV_FILES.recipes)
  const groupedRecipes = groupRecipeRows(rows)
  
  const foodLookup = buildFoodLookupFromCSV()
  const spiceLookup = buildSpiceLookupFromCSV()

  let totalIngredients = 0
  let matchedToFood = 0
  let matchedToSpice = 0
  const unmatchedSet = new Set<string>()
  const unmatchedDetails: FKValidationResult['unmatchedDetails'] = []

  for (const [recipeName, grouped] of groupedRecipes) {
    for (const ing of grouped.ingredients) {
      totalIngredients++
      const lookupKey = createLookupKey(ing.raw_name)
      
      if (spiceLookup.has(lookupKey)) {
        matchedToSpice++
      } else if (foodLookup.has(lookupKey)) {
        matchedToFood++
      } else {
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
  log.info(`Matched to foods: ${matchedToFood}`)
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
    matchedToFood,
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
    warnings.push(`${fkResult.unmatched.length} ingredients could not be matched to foods or spices. Examples: ${sample}`)
  }

  // Check existing records in database
  const { data: existing, error } = await supabase
    .from('nutri_recipes')
    .select('name')
  
  if (error) {
    errors.push(`Database error: ${error.message}`)
    return { table: 'nutri_recipes', wouldInsert: 0, wouldUpdate: 0, warnings, errors }
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

  return { table: 'nutri_recipes', wouldInsert, wouldUpdate, warnings, errors }
}

// =============================================================================
// Seed Execution
// =============================================================================

export async function seedRecipes(supabase: SupabaseClient): Promise<SeedResult> {
  log.subheader('Recipes - Seeding')
  
  const rows = parseCSV<RecipeCsvRow>(CSV_FILES.recipes)
  const groupedRecipes = groupRecipeRows(rows)
  const errors: string[] = []

  log.info(`Parsed ${groupedRecipes.size} unique recipes`)

  // Build lookups from database
  log.info('Building food lookup from database...')
  const foodLookup = await buildFoodLookup(supabase)
  log.info(`  Food lookup: ${foodLookup.size} entries`)

  log.info('Building spice lookup from database...')
  const spiceLookup = await buildSpiceLookup(supabase)
  log.info(`  Spice lookup: ${spiceLookup.size} entries`)

  // Build all recipes
  const recipes: RecipeInsert[] = []
  let totalUnmatched = 0

  for (const [, grouped] of groupedRecipes) {
    const { recipe, unmatchedIngredients } = buildRecipe(grouped, { foodLookup, spiceLookup })
    recipes.push(recipe)
    totalUnmatched += unmatchedIngredients.length
  }

  if (totalUnmatched > 0) {
    log.warning(`${totalUnmatched} ingredient references will have null food_id`)
  }

  log.info(`Upserting ${recipes.length} recipes...`)

  // Upsert in batches
  const batchSize = 50
  let inserted = 0
  let skipped = 0

  for (let i = 0; i < recipes.length; i += batchSize) {
    const batch = recipes.slice(i, i + batchSize)
    
    const { data, error } = await supabase
      .from('nutri_recipes')
      .upsert(batch, { 
        onConflict: 'name',
        ignoreDuplicates: false 
      })
      .select('id')

    if (error) {
      errors.push(`Batch ${Math.floor(i / batchSize) + 1} error: ${error.message}`)
      skipped += batch.length
    } else {
      inserted += data?.length || batch.length
    }

    process.stdout.write(`\r  Progress: ${Math.min(i + batchSize, recipes.length)}/${recipes.length}`)
  }
  
  console.log() // New line

  log.success(`Recipes seeded: ${inserted} inserted/updated, ${skipped} skipped`)
  
  return { table: 'nutri_recipes', inserted, updated: 0, skipped, errors }
}
