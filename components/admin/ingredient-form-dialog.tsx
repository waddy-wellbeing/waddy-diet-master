'use client'

import { useForm } from 'react-hook-form'
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
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import {
  ingredientSchema,
  type IngredientFormData,
  SERVING_UNITS,
} from '@/lib/validators/ingredients'
import {
  createIngredient,
  updateIngredient,
  getFoodGroups,
  getFoodGroupsWithSubgroups,
} from '@/lib/actions/ingredients'
import type { IngredientMacros, IngredientMicros } from '@/lib/types/nutri'

interface Ingredient {
  id: string
  name: string
  name_ar: string | null
  brand: string | null
  category: string | null
  food_group: string | null
  subgroup: string | null
  serving_size: number
  serving_unit: string
  macros: IngredientMacros
  micros?: IngredientMicros | null
  is_verified: boolean
  is_public: boolean
  source?: string | null
}

interface IngredientFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  ingredient?: Ingredient
}

export function IngredientFormDialog({
  open,
  onOpenChange,
  mode,
  ingredient,
}: IngredientFormDialogProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [foodGroupOptions, setFoodGroupOptions] = useState<ComboboxOption[]>([])
  const [subgroupsByFoodGroup, setSubgroupsByFoodGroup] = useState<Record<string, string[]>>({})
  const [isLoadingOptions, setIsLoadingOptions] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(ingredientSchema),
    defaultValues: {
      name: '',
      name_ar: null,
      brand: null,
      category: null,
      food_group: null,
      subgroup: null,
      serving_size: 100,
      serving_unit: 'g',
      macros: {},
      micros: null,
      is_verified: false,
      is_public: true,
      source: null,
    },
  })

  // Load food groups and subgroups mapping from database when dialog opens
  useEffect(() => {
    if (open && foodGroupOptions.length === 0 && Object.keys(subgroupsByFoodGroup).length === 0) {
      setIsLoadingOptions(true)
      Promise.all([getFoodGroups(), getFoodGroupsWithSubgroups()])
        .then(([foodGroups, subgroupsMap]) => {
          setFoodGroupOptions(
            foodGroups.map((group) => ({ value: group, label: group }))
          )
          setSubgroupsByFoodGroup(subgroupsMap)
        })
        .catch((error) => {
          console.error('Failed to load options:', error)
          toast.error('Failed to load food groups and subgroups')
        })
        .finally(() => {
          setIsLoadingOptions(false)
        })
    }
  }, [open, foodGroupOptions.length, subgroupsByFoodGroup])

  // Reset form when ingredient changes (for edit mode)
  useEffect(() => {
    if (open && ingredient && mode === 'edit') {
      reset({
        name: ingredient.name,
        name_ar: ingredient.name_ar,
        brand: ingredient.brand,
        category: ingredient.category,
        food_group: ingredient.food_group,
        subgroup: ingredient.subgroup,
        serving_size: ingredient.serving_size,
        serving_unit: ingredient.serving_unit,
        macros: ingredient.macros ?? {},
        micros: ingredient.micros ?? null,
        source: ingredient.source ?? null,
        is_verified: ingredient.is_verified,
        is_public: ingredient.is_public,
      })
    } else if (open && mode === 'create') {
      reset({
        name: '',
        name_ar: null,
        brand: null,
        category: null,
        food_group: null,
        subgroup: null,
        serving_size: 100,
        serving_unit: 'g',
        macros: {},
        micros: null,
        is_verified: false,
        is_public: true,
        source: null,
      })
    }
  }, [open, ingredient, mode, reset])

  const servingUnit = watch('serving_unit')
  const foodGroup = watch('food_group')
  const subgroup = watch('subgroup')

  // Get filtered subgroups based on selected food group
  const availableSubgroups = foodGroup && subgroupsByFoodGroup[foodGroup]
    ? subgroupsByFoodGroup[foodGroup].map((sg) => ({ value: sg, label: sg }))
    : []

  // Clear subgroup when food group changes (if the subgroup is not valid for the new food group)
  useEffect(() => {
    if (foodGroup && subgroup) {
      const isValidSubgroup = subgroupsByFoodGroup[foodGroup]?.includes(subgroup)
      if (!isValidSubgroup) {
        setValue('subgroup', null)
      }
    }
  }, [foodGroup, subgroup, subgroupsByFoodGroup, setValue])

  async function onSubmit(data: IngredientFormData) {
    setIsSubmitting(true)

    try {
      const result =
        mode === 'create'
          ? await createIngredient(data)
          : await updateIngredient(ingredient!.id, data)

      if (result.success) {
        toast.success(mode === 'create' ? 'Ingredient created' : 'Ingredient updated', {
          description: `${data.name} has been ${mode === 'create' ? 'added' : 'updated'}.`,
        })
        onOpenChange(false)
        reset()
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
      reset()
    }
    onOpenChange(open)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Add New Ingredient' : 'Edit Ingredient'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Add a new ingredient to the database.'
              : 'Update the ingredient details.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="macros">Macros</TabsTrigger>
              <TabsTrigger value="micros">Micros</TabsTrigger>
            </TabsList>

            {/* Basic Info Tab */}
            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Chicken Breast"
                    {...register('name')}
                    aria-invalid={errors.name ? 'true' : 'false'}
                  />
                  {errors.name && (
                    <p className="text-sm text-destructive">{errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name_ar">Arabic Name</Label>
                  <Input
                    id="name_ar"
                    placeholder="e.g., صدر دجاج"
                    dir="rtl"
                    {...register('name_ar')}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="food_group">Food Group</Label>
                  <Combobox
                    options={foodGroupOptions}
                    value={foodGroup ?? null}
                    onValueChange={(value) => setValue('food_group', value)}
                    placeholder="Select food group"
                    searchPlaceholder="Search food groups..."
                    emptyText="No food group found."
                    disabled={isLoadingOptions}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subgroup">Subgroup</Label>
                  <Combobox
                    options={availableSubgroups}
                    value={subgroup ?? null}
                    onValueChange={(value) => setValue('subgroup', value)}
                    placeholder={foodGroup ? "Select subgroup" : "Select food group first"}
                    searchPlaceholder="Search subgroups..."
                    emptyText={foodGroup ? "No subgroup found for this food group." : "Select a food group first."}
                    disabled={isLoadingOptions || !foodGroup}
                  />
                  {foodGroup && availableSubgroups.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No subgroups available for this food group.
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  placeholder="e.g., Poultry"
                  {...register('category')}
                />
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="serving_size">Serving Size *</Label>
                  <Input
                    id="serving_size"
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="100"
                    {...register('serving_size')}
                    aria-invalid={errors.serving_size ? 'true' : 'false'}
                  />
                  {errors.serving_size && (
                    <p className="text-sm text-destructive">
                      {errors.serving_size.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="serving_unit">Serving Unit *</Label>
                  <Select
                    value={servingUnit}
                    onValueChange={(value) => setValue('serving_unit', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {SERVING_UNITS.map((unit) => (
                        <SelectItem key={unit} value={unit}>
                          {unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.serving_unit && (
                    <p className="text-sm text-destructive">
                      {errors.serving_unit.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="brand">Brand</Label>
                  <Input
                    id="brand"
                    placeholder="Optional brand name"
                    {...register('brand')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="source">Source</Label>
                  <Input
                    id="source"
                    placeholder="e.g., USDA, manual"
                    {...register('source')}
                  />
                </div>
              </div>

              <Separator />

              <div className="flex gap-6">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_verified"
                    checked={watch('is_verified')}
                    onCheckedChange={(checked) => 
                      setValue('is_verified', checked === true)
                    }
                  />
                  <Label htmlFor="is_verified" className="font-normal cursor-pointer">
                    Verified ingredient
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_public"
                    checked={watch('is_public')}
                    onCheckedChange={(checked) => 
                      setValue('is_public', checked === true)
                    }
                  />
                  <Label htmlFor="is_public" className="font-normal cursor-pointer">
                    Public (visible to all users)
                  </Label>
                </div>
              </div>
            </TabsContent>

            {/* Macros Tab */}
            <TabsContent value="macros" className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground">
                Nutritional values per serving ({String(watch('serving_size'))} {servingUnit})
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="macros.calories">Calories (kcal)</Label>
                  <Input
                    id="macros.calories"
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="0"
                    {...register('macros.calories')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="macros.protein_g">Protein (g)</Label>
                  <Input
                    id="macros.protein_g"
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="0"
                    {...register('macros.protein_g')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="macros.carbs_g">Carbs (g)</Label>
                  <Input
                    id="macros.carbs_g"
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="0"
                    {...register('macros.carbs_g')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="macros.fat_g">Fat (g)</Label>
                  <Input
                    id="macros.fat_g"
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="0"
                    {...register('macros.fat_g')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="macros.fiber_g">Fiber (g)</Label>
                  <Input
                    id="macros.fiber_g"
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="0"
                    {...register('macros.fiber_g')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="macros.sugar_g">Sugar (g)</Label>
                  <Input
                    id="macros.sugar_g"
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="0"
                    {...register('macros.sugar_g')}
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="macros.saturated_fat_g">Saturated Fat (g)</Label>
                  <Input
                    id="macros.saturated_fat_g"
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="0"
                    {...register('macros.saturated_fat_g')}
                  />
                </div>
              </div>
            </TabsContent>

            {/* Micros Tab */}
            <TabsContent value="micros" className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground">
                Micronutrients per serving (optional)
              </p>

              {/* Vitamins */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Vitamins</h4>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="micros.vitamin_a_ug">Vitamin A (μg)</Label>
                    <Input
                      id="micros.vitamin_a_ug"
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="0"
                      {...register('micros.vitamin_a_ug')}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="micros.vitamin_c_mg">Vitamin C (mg)</Label>
                    <Input
                      id="micros.vitamin_c_mg"
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="0"
                      {...register('micros.vitamin_c_mg')}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="micros.vitamin_d_ug">Vitamin D (μg)</Label>
                    <Input
                      id="micros.vitamin_d_ug"
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="0"
                      {...register('micros.vitamin_d_ug')}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="micros.vitamin_b12_ug">Vitamin B12 (μg)</Label>
                    <Input
                      id="micros.vitamin_b12_ug"
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="0"
                      {...register('micros.vitamin_b12_ug')}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="micros.vitamin_k_ug">Vitamin K (μg)</Label>
                    <Input
                      id="micros.vitamin_k_ug"
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="0"
                      {...register('micros.vitamin_k_ug')}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="micros.folate_ug">Folate (μg)</Label>
                    <Input
                      id="micros.folate_ug"
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="0"
                      {...register('micros.folate_ug')}
                    />
                  </div>
                </div>
              </div>

              {/* Minerals */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Minerals</h4>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="micros.calcium_mg">Calcium (mg)</Label>
                    <Input
                      id="micros.calcium_mg"
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="0"
                      {...register('micros.calcium_mg')}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="micros.iron_mg">Iron (mg)</Label>
                    <Input
                      id="micros.iron_mg"
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="0"
                      {...register('micros.iron_mg')}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="micros.magnesium_mg">Magnesium (mg)</Label>
                    <Input
                      id="micros.magnesium_mg"
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="0"
                      {...register('micros.magnesium_mg')}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="micros.potassium_mg">Potassium (mg)</Label>
                    <Input
                      id="micros.potassium_mg"
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="0"
                      {...register('micros.potassium_mg')}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="micros.sodium_mg">Sodium (mg)</Label>
                    <Input
                      id="micros.sodium_mg"
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="0"
                      {...register('micros.sodium_mg')}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="micros.zinc_mg">Zinc (mg)</Label>
                    <Input
                      id="micros.zinc_mg"
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="0"
                      {...register('micros.zinc_mg')}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="micros.selenium_ug">Selenium (μg)</Label>
                    <Input
                      id="micros.selenium_ug"
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="0"
                      {...register('micros.selenium_ug')}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
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
                ? 'Create Ingredient'
                : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
