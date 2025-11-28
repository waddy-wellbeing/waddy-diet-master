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
import { Badge } from '@/components/ui/badge'
import { X } from 'lucide-react'
import { spiceSchema, type SpiceFormData } from '@/lib/validators/spices'
import { createSpice, updateSpice } from '@/lib/actions/spices'

interface Spice {
  id: string
  name: string
  name_ar: string | null
  aliases: string[]
  is_default: boolean
}

interface SpiceFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  spice?: Spice | null
}

export function SpiceFormDialog({
  open,
  onOpenChange,
  mode,
  spice,
}: SpiceFormDialogProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [aliasInput, setAliasInput] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<SpiceFormData>({
    resolver: zodResolver(spiceSchema) as any,
    defaultValues: {
      name: '',
      name_ar: null,
      aliases: [],
      is_default: true,
    },
  })

  const aliases = watch('aliases') ?? []

  // Reset form when spice changes (for edit mode)
  useEffect(() => {
    if (open && spice && mode === 'edit') {
      reset({
        name: spice.name,
        name_ar: spice.name_ar,
        aliases: spice.aliases ?? [],
        is_default: spice.is_default,
      })
    } else if (open && mode === 'create') {
      reset({
        name: '',
        name_ar: null,
        aliases: [],
        is_default: true,
      })
    }
  }, [open, spice, mode, reset])

  async function onSubmit(data: SpiceFormData) {
    setIsSubmitting(true)

    try {
      const result =
        mode === 'create'
          ? await createSpice(data)
          : await updateSpice(spice!.id, data)

      if (result.success) {
        toast.success(mode === 'create' ? 'Spice created' : 'Spice updated', {
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
      setAliasInput('')
    }
    onOpenChange(open)
  }

  function addAlias() {
    const trimmed = aliasInput.trim()
    if (trimmed && !aliases.includes(trimmed)) {
      setValue('aliases', [...aliases, trimmed])
      setAliasInput('')
    }
  }

  function removeAlias(alias: string) {
    setValue('aliases', aliases.filter(a => a !== alias))
  }

  function handleAliasKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addAlias()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Add New Spice' : 'Edit Spice'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Add a new spice to the database.'
              : 'Update the spice details.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Cumin"
              {...register('name')}
              aria-invalid={errors.name ? 'true' : 'false'}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Arabic Name */}
          <div className="space-y-2">
            <Label htmlFor="name_ar">Arabic Name</Label>
            <Input
              id="name_ar"
              placeholder="e.g., كمون"
              dir="rtl"
              {...register('name_ar')}
            />
          </div>

          {/* Aliases */}
          <div className="space-y-2">
            <Label>Aliases</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Add an alias..."
                value={aliasInput}
                onChange={(e) => setAliasInput(e.target.value)}
                onKeyDown={handleAliasKeyDown}
              />
              <Button type="button" variant="outline" onClick={addAlias}>
                Add
              </Button>
            </div>
            {aliases.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {aliases.map((alias) => (
                  <Badge key={alias} variant="secondary" className="gap-1">
                    {alias}
                    <button
                      type="button"
                      onClick={() => removeAlias(alias)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Is Default */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_default"
              checked={watch('is_default')}
              onCheckedChange={(checked) => 
                setValue('is_default', checked === true)
              }
            />
            <Label htmlFor="is_default" className="font-normal cursor-pointer">
              Default spice (available to all users)
            </Label>
          </div>

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
                ? 'Create Spice'
                : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
