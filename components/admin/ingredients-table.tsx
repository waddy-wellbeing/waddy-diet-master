'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
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
  ArrowUpDown,
} from 'lucide-react'
import { deleteIngredient } from '@/lib/actions/ingredients'
import { IngredientFormDialog } from './ingredient-form-dialog'
import type { IngredientMacros } from '@/lib/types/nutri'

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
  micros?: Record<string, number> | null
  is_verified: boolean
  is_public: boolean
  source?: string | null
  created_at: string
}

interface IngredientsTableProps {
  ingredients: Ingredient[]
  total: number
  page: number
  pageSize: number
  foodGroups: string[]
}

export function IngredientsTable({
  ingredients,
  total,
  page,
  pageSize,
  foodGroups,
}: IngredientsTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  
  const [searchValue, setSearchValue] = useState(searchParams.get('search') ?? '')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [ingredientToDelete, setIngredientToDelete] = useState<Ingredient | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [ingredientToEdit, setIngredientToEdit] = useState<Ingredient | null>(null)

  const totalPages = Math.ceil(total / pageSize)
  const currentFoodGroup = searchParams.get('foodGroup') ?? ''

  function updateSearchParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '') {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    })
    
    // Reset to page 1 when filtering
    if (!updates.page) {
      params.delete('page')
    }
    
    startTransition(() => {
      router.push(`/admin/ingredients?${params.toString()}`)
    })
  }

  function handleSearch() {
    updateSearchParams({ search: searchValue })
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  function handlePageChange(newPage: number) {
    updateSearchParams({ page: newPage.toString() })
  }

  function handleFoodGroupChange(value: string) {
    updateSearchParams({ foodGroup: value === 'all' ? null : value })
  }

  async function handleDelete() {
    if (!ingredientToDelete) return

    const result = await deleteIngredient(ingredientToDelete.id)
    
    if (result.success) {
      toast.success('Ingredient deleted', {
        description: `${ingredientToDelete.name} has been removed.`,
      })
      setDeleteDialogOpen(false)
      setIngredientToDelete(null)
      router.refresh()
    } else {
      toast.error('Failed to delete', {
        description: result.error,
      })
    }
  }

  function openEditDialog(ingredient: Ingredient) {
    setIngredientToEdit(ingredient)
    setEditDialogOpen(true)
  }

  function openDeleteDialog(ingredient: Ingredient) {
    setIngredientToDelete(ingredient)
    setDeleteDialogOpen(true)
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search ingredients..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-9"
            />
          </div>
          <Button variant="outline" onClick={handleSearch} disabled={isPending}>
            Search
          </Button>
        </div>

        <div className="flex gap-2">
          <Select value={currentFoodGroup || 'all'} onValueChange={handleFoodGroupChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Food Group" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Groups</SelectItem>
              {foodGroups.map((group) => (
                <SelectItem key={group} value={group}>
                  {group}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Ingredient
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[250px]">
                <Button variant="ghost" size="sm" className="-ml-3 h-8">
                  Name
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>Food Group</TableHead>
              <TableHead>Subgroup</TableHead>
              <TableHead className="text-right">Serving</TableHead>
              <TableHead className="text-right">Calories</TableHead>
              <TableHead className="text-right">Protein</TableHead>
              <TableHead className="text-right">Carbs</TableHead>
              <TableHead className="text-right">Fat</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ingredients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-muted-foreground">No ingredients found</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCreateDialogOpen(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add your first ingredient
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              ingredients.map((ingredient) => (
                <TableRow key={ingredient.id} className="group">
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{ingredient.name}</span>
                      {ingredient.name_ar && (
                        <span className="text-xs text-muted-foreground">
                          {ingredient.name_ar}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {ingredient.food_group ? (
                      <Badge variant="secondary">{ingredient.food_group}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {ingredient.subgroup ? (
                      <span className="text-sm">{ingredient.subgroup}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {ingredient.serving_size} {ingredient.serving_unit}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {ingredient.macros?.calories ?? '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {ingredient.macros?.protein_g != null
                      ? `${ingredient.macros.protein_g}g`
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {ingredient.macros?.carbs_g != null
                      ? `${ingredient.macros.carbs_g}g`
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {ingredient.macros?.fat_g != null
                      ? `${ingredient.macros.fat_g}g`
                      : '—'}
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
                        <DropdownMenuItem onClick={() => openEditDialog(ingredient)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => openDeleteDialog(ingredient)}
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
            {Math.min(page * pageSize, total)} of {total} ingredients
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
            <span className="text-sm">
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Ingredient</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{ingredientToDelete?.name}&quot;? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialogs */}
      <IngredientFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        mode="create"
      />

      {ingredientToEdit && (
        <IngredientFormDialog
          open={editDialogOpen}
          onOpenChange={(open: boolean) => {
            setEditDialogOpen(open)
            if (!open) setIngredientToEdit(null)
          }}
          mode="edit"
          ingredient={ingredientToEdit}
        />
      )}
    </div>
  )
}
