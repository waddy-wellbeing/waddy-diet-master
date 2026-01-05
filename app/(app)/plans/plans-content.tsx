'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { format, addDays, subDays } from 'date-fns'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, ChevronRight, Calendar, Clock, Flame, Beef, Wheat } from 'lucide-react'
import type { DailyPlanRecord, DailyPlan, PlanMealSlot } from '@/lib/types/nutri'

interface Recipe {
  id: string
  name: string
  image_url?: string
  prep_time_minutes?: number
  cook_time_minutes?: number
}

interface PlanContentProps {
  profile: any
  todayPlan?: DailyPlanRecord
  allPlans: DailyPlanRecord[]
  recipes: Map<string, Recipe>
  today: Date
}

export function PlanContent({
  profile,
  todayPlan,
  allPlans,
  recipes,
  today,
}: PlanContentProps) {
  const [selectedDate, setSelectedDate] = useState(today)
  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd')
  
  // Find plan for selected date
  const selectedPlan = allPlans.find(p => p.plan_date === selectedDateStr)
  
  // Get user targets
  const dailyCalories = profile?.targets?.daily_calories || 2000
  const dailyProtein = profile?.targets?.protein_g || 150
  const dailyCarbs = profile?.targets?.carbs_g || 250
  const dailyFat = profile?.targets?.fat_g || 65

  const mealLabels: Record<string, string> = {
    breakfast: '🥞 Breakfast',
    lunch: '🍽️ Lunch',
    dinner: '🍖 Dinner',
    snacks: '🍎 Snacks',
  }

  const renderMealCard = (mealType: string, meal: any) => {
    if (!meal) return null

    const recipeId = meal.recipe_id || meal.id
    const recipe = recipes.get(recipeId)
    const servings = meal.servings || 1

    return (
      <Card key={mealType} className="overflow-hidden hover:shadow-lg transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg">{mealLabels[mealType]}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {recipe?.name || 'Unknown Recipe'}
              </p>
            </div>
            {meal.swapped && (
              <Badge variant="secondary" className="ml-2">Swapped</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Recipe Details */}
          {recipe && (
            <div className="space-y-2">
              {recipe.image_url && (
                <img
                  src={recipe.image_url}
                  alt={recipe.name}
                  className="w-full h-40 object-cover rounded-lg"
                />
              )}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {recipe.prep_time_minutes && (
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>{recipe.prep_time_minutes} min</span>
                  </div>
                )}
                {recipe.cook_time_minutes && (
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>{recipe.cook_time_minutes} min cook</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Nutrition Info */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Servings:</span>
              <span className="font-medium">{servings}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <Flame className="w-4 h-4" /> Calories
              </span>
              <span className="font-medium">{((selectedPlan?.daily_totals?.calories || 0) / (mealType === 'snacks' ? 1 : 4)).toFixed(0)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <Beef className="w-4 h-4" /> Protein
              </span>
              <span className="font-medium">{((selectedPlan?.daily_totals?.protein_g || 0) / (mealType === 'snacks' ? 1 : 4)).toFixed(0)}g</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <Wheat className="w-4 h-4" /> Carbs
              </span>
              <span className="font-medium">{((selectedPlan?.daily_totals?.carbs_g || 0) / (mealType === 'snacks' ? 1 : 4)).toFixed(0)}g</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild className="flex-1">
              <Link href={`/meal-builder?meal=${mealType}`}>
                Swap
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild className="flex-1">
              <Link href={`/recipes/${recipeId}`}>
                View Recipe
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Meal Plans</h1>
        <p className="text-muted-foreground mt-1">
          View and customize your personalized meal plans
        </p>
      </div>

      {/* Date Navigation */}
      <Card className="bg-gradient-to-r from-lime-50 to-transparent dark:from-lime-950/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedDate(subDays(selectedDate, 1))}
              className="h-10 w-10 p-0"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>

            <div className="flex-1 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Calendar className="w-5 h-5 text-lime-600 dark:text-lime-400" />
                <h2 className="text-2xl font-bold">
                  {format(selectedDate, 'EEEE')}
                </h2>
              </div>
              <p className="text-sm text-muted-foreground">
                {format(selectedDate, 'MMMM d, yyyy')}
              </p>
              {selectedDateStr === format(today, 'yyyy-MM-dd') && (
                <Badge className="mt-2 bg-lime-600">Today</Badge>
              )}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedDate(addDays(selectedDate, 1))}
              className="h-10 w-10 p-0"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Daily Summary */}
      {selectedPlan ? (
        <>
          {/* Nutrition Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Calories
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Math.round(selectedPlan?.daily_totals?.calories || 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Target: {dailyCalories}
                </p>
                <div className="w-full bg-muted rounded-full h-1.5 mt-2">
                  <div
                    className="bg-lime-600 h-1.5 rounded-full transition-all"
                    style={{
                      width: `${Math.min(((selectedPlan?.daily_totals?.calories || 0) / dailyCalories) * 100, 100)}%`,
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Protein
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Math.round(selectedPlan?.daily_totals?.protein_g || 0)}g
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Target: {dailyProtein}g
                </p>
                <div className="w-full bg-muted rounded-full h-1.5 mt-2">
                  <div
                    className="bg-blue-600 h-1.5 rounded-full transition-all"
                    style={{
                      width: `${Math.min(((selectedPlan?.daily_totals?.protein_g || 0) / dailyProtein) * 100, 100)}%`,
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Carbs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Math.round(selectedPlan?.daily_totals?.carbs_g || 0)}g
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Target: {dailyCarbs}g
                </p>
                <div className="w-full bg-muted rounded-full h-1.5 mt-2">
                  <div
                    className="bg-amber-600 h-1.5 rounded-full transition-all"
                    style={{
                      width: `${Math.min(((selectedPlan?.daily_totals?.carbs_g || 0) / dailyCarbs) * 100, 100)}%`,
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Fat
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Math.round(selectedPlan?.daily_totals?.fat_g || 0)}g
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Target: {dailyFat}g
                </p>
                <div className="w-full bg-muted rounded-full h-1.5 mt-2">
                  <div
                    className="bg-red-600 h-1.5 rounded-full transition-all"
                    style={{
                      width: `${Math.min(((selectedPlan?.daily_totals?.fat_g || 0) / dailyFat) * 100, 100)}%`,
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Meals */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Today's Meals</h3>
            <div className="grid gap-4 md:grid-cols-2">
              {selectedPlan.plan.breakfast && renderMealCard('breakfast', selectedPlan.plan.breakfast)}
              {selectedPlan.plan.lunch && renderMealCard('lunch', selectedPlan.plan.lunch)}
              {selectedPlan.plan.dinner && renderMealCard('dinner', selectedPlan.plan.dinner)}
              {selectedPlan.plan.snacks && selectedPlan.plan.snacks.length > 0 && (
                renderMealCard('snacks', selectedPlan.plan.snacks[0])
              )}
            </div>
          </div>

          {/* Build Meal Button */}
          {selectedDateStr === format(today, 'yyyy-MM-dd') && (
            <Button asChild size="lg" className="w-full">
              <Link href="/meal-builder">
                Build Today's Meals
              </Link>
            </Button>
          )}
        </>
      ) : (
        /* No Plan Message */
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No Plan for This Day</h3>
            <p className="text-sm text-muted-foreground text-center mb-6 max-w-sm">
              {selectedDateStr === format(today, 'yyyy-MM-dd')
                ? "You haven't created a meal plan for today yet. Create one now!"
                : 'No meal plan exists for this date.'}
            </p>
            <Button asChild>
              <Link href="/meal-builder">Create Meal Plan</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Recent Plans */}
      {allPlans.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Recent Plans</h3>
          <div className="grid gap-3">
            {allPlans.slice(0, 5).map(plan => (
              <Card
                key={plan.plan_date}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  plan.plan_date === selectedDateStr ? 'ring-2 ring-lime-600' : ''
                }`}
                onClick={() => setSelectedDate(new Date(plan.plan_date + 'T00:00:00'))}
              >
                <CardContent className="flex items-center justify-between pt-6">
                  <div>
                    <p className="font-medium">{format(new Date(plan.plan_date + 'T00:00:00'), 'EEEE, MMMM d')}</p>
                    <p className="text-sm text-muted-foreground">
                      {Object.keys(plan.plan).length} meals planned
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-lg">
                      {Math.round(plan.daily_totals?.calories || 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">kcal</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
