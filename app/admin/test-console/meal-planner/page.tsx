'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { 
  ArrowLeft, 
  CalendarDays, 
  UtensilsCrossed, 
  RefreshCw, 
  ChevronRight,
  Clock,
  Scale,
  AlertCircle,
  CheckCircle2,
  Filter,
  Search,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { generateTestMealPlan, searchUsersForTestConsole, type RecipeForMealPlan } from '@/lib/actions/test-console'
import type { MealSlot } from '@/lib/types/nutri'

// Default meal structures
// User-facing meal types: breakfast, lunch, dinner, snacks
// Snacks can appear multiple times in a day with different labels
const MEAL_TEMPLATES: Record<string, MealSlot[]> = {
  '3_meals': [
    { name: 'breakfast', percentage: 0.30, target_calories: 0 },
    { name: 'lunch', percentage: 0.40, target_calories: 0 },
    { name: 'dinner', percentage: 0.30, target_calories: 0 },
  ],
  '3_meals_1_snack': [
    { name: 'breakfast', percentage: 0.25, target_calories: 0 },
    { name: 'lunch', percentage: 0.35, target_calories: 0 },
    { name: 'snack', percentage: 0.10, target_calories: 0 },
    { name: 'dinner', percentage: 0.30, target_calories: 0 },
  ],
  '3_meals_2_snacks': [
    { name: 'breakfast', percentage: 0.25, target_calories: 0 },
    { name: 'snack_1', percentage: 0.10, target_calories: 0 },
    { name: 'lunch', percentage: 0.30, target_calories: 0 },
    { name: 'snack_2', percentage: 0.10, target_calories: 0 },
    { name: 'dinner', percentage: 0.25, target_calories: 0 },
  ],
  '4_meals': [
    { name: 'breakfast', percentage: 0.25, target_calories: 0 },
    { name: 'lunch', percentage: 0.30, target_calories: 0 },
    { name: 'snack', percentage: 0.15, target_calories: 0 },
    { name: 'dinner', percentage: 0.30, target_calories: 0 },
  ],
  '3_meals_3_snacks': [
    { name: 'breakfast', percentage: 0.20, target_calories: 0 },
    { name: 'snack_1', percentage: 0.10, target_calories: 0 },
    { name: 'lunch', percentage: 0.25, target_calories: 0 },
    { name: 'snack_2', percentage: 0.10, target_calories: 0 },
    { name: 'dinner', percentage: 0.25, target_calories: 0 },
    { name: 'snack_3', percentage: 0.10, target_calories: 0 },
  ],
}

const MEAL_SLOT_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
  snack_1: 'Snack 1',
  snack_2: 'Snack 2',
  snack_3: 'Snack 3',
}

interface MealPlanResult {
  slot: MealSlot
  recipe: RecipeForMealPlan | null
  alternativeCount: number
}

interface TestConsoleUser {
  id: string
  name: string | null
  email: string | null
  mobile?: string | null
  daily_calories?: number | null
  meal_structure?: MealSlot[] | null
}

export default function MealPlannerPage() {
  const searchParams = useSearchParams()

  const [dailyCalories, setDailyCalories] = useState(2000)
  const [selectedTemplate, setSelectedTemplate] = useState('3_meals_2_snacks')
  const [dietaryFilters, setDietaryFilters] = useState({
    vegetarian: false,
    vegan: false,
    gluten_free: false,
    dairy_free: false,
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSearching, startSearching] = useTransition()
  const [mealPlan, setMealPlan] = useState<MealPlanResult[] | null>(null)
  const [totalCalories, setTotalCalories] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [userQuery, setUserQuery] = useState('')
  const [userResults, setUserResults] = useState<TestConsoleUser[]>([])
  const [selectedUser, setSelectedUser] = useState<TestConsoleUser | null>(null)
  const [customStructure, setCustomStructure] = useState<MealSlot[] | null>(null)

  const activeStructure = customStructure || MEAL_TEMPLATES[selectedTemplate]

  const handleSearchUser = (query?: string) => {
    const q = (query ?? userQuery).trim()
    if (!q) return
    startSearching(async () => {
      const { users, error: searchError } = await searchUsersForTestConsole(q)
      setUserResults(users)
      if (searchError) setError(searchError)
    })
  }

  const handleSelectUser = (user: TestConsoleUser) => {
    setSelectedUser(user)
    setDailyCalories(user.daily_calories || 2000)
    if (user.meal_structure && user.meal_structure.length > 0) {
      setCustomStructure(user.meal_structure.map(slot => ({
        ...slot,
        target_calories: Math.round((user.daily_calories || 2000) * slot.percentage),
      })))
    }
    setMealPlan(null)
    setError(null)
    setUserResults([]) // Clear search results
  }

  useEffect(() => {
    const preset = searchParams.get('user')
    if (preset) {
      setUserQuery(preset)
      handleSearchUser(preset)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  useEffect(() => {
    // Update target_calories when daily calories change, but only if using custom structure
    if (customStructure && selectedUser) {
      setCustomStructure(prev => prev?.map(slot => ({
        ...slot,
        target_calories: Math.round(dailyCalories * slot.percentage),
      })) || null)
    }
  }, [dailyCalories, selectedUser])

  const handleGenerate = async () => {
    setIsGenerating(true)
    setError(null)
    
    const mealStructure = activeStructure
    
    const { data, totalCalories: total, error: err } = await generateTestMealPlan({
      dailyCalories,
      mealStructure,
      dietaryFilters: Object.entries(dietaryFilters).some(([, v]) => v) 
        ? dietaryFilters 
        : undefined,
    })

    if (err) {
      setError(err)
      setMealPlan(null)
    } else {
      setMealPlan(data)
      setTotalCalories(total)
    }
    
    setIsGenerating(false)
  }

  const calorieVariance = mealPlan ? totalCalories - dailyCalories : 0
  const variancePercent = mealPlan ? Math.round((calorieVariance / dailyCalories) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/test-console">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Meal Plan Preview</h1>
          <p className="text-muted-foreground">
            Test meal plan generation with different calorie targets and structures
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Load User Context
          </CardTitle>
          <CardDescription>Search by email, name, or mobile to preload calories and meal structure.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col md:flex-row gap-3">
            <Input
              placeholder="Enter email, name, or mobile..."
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearchUser()
              }}
            />
            <Button onClick={() => handleSearchUser()} disabled={isSearching}>
              {isSearching ? 'Searching...' : 'Search User'}
            </Button>
          </div>

          {selectedUser && (
            <div className="rounded-md bg-primary/5 px-3 py-2 text-sm flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="font-medium">{selectedUser.name || 'Unnamed'} ({selectedUser.email || selectedUser.mobile || selectedUser.id})</div>
                <div className="text-muted-foreground">Calories: {selectedUser.daily_calories || '—'} • Structure: {selectedUser.meal_structure?.length || '—'} slots</div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setSelectedUser(null); setCustomStructure(null); setUserResults([]); }}>
                Clear
              </Button>
            </div>
          )}

          {userResults.length > 0 && (
            <div className="border rounded-md divide-y">
              {userResults.map((user) => (
                <button
                  key={user.id}
                  className="w-full text-left px-3 py-2 hover:bg-muted"
                  onClick={() => handleSelectUser(user)}
                >
                  <div className="font-medium">{user.name || 'Unnamed User'}</div>
                  <div className="text-xs text-muted-foreground flex gap-2">
                    <span>{user.email || 'No email'}</span>
                    {user.mobile && <span>• {user.mobile}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Calories: {user.daily_calories || '—'} | Structure: {user.meal_structure?.length || '—'} slots
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Config Panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                Plan Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="calories">Daily Calorie Target</Label>
                <Input
                  id="calories"
                  type="number"
                  min={1200}
                  max={5000}
                  step={50}
                  value={dailyCalories}
                  onChange={(e) => setDailyCalories(parseInt(e.target.value) || 2000)}
                />
              </div>

              <div className="space-y-2">
                <Label>Meal Structure</Label>
                {selectedUser && customStructure ? (
                  <div className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm items-center text-muted-foreground">
                    {customStructure.length} meals ({customStructure.map(s => Math.round(s.percentage * 100) + '%').join(', ')})
                  </div>
                ) : (
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={selectedTemplate}
                    onChange={(e) => setSelectedTemplate(e.target.value)}
                  >
                    <option value="3_meals">3 Meals</option>
                    <option value="3_meals_1_snack">3 Meals + 1 Snack</option>
                    <option value="3_meals_2_snacks">3 Meals + 2 Snacks</option>
                    <option value="4_meals">4 Meals (3 + 1 Snack)</option>
                    <option value="3_meals_3_snacks">3 Meals + 3 Snacks</option>
                  </select>
                )}
                {selectedUser && customStructure && (
                  <p className="text-xs text-muted-foreground">Using user's saved structure</p>
                )}
              </div>

              {/* Meal breakdown preview */}
              <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                <div className="text-sm font-medium">Calorie Distribution</div>
                {activeStructure.map(slot => (
                  <div key={slot.name} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{MEAL_SLOT_LABELS[slot.name] || slot.name}</span>
                    <span className="font-mono">
                      {Math.round(dailyCalories * slot.percentage)} kcal ({Math.round(slot.percentage * 100)}%)
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Dietary Filters
              </CardTitle>
              <CardDescription>
                Filter recipes by dietary restrictions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { key: 'vegetarian', label: 'Vegetarian' },
                { key: 'vegan', label: 'Vegan' },
                { key: 'gluten_free', label: 'Gluten-Free' },
                { key: 'dairy_free', label: 'Dairy-Free' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={dietaryFilters[key as keyof typeof dietaryFilters]}
                    onChange={(e) => setDietaryFilters(prev => ({ ...prev, [key]: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </CardContent>
          </Card>

          <Button 
            onClick={handleGenerate} 
            className="w-full" 
            size="lg"
            disabled={isGenerating}
          >
            {isGenerating ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <UtensilsCrossed className="h-4 w-4 mr-2" />
            )}
            Generate Meal Plan
          </Button>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-2 space-y-4">
          {error && (
            <Card className="border-destructive">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  <span>{error}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {mealPlan && (
            <>
              {/* Summary */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-muted-foreground">Total Plan Calories</div>
                      <div className="text-3xl font-bold">{totalCalories} kcal</div>
                    </div>
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
                      Math.abs(variancePercent) <= 5 
                        ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400'
                        : Math.abs(variancePercent) <= 10
                        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
                    }`}>
                      {Math.abs(variancePercent) <= 5 ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <AlertCircle className="h-4 w-4" />
                      )}
                      <span className="text-sm font-medium">
                        {calorieVariance >= 0 ? '+' : ''}{calorieVariance} kcal ({variancePercent >= 0 ? '+' : ''}{variancePercent}%)
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Meal Cards */}
              <div className="space-y-3">
                {mealPlan.map(({ slot, recipe, alternativeCount }) => (
                  <Card key={slot.name}>
                    <CardContent className="pt-6">
                      <div className="flex gap-4">
                        {/* Meal slot info */}
                        <div className="w-24 flex-shrink-0">
                          <div className="font-medium">{MEAL_SLOT_LABELS[slot.name] || slot.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {slot.target_calories} kcal
                          </div>
                          <div className="text-xs text-muted-foreground">
                            target
                          </div>
                        </div>

                        {/* Recipe */}
                        {recipe ? (
                          <div className="flex-1 flex gap-4">
                            {/* Image */}
                            <div className="w-20 h-20 rounded-lg bg-muted flex-shrink-0 overflow-hidden">
                              {recipe.image_url ? (
                                <Image
                                  src={recipe.image_url}
                                  alt={recipe.name}
                                  width={80}
                                  height={80}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <UtensilsCrossed className="h-8 w-8 text-muted-foreground" />
                                </div>
                              )}
                            </div>

                            {/* Details */}
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate font-arabic">{recipe.name}</div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                                {recipe.cuisine && (
                                  <span>{recipe.cuisine}</span>
                                )}
                                {(recipe.prep_time_minutes || recipe.cook_time_minutes) && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {(recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0)} min
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-4 text-sm mt-2">
                                <span className="flex items-center gap-1 text-primary font-medium">
                                  <Scale className="h-3 w-3" />
                                  {recipe.scale_factor}x scale
                                </span>
                                <span className="font-medium">
                                  {recipe.scaled_calories} kcal
                                </span>
                                {recipe.nutrition_per_serving?.protein_g && (
                                  <span className="text-muted-foreground">
                                    {Math.round(recipe.nutrition_per_serving.protein_g * (recipe.scale_factor || 1))}g protein
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Alternatives count */}
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <span>+{alternativeCount} alternatives</span>
                              <ChevronRight className="h-4 w-4" />
                            </div>
                          </div>
                        ) : (
                          <div className="flex-1 flex items-center justify-center text-muted-foreground">
                            <AlertCircle className="h-5 w-5 mr-2" />
                            No suitable recipe found
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}

          {!mealPlan && !error && (
            <Card className="min-h-[400px] flex items-center justify-center">
              <CardContent className="text-center">
                <CalendarDays className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Configure calorie target and meal structure, then generate a plan
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
