import type { MealSlot, ProfilePreferences } from '@/lib/types/nutri'

const CORE_REGULAR_MEALS = ['breakfast', 'lunch', 'dinner'] as const

const DEFAULT_REGULAR_STRUCTURES: Record<3 | 4 | 5, MealSlot[]> = {
  3: [
    { name: 'breakfast', label: 'Breakfast', percentage: 25 },
    { name: 'lunch', label: 'Lunch', percentage: 35 },
    { name: 'dinner', label: 'Dinner', percentage: 40 },
  ],
  4: [
    { name: 'breakfast', label: 'Breakfast', percentage: 25 },
    { name: 'lunch', label: 'Lunch', percentage: 35 },
    { name: 'afternoon', label: 'Afternoon Snack', percentage: 10 },
    { name: 'dinner', label: 'Dinner', percentage: 30 },
  ],
  5: [
    { name: 'breakfast', label: 'Breakfast', percentage: 20 },
    { name: 'mid_morning', label: 'Mid-Morning Snack', percentage: 10 },
    { name: 'lunch', label: 'Lunch', percentage: 30 },
    { name: 'afternoon', label: 'Afternoon Snack', percentage: 10 },
    { name: 'dinner', label: 'Dinner', percentage: 30 },
  ],
}

export function normalizeMealStructurePercentages(structure: MealSlot[] = []): MealSlot[] {
  const total = structure.reduce((sum, meal) => sum + (meal.percentage || 0), 0)
  if (total > 0 && total <= 1.5) {
    return structure.map((meal) => ({ ...meal, percentage: meal.percentage * 100 }))
  }
  return structure
}

export function buildRegularMealStructureFromCount(mealsPerDay: number): MealSlot[] {
  const normalizedCount: 3 | 4 | 5 = mealsPerDay === 5 ? 5 : mealsPerDay === 4 ? 4 : 3
  return DEFAULT_REGULAR_STRUCTURES[normalizedCount].map((slot) => ({ ...slot }))
}

export function getRegularMealStructure(preferences?: ProfilePreferences): MealSlot[] {
  const rawStructure = preferences?.meal_structure
  if (Array.isArray(rawStructure) && rawStructure.length > 0) {
    return normalizeMealStructurePercentages(rawStructure)
  }

  return buildRegularMealStructureFromCount(preferences?.meals_per_day || 3)
}

export function isCoreRegularMealSlot(slotName: string): boolean {
  return CORE_REGULAR_MEALS.includes(slotName as (typeof CORE_REGULAR_MEALS)[number])
}

export function getSnackSlotNamesFromStructure(mealStructure: MealSlot[]): string[] {
  return mealStructure.map((slot) => slot.name).filter((name) => !isCoreRegularMealSlot(name))
}

export function getSnackIndexForSlotName(slotName: string, mealStructure: MealSlot[]): number {
  const snackNames = getSnackSlotNamesFromStructure(mealStructure)
  return snackNames.indexOf(slotName)
}
