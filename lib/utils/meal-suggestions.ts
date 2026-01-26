/**
 * Meal Suggestions Utility
 * 
 * Generates deterministic but different meal suggestions for each unplanned day.
 * Uses the date as a seed to ensure:
 * 1. Each unplanned day shows DIFFERENT suggested meals
 * 2. Revisiting the same unplanned day shows the SAME suggestions (consistent)
 */

/**
 * Simple hash function to convert date string to a number
 */
function hashDate(dateStr: string): number {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    const char = dateStr.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Generate a pseudo-random number based on seed
 */
function seededRandom(seed: number, index: number): number {
  const x = Math.sin(seed + index * 1000) * 10000;
  return x - Math.floor(x);
}

/**
 * Get suggested recipe index for a specific meal type on a specific date
 * 
 * @param dateStr - Date string in 'yyyy-MM-dd' format
 * @param mealType - The meal type (breakfast, lunch, dinner, snacks)
 * @param recipeCount - Total number of available recipes for this meal type
 * @returns Index of the suggested recipe (0 to recipeCount-1)
 */
export function getSuggestedRecipeIndex(
  dateStr: string,
  mealType: string,
  recipeCount: number
): number {
  if (recipeCount <= 0) return 0;
  if (recipeCount === 1) return 0;
  
  // Create a unique seed for this date + meal combination
  const mealTypeOffset = {
    breakfast: 0,
    lunch: 100,
    dinner: 200,
    snacks: 300,
  }[mealType] || 0;
  
  const seed = hashDate(dateStr) + mealTypeOffset;
  const random = seededRandom(seed, 1);
  
  return Math.floor(random * recipeCount);
}

/**
 * Get all suggested recipe indices for a date
 * 
 * @param dateStr - Date string in 'yyyy-MM-dd' format  
 * @param recipeCounts - Object with recipe counts per meal type
 * @returns Object with suggested indices per meal type
 */
export function getSuggestedIndicesForDate(
  dateStr: string,
  recipeCounts: Record<string, number>
): Record<string, number> {
  const indices: Record<string, number> = {};
  
  for (const [mealType, count] of Object.entries(recipeCounts)) {
    indices[mealType] = getSuggestedRecipeIndex(dateStr, mealType, count);
  }
  
  return indices;
}
