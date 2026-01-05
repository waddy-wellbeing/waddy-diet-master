import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PlanContent } from './plans-content'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import type { DailyPlanRecord } from '@/lib/types/nutri'

export const metadata: Metadata = {
  title: 'Meal Plans | Waddy Diet Master',
  description: 'View your personalized meal plans',
}

export default async function PlansPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!profile?.onboarding_completed) {
    redirect('/onboarding')
  }

  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')
  const monthStart = format(startOfMonth(today), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(today), 'yyyy-MM-dd')
  const twoMonthsAgo = format(subMonths(today, 2), 'yyyy-MM-dd')

  // Fetch plans for the current and past months
  const { data: plans } = await supabase
    .from('daily_plans')
    .select('*')
    .eq('user_id', user.id)
    .gte('plan_date', twoMonthsAgo)
    .order('plan_date', { ascending: false })

  // Fetch all recipes for display
  const { data: recipes } = await supabase
    .from('recipes')
    .select('id, name, image_url, prep_time_minutes, cook_time_minutes')
    .eq('is_public', true)

  const recipeMap = new Map(recipes?.map(r => [r.id, r]) ?? [])

  // Get today's plan specifically
  const todayPlan = (plans ?? []).find(p => p.plan_date === todayStr)

  return (
    <PlanContent 
      profile={profile}
      todayPlan={todayPlan}
      allPlans={plans as DailyPlanRecord[] ?? []}
      recipes={recipeMap}
      today={today}
    />
  )
}
