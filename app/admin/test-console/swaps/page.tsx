'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { 
  ArrowLeft, 
  RefreshCcw,
  Search,
  Scale,
  AlertCircle,
  Apple,
  ArrowRight,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getIngredientSwaps } from '@/lib/actions/test-console'
import { createClient } from '@/lib/supabase/client'

interface IngredientOption {
  id: string
  name: string
  food_group: string | null
  subgroup: string | null
  serving_size: number
  serving_unit: string
  macros?: { calories?: number }
}

interface SwapOption {
  id: string
  name: string
  name_ar: string | null
  food_group: string | null
  subgroup: string | null
  serving_size: number
  serving_unit: string
  macros: { calories?: number; protein_g?: number; carbs_g?: number; fat_g?: number }
  suggested_amount?: number
  calorie_diff_percent?: number
}

export default function SwapsPage() {
  const [ingredients, setIngredients] = useState<IngredientOption[]>([])
  const [selectedIngredientId, setSelectedIngredientId] = useState('')
  const [amount, setAmount] = useState<number | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(false)
  const [originalIngredient, setOriginalIngredient] = useState<IngredientOption | null>(null)
  const [swapOptions, setSwapOptions] = useState<SwapOption[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterGroup, setFilterGroup] = useState<string>('')

  // Load ingredients on mount
  useEffect(() => {
    async function loadIngredients() {
      const supabase = createClient()
      const { data } = await supabase
        .from('ingredients')
        .select('id, name, food_group, subgroup, serving_size, serving_unit, macros')
        .not('food_group', 'is', null)
        .order('name')
        .limit(200)

      if (data) {
        setIngredients(data)
      }
    }
    loadIngredients()
  }, [])

  const handleFindSwaps = async () => {
    if (!selectedIngredientId) return

    setIsLoading(true)
    setError(null)

    const { data, originalIngredient: original, error: err } = await getIngredientSwaps({
      ingredientId: selectedIngredientId,
      targetAmount: amount,
    })

    if (err) {
      setError(err)
      setSwapOptions(null)
      setOriginalIngredient(null)
    } else {
      setSwapOptions(data)
      setOriginalIngredient(original)
      // Set default amount to serving size
      if (original && !amount) {
        setAmount(original.serving_size)
      }
    }

    setIsLoading(false)
  }

  // Get unique food groups for filter
  const foodGroups = Array.from(new Set(ingredients.map(i => i.food_group).filter(Boolean))) as string[]

  const filteredIngredients = ingredients.filter(i => {
    const matchesSearch = i.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesGroup = !filterGroup || i.food_group === filterGroup
    return matchesSearch && matchesGroup
  })

  const getCalorieDiffColor = (diff: number | undefined) => {
    if (diff === undefined) return 'text-muted-foreground'
    if (Math.abs(diff) <= 5) return 'text-green-600 dark:text-green-400'
    if (Math.abs(diff) <= 15) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-red-600 dark:text-red-400'
  }

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
          <h1 className="text-2xl font-bold">Ingredient Swaps</h1>
          <p className="text-muted-foreground">
            Find ingredient substitutions within the same food group
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Selection Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Apple className="h-5 w-5" />
              Select Ingredient
            </CardTitle>
            <CardDescription>
              Choose an ingredient to find swaps for
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search Ingredients</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Food Group Filter</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={filterGroup}
                onChange={(e) => setFilterGroup(e.target.value)}
              >
                <option value="">All Groups</option>
                {foodGroups.sort().map(group => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Ingredient</Label>
              <div className="max-h-[200px] overflow-y-auto border rounded-md">
                {filteredIngredients.length > 0 ? (
                  filteredIngredients.map(ingredient => (
                    <button
                      key={ingredient.id}
                      onClick={() => {
                        setSelectedIngredientId(ingredient.id)
                        setAmount(ingredient.serving_size)
                      }}
                      className={`w-full text-left px-3 py-2 text-sm border-b last:border-b-0 transition-colors ${
                        selectedIngredientId === ingredient.id
                          ? 'bg-primary/10 text-primary'
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      <div className="font-medium truncate">{ingredient.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {ingredient.food_group} • {ingredient.serving_size} {ingredient.serving_unit}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                    No ingredients found
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount ({ingredients.find(i => i.id === selectedIngredientId)?.serving_unit || 'g'})</Label>
              <Input
                id="amount"
                type="number"
                min={1}
                step={1}
                value={amount || ''}
                onChange={(e) => setAmount(parseInt(e.target.value) || undefined)}
                placeholder="Enter amount"
              />
              <p className="text-xs text-muted-foreground">
                Enter the amount to calculate equivalent swaps
              </p>
            </div>

            <Button 
              onClick={handleFindSwaps}
              className="w-full"
              disabled={!selectedIngredientId || isLoading}
            >
              {isLoading ? (
                <RefreshCcw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4 mr-2" />
              )}
              Find Swaps
            </Button>
          </CardContent>
        </Card>

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

          {originalIngredient && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-muted-foreground">Original Ingredient</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Apple className="h-8 w-8 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-lg">{originalIngredient.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {originalIngredient.food_group}
                      {originalIngredient.subgroup && ` → ${originalIngredient.subgroup}`}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm">
                      <span>
                        <strong>{amount || originalIngredient.serving_size}</strong> {originalIngredient.serving_unit}
                      </span>
                      <span className="text-muted-foreground">
                        ≈ {Math.round(((originalIngredient.macros?.calories || 0) / originalIngredient.serving_size) * (amount || originalIngredient.serving_size))} kcal
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {swapOptions && swapOptions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">
                  {swapOptions.length} Swap Option{swapOptions.length !== 1 ? 's' : ''}
                </h3>
                <span className="text-sm text-muted-foreground">
                  Same food group: {originalIngredient?.food_group}
                </span>
              </div>

              <div className="space-y-2">
                {swapOptions.map(swap => (
                  <Card key={swap.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          <Apple className="h-6 w-6 text-muted-foreground" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{swap.name}</span>
                            {swap.subgroup === originalIngredient?.subgroup && (
                              <span className="flex items-center gap-0.5 text-xs text-green-600 bg-green-100 dark:bg-green-950 px-1.5 py-0.5 rounded">
                                <Check className="h-3 w-3" />
                                Same subgroup
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {swap.subgroup || swap.food_group}
                          </div>
                        </div>

                        <div className="flex items-center gap-6 text-sm">
                          <div className="flex items-center gap-2">
                            <Scale className="h-4 w-4 text-primary" />
                            <div>
                              <div className="font-medium">
                                {swap.suggested_amount !== undefined 
                                  ? `${swap.suggested_amount} ${swap.serving_unit}`
                                  : `${swap.serving_size} ${swap.serving_unit}`
                                }
                              </div>
                              <div className="text-xs text-muted-foreground">
                                suggested
                              </div>
                            </div>
                          </div>

                          <div className="text-right min-w-[60px]">
                            <div className={`font-medium ${getCalorieDiffColor(swap.calorie_diff_percent)}`}>
                              {swap.calorie_diff_percent !== undefined 
                                ? `${swap.calorie_diff_percent >= 0 ? '+' : ''}${swap.calorie_diff_percent}%`
                                : '—'
                              }
                            </div>
                            <div className="text-xs text-muted-foreground">
                              cal diff
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Macros comparison */}
                      <div className="flex gap-4 mt-3 pt-3 border-t text-xs">
                        <div className="flex items-center gap-4">
                          <span className="text-muted-foreground">Per {swap.serving_size} {swap.serving_unit}:</span>
                          <span>
                            <strong>{swap.macros?.calories || 0}</strong> kcal
                          </span>
                          <span>
                            <strong>{swap.macros?.protein_g || 0}</strong>g protein
                          </span>
                          <span>
                            <strong>{swap.macros?.carbs_g || 0}</strong>g carbs
                          </span>
                          <span>
                            <strong>{swap.macros?.fat_g || 0}</strong>g fat
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {swapOptions && swapOptions.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  No swap options found for this ingredient
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  This ingredient may be the only one in its food group
                </p>
              </CardContent>
            </Card>
          )}

          {!swapOptions && !error && (
            <Card className="min-h-[400px] flex items-center justify-center">
              <CardContent className="text-center">
                <RefreshCcw className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Select an ingredient and click Find Swaps to see alternatives
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
