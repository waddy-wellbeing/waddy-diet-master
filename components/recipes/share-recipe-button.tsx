'use client'

import type { ComponentProps } from 'react'
import { useCallback } from 'react'
import { Share2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

function fallbackCopyToClipboard(text: string) {
  const el = document.createElement('textarea')
  el.value = text
  el.setAttribute('readonly', '')
  el.style.position = 'absolute'
  el.style.left = '-9999px'
  document.body.appendChild(el)
  el.select()
  document.execCommand('copy')
  document.body.removeChild(el)
}

export function ShareRecipeButton(props: {
  recipeId: string
  recipeName: string
  variant?: ComponentProps<typeof Button>['variant']
  size?: ComponentProps<typeof Button>['size']
  className?: string
}) {
  const { recipeId, recipeName, variant = 'secondary', size = 'icon', className } = props

  const onShare = useCallback(async () => {
    const url = new URL(`/r/${recipeId}`, window.location.origin).toString()

    try {
      if (navigator.share) {
        await navigator.share({ title: recipeName, text: recipeName, url })
        return
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
      } else {
        fallbackCopyToClipboard(url)
      }

      toast.success('Link copied')
    } catch {
      // User cancelled / share failed
    }
  }, [recipeId, recipeName])

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={onShare}
      aria-label="Share recipe"
      title="Share recipe"
    >
      <Share2 className="size-4" />
    </Button>
  )
}
