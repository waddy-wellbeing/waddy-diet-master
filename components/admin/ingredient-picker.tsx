'use client'

import { useState, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Search, Plus, Leaf } from 'lucide-react'
import { searchIngredients, searchSpices } from '@/lib/actions/recipes'
import { useDebouncedCallback } from '@/lib/hooks/use-debounce'

export interface IngredientResult {
  id: string
  name: string
  name_ar: string | null
  serving_size?: number
  serving_unit?: string
  macros?: {
    calories?: number
    protein_g?: number
    carbs_g?: number
    fat_g?: number
  }
  is_spice?: boolean
}

interface SpiceResult {
  id: string
  name: string
  name_ar: string | null
}

interface IngredientPickerProps {
  onSelect: (ingredient: IngredientResult) => void
}

export function IngredientPicker({ onSelect }: IngredientPickerProps) {
  const [query, setQuery] = useState('')
  const [ingredients, setIngredients] = useState<IngredientResult[]>([])
  const [spices, setSpices] = useState<SpiceResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [activeTab, setActiveTab] = useState('ingredients')

  const debouncedSearch = useDebouncedCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setIngredients([])
      setSpices([])
      return
    }

    setIsSearching(true)
    
    // Search both ingredients and spices in parallel
    const [ingredientsResult, spicesResult] = await Promise.all([
      searchIngredients(searchQuery),
      searchSpices(searchQuery),
    ])

    setIngredients(ingredientsResult.ingredients ?? [])
    setSpices(spicesResult.spices ?? [])
    setIsSearching(false)
  }, 300)

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value)
    debouncedSearch(value)
  }, [debouncedSearch])

  function handleSelectIngredient(ingredient: IngredientResult) {
    onSelect(ingredient)
    setQuery('')
    setIngredients([])
    setSpices([])
  }

  function handleSelectSpice(spice: SpiceResult) {
    onSelect({
      id: spice.id,
      name: spice.name,
      name_ar: spice.name_ar,
      is_spice: true,
    })
    setQuery('')
    setIngredients([])
    setSpices([])
  }

  const hasResults = ingredients.length > 0 || spices.length > 0

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search ingredients or spices..."
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {query && (
        <div className="rounded-lg border bg-popover shadow-md">
          {isSearching ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Searching...
            </div>
          ) : !hasResults ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No results found for "{query}"
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full rounded-none border-b">
                <TabsTrigger value="ingredients" className="flex-1">
                  Ingredients ({ingredients.length})
                </TabsTrigger>
                <TabsTrigger value="spices" className="flex-1">
                  Spices ({spices.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="ingredients" className="m-0">
                <div className="max-h-60 overflow-y-auto">
                  {ingredients.length === 0 ? (
                    <p className="p-4 text-center text-sm text-muted-foreground">
                      No ingredients found
                    </p>
                  ) : (
                    ingredients.map((ingredient) => (
                      <button
                        key={ingredient.id}
                        type="button"
                        className="w-full px-4 py-2 text-left hover:bg-muted flex items-center justify-between group"
                        onClick={() => handleSelectIngredient(ingredient)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{ingredient.name}</span>
                            {ingredient.name_ar && (
                              <span className="text-sm text-muted-foreground truncate" dir="rtl">
                                {ingredient.name_ar}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {ingredient.serving_size} {ingredient.serving_unit}
                            {ingredient.macros?.calories && (
                              <span className="ml-2">{ingredient.macros.calories} cal</span>
                            )}
                          </div>
                        </div>
                        <Plus className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="spices" className="m-0">
                <div className="max-h-60 overflow-y-auto">
                  {spices.length === 0 ? (
                    <p className="p-4 text-center text-sm text-muted-foreground">
                      No spices found
                    </p>
                  ) : (
                    spices.map((spice) => (
                      <button
                        key={spice.id}
                        type="button"
                        className="w-full px-4 py-2 text-left hover:bg-muted flex items-center justify-between group"
                        onClick={() => handleSelectSpice(spice)}
                      >
                        <div className="flex items-center gap-2">
                          <Leaf className="h-4 w-4 text-green-600" />
                          <span className="font-medium">{spice.name}</span>
                          {spice.name_ar && (
                            <span className="text-sm text-muted-foreground" dir="rtl">
                              {spice.name_ar}
                            </span>
                          )}
                          <Badge variant="outline" className="text-xs">Spice</Badge>
                        </div>
                        <Plus className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      )}
    </div>
  )
}
