'use client'

import { useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { Settings, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  WeekSelector,
  DaySummary,
  MealCard,
  QuickStats,
} from '@/components/dashboard/dashboard-components'
import type { Profile } from '@/lib/types/nutri'

interface DashboardContentProps {
  profile: Profile
}

export function DashboardContent({ profile }: DashboardContentProps) {
  const [selectedDate, setSelectedDate] = useState(new Date())
  
  // Get targets from profile
  const targets = profile.targets
  const dailyCalories = targets.daily_calories || 2000
  const proteinTarget = targets.protein_g || 150
  const carbsTarget = targets.carbs_g || 200
  const fatTarget = targets.fat_g || 65
  
  // Mock data - in real app, this would come from daily_logs table
  const weekData: Record<string, { consumed: number }> = {
    [format(new Date(), 'yyyy-MM-dd')]: { consumed: 1250 },
  }
  
  const todayConsumed = 1250
  const currentProtein = 65
  const currentCarbs = 120
  const currentFat = 35
  
  // Mock meal data - in real app, this would come from daily_logs
  const meals = [
    {
      name: 'breakfast',
      label: 'Breakfast',
      targetCalories: Math.round(dailyCalories * 0.25),
      consumedCalories: 450,
      items: [
        { name: 'Oatmeal with berries', calories: 350 },
        { name: 'Black coffee', calories: 5 },
        { name: 'Scrambled eggs (2)', calories: 95 },
      ],
    },
    {
      name: 'lunch',
      label: 'Lunch',
      targetCalories: Math.round(dailyCalories * 0.35),
      consumedCalories: 800,
      items: [
        { name: 'Grilled chicken salad', calories: 550 },
        { name: 'Whole wheat bread', calories: 150 },
        { name: 'Iced tea', calories: 100 },
      ],
    },
    {
      name: 'dinner',
      label: 'Dinner',
      targetCalories: Math.round(dailyCalories * 0.30),
      consumedCalories: 0,
      items: [],
    },
    {
      name: 'snack',
      label: 'Snacks',
      targetCalories: Math.round(dailyCalories * 0.10),
      consumedCalories: 0,
      items: [],
    },
  ]

  const greeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const firstName = profile.basic_info?.name?.split(' ')[0] || 'there'

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border/50 px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{greeting()}, {firstName}! 👋</h1>
            <p className="text-sm text-muted-foreground">{format(new Date(), 'EEEE, MMMM d')}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
            </Button>
            <Button variant="ghost" size="icon" asChild>
              <Link href="/profile">
                <Settings className="h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 space-y-6 max-w-lg mx-auto">
        {/* Week Selector */}
        <WeekSelector
          selectedDate={selectedDate}
          onDateSelect={setSelectedDate}
          weekData={weekData}
          dailyTarget={dailyCalories}
        />

        {/* Day Summary */}
        <DaySummary
          consumed={todayConsumed}
          target={dailyCalories}
          protein={{ current: currentProtein, target: proteinTarget }}
          carbs={{ current: currentCarbs, target: carbsTarget }}
          fat={{ current: currentFat, target: currentFat }}
        />

        {/* Meals Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Today's Meals</h2>
            <Button variant="ghost" size="sm" className="text-primary" asChild>
              <Link href="/plans">View Plan</Link>
            </Button>
          </div>
          
          <div className="space-y-3">
            {meals.map((meal) => (
              <MealCard
                key={meal.name}
                meal={meal}
                onAddFood={() => {
                  // Navigate to meal builder or open add food modal
                  console.log('Add food to', meal.name)
                }}
              />
            ))}
          </div>
        </section>

        {/* Quick Stats */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Weekly Overview</h2>
          <QuickStats
            streak={5}
            weeklyAverage={Math.round(dailyCalories * 0.95)}
            weeklyTarget={dailyCalories}
          />
        </section>

        {/* Admin link if applicable */}
        {(profile.role === 'admin' || profile.role === 'moderator') && (
          <div className="pt-4 border-t border-border">
            <Button variant="outline" className="w-full" asChild>
              <Link href="/admin">
                Go to Admin Panel
              </Link>
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}
