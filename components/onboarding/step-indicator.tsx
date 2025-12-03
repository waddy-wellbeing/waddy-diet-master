'use client'

import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

interface StepIndicatorProps {
  currentStep: number
  totalSteps: number
  className?: string
}

export function StepIndicator({ currentStep, totalSteps, className }: StepIndicatorProps) {
  return (
    <div className={cn('flex items-center justify-center gap-2', className)}>
      {Array.from({ length: totalSteps }).map((_, index) => {
        const isCompleted = index < currentStep
        const isCurrent = index === currentStep
        
        return (
          <motion.div
            key={index}
            className={cn(
              'h-2 rounded-full transition-all duration-300',
              isCurrent 
                ? 'w-8 bg-primary' 
                : isCompleted 
                  ? 'w-2 bg-primary' 
                  : 'w-2 bg-muted'
            )}
            initial={false}
              animate={{
              width: isCurrent ? 32 : 8,
              backgroundColor: isCurrent || isCompleted 
                ? 'var(--primary)' 
                : 'var(--muted)'
            }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          />
        )
      })}
    </div>
  )
}

interface StepProgressBarProps {
  currentStep: number
  totalSteps: number
  className?: string
}

export function StepProgressBar({ currentStep, totalSteps, className }: StepProgressBarProps) {
  const progress = ((currentStep + 1) / totalSteps) * 100

  return (
    <div className={cn('w-full h-1 bg-muted rounded-full overflow-hidden', className)}>
      <motion.div
        className="h-full bg-primary rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      />
    </div>
  )
}
