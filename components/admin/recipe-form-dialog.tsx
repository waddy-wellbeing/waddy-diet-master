'use client'

import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronUp,
  ChevronDown,
  AlertCircle,
  Link2,
  Pencil,
} from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  recipeSchema,
  type RecipeFormData,
  MEAL_TYPES,
  CUISINES,
  DIFFICULTIES,
} from '@/lib/validators/recipes'
import {
  createRecipe,
  updateRecipe,
  getRecipe,
  searchIngredients,
  searchSpices,
} from '@/lib/actions/recipes'
import { IngredientPicker, type IngredientResult } from './ingredient-picker'

// =============================================================================
// IngredientEditPopover - Search and match/edit an ingredient
// =============================================================================

interface IngredientEditPopoverProps {
  rawName: string
  isUnmatched: boolean
  linkedName?: string | null
  onMatch: (ingredient: IngredientResult) => void
}

function IngredientEditPopover({ rawName, isUnmatched, linkedName, onMatch }: IngredientEditPopoverProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [ingredients, setIngredients] = useState<IngredientResult[]>([])
  const [spices, setSpices] = useState<{ id: string; name: string; name_ar: string | null }[]>([])
  const [isSearching, setIsSearching] = useState(false)

  // Reset query when popover opens
  useEffect(() => {
    if (open) {
      setQuery(rawName)
    }
  }, [open, rawName])

  // Search when popover opens or query changes
  useEffect(() => {
    if (!open) return

    const searchTimer = setTimeout(async () => {
      if (!query.trim()) {
        setIngredients([])
        setSpices([])
        return
      }

      setIsSearching(true)
      const [ingredientsResult, spicesResult] = await Promise.all([
        searchIngredients(query, 5),
        searchSpices(query, 5),
      ])
      setIngredients(ingredientsResult.ingredients ?? [])
      setSpices(spicesResult.spices ?? [])
      setIsSearching(false)
    }, 300)

    return () => clearTimeout(searchTimer)
  }, [open, query])

  function handleSelectIngredient(ingredient: IngredientResult) {
    onMatch(ingredient)
    setOpen(false)
  }

  function handleSelectSpice(spice: { id: string; name: string; name_ar: string | null }) {
    onMatch({
      id: spice.id,
      name: spice.name,
      name_ar: spice.name_ar,
      is_spice: true,
    })
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {isUnmatched ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-2 text-xs border-destructive text-destructive hover:bg-destructive/10"
          >
            <Link2 className="h-3 w-3 mr-1" />
            Match
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Change linked ingredient"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b">
          {linkedName && !isUnmatched && (
            <p className="text-xs text-muted-foreground mb-2">
              Currently linked to: <span className="font-medium text-foreground">{linkedName}</span>
            </p>
          )}
          <Input
            placeholder="Search ingredients or spices..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8"
            autoFocus
          />
        </div>
        <ScrollArea className="max-h-60">
          {isSearching ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Searching...
            </div>
          ) : ingredients.length === 0 && spices.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No matches found
            </div>
          ) : (
            <div>
              {ingredients.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted">
                    Ingredients
                  </div>
                  {ingredients.map((ingredient) => (
                    <button
                      key={ingredient.id}
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center justify-between"
                      onClick={() => handleSelectIngredient(ingredient)}
                    >
                      <span className="truncate">{ingredient.name}</span>
                      {ingredient.name_ar && (
                        <span className="text-xs text-muted-foreground truncate ml-2" dir="rtl">
                          {ingredient.name_ar}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {spices.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted">
                    Spices
                  </div>
                  {spices.map((spice) => (
                    <button
                      key={spice.id}
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center justify-between"
                      onClick={() => handleSelectSpice(spice)}
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs h-5">Spice</Badge>
                        <span className="truncate">{spice.name}</span>
                      </div>
                      {spice.name_ar && (
                        <span className="text-xs text-muted-foreground truncate ml-2" dir="rtl">
                          {spice.name_ar}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}

// =============================================================================
// RecipeFormDialog
// =============================================================================

interface RecipeFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  recipeId?: string
}

export function RecipeFormDialog({
  open,
  onOpenChange,
  mode,
  recipeId,
}: RecipeFormDialogProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [tagInput, setTagInput] = useState('')

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<RecipeFormData>({
    resolver: zodResolver(recipeSchema) as any,
    defaultValues: getDefaultValues(),
  })

  const {
    fields: ingredientFields,
    append: appendIngredient,
    remove: removeIngredient,
    move: moveIngredient,
  } = useFieldArray({
    control,
    name: 'ingredients',
  })

  const {
    fields: instructionFields,
    append: appendInstruction,
    remove: removeInstruction,
    move: moveInstruction,
  } = useFieldArray({
    control,
    name: 'instructions',
  })

  const mealTypes = watch('meal_type') ?? []
  const tags = watch('tags') ?? []
  const ingredients = watch('ingredients') ?? []

  function getDefaultValues(): RecipeFormData {
    return {
      name: '',
      description: null,
      image_url: null,
      meal_type: [],
      cuisine: null,
      tags: [],
      prep_time_minutes: null,
      cook_time_minutes: null,
      servings: 1,
      difficulty: null,
      ingredients: [],
      instructions: [],
      nutrition_per_serving: {},
      is_vegetarian: false,
      is_vegan: false,
      is_gluten_free: false,
      is_dairy_free: false,
      admin_notes: null,
      is_public: false,
    }
  }

  // Load recipe data when editing
  useEffect(() => {
    async function loadRecipe() {
      if (open && mode === 'edit' && recipeId) {
        setIsLoading(true)
        const { recipe, error } = await getRecipe(recipeId)
        if (recipe && !error) {
          reset({
            name: recipe.name,
            description: recipe.description,
            image_url: recipe.image_url,
            meal_type: recipe.meal_type ?? [],
            cuisine: recipe.cuisine,
            tags: recipe.tags ?? [],
            prep_time_minutes: recipe.prep_time_minutes,
            cook_time_minutes: recipe.cook_time_minutes,
            servings: recipe.servings,
            difficulty: recipe.difficulty,
            ingredients: recipe.ingredients ?? [],
            instructions: recipe.instructions ?? [],
            nutrition_per_serving: recipe.nutrition_per_serving ?? {},
            is_vegetarian: recipe.is_vegetarian,
            is_vegan: recipe.is_vegan,
            is_gluten_free: recipe.is_gluten_free,
            is_dairy_free: recipe.is_dairy_free,
            admin_notes: recipe.admin_notes,
            is_public: recipe.is_public,
          })
        }
        setIsLoading(false)
      } else if (open && mode === 'create') {
        reset(getDefaultValues())
      }
    }
    loadRecipe()
  }, [open, mode, recipeId, reset])

  // Calculate nutrition from ingredients
  useEffect(() => {
    // Simple auto-calculation placeholder
    // In a real app, you'd sum up the nutrition from each ingredient
    // based on quantity and serving size
  }, [ingredients])

  async function onSubmit(data: RecipeFormData) {
    setIsSubmitting(true)

    try {
      const result =
        mode === 'create'
          ? await createRecipe(data)
          : await updateRecipe(recipeId!, data)

      if (result.success) {
        toast.success(mode === 'create' ? 'Recipe created' : 'Recipe updated', {
          description: `${data.name} has been ${mode === 'create' ? 'added' : 'updated'}.`,
        })
        onOpenChange(false)
        reset(getDefaultValues())
        router.refresh()
      } else {
        toast.error('Error', {
          description: result.error,
        })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      reset(getDefaultValues())
      setTagInput('')
    }
    onOpenChange(open)
  }

  // Meal type toggle
  function toggleMealType(type: string) {
    const current = mealTypes
    if (current.includes(type)) {
      setValue('meal_type', current.filter(t => t !== type))
    } else {
      setValue('meal_type', [...current, type])
    }
  }

  // Tag management
  function addTag() {
    const trimmed = tagInput.trim()
    if (trimmed && !tags.includes(trimmed)) {
      setValue('tags', [...tags, trimmed])
      setTagInput('')
    }
  }

  function removeTag(tag: string) {
    setValue('tags', tags.filter(t => t !== tag))
  }

  function handleTagKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag()
    }
  }

  // Add new instruction
  function addInstruction() {
    appendInstruction({
      step: instructionFields.length + 1,
      instruction: '',
    })
  }

  // Reorder instructions
  function moveInstructionUp(index: number) {
    if (index > 0) {
      moveInstruction(index, index - 1)
      // Update step numbers
      const current = watch('instructions')
      current.forEach((inst, i) => {
        setValue(`instructions.${i}.step`, i + 1)
      })
    }
  }

  function moveInstructionDown(index: number) {
    if (index < instructionFields.length - 1) {
      moveInstruction(index, index + 1)
      // Update step numbers
      const current = watch('instructions')
      current.forEach((inst, i) => {
        setValue(`instructions.${i}.step`, i + 1)
      })
    }
  }

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-4xl" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Loading Recipe</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Add New Recipe' : 'Edit Recipe'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Add a new recipe to the database.'
              : 'Update the recipe details.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-hidden flex flex-col">
          <Tabs defaultValue="basic" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="ingredients">Ingredients</TabsTrigger>
              <TabsTrigger value="instructions">Instructions</TabsTrigger>
              <TabsTrigger value="nutrition">Nutrition</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-hidden mt-4">
              {/* Basic Info Tab */}
              <TabsContent value="basic" className="mt-0 h-full">
                <ScrollArea className="h-[calc(60vh-4rem)] pr-4">
                  <div className="space-y-4 pb-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Grilled Chicken Salad"
                      {...register('name')}
                      aria-invalid={errors.name ? 'true' : 'false'}
                    />
                    {errors.name && (
                      <p className="text-sm text-destructive">{errors.name.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="image_url">Image URL</Label>
                    <Input
                      id="image_url"
                      placeholder="https://..."
                      {...register('image_url')}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Brief description of the recipe..."
                    rows={3}
                    {...register('description')}
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Meal Type</Label>
                  <div className="flex flex-wrap gap-2">
                    {MEAL_TYPES.map((type) => (
                      <Badge
                        key={type}
                        variant={mealTypes.includes(type) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => toggleMealType(type)}
                      >
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="cuisine">Cuisine</Label>
                    <Select
                      value={watch('cuisine') ?? ''}
                      onValueChange={(value) => setValue('cuisine', value || null)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select cuisine" />
                      </SelectTrigger>
                      <SelectContent>
                        {CUISINES.map((cuisine) => (
                          <SelectItem key={cuisine} value={cuisine}>
                            {cuisine}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="difficulty">Difficulty</Label>
                    <Select
                      value={watch('difficulty') ?? ''}
                      onValueChange={(value) => setValue('difficulty', value || null)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select difficulty" />
                      </SelectTrigger>
                      <SelectContent>
                        {DIFFICULTIES.map((diff) => (
                          <SelectItem key={diff} value={diff}>
                            {diff.charAt(0).toUpperCase() + diff.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="prep_time_minutes">Prep Time (min)</Label>
                    <Input
                      id="prep_time_minutes"
                      type="number"
                      min="0"
                      placeholder="15"
                      {...register('prep_time_minutes')}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cook_time_minutes">Cook Time (min)</Label>
                    <Input
                      id="cook_time_minutes"
                      type="number"
                      min="0"
                      placeholder="30"
                      {...register('cook_time_minutes')}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="servings">Servings *</Label>
                    <Input
                      id="servings"
                      type="number"
                      min="1"
                      placeholder="4"
                      {...register('servings')}
                    />
                    {errors.servings && (
                      <p className="text-sm text-destructive">{errors.servings.message}</p>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Tags</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add a tag..."
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleTagKeyDown}
                    />
                    <Button type="button" variant="outline" onClick={addTag}>
                      Add
                    </Button>
                  </div>
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="gap-1">
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="ml-1 hover:text-destructive"
                          >
                            ×
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label>Dietary Information</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="is_vegetarian"
                        checked={watch('is_vegetarian')}
                        onCheckedChange={(checked) => setValue('is_vegetarian', checked === true)}
                      />
                      <Label htmlFor="is_vegetarian" className="font-normal cursor-pointer">
                        Vegetarian
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="is_vegan"
                        checked={watch('is_vegan')}
                        onCheckedChange={(checked) => setValue('is_vegan', checked === true)}
                      />
                      <Label htmlFor="is_vegan" className="font-normal cursor-pointer">
                        Vegan
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="is_gluten_free"
                        checked={watch('is_gluten_free')}
                        onCheckedChange={(checked) => setValue('is_gluten_free', checked === true)}
                      />
                      <Label htmlFor="is_gluten_free" className="font-normal cursor-pointer">
                        Gluten Free
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="is_dairy_free"
                        checked={watch('is_dairy_free')}
                        onCheckedChange={(checked) => setValue('is_dairy_free', checked === true)}
                      />
                      <Label htmlFor="is_dairy_free" className="font-normal cursor-pointer">
                        Dairy Free
                      </Label>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_public"
                    checked={watch('is_public')}
                    onCheckedChange={(checked) => setValue('is_public', checked === true)}
                  />
                  <Label htmlFor="is_public" className="font-normal cursor-pointer">
                    Public (visible to all users)
                  </Label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="admin_notes">Admin Notes</Label>
                  <Textarea
                    id="admin_notes"
                    placeholder="Internal notes (not visible to users)..."
                    rows={2}
                    {...register('admin_notes')}
                  />
                </div>
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Ingredients Tab */}
              <TabsContent value="ingredients" className="mt-0 h-full">
                <ScrollArea className="h-[calc(60vh-4rem)] pr-4">
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Add Ingredients</Label>
                      <IngredientPicker
                        onSelect={(ingredient: IngredientResult) => {
                          appendIngredient({
                            ingredient_id: ingredient.is_spice ? null : ingredient.id,
                            spice_id: ingredient.is_spice ? ingredient.id : null,
                            raw_name: ingredient.name,
                            quantity: ingredient.is_spice ? null : (ingredient.serving_size ?? 100),
                            unit: ingredient.is_spice ? null : (ingredient.serving_unit ?? 'g'),
                            is_spice: ingredient.is_spice ?? false,
                            is_optional: false,
                            linked_name: ingredient.name,
                            linked_name_ar: ingredient.name_ar,
                          })
                        }}
                      />
                    </div>

                <Separator />

                    <div className="space-y-2">
                      <Label>Recipe Ingredients ({ingredientFields.length})</Label>
                      {ingredientFields.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                          No ingredients added yet. Use the search above to add ingredients.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {ingredientFields.map((field, index) => {
                            const isSpice = watch(`ingredients.${index}.is_spice`)
                            const ingredientId = watch(`ingredients.${index}.ingredient_id`)
                            const spiceId = watch(`ingredients.${index}.spice_id`)
                            const rawName = watch(`ingredients.${index}.raw_name`)
                            const linkedName = watch(`ingredients.${index}.linked_name`)
                            const linkedNameAr = watch(`ingredients.${index}.linked_name_ar`)
                            // Unmatched if: not a spice and no ingredient_id, OR is a spice but no spice_id
                            const isUnmatched = isSpice ? !spiceId : !ingredientId
                            
                            // Build tooltip content
                            const tooltipContent = linkedName 
                              ? `Linked: ${linkedName}${linkedNameAr ? ` (${linkedNameAr})` : ''}`
                              : isUnmatched 
                                ? 'Unmatched - click Match to link'
                                : rawName
                            
                            return (
                              <div
                                key={field.id}
                                className={`flex items-center gap-2 p-3 rounded-lg border ${
                                  isUnmatched 
                                    ? 'border-destructive bg-destructive/10' 
                                    : 'bg-muted/50'
                                }`}
                              >
                                <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    {isUnmatched && (
                                      <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                                    )}
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className={`font-medium truncate cursor-help ${isUnmatched ? 'text-destructive' : ''}`}>
                                          {rawName}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-xs">
                                        <p className="font-medium">{rawName}</p>
                                        {linkedName && (
                                          <p className="text-xs text-muted-foreground mt-1">
                                            → {linkedName}
                                            {linkedNameAr && <span className="ml-1" dir="rtl">({linkedNameAr})</span>}
                                          </p>
                                        )}
                                        {isUnmatched && (
                                          <p className="text-xs text-destructive mt-1">Not linked to any ingredient</p>
                                        )}
                                      </TooltipContent>
                                    </Tooltip>
                                    {isSpice && (
                                      <Badge variant="outline" className="text-xs">Spice</Badge>
                                    )}
                                    {watch(`ingredients.${index}.is_optional`) && (
                                      <Badge variant="secondary" className="text-xs">Optional</Badge>
                                    )}
                                    {linkedName && !isUnmatched && (
                                      <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                                        → {linkedName}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <IngredientEditPopover
                                    rawName={rawName}
                                    isUnmatched={isUnmatched}
                                    linkedName={linkedName}
                                    onMatch={(matchedIngredient) => {
                                      if (matchedIngredient.is_spice) {
                                        setValue(`ingredients.${index}.spice_id`, matchedIngredient.id)
                                        setValue(`ingredients.${index}.ingredient_id`, null)
                                        setValue(`ingredients.${index}.is_spice`, true)
                                        setValue(`ingredients.${index}.quantity`, null)
                                        setValue(`ingredients.${index}.unit`, null)
                                        setValue(`ingredients.${index}.linked_name`, matchedIngredient.name)
                                        setValue(`ingredients.${index}.linked_name_ar`, matchedIngredient.name_ar ?? null)
                                      } else {
                                        setValue(`ingredients.${index}.ingredient_id`, matchedIngredient.id)
                                        setValue(`ingredients.${index}.spice_id`, null)
                                        setValue(`ingredients.${index}.is_spice`, false)
                                        setValue(`ingredients.${index}.linked_name`, matchedIngredient.name)
                                        setValue(`ingredients.${index}.linked_name_ar`, matchedIngredient.name_ar ?? null)
                                      }
                                    }}
                                  />
                                  {isSpice ? (
                                    <span className="text-sm text-muted-foreground">حسب الرغبة</span>
                                  ) : (
                                    <>
                                      <Input
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        className="w-20"
                                        placeholder="Qty"
                                        {...register(`ingredients.${index}.quantity`)}
                                      />
                                      <Input
                                        className="w-16"
                                        placeholder="Unit"
                                        {...register(`ingredients.${index}.unit`)}
                                      />
                                    </>
                                  )}
                                  <Checkbox
                                    checked={watch(`ingredients.${index}.is_optional`)}
                                    onCheckedChange={(checked) =>
                                      setValue(`ingredients.${index}.is_optional`, checked === true)
                                    }
                                    title="Optional"
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeIngredient(index)}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Instructions Tab */}
              <TabsContent value="instructions" className="mt-0 h-full">
                <ScrollArea className="h-[calc(60vh-4rem)] pr-4">
                  <div className="space-y-4 py-4">
                    <div className="flex items-center justify-between">
                      <Label>Cooking Instructions</Label>
                      <Button type="button" variant="outline" size="sm" onClick={addInstruction}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Step
                      </Button>
                    </div>

                    {instructionFields.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-8 text-center">
                        No instructions added yet. Click "Add Step" to start.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {instructionFields.map((field, index) => (
                          <div key={field.id} className="flex gap-2">
                            <div className="flex flex-col gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => moveInstructionUp(index)}
                                disabled={index === 0}
                              >
                                <ChevronUp className="h-4 w-4" />
                              </Button>
                              <span className="text-center text-sm font-medium text-muted-foreground">
                                {index + 1}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => moveInstructionDown(index)}
                                disabled={index === instructionFields.length - 1}
                              >
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                            </div>
                            <Textarea
                              placeholder={`Step ${index + 1}: Describe what to do...`}
                              rows={2}
                              className="flex-1"
                              {...register(`instructions.${index}.instruction`)}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeInstruction(index)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Nutrition Tab */}
              <TabsContent value="nutrition" className="mt-0 h-full">
                <ScrollArea className="h-[calc(60vh-4rem)] pr-4">
                  <div className="space-y-4 py-4">
                    <p className="text-sm text-muted-foreground">
                      Nutrition per serving. These values are auto-calculated from ingredients
                      but can be overridden manually.
                    </p>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="nutrition_per_serving.calories">Calories</Label>
                        <Input
                          id="nutrition_per_serving.calories"
                          type="number"
                          min="0"
                          placeholder="0"
                          {...register('nutrition_per_serving.calories')}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="nutrition_per_serving.protein_g">Protein (g)</Label>
                        <Input
                          id="nutrition_per_serving.protein_g"
                          type="number"
                          step="0.1"
                          min="0"
                          placeholder="0"
                          {...register('nutrition_per_serving.protein_g')}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="nutrition_per_serving.carbs_g">Carbs (g)</Label>
                        <Input
                          id="nutrition_per_serving.carbs_g"
                          type="number"
                          step="0.1"
                          min="0"
                          placeholder="0"
                          {...register('nutrition_per_serving.carbs_g')}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="nutrition_per_serving.fat_g">Fat (g)</Label>
                        <Input
                          id="nutrition_per_serving.fat_g"
                          type="number"
                          step="0.1"
                          min="0"
                          placeholder="0"
                          {...register('nutrition_per_serving.fat_g')}
                        />
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>
            </div>
          </Tabs>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? mode === 'create'
                  ? 'Creating...'
                  : 'Saving...'
                : mode === 'create'
                ? 'Create Recipe'
                : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
