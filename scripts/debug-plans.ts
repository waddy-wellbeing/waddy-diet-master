// Debug script to check daily_plans table
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

console.log('Supabase URL:', supabaseUrl)
console.log('Using key type:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SERVICE_ROLE' : 'ANON')

const supabase = createClient(supabaseUrl, supabaseKey)

async function debug() {
  // 1. Check total count of daily_plans
  console.log('\n=== Checking daily_plans table ===')
  const { count, error: countError } = await supabase
    .from('daily_plans')
    .select('*', { count: 'exact', head: true })
  
  if (countError) {
    console.error('Error counting daily_plans:', countError)
  } else {
    console.log('Total plans in database:', count)
  }

  // 2. Get sample plans
  console.log('\n=== Sample plans ===')
  const { data: samplePlans, error: sampleError } = await supabase
    .from('daily_plans')
    .select('id, user_id, plan_date, plan')
    .limit(5)
  
  if (sampleError) {
    console.error('Error fetching sample plans:', sampleError)
  } else {
    console.log('Sample plans:', JSON.stringify(samplePlans, null, 2))
  }

  // 3. Get all unique user_ids with plans
  console.log('\n=== Users with plans ===')
  const { data: usersWithPlans, error: usersError } = await supabase
    .from('daily_plans')
    .select('user_id')
  
  if (usersError) {
    console.error('Error fetching users with plans:', usersError)
  } else {
    const uniqueUsers = [...new Set(usersWithPlans?.map(p => p.user_id))]
    console.log('Unique users with plans:', uniqueUsers)
  }

  // 4. Check plans for specific user
  const targetUserId = '245c79b2-9686-4aee-9127-0008c7325a79'
  console.log(`\n=== Plans for user ${targetUserId} ===`)
  const { data: userPlans, error: userPlansError } = await supabase
    .from('daily_plans')
    .select('*')
    .eq('user_id', targetUserId)
  
  if (userPlansError) {
    console.error('Error fetching user plans:', userPlansError)
  } else {
    console.log('Plans for target user:', JSON.stringify(userPlans, null, 2))
  }
}

debug().catch(console.error)
