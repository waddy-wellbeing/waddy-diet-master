/**
 * Fasting Mode Meal Templates
 * 
 * Defines meal structures for fasting mode with different meal counts.
 * Mirrors the logic from regular meal templates in lib/actions/users.ts
 */

import type { MealSlot } from '@/lib/types/nutri';

/**
 * Fasting meal template configurations
 * 
 * Percentage Constraints:
 * - pre-iftar: Not exceed 10% (light meal to break fast with dates, soup, or water)
 * - iftar: 25%-45% range (main breaking-fast meal)
 * - full-meal-taraweeh: 25%-30% range (complete balanced meal after Taraweeh prayer)
 * - snack-taraweeh: 15%-20% range (light snack after Taraweeh)
 * - suhoor: 25%-45% range (pre-dawn meal before fasting begins)
 * 
 * Supports 1-5 meals with flexible combinations
 * Note: Percentages must sum to exactly 100%
 */
export const FASTING_TEMPLATES: Record<number, MealSlot[]> = {
    // 1 Meal: Single meal (any meal gets 100%)
    1: [
        { name: 'iftar', label: 'Iftar', percentage: 100 },
    ],

    // 2 Meals: Two meals split
    2: [
        { name: 'iftar', label: 'Iftar', percentage: 50 },
        { name: 'suhoor', label: 'Suhoor', percentage: 50 },
    ],

    // 3 Meals: Standard fasting (Pre-Iftar + Iftar + Suhoor)
    3: [
        { name: 'pre-iftar', label: 'Pre-Iftar', percentage: 10 },
        { name: 'iftar', label: 'Iftar', percentage: 45 },
        { name: 'suhoor', label: 'Suhoor', percentage: 45 },
    ],

    // 4 Meals: Add snack after Taraweeh
    4: [
        { name: 'pre-iftar', label: 'Pre-Iftar', percentage: 10 },
        { name: 'iftar', label: 'Iftar', percentage: 40 },
        { name: 'snack-taraweeh', label: 'Snack (After Taraweeh)', percentage: 15 },
        { name: 'suhoor', label: 'Suhoor', percentage: 35 },
    ],

    // 5 Meals: Add full meal after Taraweeh (maximum)
    5: [
        { name: 'pre-iftar', label: 'Pre-Iftar', percentage: 10 },
        { name: 'iftar', label: 'Iftar', percentage: 30 },
        { name: 'snack-taraweeh', label: 'Snack (After Taraweeh)', percentage: 15 },
        { name: 'full-meal-taraweeh', label: 'Full Meal (After Taraweeh)', percentage: 20 },
        { name: 'suhoor', label: 'Suhoor', percentage: 25 },
    ],
};

/**
 * Available fasting meal options for checklist selection
 * User can select which meals to include (1-6 meals)
 */
export const FASTING_MEAL_OPTIONS = [
    {
        value: 'pre-iftar',
        label: 'Pre-Iftar (Breaking Fast)',
        label_ar: 'كسر صيام',
        description: 'Light meal with dates, soup, or water',
        percentage_range: 'Not exceed 10%',
        is_recommended: true,
    },
    {
        value: 'iftar',
        label: 'Iftar (Main Meal)',
        label_ar: 'إفطار',
        description: 'Main breaking-fast meal',
        percentage_range: '25-45%',
        is_recommended: true,
        is_required: true, // Must be selected
    },
    {
        value: 'full-meal-taraweeh',
        label: 'Full Meal (After Taraweeh)',
        label_ar: 'وجبه متكامله بعد صلاة التراويح',
        description: 'Complete balanced meal after Taraweeh prayer',
        percentage_range: '25-30%',
        is_recommended: false,
    },
    {
        value: 'snack-taraweeh',
        label: 'Snack (After Taraweeh)',
        label_ar: 'سناك بعد صلاة التراويح',
        description: 'Late evening snack before sleep',
        percentage_range: '15-20%',
        is_recommended: false,
    },
    {
        value: 'suhoor',
        label: 'Suhoor (Pre-Dawn)',
        label_ar: 'سحور',
        description: 'Pre-dawn meal before fasting begins',
        percentage_range: '25-45%',
        is_recommended: true,
        is_required: true, // Must be selected
    },
] as const;

/**
 * Get fasting meal template based on number of meals
 * 
 * @param mealsPerDay - Number of meals (2-5)
 * @returns Array of MealSlot objects or null if invalid count
 */
export function getFastingTemplate(mealsPerDay: number): MealSlot[] | null {
    return FASTING_TEMPLATES[mealsPerDay] || null;
}

/**
 * Validate that percentages in a template sum to 100%
 * 
 * @param template - Array of MealSlot objects
 * @returns true if valid, false otherwise
 */
export function validateFastingTemplate(template: MealSlot[]): boolean {
    const totalPercentage = template.reduce((sum, meal) => sum + meal.percentage, 0);
    return Math.abs(totalPercentage - 100) < 0.01; // Allow tiny floating point errors
}

/**
 * Build custom fasting template from selected meal names
 * This will be used when user selects meals via checklist
 * 
 * @param selectedMeals - Array of meal names selected by user
 * @returns Custom MealSlot array with balanced percentages
 */
export function buildCustomFastingTemplate(selectedMeals: string[]): MealSlot[] | null {
    // Get base meals from options
    const selectedOptions = FASTING_MEAL_OPTIONS.filter(opt =>
        selectedMeals.includes(opt.value)
    );

    if (selectedOptions.length < 1 || selectedOptions.length > 5) {
        return null; // Invalid meal count (1-5 meals allowed)
    }

    // Use predefined template if it matches selected count
    const predefinedTemplate = FASTING_TEMPLATES[selectedOptions.length];
    if (predefinedTemplate) {
        // Check if selected meals match predefined template
        const predefinedMealNames = predefinedTemplate.map(m => m.name).sort();
        const selectedMealNames = selectedMeals.sort();
        const isExactMatch = predefinedMealNames.length === selectedMealNames.length &&
            predefinedMealNames.every((name, index) => name === selectedMealNames[index]);

        if (isExactMatch) {
            return predefinedTemplate;
        }
    }

    // Build custom template with balanced percentages
    // TODO: Implement smart percentage distribution based on meal types
    // For now, return null to force using predefined templates
    return null;
}

/**
 * Percentage constraints for each fasting meal type
 * Used for validation when creating custom meal structures
 */
export const FASTING_MEAL_CONSTRAINTS = {
    'pre-iftar': { max: 10 },
    'iftar': { min: 25, max: 45 },
    'snack-taraweeh': { min: 15, max: 20 },
    'full-meal-taraweeh': { min: 25, max: 30 },
    'suhoor': { min: 25, max: 45 },
} as const;

/**
 * Generate fasting meal plan based on selected meals and total calories
 * Automatically calculates percentages and target calories for each meal
 * 
 * @param selectedMeals - Array of meal names to include (must contain 'iftar' and 'suhoor')
 * @param dailyCalories - Total daily calorie target
 * @returns Array of MealSlot with calculated calories or null if invalid
 */
export function generateFastingPlan(
    selectedMeals: string[],
    dailyCalories: number
): MealSlot[] | null {
    const template = buildCustomFastingTemplate(selectedMeals);
    if (!template) return null;

    // Calculate target calories for each meal
    return template.map(meal => ({
        ...meal,
        target_calories: Math.round(dailyCalories * (meal.percentage / 100)),
    }));
}

/**
 * Get all available fasting meal counts with descriptions
 * Useful for UI selection
 */
export const FASTING_MEAL_COUNT_OPTIONS = [
    { value: 1, label: '1 Meal', description: 'Single meal (any meal)' },
    { value: 2, label: '2 Meals', description: 'Two meals combination' },
    { value: 3, label: '3 Meals', description: 'Three meals combination' },
    { value: 4, label: '4 Meals', description: 'Add snack after Taraweeh' },
    { value: 5, label: '5 Meals', description: 'Add full meal after Taraweeh (maximum)' },
] as const;
