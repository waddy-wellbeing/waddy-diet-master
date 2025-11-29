/**
 * Recipe Ingredients Audit & Fix Script
 * 
 * This script audits the recipe_ingredients junction table and ensures:
 * 1. All recipes have their ingredients in the junction table
 * 2. Ingredient references are valid (ingredient_id exists in ingredients table)
 * 3. Spice references are valid (spice_id exists in spices table)
 * 4. is_matched flag is correctly set based on FK presence
 * 
 * Usage:
 *   npx tsx scripts/audit-recipe-ingredients.ts                  # Dry run (default)
 *   npx tsx scripts/audit-recipe-ingredients.ts --fix            # Apply basic fixes
 *   npx tsx scripts/audit-recipe-ingredients.ts --auto-match     # Auto-match high confidence items
 *   npx tsx scripts/audit-recipe-ingredients.ts --populate-missing # Populate junction for missing recipes
 *   npx tsx scripts/audit-recipe-ingredients.ts --verbose        # Show all details
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { parseCSV, cleanText, createLookupVariants, CSV_FILES } from './utils'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables:')
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗')
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// =============================================================================
// Types
// =============================================================================

interface Recipe {
  id: string
  name: string
  servings: number
}

interface RecipeIngredientRow {
  id: string
  recipe_id: string
  ingredient_id: string | null
  spice_id: string | null
  raw_name: string
  is_spice: boolean
  is_matched: boolean
  quantity: number | null
  unit: string | null
}

interface Ingredient {
  id: string
  name: string
  name_ar: string | null
}

interface Spice {
  id: string
  name: string
  name_ar: string | null
  aliases: string[]
}

interface AuditResult {
  recipesWithNoIngredients: Recipe[]
  orphanedIngredientRefs: RecipeIngredientRow[]
  orphanedSpiceRefs: RecipeIngredientRow[]
  incorrectMatchedFlags: RecipeIngredientRow[]
  unmatchedIngredients: {
    row: RecipeIngredientRow
    recipeName: string
    possibleMatches: { id: string; name: string; score: number }[]
  }[]
  summary: {
    totalRecipes: number
    totalJunctionRows: number
    recipesWithIngredients: number
    recipesWithNoIngredients: number
    matchedIngredients: number
    unmatchedIngredients: number
    orphanedRefs: number
    incorrectFlags: number
  }
}

interface FixResult {
  deletedOrphanedRefs: number
  fixedMatchedFlags: number
  errors: string[]
}

// =============================================================================
// Helper Functions
// =============================================================================

function normalizeForMatching(str: string): string {
  return str
    .toLowerCase()
    .replace(/[أإآا]/g, 'ا')
    .replace(/[ة]/g, 'ه')
    .replace(/[ى]/g, 'ي')
    .replace(/[\s\-_]+/g, ' ')
    .trim()
}

function calculateMatchScore(rawName: string, candidateName: string, aliases: string[] = []): number {
  const normalizedRaw = normalizeForMatching(rawName)
  const normalizedCandidate = normalizeForMatching(candidateName)
  
  // Exact match
  if (normalizedRaw === normalizedCandidate) return 100
  
  // Check aliases
  for (const alias of aliases) {
    if (normalizeForMatching(alias) === normalizedRaw) return 95
  }
  
  // Contains match
  if (normalizedCandidate.includes(normalizedRaw) || normalizedRaw.includes(normalizedCandidate)) {
    return 70
  }
  
  // Word overlap
  const rawWords = normalizedRaw.split(' ')
  const candidateWords = normalizedCandidate.split(' ')
  const commonWords = rawWords.filter(w => candidateWords.includes(w))
  if (commonWords.length > 0) {
    return Math.round((commonWords.length / Math.max(rawWords.length, candidateWords.length)) * 60)
  }
  
  return 0
}

// =============================================================================
// Audit Functions
// =============================================================================

async function loadAllData() {
  console.log('📊 Loading data from database...\n')
  
  // Load recipes
  const { data: recipes, error: recipesError } = await supabase
    .from('recipes')
    .select('id, name, servings')
    .order('name')
  
  if (recipesError) throw new Error(`Failed to load recipes: ${recipesError.message}`)
  
  // Load junction table - need to paginate as we may have many rows
  const allJunctionRows: RecipeIngredientRow[] = []
  let page = 0
  const pageSize = 1000
  
  while (true) {
    const { data: junctionBatch, error: junctionError } = await supabase
      .from('recipe_ingredients')
      .select('*')
      .order('recipe_id, sort_order')
      .range(page * pageSize, (page + 1) * pageSize - 1)
    
    if (junctionError) throw new Error(`Failed to load junction table: ${junctionError.message}`)
    
    if (!junctionBatch || junctionBatch.length === 0) break
    
    allJunctionRows.push(...junctionBatch)
    
    if (junctionBatch.length < pageSize) break
    page++
  }
  
  // Load ingredients
  const { data: ingredients, error: ingredientsError } = await supabase
    .from('ingredients')
    .select('id, name, name_ar')
  
  if (ingredientsError) throw new Error(`Failed to load ingredients: ${ingredientsError.message}`)
  
  // Load spices
  const { data: spices, error: spicesError } = await supabase
    .from('spices')
    .select('id, name, name_ar, aliases')
  
  if (spicesError) throw new Error(`Failed to load spices: ${spicesError.message}`)
  
  console.log(`   Recipes: ${recipes?.length ?? 0}`)
  console.log(`   Junction rows: ${allJunctionRows.length}`)
  console.log(`   Ingredients: ${ingredients?.length ?? 0}`)
  console.log(`   Spices: ${spices?.length ?? 0}`)
  console.log()
  
  return {
    recipes: recipes as Recipe[],
    junctionRows: allJunctionRows as RecipeIngredientRow[],
    ingredients: ingredients as Ingredient[],
    spices: spices as Spice[],
  }
}

async function auditDatabase(verbose: boolean): Promise<AuditResult> {
  const { recipes, junctionRows, ingredients, spices } = await loadAllData()
  
  // Create lookup maps
  const ingredientIds = new Set(ingredients.map(i => i.id))
  const spiceIds = new Set(spices.map(s => s.id))
  const recipeIdsWithIngredients = new Set(junctionRows.map(r => r.recipe_id))
  const recipeMap = new Map(recipes.map(r => [r.id, r]))
  
  // 1. Find recipes with no ingredients in junction table
  const recipesWithNoIngredients = recipes.filter(r => !recipeIdsWithIngredients.has(r.id))
  
  // 2. Find orphaned ingredient references (ingredient_id that doesn't exist)
  const orphanedIngredientRefs = junctionRows.filter(
    row => row.ingredient_id && !ingredientIds.has(row.ingredient_id)
  )
  
  // 3. Find orphaned spice references (spice_id that doesn't exist)
  const orphanedSpiceRefs = junctionRows.filter(
    row => row.spice_id && !spiceIds.has(row.spice_id)
  )
  
  // 4. Find incorrect is_matched flags
  const incorrectMatchedFlags = junctionRows.filter(row => {
    const shouldBeMatched = row.is_spice 
      ? row.spice_id !== null 
      : row.ingredient_id !== null
    return row.is_matched !== shouldBeMatched
  })
  
  // 5. Find unmatched ingredients and suggest possible matches
  const unmatchedRows = junctionRows.filter(row => !row.is_matched || 
    (row.is_spice && !row.spice_id) || 
    (!row.is_spice && !row.ingredient_id)
  )
  
  const unmatchedIngredients = unmatchedRows.map(row => {
    const recipe = recipeMap.get(row.recipe_id)
    
    // Find possible matches
    let possibleMatches: { id: string; name: string; score: number }[] = []
    
    if (row.is_spice) {
      // Search in spices
      possibleMatches = spices
        .map(s => ({
          id: s.id,
          name: s.name,
          score: calculateMatchScore(row.raw_name, s.name, s.aliases)
        }))
        .filter(m => m.score > 30)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
    } else {
      // Search in ingredients
      possibleMatches = ingredients
        .map(i => ({
          id: i.id,
          name: i.name,
          score: calculateMatchScore(row.raw_name, i.name)
        }))
        .filter(m => m.score > 30)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
    }
    
    return {
      row,
      recipeName: recipe?.name ?? 'Unknown',
      possibleMatches
    }
  })
  
  // Calculate summary
  const matchedCount = junctionRows.filter(r => r.is_matched).length
  
  const result: AuditResult = {
    recipesWithNoIngredients,
    orphanedIngredientRefs,
    orphanedSpiceRefs,
    incorrectMatchedFlags,
    unmatchedIngredients,
    summary: {
      totalRecipes: recipes.length,
      totalJunctionRows: junctionRows.length,
      recipesWithIngredients: recipeIdsWithIngredients.size,
      recipesWithNoIngredients: recipesWithNoIngredients.length,
      matchedIngredients: matchedCount,
      unmatchedIngredients: junctionRows.length - matchedCount,
      orphanedRefs: orphanedIngredientRefs.length + orphanedSpiceRefs.length,
      incorrectFlags: incorrectMatchedFlags.length,
    }
  }
  
  return result
}

function printAuditReport(result: AuditResult, verbose: boolean) {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('                    AUDIT SUMMARY REPORT                        ')
  console.log('═══════════════════════════════════════════════════════════════\n')
  
  const s = result.summary
  
  console.log('📈 Overview:')
  console.log(`   Total recipes:              ${s.totalRecipes}`)
  console.log(`   Total junction rows:        ${s.totalJunctionRows}`)
  console.log(`   Recipes with ingredients:   ${s.recipesWithIngredients}`)
  console.log(`   Recipes without ingredients: ${s.recipesWithNoIngredients}`)
  console.log()
  
  console.log('🔗 Ingredient Matching:')
  console.log(`   Matched:   ${s.matchedIngredients} (${((s.matchedIngredients / s.totalJunctionRows) * 100).toFixed(1)}%)`)
  console.log(`   Unmatched: ${s.unmatchedIngredients} (${((s.unmatchedIngredients / s.totalJunctionRows) * 100).toFixed(1)}%)`)
  console.log()
  
  // Issues
  console.log('⚠️  Issues Found:')
  
  if (s.recipesWithNoIngredients > 0) {
    console.log(`   ❌ Recipes with no ingredients: ${s.recipesWithNoIngredients}`)
    if (verbose || s.recipesWithNoIngredients <= 10) {
      result.recipesWithNoIngredients.forEach(r => {
        console.log(`      - ${r.name} (${r.id})`)
      })
    }
  }
  
  if (s.orphanedRefs > 0) {
    console.log(`   ❌ Orphaned FK references: ${s.orphanedRefs}`)
    if (verbose) {
      result.orphanedIngredientRefs.forEach(r => {
        console.log(`      - ingredient_id ${r.ingredient_id} in row ${r.id}`)
      })
      result.orphanedSpiceRefs.forEach(r => {
        console.log(`      - spice_id ${r.spice_id} in row ${r.id}`)
      })
    }
  }
  
  if (s.incorrectFlags > 0) {
    console.log(`   ❌ Incorrect is_matched flags: ${s.incorrectFlags}`)
  }
  
  if (s.recipesWithNoIngredients === 0 && s.orphanedRefs === 0 && s.incorrectFlags === 0) {
    console.log('   ✅ No critical issues found!')
  }
  
  console.log()
  
  // Unmatched ingredients with suggestions
  if (result.unmatchedIngredients.length > 0) {
    console.log('═══════════════════════════════════════════════════════════════')
    console.log('                 UNMATCHED INGREDIENTS                          ')
    console.log('═══════════════════════════════════════════════════════════════\n')
    
    const toShow = verbose ? result.unmatchedIngredients : result.unmatchedIngredients.slice(0, 20)
    
    toShow.forEach(({ row, recipeName, possibleMatches }) => {
      const type = row.is_spice ? '🧂' : '🥕'
      console.log(`${type} "${row.raw_name}" in recipe "${recipeName}"`)
      if (possibleMatches.length > 0) {
        console.log('   Suggestions:')
        possibleMatches.forEach(m => {
          console.log(`     - ${m.name} (score: ${m.score}%)`)
        })
      } else {
        console.log('   No suggestions found')
      }
      console.log()
    })
    
    if (!verbose && result.unmatchedIngredients.length > 20) {
      console.log(`   ... and ${result.unmatchedIngredients.length - 20} more (use --verbose to see all)`)
      console.log()
    }
  }
  
  // Recommended actions
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('                 RECOMMENDED ACTIONS                            ')
  console.log('═══════════════════════════════════════════════════════════════\n')
  
  if (s.orphanedRefs > 0) {
    console.log(`🔧 FIX: Delete ${s.orphanedRefs} orphaned FK references`)
    console.log('   These reference ingredients/spices that no longer exist.')
    console.log()
  }
  
  if (s.incorrectFlags > 0) {
    console.log(`🔧 FIX: Correct ${s.incorrectFlags} is_matched flags`)
    console.log('   These have incorrect match status based on their FK values.')
    console.log()
  }
  
  if (s.recipesWithNoIngredients > 0) {
    console.log(`⚠️  MANUAL: ${s.recipesWithNoIngredients} recipes have no ingredients`)
    console.log('   These need to be edited in the admin panel to add ingredients.')
    console.log()
  }
  
  if (s.unmatchedIngredients > 0) {
    console.log(`⚠️  MANUAL: ${s.unmatchedIngredients} ingredients are unmatched`)
    console.log('   Use the admin panel to match these to existing ingredients/spices.')
    console.log()
  }
  
  if (s.orphanedRefs === 0 && s.incorrectFlags === 0) {
    console.log('✅ No automatic fixes needed!')
    console.log()
  }
}

// =============================================================================
// Fix Functions
// =============================================================================

async function applyFixes(result: AuditResult): Promise<FixResult> {
  const fixResult: FixResult = {
    deletedOrphanedRefs: 0,
    fixedMatchedFlags: 0,
    errors: []
  }
  
  // 1. Delete orphaned ingredient references
  if (result.orphanedIngredientRefs.length > 0) {
    const ids = result.orphanedIngredientRefs.map(r => r.id)
    const { error } = await supabase
      .from('recipe_ingredients')
      .update({ ingredient_id: null, is_matched: false })
      .in('id', ids)
    
    if (error) {
      fixResult.errors.push(`Failed to fix orphaned ingredient refs: ${error.message}`)
    } else {
      fixResult.deletedOrphanedRefs += ids.length
      console.log(`   ✅ Cleared ${ids.length} orphaned ingredient_id references`)
    }
  }
  
  // 2. Delete orphaned spice references
  if (result.orphanedSpiceRefs.length > 0) {
    const ids = result.orphanedSpiceRefs.map(r => r.id)
    const { error } = await supabase
      .from('recipe_ingredients')
      .update({ spice_id: null, is_matched: false })
      .in('id', ids)
    
    if (error) {
      fixResult.errors.push(`Failed to fix orphaned spice refs: ${error.message}`)
    } else {
      fixResult.deletedOrphanedRefs += ids.length
      console.log(`   ✅ Cleared ${ids.length} orphaned spice_id references`)
    }
  }
  
  // 3. Fix incorrect is_matched flags
  if (result.incorrectMatchedFlags.length > 0) {
    for (const row of result.incorrectMatchedFlags) {
      const shouldBeMatched = row.is_spice 
        ? row.spice_id !== null 
        : row.ingredient_id !== null
      
      const { error } = await supabase
        .from('recipe_ingredients')
        .update({ is_matched: shouldBeMatched })
        .eq('id', row.id)
      
      if (error) {
        fixResult.errors.push(`Failed to fix is_matched for ${row.id}: ${error.message}`)
      } else {
        fixResult.fixedMatchedFlags++
      }
    }
    console.log(`   ✅ Fixed ${fixResult.fixedMatchedFlags} incorrect is_matched flags`)
  }
  
  return fixResult
}

// =============================================================================
// Auto-Match Function
// =============================================================================

async function autoMatchIngredients(
  result: AuditResult, 
  minScore: number = 90
): Promise<{ matched: number; skipped: number; errors: string[] }> {
  const matchResult = { matched: 0, skipped: 0, errors: [] as string[] }
  
  console.log(`\n   Looking for matches with score >= ${minScore}%...\n`)
  
  for (const { row, recipeName, possibleMatches } of result.unmatchedIngredients) {
    const bestMatch = possibleMatches[0]
    
    if (!bestMatch || bestMatch.score < minScore) {
      matchResult.skipped++
      continue
    }
    
    // Apply the match
    const updateData = row.is_spice
      ? { spice_id: bestMatch.id, is_matched: true }
      : { ingredient_id: bestMatch.id, is_matched: true }
    
    const { error } = await supabase
      .from('recipe_ingredients')
      .update(updateData)
      .eq('id', row.id)
    
    if (error) {
      matchResult.errors.push(`Failed to match "${row.raw_name}": ${error.message}`)
    } else {
      matchResult.matched++
      console.log(`   ✅ Matched "${row.raw_name}" → "${bestMatch.name}" (${bestMatch.score}%)`)
    }
  }
  
  return matchResult
}

// =============================================================================
// Populate Missing Function - Re-populate junction table from CSV
// =============================================================================

interface RecipeCsvRow {
  'Recipe Name': string
  'Ingredient': string
  'Quantity': string
  'Unit': string
  'Preparation Steps': string
  'breakfast': string // Column name is 'breakfast' but contains meal type
}

interface ParsedIngredient {
  raw_name: string
  quantity: number | null
  unit: string | null
}

interface GroupedRecipe {
  name: string
  ingredients: ParsedIngredient[]
}

interface RecipeIngredientInsert {
  recipe_id: string
  ingredient_id: string | null
  spice_id: string | null
  raw_name: string
  quantity: number | null
  unit: string | null
  is_spice: boolean
  is_optional: boolean
  is_matched: boolean
  sort_order: number
}

const PLACEHOLDER_RECIPE_NAMES = new Set(['recipe name', 'اسم الوصفة'])
const PLACEHOLDER_INGREDIENT_NAMES = new Set(['ingredient', 'المكون'])

function groupRecipeRowsFromCSV(rows: RecipeCsvRow[]): Map<string, GroupedRecipe> {
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
      })
    }

    const recipe = recipes.get(recipeName)!

    // Add ingredient
    const ingredientName = cleanText(row['Ingredient'])
    if (ingredientName && !PLACEHOLDER_INGREDIENT_NAMES.has(ingredientName.toLowerCase())) {
      // Parse quantity
      let quantity: number | null = null
      const qtyStr = row['Quantity']?.trim()
      if (qtyStr) {
        const parsed = parseFloat(qtyStr)
        if (!isNaN(parsed)) quantity = parsed
      }
      
      recipe.ingredients.push({
        raw_name: ingredientName,
        quantity,
        unit: cleanText(row['Unit']),
      })
    }
  }

  return recipes
}

// Spice detection patterns
const SPICE_PATTERNS = [
  /ملح|salt/i,
  /فلفل|pepper/i,
  /كمون|cumin/i,
  /بهارات|spice/i,
  /قرفة|cinnamon/i,
  /زعتر|thyme|oregano/i,
  /كركم|turmeric/i,
  /بابريكا|paprika/i,
  /كزبرة جافة|coriander.*dry/i,
  /روزماري|rosemary/i,
  /كاري|curry/i,
  /جنزبيل|ginger/i,
  /شطة|chili/i,
  /هيل|cardamom/i,
  /قرنفل|cloves/i,
  /ورق لورا|bay.*leaf/i,
]

function isLikelySpice(name: string): boolean {
  return SPICE_PATTERNS.some(pattern => pattern.test(name))
}

async function populateMissingRecipes(
  recipesWithNoIngredients: Recipe[]
): Promise<{ populated: number; skipped: number; errors: string[] }> {
  const result = { populated: 0, skipped: 0, errors: [] as string[] }
  
  if (recipesWithNoIngredients.length === 0) {
    console.log('   ✅ No recipes with missing ingredients to populate!')
    return result
  }
  
  console.log(`\n📂 Loading CSV data from: ${CSV_FILES.recipes}`)
  
  // Parse CSV
  let rows: RecipeCsvRow[]
  try {
    rows = parseCSV<RecipeCsvRow>(CSV_FILES.recipes)
  } catch (error) {
    result.errors.push(`Failed to parse CSV: ${error}`)
    return result
  }
  
  const groupedRecipes = groupRecipeRowsFromCSV(rows)
  console.log(`   Found ${groupedRecipes.size} recipes in CSV`)
  
  // Build lookups for ingredient/spice matching
  console.log('\n📊 Building lookup tables from database...')
  
  // Get all ingredients
  const { data: ingredients, error: ingredientsError } = await supabase
    .from('ingredients')
    .select('id, name, name_ar')
  
  if (ingredientsError) {
    result.errors.push(`Failed to load ingredients: ${ingredientsError.message}`)
    return result
  }
  
  // Get all spices
  const { data: spices, error: spicesError } = await supabase
    .from('spices')
    .select('id, name, name_ar, aliases')
  
  if (spicesError) {
    result.errors.push(`Failed to load spices: ${spicesError.message}`)
    return result
  }
  
  // Build ingredient lookup
  const ingredientLookup = new Map<string, { id: string; name: string }>()
  for (const ing of ingredients || []) {
    const ingData = { id: ing.id, name: ing.name }
    for (const key of createLookupVariants(ing.name)) {
      if (!ingredientLookup.has(key)) ingredientLookup.set(key, ingData)
    }
    if (ing.name_ar) {
      for (const key of createLookupVariants(ing.name_ar)) {
        if (!ingredientLookup.has(key)) ingredientLookup.set(key, ingData)
      }
    }
  }
  
  // Build spice lookup
  const spiceLookup = new Map<string, { id: string; name: string }>()
  for (const spice of spices || []) {
    const spiceData = { id: spice.id, name: spice.name }
    for (const key of createLookupVariants(spice.name)) {
      if (!spiceLookup.has(key)) spiceLookup.set(key, spiceData)
    }
    if (spice.name_ar) {
      for (const key of createLookupVariants(spice.name_ar)) {
        if (!spiceLookup.has(key)) spiceLookup.set(key, spiceData)
      }
    }
    for (const alias of spice.aliases || []) {
      for (const key of createLookupVariants(alias)) {
        if (!spiceLookup.has(key)) spiceLookup.set(key, spiceData)
      }
    }
  }
  
  console.log(`   Ingredient lookup: ${ingredientLookup.size} entries`)
  console.log(`   Spice lookup: ${spiceLookup.size} entries`)
  
  // Process each missing recipe
  console.log(`\n📝 Processing ${recipesWithNoIngredients.length} recipes with missing ingredients...\n`)
  
  for (const recipe of recipesWithNoIngredients) {
    const grouped = groupedRecipes.get(recipe.name)
    
    if (!grouped) {
      console.log(`   ⚠️  Recipe "${recipe.name}" not found in CSV - skipping`)
      result.skipped++
      continue
    }
    
    if (grouped.ingredients.length === 0) {
      console.log(`   ⚠️  Recipe "${recipe.name}" has no ingredients in CSV - skipping`)
      result.skipped++
      continue
    }
    
    // Build junction records
    const junctionRecords: RecipeIngredientInsert[] = []
    
    for (let i = 0; i < grouped.ingredients.length; i++) {
      const ing = grouped.ingredients[i]
      const lookupKeys = createLookupVariants(ing.raw_name)
      
      let ingredientId: string | null = null
      let spiceId: string | null = null
      let isSpice = isLikelySpice(ing.raw_name)
      let isMatched = false
      
      // Try to match - check spices first if it looks like a spice
      if (isSpice) {
        for (const key of lookupKeys) {
          const spice = spiceLookup.get(key)
          if (spice) {
            spiceId = spice.id
            isMatched = true
            break
          }
        }
        // If not found in spices, check ingredients
        if (!isMatched) {
          for (const key of lookupKeys) {
            const ingredient = ingredientLookup.get(key)
            if (ingredient) {
              ingredientId = ingredient.id
              isSpice = false
              isMatched = true
              break
            }
          }
        }
      } else {
        // Check ingredients first
        for (const key of lookupKeys) {
          const ingredient = ingredientLookup.get(key)
          if (ingredient) {
            ingredientId = ingredient.id
            isMatched = true
            break
          }
        }
        // If not found in ingredients, check spices
        if (!isMatched) {
          for (const key of lookupKeys) {
            const spice = spiceLookup.get(key)
            if (spice) {
              spiceId = spice.id
              isSpice = true
              isMatched = true
              break
            }
          }
        }
      }
      
      junctionRecords.push({
        recipe_id: recipe.id,
        ingredient_id: ingredientId,
        spice_id: spiceId,
        raw_name: ing.raw_name,
        quantity: isSpice ? null : ing.quantity, // Spices can't have quantity per constraint
        unit: isSpice ? null : ing.unit, // Also null unit for spices
        is_spice: isSpice,
        is_optional: false,
        is_matched: isMatched,
        sort_order: i + 1,
      })
    }
    
    // Insert junction records
    const { error } = await supabase
      .from('recipe_ingredients')
      .insert(junctionRecords)
    
    if (error) {
      console.log(`   ❌ Failed to insert ingredients for "${recipe.name}": ${error.message}`)
      result.errors.push(`Recipe "${recipe.name}": ${error.message}`)
    } else {
      const matchedCount = junctionRecords.filter(r => r.is_matched).length
      const unmatchedCount = junctionRecords.length - matchedCount
      console.log(`   ✅ ${recipe.name}: ${junctionRecords.length} ingredients (${matchedCount} matched, ${unmatchedCount} unmatched)`)
      result.populated++
    }
  }
  
  return result
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  const args = process.argv.slice(2)
  const shouldFix = args.includes('--fix')
  const shouldAutoMatch = args.includes('--auto-match')
  const shouldPopulateMissing = args.includes('--populate-missing')
  const verbose = args.includes('--verbose')
  
  // Get min score from args (default 90)
  const minScoreArg = args.find(a => a.startsWith('--min-score='))
  const minScore = minScoreArg ? parseInt(minScoreArg.split('=')[1], 10) : 90
  
  console.log('\n🔍 Recipe Ingredients Audit Script')
  console.log('═══════════════════════════════════════════════════════════════\n')
  
  if (shouldFix || shouldAutoMatch || shouldPopulateMissing) {
    console.log('⚠️  Running in FIX mode - changes will be applied!')
    if (shouldAutoMatch) {
      console.log(`   Auto-matching with min score: ${minScore}%`)
    }
    if (shouldPopulateMissing) {
      console.log('   Populating missing recipe ingredients from CSV')
    }
    console.log()
  } else {
    console.log('ℹ️  Running in DRY RUN mode - no changes will be made')
    console.log('   Use --fix to apply basic fixes')
    console.log('   Use --auto-match to auto-match high confidence items')
    console.log('   Use --populate-missing to populate junction table from CSV')
    console.log('   Use --min-score=80 to change the minimum match score (default: 90)')
    console.log()
  }
  
  try {
    // Run audit
    const result = await auditDatabase(verbose)
    
    // Print report
    printAuditReport(result, verbose)
    
    // Apply fixes if requested
    if (shouldFix) {
      const needsFixes = result.summary.orphanedRefs > 0 || result.summary.incorrectFlags > 0
      
      if (needsFixes) {
        console.log('═══════════════════════════════════════════════════════════════')
        console.log('                    APPLYING FIXES                              ')
        console.log('═══════════════════════════════════════════════════════════════\n')
        
        const fixResult = await applyFixes(result)
        
        if (fixResult.errors.length > 0) {
          console.log('\n❌ Errors during fix:')
          fixResult.errors.forEach(e => console.log(`   - ${e}`))
        }
        
        console.log('\n✅ Basic fixes complete!')
        console.log(`   Orphaned refs cleared: ${fixResult.deletedOrphanedRefs}`)
        console.log(`   Matched flags fixed: ${fixResult.fixedMatchedFlags}`)
      } else {
        console.log('✅ No basic fixes needed!')
      }
    }
    
    // Auto-match if requested
    if (shouldAutoMatch && result.unmatchedIngredients.length > 0) {
      console.log('\n═══════════════════════════════════════════════════════════════')
      console.log('                    AUTO-MATCHING                               ')
      console.log('═══════════════════════════════════════════════════════════════\n')
      
      const matchResult = await autoMatchIngredients(result, minScore)
      
      if (matchResult.errors.length > 0) {
        console.log('\n❌ Errors during auto-match:')
        matchResult.errors.forEach(e => console.log(`   - ${e}`))
      }
      
      console.log(`\n✅ Auto-match complete!`)
      console.log(`   Matched: ${matchResult.matched}`)
      console.log(`   Skipped (score < ${minScore}%): ${matchResult.skipped}`)
    }
    
    // Populate missing if requested
    if (shouldPopulateMissing && result.recipesWithNoIngredients.length > 0) {
      console.log('\n═══════════════════════════════════════════════════════════════')
      console.log('                 POPULATING MISSING INGREDIENTS                 ')
      console.log('═══════════════════════════════════════════════════════════════\n')
      
      const populateResult = await populateMissingRecipes(result.recipesWithNoIngredients)
      
      if (populateResult.errors.length > 0) {
        console.log('\n❌ Errors during populate:')
        populateResult.errors.slice(0, 10).forEach(e => console.log(`   - ${e}`))
        if (populateResult.errors.length > 10) {
          console.log(`   ... and ${populateResult.errors.length - 10} more errors`)
        }
      }
      
      console.log(`\n✅ Populate complete!`)
      console.log(`   Populated: ${populateResult.populated}`)
      console.log(`   Skipped (not in CSV): ${populateResult.skipped}`)
    }
    
    // Exit with appropriate code
    const hasIssues = result.summary.recipesWithNoIngredients > 0 || 
                      result.summary.orphanedRefs > 0 || 
                      result.summary.incorrectFlags > 0
    process.exit(hasIssues ? 1 : 0)
    
  } catch (error) {
    console.error('\n❌ Error:', error)
    process.exit(1)
  }
}

main()
