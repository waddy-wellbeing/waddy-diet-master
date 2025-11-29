'use client'

import { useState, useRef, useCallback } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Upload, X, ImageIcon, Loader2, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface RecipeImageUploadProps {
  recipeId?: string
  imageUrl: string | null | undefined
  onUploadComplete: (imageUrl: string) => void
  className?: string
}

export function RecipeImageUpload({
  recipeId,
  imageUrl,
  onUploadComplete,
  className,
}: RecipeImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [showPreviewDialog, setShowPreviewDialog] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback(async (file: File) => {
    if (!recipeId) {
      toast.error('Recipe must be saved before uploading images')
      return
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type. Use JPEG, PNG, WebP, or GIF')
      return
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 10MB')
      return
    }

    // Create local preview
    const objectUrl = URL.createObjectURL(file)
    setPreviewUrl(objectUrl)

    // Upload the file
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('image', file)
      formData.append('recipeId', recipeId)

      const response = await fetch('/api/upload/recipe-image', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed')
      }

      onUploadComplete(result.image_url)
      toast.success('Image uploaded successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload image')
      setPreviewUrl(null)
    } finally {
      setIsUploading(false)
      // Clean up object URL
      URL.revokeObjectURL(objectUrl)
    }
  }, [recipeId, onUploadComplete])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
    // Reset input so same file can be selected again
    e.target.value = ''
  }

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileSelect(file)
    }
  }, [handleFileSelect])

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }

  const displayUrl = previewUrl || imageUrl

  return (
    <div className={cn('space-y-3', className)}>
      <Label>Recipe Image</Label>
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleInputChange}
        className="hidden"
      />

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className={cn(
          'border-2 border-dashed rounded-lg transition-colors',
          isUploading 
            ? 'border-primary bg-primary/5' 
            : 'border-muted-foreground/25 hover:border-primary/50',
          !recipeId && 'opacity-50 cursor-not-allowed'
        )}
      >
        {displayUrl ? (
          <div className="relative">
            {/* Image Preview */}
            <div 
              className="relative aspect-[4/3] w-full cursor-pointer group"
              onClick={() => setShowPreviewDialog(true)}
            >
              <Image
                src={displayUrl}
                alt="Recipe image"
                fill
                className="object-cover rounded-t-lg"
                sizes="(max-width: 768px) 100vw, 400px"
              />
              {isUploading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-t-lg">
                  <Loader2 className="h-8 w-8 text-white animate-spin" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-t-lg flex items-center justify-center">
                <ExternalLink className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
            
            {/* Actions */}
            <div className="p-3 flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || !recipeId}
              >
                <Upload className="h-4 w-4 mr-2" />
                Replace Image
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || !recipeId}
            className="w-full p-8 flex flex-col items-center gap-3 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-10 w-10 animate-spin" />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <ImageIcon className="h-10 w-10" />
                <div className="text-center">
                  <p className="font-medium">Click to upload or drag & drop</p>
                  <p className="text-sm">JPEG, PNG, WebP, GIF (max 10MB)</p>
                  {!recipeId && (
                    <p className="text-xs text-amber-600 mt-2">
                      Save the recipe first to enable image upload
                    </p>
                  )}
                </div>
              </>
            )}
          </button>
        )}
      </div>

      {/* Full Size Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Recipe Image Preview</DialogTitle>
          </DialogHeader>
          <div className="relative aspect-[4/3] w-full">
            {imageUrl && (
              <Image
                src={imageUrl}
                alt="Recipe image full size"
                fill
                className="object-contain rounded-lg"
                sizes="(max-width: 768px) 100vw, 800px"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
