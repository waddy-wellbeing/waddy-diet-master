'use client'

import { useState } from 'react'
import { format, addDays, startOfWeek, isSameDay, isToday } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  ChevronLeft,
  ChevronRight,
  Flame,
  Target,
  TrendingUp,
  Utensils,
  Check,
  ArrowLeftRight,
  Undo2,
} from 'lucide-react'
import type { ProfileTargets } from '@/lib/types/nutri'

interface WeekDayCardProps {
  date: Date
  isSelected: boolean
  onClick: () => void
  consumed: number
  target: number
}

function WeekDayCard({ date, isSelected, onClick, consumed, target }: WeekDayCardProps) {
  const today = isToday(date)
  const progress = Math.min((consumed / target) * 100, 100)
  const dayName = format(date, 'EEE')
  const dayNum = format(date, 'd')
  
  // Calculate stroke dash for circular progress
  const radius = 22
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference - (progress / 100) * circumference

  return (
    <motion.button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center p-2 rounded-xl transition-all touch-manipulation min-w-[52px]',
        'border-2',
        isSelected
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'border-transparent hover:bg-muted/50',
        today && !isSelected && 'border-primary/30'
      )}
      whileTap={{ scale: 0.95 }}
    >
      <span className={cn(
        'text-xs font-medium mb-1',
        isSelected ? 'text-primary' : 'text-muted-foreground'
      )}>
        {dayName}
      </span>
      
      {/* Circular progress */}
      <div className="relative w-11 h-11 mb-1">
        <svg className="w-full h-full transform -rotate-90">
          {/* Background circle */}
          <circle
            cx="22"
            cy="22"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="text-muted/30"
          />
          {/* Progress circle */}
          <circle
            cx="22"
            cy="22"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className={cn(
              progress >= 100 ? 'text-green-500' : 'text-primary'
            )}
          />
        </svg>
        <span className={cn(
          'absolute inset-0 flex items-center justify-center text-sm font-semibold',
          isSelected ? 'text-primary' : 'text-foreground'
        )}>
          {dayNum}
        </span>
      </div>
      
      {today && (
        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
      )}
    </motion.button>
  )
}

interface WeekSelectorProps {
  selectedDate: Date
  onDateSelect: (date: Date) => void
  weekData: Record<string, { consumed: number }>
  dailyTarget: number
  showDayProgress?: boolean
}

export function WeekSelector({ selectedDate, onDateSelect, weekData, dailyTarget, showDayProgress = false }: WeekSelectorProps) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }))
  
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  
  const goToPreviousWeek = () => {
    setWeekStart((prev: Date) => addDays(prev, -7))
  }
  
  const goToNextWeek = () => {
    setWeekStart((prev: Date) => addDays(prev, 7))
  }

  // Get consumed calories for the selected day
  const selectedDateKey = format(selectedDate, 'yyyy-MM-dd')
  const selectedDayData = weekData[selectedDateKey] || { consumed: 0 }
  const consumed = selectedDayData.consumed
  const progress = Math.min((consumed / dailyTarget) * 100, 100)
  const remaining = dailyTarget - consumed

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      {/* Week navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={goToPreviousWeek}
          className="p-2 hover:bg-muted rounded-full transition-colors touch-manipulation"
          aria-label="Previous week"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        
        <span className="text-sm font-medium text-muted-foreground">
          {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d, yyyy')}
        </span>
        
        <button
          onClick={goToNextWeek}
          className="p-2 hover:bg-muted rounded-full transition-colors touch-manipulation"
          aria-label="Next week"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
      
      {/* Week days */}
      <div className="flex justify-between">
        {weekDays.map((date) => {
          const dateKey = format(date, 'yyyy-MM-dd')
          const dayData = weekData[dateKey] || { consumed: 0 }
          
          return (
            <WeekDayCard
              key={dateKey}
              date={date}
              isSelected={isSameDay(date, selectedDate)}
              onClick={() => onDateSelect(date)}
              consumed={dayData.consumed}
              target={dailyTarget}
            />
          )
        })}
      </div>
      
      {/* Simple progress bar when day is selected */}
      {showDayProgress && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-4 pt-4 border-t border-border/50"
        >
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-medium">
              {consumed.toLocaleString()} kcal consumed
            </span>
            <span className="text-muted-foreground">
              of {dailyTarget.toLocaleString()}
            </span>
          </div>
          
          {/* Progress bar */}
          <div className="h-3 bg-muted/30 rounded-full overflow-hidden">
            <motion.div
              className={cn(
                'h-full rounded-full',
                progress >= 100 ? 'bg-green-500' : 'bg-primary'
              )}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
          
          {/* Remaining calories */}
          <div className="flex items-center justify-center gap-1.5 mt-2">
            <Flame className="h-4 w-4 text-primary" />
            <span className={cn(
              'text-sm font-medium',
              remaining > 0 ? 'text-muted-foreground' : 'text-orange-500'
            )}>
              {remaining > 0 
                ? `${remaining.toLocaleString()} remaining`
                : `${Math.abs(remaining).toLocaleString()} over target`
              }
            </span>
          </div>
        </motion.div>
      )}
    </div>
  )
}

interface CalorieRingProps {
  consumed: number
  target: number
}

export function CalorieRing({ consumed, target }: CalorieRingProps) {
  const remaining = target - consumed
  const progress = Math.min((consumed / target) * 100, 100)
  
  // Circular progress
  const radius = 70
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference - (progress / 100) * circumference
  
  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-center justify-center gap-8">
        {/* Large circular progress ring */}
        <div className="relative w-40 h-40">
          <svg className="w-full h-full transform -rotate-90">
            {/* Background circle */}
            <circle
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-muted/20"
            />
            {/* Progress circle */}
            <motion.circle
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: dashOffset }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className={cn(
                progress >= 100 ? 'text-green-500' : 'text-primary'
              )}
            />
          </svg>
          
          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold">{consumed.toLocaleString()}</span>
            <span className="text-sm text-muted-foreground">of {target.toLocaleString()}</span>
            <span className="text-xs text-muted-foreground">calories</span>
          </div>
        </div>
        
        {/* Remaining info */}
        <div className="text-center">
          <div className={cn(
            'text-4xl font-bold mb-1',
            remaining > 0 ? 'text-primary' : 'text-orange-500'
          )}>
            {Math.abs(remaining).toLocaleString()}
          </div>
          <div className="flex items-center justify-center gap-1 text-muted-foreground">
            <Flame className="h-4 w-4" />
            <span className="text-sm">{remaining > 0 ? 'remaining' : 'over'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// Keep DaySummary for backwards compatibility but simplified
interface DaySummaryProps {
  consumed: number
  target: number
  protein: { current: number; target: number }
  carbs: { current: number; target: number }
  fat: { current: number; target: number }
}

export function DaySummary({ consumed, target }: DaySummaryProps) {
  // Simplified - just use CalorieRing
  return <CalorieRing consumed={consumed} target={target} />
}

interface MealCardProps {
  meal: {
    name: 'breakfast' | 'lunch' | 'dinner' | 'snacks'
    label: string
    targetCalories: number
    consumedCalories: number
    isLogged: boolean
    loggedRecipeName?: string | null
    recipe: {
      id: string
      name: string
      image_url?: string | null
      nutrition_per_serving?: {
        calories?: number
        protein_g?: number
        carbs_g?: number
        fat_g?: number
      }
    } | null
    recipeCount: number
    currentIndex: number
    planSlot?: {
      recipe_id: string
      servings: number
    } | null
  }
  isToday?: boolean
  onLogMeal?: (mealName: string) => void
  onUnlogMeal?: (mealName: string) => void
  onSwapMeal?: (mealName: string, direction: 'left' | 'right') => void
  onAddFood?: () => void
}

export function MealCard({ meal, isToday = true, onLogMeal, onUnlogMeal, onSwapMeal, onAddFood }: MealCardProps) {
  const [swipeX, setSwipeX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  
  const progress = meal.isLogged ? 100 : 0
  const hasRecipe = !!meal.recipe
  const canSwipe = meal.recipeCount > 1 && isToday
  const canLog = isToday
  
  // Use scaled calories if available, otherwise use target
  const displayCalories = (meal.recipe as any)?.scaled_calories || meal.targetCalories
  const scaleFactor = (meal.recipe as any)?.scale_factor
  
  const mealEmojis: Record<string, string> = {
    breakfast: '🌅',
    lunch: '☀️',
    dinner: '🌙',
    snacks: '🍎',
  }
  
  const emoji = mealEmojis[meal.name] || '🍽️'
  
  // Swipe gesture handlers
  const handleDragEnd = (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
    setIsDragging(false)
    if (!canSwipe) return
    
    const threshold = 100
    const velocity = 500
    
    if (info.offset.x > threshold || info.velocity.x > velocity) {
      onSwapMeal?.(meal.name, 'right')
    } else if (info.offset.x < -threshold || info.velocity.x < -velocity) {
      onSwapMeal?.(meal.name, 'left')
    }
    
    setSwipeX(0)
  }
  
  // If there's a recipe assigned OR viewing a past day with logged meal
  if (hasRecipe || (!isToday && meal.isLogged)) {
    return (
      <div className={cn(
        "relative overflow-hidden rounded-xl",
        !isToday && "opacity-75"
      )}>
        {/* Swipe indicator background - only show if can swap */}
        {canSwipe && (
          <div className="absolute inset-0 flex items-center justify-between px-4 pointer-events-none">
            <div className={cn(
              'flex items-center gap-1 text-sm font-medium transition-opacity',
              swipeX > 30 ? 'opacity-100 text-primary' : 'opacity-30'
            )}>
              <ChevronLeft className="h-4 w-4" />
              <span>Previous</span>
            </div>
            <div className={cn(
              'flex items-center gap-1 text-sm font-medium transition-opacity',
              swipeX < -30 ? 'opacity-100 text-primary' : 'opacity-30'
            )}>
              <span>Next</span>
              <ChevronRight className="h-4 w-4" />
            </div>
          </div>
        )}
        
        <motion.div
          className={cn(
            "bg-card rounded-xl border border-border overflow-hidden relative touch-manipulation",
            !isToday && "bg-muted/30"
          )}
          drag={canSwipe ? "x" : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragStart={() => setIsDragging(true)}
          onDrag={(_, info) => setSwipeX(info.offset.x)}
          onDragEnd={handleDragEnd}
          animate={{ x: 0 }}
          whileTap={{ scale: isDragging ? 1 : 0.99 }}
        >
          <div className="flex">
            {/* Recipe image */}
            <div className={cn(
              "relative w-24 h-24 flex-shrink-0 bg-muted",
              !isToday && "grayscale"
            )}>
              {meal.recipe?.image_url ? (
                <img
                  src={meal.recipe.image_url}
                  alt={meal.recipe.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl bg-primary/10">
                  {emoji}
                </div>
              )}
              {/* Meal type badge */}
              <span className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-background/90 rounded text-[10px] font-medium">
                {meal.label}
              </span>
            </div>
            
            {/* Recipe info */}
            <div className="flex-1 p-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm line-clamp-1 flex-1 font-arabic">
                    {!isToday && meal.loggedRecipeName ? meal.loggedRecipeName : meal.recipe?.name || 'No recipe'}
                  </h3>
                  {canSwipe && (
                    <span className="text-[10px] text-muted-foreground ml-2 whitespace-nowrap">
                      {meal.currentIndex + 1}/{meal.recipeCount}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {displayCalories} cal
                  {scaleFactor && scaleFactor !== 1 && (
                    <span className="text-[10px] ml-1">
                      (×{scaleFactor.toFixed(1)})
                    </span>
                  )}
                </p>
              </div>
              
              {/* Action buttons - only for today */}
              <div className="flex items-center gap-2 mt-2">
                {!isToday ? (
                  // Past day - just show status
                  meal.isLogged ? (
                    <span className="inline-flex items-center gap-1 text-xs text-green-600/70 font-medium">
                      <Check className="h-3 w-3" />
                      Eaten
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Not logged</span>
                  )
                ) : meal.isLogged ? (
                  <>
                    <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                      <Check className="h-3 w-3" />
                      Logged
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs px-2 text-muted-foreground hover:text-destructive"
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation()
                        onUnlogMeal?.(meal.name)
                      }}
                    >
                      <Undo2 className="h-3 w-3 mr-1" />
                      Undo
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="default"
                    className="h-7 text-xs px-3"
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation()
                      onLogMeal?.(meal.name)
                    }}
                  >
                    <Check className="h-3 w-3 mr-1" />
                    I ate it
                  </Button>
                )}
                
                {canSwipe && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs px-2 ml-auto"
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation()
                      onSwapMeal?.(meal.name, 'right')
                    }}
                  >
                    <ArrowLeftRight className="h-3 w-3 mr-1" />
                    Swap
                  </Button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    )
  }
  
  // No recipe assigned - empty state
  return (
    <motion.div
      className="bg-card rounded-xl border border-border p-4 touch-manipulation"
      whileTap={{ scale: 0.99 }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{emoji}</span>
          <div>
            <h3 className="font-semibold">{meal.label}</h3>
            <p className="text-sm text-muted-foreground">
              0 / {meal.targetCalories} cal
            </p>
          </div>
        </div>
        
        {/* Mini progress ring */}
        <div className="relative w-10 h-10">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="20"
              cy="20"
              r="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className="text-muted/30"
            />
            <circle
              cx="20"
              cy="20"
              r="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 16}
              strokeDashoffset={2 * Math.PI * 16 * (1 - progress / 100)}
              className="text-primary"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
            {Math.round(progress)}%
          </span>
        </div>
      </div>
      
      <button
        onClick={onAddFood}
        className="w-full py-3 border-2 border-dashed border-muted rounded-lg text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
      >
        + Add food
      </button>
    </motion.div>
  )
}

interface QuickStatsProps {
  streak: number
  weeklyAverage: number
  weeklyTarget: number
}

export function QuickStats({ streak, weeklyAverage, weeklyTarget }: QuickStatsProps) {
  const adherence = Math.round((weeklyAverage / weeklyTarget) * 100)
  
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="bg-card rounded-xl border border-border p-3 text-center">
        <div className="text-2xl font-bold text-primary">{streak}</div>
        <p className="text-xs text-muted-foreground">Day Streak</p>
      </div>
      <div className="bg-card rounded-xl border border-border p-3 text-center">
        <div className="text-2xl font-bold">{weeklyAverage.toLocaleString()}</div>
        <p className="text-xs text-muted-foreground">Avg Cal/Day</p>
      </div>
      <div className="bg-card rounded-xl border border-border p-3 text-center">
        <div className={cn(
          'text-2xl font-bold',
          adherence >= 90 ? 'text-green-500' : adherence >= 70 ? 'text-primary' : 'text-orange-500'
        )}>
          {adherence}%
        </div>
        <p className="text-xs text-muted-foreground">Adherence</p>
      </div>
    </div>
  )
}
