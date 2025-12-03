'use client'

import { useState, useMemo, useCallback, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format, subDays, parseISO } from 'date-fns'
import {
  Flame,
  Beef,
  Wheat,
  Droplet,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  Award,
  Calendar,
  ChevronRight,
  Info,
  Zap,
  Trophy,
  BarChart3,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { NutritionStats, DayLog } from './page'

interface NutritionContentProps {
  stats: NutritionStats
  userName: string
}

// Macro Ring Component
function MacroRing({ 
  value, 
  target, 
  color, 
  icon: Icon, 
  label,
  unit = 'g',
  size = 'md'
}: { 
  value: number
  target: number
  color: string
  icon: React.ElementType
  label: string
  unit?: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
}) {
  const percentage = Math.min((value / target) * 100, 100)
  const remaining = Math.round(target - value)
  
  const sizes = {
    xs: { ring: 56, stroke: 4, icon: 14, text: 'text-sm' },
    sm: { ring: 64, stroke: 4, icon: 16, text: 'text-sm' },
    md: { ring: 80, stroke: 6, icon: 18, text: 'text-base' },
    lg: { ring: 100, stroke: 8, icon: 22, text: 'text-lg' },
  }
  
  const s = sizes[size]
  const radius = (s.ring - s.stroke) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference - (percentage / 100) * circumference

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: s.ring, height: s.ring }}>
      <svg className="w-full h-full transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={s.ring / 2}
            cy={s.ring / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={s.stroke}
            className="text-muted/20"
          />
          {/* Progress circle */}
          <motion.circle
            cx={s.ring / 2}
            cy={s.ring / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={s.stroke}
            style={{ color }}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </svg>
        {/* Center icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon style={{ width: s.icon, height: s.icon, color }} />
        </div>
      </div>
      <div className="mt-2 text-center">
        <p className={cn('font-bold', s.text)}>{Math.round(value)}{unit}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-[10px] text-muted-foreground">
          {remaining > 0 ? `${remaining}${unit} left` : 'Target met!'}
        </p>
      </div>
    </div>
  )
}

// Weekly Bar Chart
function WeeklyChart({ 
  logs, 
  target,
  metric = 'calories'
}: { 
  logs: DayLog[]
  target: number
  metric?: 'calories' | 'protein' | 'carbs' | 'fat'
}) {
  const today = new Date()
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(today, 6 - i)
    return format(date, 'yyyy-MM-dd')
  })

  const maxValue = Math.max(target * 1.2, ...logs.map(l => l[metric]))

  return (
    <div className="flex items-end justify-between gap-1 h-24">
      {last7Days.map((dateStr, i) => {
        const log = logs.find(l => l.date === dateStr)
        const value = log ? log[metric] : 0
        const height = (value / maxValue) * 100
        const isToday = i === 6
        const isOverTarget = value > target
        const date = parseISO(dateStr)

        return (
          <div key={dateStr} className="flex-1 flex flex-col items-center gap-1">
            <div className="relative w-full h-20 flex items-end justify-center">
              {/* Target line */}
              <div 
                className="absolute w-full border-t border-dashed border-primary/30"
                style={{ bottom: `${(target / maxValue) * 100}%` }}
              />
              {/* Bar */}
              <motion.div
                className={cn(
                  'w-full max-w-[24px] rounded-t-md',
                  isToday ? 'bg-primary' : 'bg-primary/60',
                  isOverTarget && 'bg-orange-500',
                  value === 0 && 'bg-muted/30'
                )}
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(height, 2)}%` }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
              />
            </div>
            <span className={cn(
              'text-[10px]',
              isToday ? 'text-primary font-semibold' : 'text-muted-foreground'
            )}>
              {format(date, 'EEE').charAt(0)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// Stat Card
function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  subtext,
  trend,
  color = 'text-primary'
}: {
  icon: React.ElementType
  label: string
  value: string | number
  subtext?: string
  trend?: 'up' | 'down' | 'neutral'
  color?: string
}) {
  return (
    <motion.div
      className="bg-card rounded-xl border border-border p-4"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex items-start justify-between">
        <div className={cn('p-2 rounded-lg bg-primary/10', color.replace('text-', 'bg-').replace('500', '100'))}>
          <Icon className={cn('w-5 h-5', color)} />
        </div>
        {trend && (
          <div className={cn(
            'flex items-center gap-0.5 text-xs font-medium',
            trend === 'up' && 'text-green-500',
            trend === 'down' && 'text-red-500',
            trend === 'neutral' && 'text-muted-foreground'
          )}>
            {trend === 'up' && <TrendingUp className="w-3 h-3" />}
            {trend === 'down' && <TrendingDown className="w-3 h-3" />}
            {trend === 'neutral' && <Minus className="w-3 h-3" />}
          </div>
        )}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
        {subtext && <p className="text-xs text-muted-foreground mt-0.5">{subtext}</p>}
      </div>
    </motion.div>
  )
}

// Today's Summary Card
function TodaySummary({ today, targets }: { today: DayLog; targets: NutritionStats['targets'] }) {
  const caloriePercentage = Math.round((today.calories / targets.calories) * 100)
  const remaining = Math.round(targets.calories - today.calories)

  return (
    <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background rounded-2xl border border-primary/20 p-4 overflow-visible">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Today&apos;s Progress</h3>
          <p className="text-sm text-muted-foreground">{format(new Date(), 'EEEE, MMM d')}</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-primary">{caloriePercentage}%</p>
          <p className="text-xs text-muted-foreground">of daily goal</p>
        </div>
      </div>

      {/* Main calorie display */}
      <div className="flex items-center justify-center my-6">
        <div className="relative w-40 h-40">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="80"
              cy="80"
              r="70"
              fill="none"
              stroke="currentColor"
              strokeWidth="10"
              className="text-muted/20"
            />
            <motion.circle
              cx="80"
              cy="80"
              r="70"
              fill="none"
              stroke="currentColor"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 70}
              initial={{ strokeDashoffset: 2 * Math.PI * 70 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 70 * (1 - Math.min(caloriePercentage, 100) / 100) }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
              className={cn(
                caloriePercentage > 100 ? 'text-orange-500' : 'text-primary'
              )}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <Flame className="w-6 h-6 text-primary mb-1" />
            <p className="text-3xl font-bold">{Math.round(today.calories)}</p>
            <p className="text-xs text-muted-foreground">of {Math.round(targets.calories)} cal</p>
          </div>
        </div>
      </div>

      {/* Remaining or over */}
      <div className="text-center mb-6">
        {remaining > 0 ? (
          <p className="text-sm">
            <span className="font-semibold text-primary">{remaining}</span>
            <span className="text-muted-foreground"> calories remaining</span>
          </p>
        ) : (
          <p className="text-sm">
            <span className="font-semibold text-orange-500">{Math.abs(remaining)}</span>
            <span className="text-muted-foreground"> calories over target</span>
          </p>
        )}
      </div>

      {/* Macros row */}
      <div className="flex justify-between items-start w-full">
        <div className="flex-1 flex justify-center">
          <MacroRing
            value={Math.round(today.protein)}
            target={Math.round(targets.protein)}
            color="var(--primary)"
            icon={Beef}
            label="Protein"
            size="xs"
          />
        </div>
        <div className="flex-1 flex justify-center">
          <MacroRing
            value={Math.round(today.carbs)}
            target={Math.round(targets.carbs)}
            color="#f59e0b"
            icon={Wheat}
            label="Carbs"
            size="xs"
          />
        </div>
        <div className="flex-1 flex justify-center">
          <MacroRing
            value={Math.round(today.fat)}
            target={Math.round(targets.fat)}
            color="#3b82f6"
            icon={Droplet}
            label="Fat"
            size="xs"
          />
        </div>
      </div>
    </div>
  )
}

// Insights Card
function InsightsCard({ stats }: { stats: NutritionStats }) {
  const insights: { icon: React.ElementType; text: string; type: 'success' | 'warning' | 'info' }[] = []

  // Generate insights based on data
  const avgCalories = stats.weeklyAverages.calories
  const targetCalories = stats.targets.calories
  const calorieDeviation = ((avgCalories - targetCalories) / targetCalories) * 100

  if (Math.abs(calorieDeviation) <= 5) {
    insights.push({
      icon: Trophy,
      text: 'Your weekly calorie average is right on target! Keep it up!',
      type: 'success'
    })
  } else if (calorieDeviation > 10) {
    insights.push({
      icon: TrendingUp,
      text: `You're averaging ${Math.round(calorieDeviation)}% over your calorie target this week.`,
      type: 'warning'
    })
  } else if (calorieDeviation < -10) {
    insights.push({
      icon: TrendingDown,
      text: `You're averaging ${Math.round(Math.abs(calorieDeviation))}% under your calorie target. Make sure you're eating enough!`,
      type: 'warning'
    })
  }

  if (stats.currentStreak >= 7) {
    insights.push({
      icon: Zap,
      text: `Amazing! You're on a ${stats.currentStreak}-day logging streak!`,
      type: 'success'
    })
  } else if (stats.currentStreak >= 3) {
    insights.push({
      icon: Zap,
      text: `Great job! ${stats.currentStreak} days logged in a row. Keep going!`,
      type: 'info'
    })
  }

  const proteinPercentage = (stats.weeklyAverages.protein / stats.targets.protein) * 100
  if (proteinPercentage < 80) {
    insights.push({
      icon: Beef,
      text: 'Try to increase your protein intake to support your goals.',
      type: 'warning'
    })
  } else if (proteinPercentage >= 95) {
    insights.push({
      icon: Beef,
      text: 'Excellent protein intake this week!',
      type: 'success'
    })
  }

  if (insights.length === 0) {
    insights.push({
      icon: Info,
      text: 'Log more meals to get personalized insights about your nutrition.',
      type: 'info'
    })
  }

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-lg bg-primary/10">
          <BarChart3 className="w-5 h-5 text-primary" />
        </div>
        <h3 className="font-semibold">Insights</h3>
      </div>
      <div className="space-y-3">
        {insights.slice(0, 3).map((insight, i) => (
          <motion.div
            key={i}
            className={cn(
              'flex items-start gap-3 p-3 rounded-lg',
              insight.type === 'success' && 'bg-green-500/10',
              insight.type === 'warning' && 'bg-orange-500/10',
              insight.type === 'info' && 'bg-blue-500/10'
            )}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <insight.icon className={cn(
              'w-5 h-5 mt-0.5 shrink-0',
              insight.type === 'success' && 'text-green-500',
              insight.type === 'warning' && 'text-orange-500',
              insight.type === 'info' && 'text-blue-500'
            )} />
            <p className="text-sm">{insight.text}</p>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

export function NutritionContent({ stats, userName }: NutritionContentProps) {
  const [activeTab, setActiveTab] = useState<'today' | 'week' | 'month'>('today')

  // Memoize tab handler to prevent unnecessary re-renders
  const handleTabChange = useCallback((tab: 'today' | 'week' | 'month') => {
    setActiveTab(tab)
  }, [])

  // Memoize today content
  const todayContent = useMemo(() => (
    <>
      <TodaySummary today={stats.today} targets={stats.targets} />
      <InsightsCard stats={stats} />
      
      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={Zap}
          label="Current Streak"
          value={`${stats.currentStreak} days`}
          trend={stats.currentStreak > 0 ? 'up' : 'neutral'}
        />
        <StatCard
          icon={Target}
          label="Perfect Days"
          value={stats.perfectDays}
          subtext="Within 10% of target"
          color="text-green-500"
        />
      </div>
    </>
  ), [stats])

  // Memoize week content
  const weekContent = useMemo(() => (
    <>
      {/* Weekly Chart */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Calorie Intake</h3>
          <span className="text-xs text-muted-foreground">Last 7 days</span>
        </div>
        <WeeklyChart 
          logs={stats.weeklyLogs} 
          target={stats.targets.calories}
          metric="calories"
        />
        <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm bg-primary" />
            <span>Daily intake</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-6 border-t border-dashed border-primary/30" />
            <span>Target</span>
          </div>
        </div>
      </div>

      {/* Weekly Averages */}
      <div className="bg-card rounded-xl border border-border p-4">
        <h3 className="font-semibold mb-4">Weekly Averages</h3>
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center p-3 bg-muted/30 rounded-lg">
            <Flame className="w-5 h-5 mx-auto mb-1 text-primary" />
            <p className="text-lg font-bold">{Math.round(stats.weeklyAverages.calories)}</p>
            <p className="text-[10px] text-muted-foreground">Calories</p>
          </div>
          <div className="text-center p-3 bg-muted/30 rounded-lg">
            <Beef className="w-5 h-5 mx-auto mb-1 text-primary" />
            <p className="text-lg font-bold">{Math.round(stats.weeklyAverages.protein)}g</p>
            <p className="text-[10px] text-muted-foreground">Protein</p>
          </div>
          <div className="text-center p-3 bg-muted/30 rounded-lg">
            <Wheat className="w-5 h-5 mx-auto mb-1 text-amber-500" />
            <p className="text-lg font-bold">{Math.round(stats.weeklyAverages.carbs)}g</p>
            <p className="text-[10px] text-muted-foreground">Carbs</p>
          </div>
          <div className="text-center p-3 bg-muted/30 rounded-lg">
            <Droplet className="w-5 h-5 mx-auto mb-1 text-blue-500" />
            <p className="text-lg font-bold">{Math.round(stats.weeklyAverages.fat)}g</p>
            <p className="text-[10px] text-muted-foreground">Fat</p>
          </div>
        </div>
      </div>

      {/* Comparison to targets */}
      <div className="bg-card rounded-xl border border-border p-4">
        <h3 className="font-semibold mb-4">vs. Targets</h3>
        <div className="space-y-3">
          {[
            { label: 'Calories', avg: stats.weeklyAverages.calories, target: stats.targets.calories, unit: '' },
            { label: 'Protein', avg: stats.weeklyAverages.protein, target: stats.targets.protein, unit: 'g' },
            { label: 'Carbs', avg: stats.weeklyAverages.carbs, target: stats.targets.carbs, unit: 'g' },
            { label: 'Fat', avg: stats.weeklyAverages.fat, target: stats.targets.fat, unit: 'g' },
          ].map(item => {
            const percentage = Math.round((item.avg / item.target) * 100)
            const isOver = percentage > 100
            return (
              <div key={item.label}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span>{item.label}</span>
                  <span className={cn(
                    'font-medium',
                    isOver ? 'text-orange-500' : 'text-foreground'
                  )}>
                    {Math.round(item.avg)}{item.unit} / {Math.round(item.target)}{item.unit}
                  </span>
                </div>
                <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                  <motion.div
                    className={cn(
                      'h-full rounded-full',
                      isOver ? 'bg-orange-500' : 'bg-primary'
                    )}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(percentage, 100)}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  ), [stats])

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 pb-24">
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-bold">Nutrition</h1>
          <p className="text-muted-foreground">Track your progress, {userName}</p>
        </motion.div>
      </div>

      {/* Tab Selector */}
      <div className="px-4 mb-4">
        <div className="flex bg-muted/50 rounded-xl p-1">
          {(['today', 'week', 'month'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={cn(
                'flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all',
                activeTab === tab
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="px-4 space-y-4"
        >
          {activeTab === 'today' && todayContent}
          {activeTab === 'week' && weekContent}

          {activeTab === 'month' && (
            <>
              {/* Monthly Stats */}
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  icon={Calendar}
                  label="Days Logged"
                  value={stats.totalDaysLogged}
                  subtext="Last 30 days"
                />
                <StatCard
                  icon={Trophy}
                  label="Longest Streak"
                  value={`${stats.longestStreak} days`}
                  color="text-amber-500"
                />
                <StatCard
                  icon={Target}
                  label="Perfect Days"
                  value={stats.perfectDays}
                  subtext="Within 10% of target"
                  color="text-green-500"
                />
                <StatCard
                  icon={Award}
                  label="Adherence"
                  value={`${stats.totalDaysLogged > 0 ? Math.round((stats.perfectDays / stats.totalDaysLogged) * 100) : 0}%`}
                  subtext="Perfect day ratio"
                  color="text-primary"
                />
              </div>

              {/* Monthly Calendar Heatmap */}
              <div className="bg-card rounded-xl border border-border p-4">
                <h3 className="font-semibold mb-4">30-Day Overview</h3>
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: 30 }, (_, i) => {
                    const date = subDays(new Date(), 29 - i)
                    const dateStr = format(date, 'yyyy-MM-dd')
                    const log = stats.monthlyLogs.find(l => l.date === dateStr)
                    const hasLog = log && log.mealsLogged > 0
                    const percentage = log ? (log.calories / stats.targets.calories) * 100 : 0
                    
                    let bgColor = 'bg-muted/30'
                    if (hasLog) {
                      if (percentage >= 90 && percentage <= 110) {
                        bgColor = 'bg-green-500'
                      } else if (percentage > 110) {
                        bgColor = 'bg-orange-500'
                      } else if (percentage > 0) {
                        bgColor = 'bg-primary/60'
                      }
                    }

                    return (
                      <motion.div
                        key={dateStr}
                        className={cn(
                          'aspect-square rounded-md flex items-center justify-center text-[10px]',
                          bgColor,
                          hasLog && 'text-white'
                        )}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: i * 0.01 }}
                        title={`${format(date, 'MMM d')}: ${log?.calories || 0} cal`}
                      >
                        {format(date, 'd')}
                      </motion.div>
                    )
                  })}
                </div>
                <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-sm bg-muted/30" />
                    <span>No data</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-sm bg-primary/60" />
                    <span>Logged</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-sm bg-green-500" />
                    <span>On target</span>
                  </div>
                </div>
              </div>

              {/* Insights for month */}
              <InsightsCard stats={stats} />
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
