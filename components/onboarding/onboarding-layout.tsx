'use client'

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import { StepProgressBar } from './step-indicator'

interface OnboardingLayoutProps {
  children: ReactNode
  currentStep: number
  totalSteps: number
  title: string
  subtitle?: string
  onBack?: () => void
  onNext: () => void
  nextLabel?: string
  isNextDisabled?: boolean
  isLoading?: boolean
  showBack?: boolean
  className?: string
}

export function OnboardingLayout({
  children,
  currentStep,
  totalSteps,
  title,
  subtitle,
  onBack,
  onNext,
  nextLabel = 'Continue',
  isNextDisabled = false,
  isLoading = false,
  showBack = true,
  className,
}: OnboardingLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header with progress */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border/50">
        <div className="px-4 py-3">
          <div className="flex items-center gap-4 mb-2">
            {showBack && currentStep > 0 && (
              <button
                onClick={onBack}
                className="p-2 -ml-2 hover:bg-muted rounded-full transition-colors touch-manipulation"
                aria-label="Go back"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">
                Step {currentStep + 1} of {totalSteps}
              </p>
            </div>
          </div>
          <StepProgressBar currentStep={currentStep} totalSteps={totalSteps} />
        </div>
      </header>

      {/* Content */}
      <main className={cn('flex-1 px-4 py-6 overflow-y-auto', className)}>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="max-w-md mx-auto"
          >
            {/* Title section */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-foreground">{title}</h1>
              {subtitle && (
                <p className="text-muted-foreground mt-2">{subtitle}</p>
              )}
            </div>

            {/* Step content */}
            <div className="space-y-6">
              {children}
            </div>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer with CTA */}
      <footer className="sticky bottom-0 bg-background border-t border-border p-4 safe-area-bottom">
        <div className="max-w-md mx-auto">
          <Button
            onClick={onNext}
            disabled={isNextDisabled || isLoading}
            className="w-full h-12 text-base font-semibold"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Please wait...
              </>
            ) : (
              <>
                {nextLabel}
                <ArrowRight className="ml-2 h-5 w-5" />
              </>
            )}
          </Button>
        </div>
      </footer>
    </div>
  )
}

// Simple wrapper for step content without the full layout
interface OnboardingStepProps {
  children: ReactNode
  className?: string
}

export function OnboardingStep({ children, className }: OnboardingStepProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {children}
    </div>
  )
}
