'use client'

import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'

export interface VisualSelectOption {
  value: string
  label: string
  description?: string
  icon?: React.ReactNode
  emoji?: string
}

interface VisualSelectProps {
  options: VisualSelectOption[]
  value: string | undefined
  onChange: (value: string) => void
  columns?: 2 | 3
  className?: string
}

export function VisualSelect({ 
  options, 
  value, 
  onChange, 
  columns = 2,
  className 
}: VisualSelectProps) {
  return (
    <div 
      className={cn(
        'grid gap-3',
        columns === 2 ? 'grid-cols-2' : 'grid-cols-3',
        className
      )}
    >
      {options.map((option) => {
        const isSelected = value === option.value
        
        return (
          <motion.button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'relative flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all',
              'hover:border-primary/50 active:scale-[0.98] touch-manipulation',
              'min-h-[120px]',
              isSelected 
                ? 'border-primary bg-primary/5 shadow-sm' 
                : 'border-muted bg-card'
            )}
            whileTap={{ scale: 0.98 }}
          >
            {isSelected && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center"
              >
                <Check className="h-3 w-3 text-primary-foreground" />
              </motion.div>
            )}
            
            {option.emoji && (
              <span className="text-3xl">{option.emoji}</span>
            )}
            
            {option.icon && (
              <div className={cn(
                'text-2xl',
                isSelected ? 'text-primary' : 'text-muted-foreground'
              )}>
                {option.icon}
              </div>
            )}
            
            <div className="text-center">
              <p className={cn(
                'font-semibold text-sm',
                isSelected ? 'text-primary' : 'text-foreground'
              )}>
                {option.label}
              </p>
              {option.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {option.description}
                </p>
              )}
            </div>
          </motion.button>
        )
      })}
    </div>
  )
}

// Single column variant for larger cards
interface VisualSelectListProps {
  options: VisualSelectOption[]
  value: string | undefined
  onChange: (value: string) => void
  className?: string
}

export function VisualSelectList({ 
  options, 
  value, 
  onChange, 
  className 
}: VisualSelectListProps) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {options.map((option) => {
        const isSelected = value === option.value
        
        return (
          <motion.button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'relative flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left',
              'hover:border-primary/50 active:scale-[0.99] touch-manipulation',
              isSelected 
                ? 'border-primary bg-primary/5 shadow-sm' 
                : 'border-muted bg-card'
            )}
            whileTap={{ scale: 0.99 }}
          >
            {option.emoji && (
              <span className="text-2xl flex-shrink-0">{option.emoji}</span>
            )}
            
            {option.icon && (
              <div className={cn(
                'text-xl flex-shrink-0',
                isSelected ? 'text-primary' : 'text-muted-foreground'
              )}>
                {option.icon}
              </div>
            )}
            
            <div className="flex-1 min-w-0">
              <p className={cn(
                'font-semibold',
                isSelected ? 'text-primary' : 'text-foreground'
              )}>
                {option.label}
              </p>
              {option.description && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {option.description}
                </p>
              )}
            </div>
            
            <div className={cn(
              'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0',
              isSelected 
                ? 'border-primary bg-primary' 
                : 'border-muted-foreground/30'
            )}>
              {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
            </div>
          </motion.button>
        )
      })}
    </div>
  )
}
