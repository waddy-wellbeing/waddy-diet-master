'use client'

import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

interface UnitToggleProps {
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
  className?: string
}

export function UnitToggle({ options, value, onChange, className }: UnitToggleProps) {
  return (
    <div 
      className={cn(
        'inline-flex items-center bg-muted rounded-lg p-1 relative',
        className
      )}
    >
      {options.map((option) => {
        const isSelected = value === option.value
        
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'relative px-4 py-2 text-sm font-medium rounded-md transition-colors z-10',
              isSelected 
                ? 'text-foreground' 
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {isSelected && (
              <motion.div
                layoutId="unit-toggle-active"
                className="absolute inset-0 bg-background rounded-md shadow-sm"
                transition={{ type: 'spring', duration: 0.3, bounce: 0.15 }}
              />
            )}
            <span className="relative z-10">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// Compact variant for inline use
interface CompactUnitToggleProps {
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
  className?: string
}

export function CompactUnitToggle({ options, value, onChange, className }: CompactUnitToggleProps) {
  return (
    <div 
      className={cn(
        'inline-flex items-center bg-muted rounded-full p-0.5',
        className
      )}
    >
      {options.map((option) => {
        const isSelected = value === option.value
        
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'px-3 py-1 text-xs font-medium rounded-full transition-all',
              isSelected 
                ? 'bg-background text-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
