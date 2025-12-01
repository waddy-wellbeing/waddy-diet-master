'use client'

import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { Check, Sun, Coffee, Utensils, Cookie, Moon } from 'lucide-react'

export type MealsPerDay = 3 | 4 | 5

interface MealStructureStepProps {
  value: MealsPerDay
  onChange: (value: MealsPerDay) => void
}

const mealStructures = [
  {
    value: 3 as MealsPerDay,
    title: '3 Meals',
    description: 'Classic breakfast, lunch, and dinner',
    meals: [
      { icon: Sun, label: 'Breakfast' },
      { icon: Utensils, label: 'Lunch' },
      { icon: Moon, label: 'Dinner' },
    ],
  },
  {
    value: 4 as MealsPerDay,
    title: '4 Meals',
    description: '3 meals plus an afternoon snack',
    meals: [
      { icon: Sun, label: 'Breakfast' },
      { icon: Utensils, label: 'Lunch' },
      { icon: Cookie, label: 'Snack' },
      { icon: Moon, label: 'Dinner' },
    ],
  },
  {
    value: 5 as MealsPerDay,
    title: '5 Meals',
    description: '3 meals plus 2 snacks',
    meals: [
      { icon: Sun, label: 'Breakfast' },
      { icon: Coffee, label: 'Snack' },
      { icon: Utensils, label: 'Lunch' },
      { icon: Cookie, label: 'Snack' },
      { icon: Moon, label: 'Dinner' },
    ],
  },
]

export function MealStructureStep({ value, onChange }: MealStructureStepProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        How many meals do you prefer to eat each day? Don't worry, you can always change this later.
      </p>

      <div className="space-y-3">
        {mealStructures.map((structure) => {
          const isSelected = value === structure.value
          
          return (
            <motion.button
              key={structure.value}
              type="button"
              onClick={() => onChange(structure.value)}
              className={cn(
                'relative w-full p-4 rounded-xl border-2 transition-all text-left',
                'hover:border-primary/50 active:scale-[0.99] touch-manipulation',
                isSelected
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-muted bg-card'
              )}
              whileTap={{ scale: 0.99 }}
            >
              {/* Selected checkmark */}
              {isSelected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-3 right-3 w-6 h-6 bg-primary rounded-full flex items-center justify-center"
                >
                  <Check className="h-4 w-4 text-primary-foreground" />
                </motion.div>
              )}

              {/* Title & Description */}
              <div className="mb-3">
                <h3 className={cn(
                  'font-semibold text-lg',
                  isSelected ? 'text-primary' : 'text-foreground'
                )}>
                  {structure.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {structure.description}
                </p>
              </div>

              {/* Meal icons */}
              <div className="flex items-center gap-1 flex-wrap">
                {structure.meals.map((meal, index) => (
                  <div key={index} className="flex items-center">
                    {index > 0 && (
                      <div className="w-4 h-px bg-muted-foreground/30 mx-1" />
                    )}
                    <div className={cn(
                      'flex items-center gap-1 px-2 py-1 rounded-full text-xs',
                      isSelected
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground'
                    )}>
                      <meal.icon className="h-3 w-3" />
                      <span className="hidden sm:inline">{meal.label}</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.button>
          )
        })}
      </div>

      <p className="text-xs text-muted-foreground text-center pt-2">
        💡 Eating smaller, more frequent meals can help maintain energy levels
      </p>
    </div>
  )
}
