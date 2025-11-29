'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import Image from 'next/image'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Trash2,
  Search,
  Plus,
  Clock,
  Users,
  Flame,
  Leaf,
  Wheat,
  Milk,
  ArrowUpDown,
  StickyNote,
  AlertTriangle,
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { deleteRecipe, type RecipeListItem } from '@/lib/actions/recipes'
import { RecipeFormDialog } from './recipe-form-dialog'
import { MEAL_TYPES } from '@/lib/validators/recipes'

interface RecipesTableProps {
  recipes: RecipeListItem[]
  total: number
  page: number
  pageSize: number
  cuisines: string[]
}

export function RecipesTable({
  recipes,
  total,
  page,
  pageSize,
  cuisines,
}: RecipesTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  
  const [searchValue, setSearchValue] = useState(searchParams.get('search') ?? '')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [recipeToDelete, setRecipeToDelete] = useState<RecipeListItem | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [recipeToEdit, setRecipeToEdit] = useState<RecipeListItem | null>(null)

  const totalPages = Math.ceil(total / pageSize)
  const currentMealType = searchParams.get('mealType') ?? ''
  const currentCuisine = searchParams.get('cuisine') ?? ''
  const currentSort = searchParams.get('sort') ?? ''
  const currentOrder = searchParams.get('order') ?? 'asc'
  const currentHasIssues = searchParams.get('hasIssues') === 'true'

  function handleSort(column: string) {
    const newOrder = currentSort === column && currentOrder === 'asc' ? 'desc' : 'asc'
    updateSearchParams({ sort: column, order: newOrder })
  }

  function updateSearchParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '') {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    })

    startTransition(() => {
      router.push(`/admin/recipes?${params.toString()}`)
    })
  }

  function handleSearch() {
    updateSearchParams({ search: searchValue, page: null })
  }

  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  function handleMealTypeChange(value: string) {
    updateSearchParams({ 
      mealType: value === 'all' ? null : value, 
      page: null 
    })
  }

  function handleCuisineChange(value: string) {
    updateSearchParams({ 
      cuisine: value === 'all' ? null : value, 
      page: null 
    })
  }

  function handlePageChange(newPage: number) {
    updateSearchParams({ page: String(newPage) })
  }

  function openEditDialog(recipe: RecipeListItem) {
    setRecipeToEdit(recipe)
    setEditDialogOpen(true)
  }

  function openDeleteDialog(recipe: RecipeListItem) {
    setRecipeToDelete(recipe)
    setDeleteDialogOpen(true)
  }

  async function handleDelete() {
    if (!recipeToDelete) return

    const result = await deleteRecipe(recipeToDelete.id)

    if (result.success) {
      toast.success('Recipe deleted', {
        description: `${recipeToDelete.name} has been removed.`,
      })
      setDeleteDialogOpen(false)
      setRecipeToDelete(null)
      router.refresh()
    } else {
      toast.error('Error', {
        description: result.error,
      })
    }
  }

  function getTotalTime(prep: number | null, cook: number | null) {
    const total = (prep ?? 0) + (cook ?? 0)
    return total > 0 ? `${total} min` : '—'
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search recipes..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="pl-9"
              />
            </div>
            <Button variant="outline" onClick={handleSearch} disabled={isPending}>
              Search
            </Button>
          </div>

          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Recipe
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <Select value={currentMealType || 'all'} onValueChange={handleMealTypeChange}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Meal Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Meals</SelectItem>
              {MEAL_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={currentCuisine || 'all'} onValueChange={handleCuisineChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Cuisine" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cuisines</SelectItem>
              {cuisines.map((cuisine) => (
                <SelectItem key={cuisine} value={cuisine}>
                  {cuisine}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant={currentHasIssues ? 'destructive' : 'outline'}
            size="sm"
            onClick={() => updateSearchParams({ 
              hasIssues: currentHasIssues ? null : 'true',
              page: null 
            })}
            className="gap-2"
          >
            <AlertTriangle className="h-4 w-4" />
            {currentHasIssues ? 'Showing Issues' : 'Has Issues'}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Image</TableHead>
              <TableHead className="w-[250px]">
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8 hover:bg-transparent"
                  onClick={() => handleSort('name')}
                >
                  Name
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>Meal Type</TableHead>
              <TableHead className="text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 hover:bg-transparent"
                  onClick={() => handleSort('prep_time')}
                >
                  <Clock className="h-4 w-4" />
                  <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead className="text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 hover:bg-transparent"
                  onClick={() => handleSort('servings')}
                >
                  <Users className="h-4 w-4" />
                  <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 hover:bg-transparent"
                  onClick={() => handleSort('calories')}
                >
                  Calories
                  <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead className="text-center">Dietary</TableHead>
              <TableHead className="w-[40px] text-center">Notes</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recipes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-muted-foreground">No recipes found</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCreateDialogOpen(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add your first recipe
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              recipes.map((recipe) => (
                <TableRow key={recipe.id} className="group">
                  <TableCell>
                    {recipe.image_url ? (
                      <div className="relative w-12 h-12 rounded-md overflow-hidden bg-muted">
                        <Image
                          src={recipe.image_url}
                          alt={recipe.name}
                          fill
                          className="object-cover"
                          sizes="48px"
                        />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center">
                        <Flame className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-medium line-clamp-1">{recipe.name}</span>
                        {(recipe.ingredient_count === 0 || recipe.unmatched_count > 0) && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                              </TooltipTrigger>
                              <TooltipContent>
                                {recipe.ingredient_count === 0 
                                  ? 'No ingredients' 
                                  : `${recipe.unmatched_count} unmatched ingredient${recipe.unmatched_count > 1 ? 's' : ''}`}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                      {recipe.description && (
                        <span className="text-xs text-muted-foreground line-clamp-1">
                          {recipe.description}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {recipe.meal_type?.slice(0, 2).map((type) => (
                        <Badge key={type} variant="outline" className="text-xs">
                          {type}
                        </Badge>
                      ))}
                      {(recipe.meal_type?.length ?? 0) > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{(recipe.meal_type?.length ?? 0) - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-sm tabular-nums">
                    {getTotalTime(recipe.prep_time_minutes, recipe.cook_time_minutes)}
                  </TableCell>
                  <TableCell className="text-center text-sm tabular-nums">
                    {recipe.servings}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {recipe.nutrition_per_serving?.calories ?? '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-center gap-1">
                      {recipe.is_vegetarian && (
                        <span title="Vegetarian">
                          <Leaf className="h-4 w-4 text-green-600" />
                        </span>
                      )}
                      {recipe.is_vegan && (
                        <span title="Vegan">
                          <Leaf className="h-4 w-4 text-green-700" />
                        </span>
                      )}
                      {recipe.is_gluten_free && (
                        <span title="Gluten Free">
                          <Wheat className="h-4 w-4 text-amber-600" />
                        </span>
                      )}
                      {recipe.is_dairy_free && (
                        <span title="Dairy Free">
                          <Milk className="h-4 w-4 text-blue-600" />
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {recipe.admin_notes && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <StickyNote className="h-4 w-4 text-amber-500 mx-auto cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="left" className="max-w-xs">
                            <p className="text-sm whitespace-pre-wrap">{recipe.admin_notes}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(recipe)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => openDeleteDialog(recipe)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * pageSize + 1} to{' '}
            {Math.min(page * pageSize, total)} of {total} recipes
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1 || isPending}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages || isPending}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Create Dialog */}
      <RecipeFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        mode="create"
      />

      {/* Edit Dialog */}
      <RecipeFormDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        mode="edit"
        recipeId={recipeToEdit?.id}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Recipe</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{recipeToDelete?.name}&quot;? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Skeleton for loading state
export function RecipesTableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex gap-2 flex-1 max-w-md">
            <div className="h-10 bg-muted rounded-md flex-1 animate-pulse" />
            <div className="h-10 w-20 bg-muted rounded-md animate-pulse" />
          </div>
          <div className="h-10 w-32 bg-muted rounded-md animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-[150px] bg-muted rounded-md animate-pulse" />
          <div className="h-10 w-[180px] bg-muted rounded-md animate-pulse" />
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="p-4 space-y-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-12 w-12 bg-muted rounded-md animate-pulse" />
              <div className="h-4 w-48 bg-muted rounded animate-pulse" />
              <div className="h-4 w-20 bg-muted rounded animate-pulse" />
              <div className="h-4 w-24 bg-muted rounded animate-pulse" />
              <div className="h-4 w-16 bg-muted rounded animate-pulse flex-1" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
