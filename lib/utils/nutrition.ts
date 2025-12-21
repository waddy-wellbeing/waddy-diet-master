/**
 * Nutrition Utilities
 * 
 * Utilities for calculating macro percentages, similarity scores,
 * and nutritional comparisons for recipe alternatives and ingredient swaps.
 */

export interface MacroProfile {
  protein_pct: number
  carbs_pct: number
  fat_pct: number
}

export interface MacroValues {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

export interface MacroSimilarityWeights {
  protein: number
  carbs: number
  fat: number
}

/**
 * Calculate macro percentages from absolute values
 * 
 * Converts grams of protein, carbs, and fat to percentage of total calories.
 * Uses 4 cal/g for protein and carbs, 9 cal/g for fat.
 * 
 * @param macros - Absolute macro values in grams and total calories
 * @returns Macro percentages (0-100) that sum to approximately 100%
 * 
 * @example
 * const macros = { calories: 500, protein_g: 40, carbs_g: 50, fat_g: 15 }
 * const percentages = calculateMacroPercentages(macros)
 * // Returns: { protein_pct: 32, carbs_pct: 40, fat_pct: 27 }
 */
export function calculateMacroPercentages(macros: MacroValues): MacroProfile {
  const { calories, protein_g, carbs_g, fat_g } = macros
  
  // Avoid division by zero
  if (!calories || calories <= 0) {
    return { protein_pct: 0, carbs_pct: 0, fat_pct: 0 }
  }
  
  // Calculate calories from each macro
  const proteinCalories = protein_g * 4
  const carbsCalories = carbs_g * 4
  const fatCalories = fat_g * 9
  
  // Convert to percentages
  const protein_pct = Math.round((proteinCalories / calories) * 100)
  const carbs_pct = Math.round((carbsCalories / calories) * 100)
  const fat_pct = Math.round((fatCalories / calories) * 100)
  
  return { protein_pct, carbs_pct, fat_pct }
}

/**
 * Calculate similarity score between two macro profiles
 * 
 * Compares two macro profiles and returns a score from 0-100:
 * - 100 = Identical macro distribution
 * - 80+ = Very similar (excellent swap)
 * - 60+ = Similar (good swap)
 * - 40+ = Somewhat similar (acceptable swap)
 * - <40 = Different (poor swap)
 * 
 * Default weights prioritize protein (50%), then carbs (30%), then fat (20%).
 * This reflects typical fitness/health goals where protein is most important.
 * 
 * @param original - Original recipe/ingredient macro profile
 * @param alternative - Alternative recipe/ingredient macro profile
 * @param weights - Optional custom weights (must sum to 1.0)
 * @returns Similarity score from 0-100
 * 
 * @example
 * const original = { protein_pct: 30, carbs_pct: 40, fat_pct: 30 }
 * const alternative = { protein_pct: 32, carbs_pct: 38, fat_pct: 30 }
 * const score = calculateMacroSimilarity(original, alternative)
 * // Returns: ~96 (excellent match)
 */
export function calculateMacroSimilarity(
  original: MacroProfile,
  alternative: MacroProfile,
  weights: MacroSimilarityWeights = { protein: 0.5, carbs: 0.3, fat: 0.2 }
): number {
  // Calculate absolute differences
  const proteinDiff = Math.abs(original.protein_pct - alternative.protein_pct)
  const carbsDiff = Math.abs(original.carbs_pct - alternative.carbs_pct)
  const fatDiff = Math.abs(original.fat_pct - alternative.fat_pct)
  
  // Convert differences to similarity scores (100 = identical, 0 = very different)
  // Using exponential decay for more intuitive scoring:
  // - 0% diff = 100 points
  // - 5% diff = ~92 points
  // - 10% diff = ~78 points
  // - 15% diff = ~61 points
  // - 20% diff = ~45 points
  const proteinScore = Math.max(0, 100 - (proteinDiff * 1.5))
  const carbsScore = Math.max(0, 100 - (carbsDiff * 1.5))
  const fatScore = Math.max(0, 100 - (fatDiff * 1.5))
  
  // Calculate weighted average
  const totalScore = 
    (proteinScore * weights.protein) + 
    (carbsScore * weights.carbs) + 
    (fatScore * weights.fat)
  
  // Round to integer
  return Math.round(totalScore)
}

/**
 * Classify macro profile type for labeling/filtering
 * 
 * Categorizes a recipe/ingredient based on its dominant macronutrient:
 * - High Protein: >35% calories from protein
 * - High Carb: >50% calories from carbs
 * - High Fat: >40% calories from fat
 * - Balanced: No single macro dominates
 * 
 * @param profile - Macro percentages
 * @returns Profile type label
 * 
 * @example
 * const profile = { protein_pct: 40, carbs_pct: 30, fat_pct: 30 }
 * const type = classifyMacroProfile(profile)
 * // Returns: 'high-protein'
 */
export function classifyMacroProfile(profile: MacroProfile): 
  'high-protein' | 'high-carb' | 'high-fat' | 'balanced' {
  const { protein_pct, carbs_pct, fat_pct } = profile
  
  if (protein_pct > 35) return 'high-protein'
  if (carbs_pct > 50) return 'high-carb'
  if (fat_pct > 40) return 'high-fat'
  return 'balanced'
}

/**
 * Get swap quality rating based on similarity score
 * 
 * Converts numerical similarity score to qualitative rating for UI display.
 * 
 * @param score - Similarity score (0-100)
 * @returns Quality rating
 */
export function getSwapQuality(score: number): 'excellent' | 'good' | 'acceptable' | 'poor' {
  if (score >= 80) return 'excellent'
  if (score >= 60) return 'good'
  if (score >= 40) return 'acceptable'
  return 'poor'
}

/**
 * Format macro profile for display
 * 
 * Creates a human-readable string representation of macro percentages.
 * 
 * @param profile - Macro percentages
 * @returns Formatted string (e.g., "P:30% C:40% F:30%")
 */
export function formatMacroProfile(profile: MacroProfile): string {
  return `P:${profile.protein_pct}% C:${profile.carbs_pct}% F:${profile.fat_pct}%`
}

/**
 * Calculate protein difference in grams between two recipes
 * 
 * Used to show users how much more/less protein they'll get with an alternative.
 * Accounts for serving size scaling.
 * 
 * @param originalProtein - Original recipe protein (g)
 * @param alternativeProtein - Alternative recipe protein (g)
 * @param alternativeScaleFactor - Scale factor applied to alternative
 * @returns Protein difference in grams (positive = more, negative = less)
 */
export function calculateProteinDifference(
  originalProtein: number,
  alternativeProtein: number,
  alternativeScaleFactor: number
): number {
  const scaledAlternativeProtein = alternativeProtein * alternativeScaleFactor
  return Math.round((scaledAlternativeProtein - originalProtein) * 10) / 10
}
