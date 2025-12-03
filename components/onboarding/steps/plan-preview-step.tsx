'use client'

import { motion } from 'framer-motion'
import { Check, Flame, Target, Scale, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BasicInfoData } from './basic-info-step'
import type { ActivityLevel } from './activity-level-step'
import type { GoalsData } from './goals-step'
import type { DietaryPreferencesData } from './dietary-preferences-step'
import type { LifestyleData } from './lifestyle-step'
import type { MealsPerDay } from './meal-structure-step'
import { calculateTDEE } from '@/lib/utils/tdee'

interface PlanPreviewStepProps {
  basicInfo: BasicInfoData
  activityLevel: ActivityLevel
  goals: GoalsData
  dietaryPreferences: DietaryPreferencesData
  lifestyle: LifestyleData
  mealsPerDay: MealsPerDay
}

export function PlanPreviewStep({
  basicInfo,
  activityLevel,
  goals,
  dietaryPreferences,
  lifestyle,
  mealsPerDay,
}: PlanPreviewStepProps) {
  // Calculate TDEE and targets
  const calculations = calculateTDEE({
    weight_kg: parseFloat(basicInfo.weight) || 70,
    height_cm: parseFloat(basicInfo.height) || 170,
    age: parseInt(basicInfo.age) || 30,
    sex: basicInfo.sex === 'male' || basicInfo.sex === 'female' ? basicInfo.sex : 'male',
    activity_level: activityLevel || 'moderate',
    goal_type: goals.goalType || 'maintain',
    pace: goals.pace || 'moderate',
  })

  const dailyCalories = calculations.daily_calories
  const protein = calculations.protein_g
  const carbs = calculations.carbs_g
  const fat = calculations.fat_g

  // Get display values
  const getGoalText = () => {
    switch (goals.goalType) {
      case 'lose_weight':
        return 'Lose Weight'
      case 'build_muscle':
        return 'Build Muscle'
      case 'recomposition':
        return 'Recomposition'
      case 'maintain':
        return 'Maintain Weight'
      default:
        return 'Maintain Weight'
    }
  }

  const getPaceText = () => {
    switch (goals.pace) {
      case 'slow':
        return 'Slow & Steady'
      case 'aggressive':
        return 'Aggressive'
      default:
        return 'Moderate'
    }
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, ease: 'easeOut' as const },
    },
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Success Header */}
      <motion.div variants={itemVariants} className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
          <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        <h2 className="text-xl font-bold text-foreground">
          Your Plan is Ready! 🎉
        </h2>
        <p className="text-muted-foreground mt-1">
          Here's what we've calculated for you
        </p>
      </motion.div>

      {/* Calorie Target - Large Display */}
      <motion.div
        variants={itemVariants}
        className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-6 text-center"
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          <Flame className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium text-primary">Daily Target</span>
        </div>
        <div className="text-5xl font-bold text-foreground">
          {dailyCalories.toLocaleString()}
        </div>
        <div className="text-lg text-muted-foreground">calories/day</div>
      </motion.div>

      {/* Macros Grid */}
      <motion.div variants={itemVariants} className="grid grid-cols-3 gap-3">
        <MacroCard
          label="Protein"
          value={protein}
          unit="g"
          color="bg-orange-500"
          percentage={Math.round((protein * 4 / dailyCalories) * 100)}
        />
        <MacroCard
          label="Carbs"
          value={carbs}
          unit="g"
          color="bg-blue-500"
          percentage={Math.round((carbs * 4 / dailyCalories) * 100)}
        />
        <MacroCard
          label="Fat"
          value={fat}
          unit="g"
          color="bg-purple-500"
          percentage={Math.round((fat * 9 / dailyCalories) * 100)}
        />
      </motion.div>

      {/* Summary Cards */}
      <motion.div variants={itemVariants} className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Your Profile Summary
        </h3>
        
        <div className="grid grid-cols-2 gap-3">
          <SummaryCard
            icon={<Target className="h-4 w-4" />}
            label="Goal"
            value={getGoalText()}
          />
          <SummaryCard
            icon={<Activity className="h-4 w-4" />}
            label="Pace"
            value={goals.goalType === 'maintain' ? 'N/A' : getPaceText()}
          />
          <SummaryCard
            icon={<Scale className="h-4 w-4" />}
            label="Current Weight"
            value={`${basicInfo.weight} ${basicInfo.weightUnit}`}
          />
          <SummaryCard
            icon={<Flame className="h-4 w-4" />}
            label="TDEE"
            value={`${calculations.tdee} cal`}
          />
        </div>
      </motion.div>

      {/* Meals Per Day */}
      <motion.div variants={itemVariants} className="text-center py-4 bg-muted/30 rounded-xl">
        <p className="text-sm text-muted-foreground">
          Your daily calories will be split across
        </p>
        <p className="text-lg font-semibold text-foreground">
          {mealsPerDay} meals per day
        </p>
      </motion.div>

      {/* Note */}
      <motion.p variants={itemVariants} className="text-xs text-muted-foreground text-center">
        These targets are personalized based on your profile. They can be adjusted anytime in settings.
      </motion.p>
    </motion.div>
  )
}

function MacroCard({
  label,
  value,
  unit,
  color,
  percentage,
}: {
  label: string
  value: number
  unit: string
  color: string
  percentage: number
}) {
  return (
    <div className="bg-card rounded-xl p-4 border border-border text-center">
      <div className={cn('w-2 h-2 rounded-full mx-auto mb-2', color)} />
      <div className="text-2xl font-bold text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground">{unit}</div>
      <div className="text-xs font-medium text-muted-foreground mt-1">
        {percentage}% • {label}
      </div>
    </div>
  )
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border">
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold text-foreground truncate">{value}</p>
      </div>
    </div>
  )
}
