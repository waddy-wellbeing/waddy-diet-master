'use client'

import { useState } from 'react'
import { format, addDays, startOfWeek, isSameDay, isToday } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  ChevronLeft,
  ChevronRight,
  Flame,
  Target,
  TrendingUp,
  Utensils,
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
}

export function WeekSelector({ selectedDate, onDateSelect, weekData, dailyTarget }: WeekSelectorProps) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }))
  
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  
  const goToPreviousWeek = () => {
    setWeekStart((prev: Date) => addDays(prev, -7))
  }
  
  const goToNextWeek = () => {
    setWeekStart((prev: Date) => addDays(prev, 7))
  }

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
    </div>
  )
}

interface DaySummaryProps {
  consumed: number
  target: number
  protein: { current: number; target: number }
  carbs: { current: number; target: number }
  fat: { current: number; target: number }
}

export function DaySummary({ consumed, target, protein, carbs, fat }: DaySummaryProps) {
  const remaining = target - consumed
  const progress = Math.min((consumed / target) * 100, 100)
  
  return (
    <div className="bg-card rounded-xl border border-border p-5">
      {/* Main calories */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-muted-foreground mb-1">Today's Progress</p>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold">{consumed.toLocaleString()}</span>
            <span className="text-muted-foreground">/ {target.toLocaleString()} cal</span>
          </div>
        </div>
        
        <div className={cn(
          'text-right',
          remaining > 0 ? 'text-primary' : 'text-orange-500'
        )}>
          <div className="flex items-center gap-1">
            <Flame className="h-4 w-4" />
            <span className="font-semibold">{Math.abs(remaining).toLocaleString()}</span>
          </div>
          <p className="text-xs">{remaining > 0 ? 'remaining' : 'over'}</p>
        </div>
      </div>
      
      {/* Progress bar */}
      <div className="h-2 bg-muted rounded-full overflow-hidden mb-4">
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
      
      {/* Macros */}
      <div className="grid grid-cols-3 gap-3">
        <MacroProgress
          label="Protein"
          current={protein.current}
          target={protein.target}
          color="bg-orange-500"
        />
        <MacroProgress
          label="Carbs"
          current={carbs.current}
          target={carbs.target}
          color="bg-blue-500"
        />
        <MacroProgress
          label="Fat"
          current={fat.current}
          target={fat.target}
          color="bg-purple-500"
        />
      </div>
    </div>
  )
}

function MacroProgress({
  label,
  current,
  target,
  color,
}: {
  label: string
  current: number
  target: number
  color: string
}) {
  const progress = Math.min((current / target) * 100, 100)
  
  return (
    <div className="text-center">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="text-sm font-semibold mb-1">
        {current}<span className="text-muted-foreground font-normal">/{target}g</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${progress}%` }} />
      </div>
    </div>
  )
}

interface MealCardProps {
  meal: {
    name: string
    label: string
    targetCalories: number
    consumedCalories: number
    items: { name: string; calories: number }[]
  }
  onAddFood?: () => void
}

export function MealCard({ meal, onAddFood }: MealCardProps) {
  const progress = Math.min((meal.consumedCalories / meal.targetCalories) * 100, 100)
  const hasItems = meal.items.length > 0
  
  const mealEmojis: Record<string, string> = {
    breakfast: '🌅',
    lunch: '☀️',
    dinner: '🌙',
    snack: '🍎',
  }
  
  const emoji = mealEmojis[meal.name.toLowerCase()] || '🍽️'
  
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
              {meal.consumedCalories} / {meal.targetCalories} cal
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
      
      {/* Food items or empty state */}
      {hasItems ? (
        <div className="space-y-2">
          {meal.items.slice(0, 3).map((item, index) => (
            <div key={index} className="flex items-center justify-between text-sm">
              <span className="truncate">{item.name}</span>
              <span className="text-muted-foreground">{item.calories} cal</span>
            </div>
          ))}
          {meal.items.length > 3 && (
            <p className="text-xs text-muted-foreground">
              +{meal.items.length - 3} more items
            </p>
          )}
        </div>
      ) : (
        <button
          onClick={onAddFood}
          className="w-full py-3 border-2 border-dashed border-muted rounded-lg text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
        >
          + Add food
        </button>
      )}
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
