import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ShoppingListContent } from './shopping-list-content'
import { getShoppingList, getWeekPlanCount } from '@/lib/actions/shopping-lists'

export default async function ShoppingListPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  // Fetch current week's shopping list
  const currentDate = new Date()
  const shoppingListResult = await getShoppingList(currentDate)
  const planCountResult = await getWeekPlanCount(currentDate)

  const shoppingList = shoppingListResult.success ? shoppingListResult.data : null
  const planCount = planCountResult.success ? planCountResult.data : 0

  return (
    <ShoppingListContent 
      initialShoppingList={shoppingList}
      initialPlanCount={planCount}
    />
  )
}
