'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface ChipSelectProps {
  options: string[]
  selected: string[]
  onChange: (selected: string[]) => void
  allowCustom?: boolean
  customPlaceholder?: string
  maxSelections?: number
  className?: string
}

export function ChipSelect({
  options,
  selected,
  onChange,
  allowCustom = false,
  customPlaceholder = 'Add custom...',
  maxSelections,
  className,
}: ChipSelectProps) {
  const [customValue, setCustomValue] = useState('')

  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter((s) => s !== option))
    } else if (!maxSelections || selected.length < maxSelections) {
      onChange([...selected, option])
    }
  }

  const addCustom = () => {
    const trimmed = customValue.trim()
    if (trimmed && !selected.includes(trimmed) && !options.includes(trimmed)) {
      if (!maxSelections || selected.length < maxSelections) {
        onChange([...selected, trimmed])
        setCustomValue('')
      }
    }
  }

  const removeSelected = (option: string) => {
    onChange(selected.filter((s) => s !== option))
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Selected chips */}
      <AnimatePresence mode="popLayout">
        {selected.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-wrap gap-2"
          >
            {selected.map((item) => (
              <motion.span
                key={item}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                layout
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-full text-sm font-medium"
              >
                {item}
                <button
                  type="button"
                  onClick={() => removeSelected(item)}
                  className="ml-1 hover:bg-primary-foreground/20 rounded-full p-0.5 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </motion.span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Options grid */}
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isSelected = selected.includes(option)
          const isDisabled = !isSelected && maxSelections !== undefined && selected.length >= maxSelections

          return (
            <motion.button
              key={option}
              type="button"
              onClick={() => toggleOption(option)}
              disabled={isDisabled}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-medium border transition-all',
                'hover:border-primary/50 active:scale-95 touch-manipulation',
                isSelected
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-muted bg-card text-foreground',
                isDisabled && 'opacity-50 cursor-not-allowed'
              )}
              whileTap={{ scale: 0.95 }}
            >
              {option}
            </motion.button>
          )
        })}
      </div>

      {/* Custom input */}
      {allowCustom && (
        <div className="flex gap-2">
          <Input
            type="text"
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            placeholder={customPlaceholder}
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addCustom()
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={addCustom}
            disabled={!customValue.trim()}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

// Simple "None" toggle option
interface NoneToggleProps {
  selected: boolean
  onChange: (selected: boolean) => void
  label?: string
}

export function NoneToggle({ selected, onChange, label = "None" }: NoneToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!selected)}
      className={cn(
        'w-full px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all',
        'hover:border-primary/50 active:scale-[0.99] touch-manipulation',
        selected
          ? 'border-primary bg-primary/5 text-primary'
          : 'border-muted bg-card text-muted-foreground'
      )}
    >
      {label}
    </button>
  )
}
