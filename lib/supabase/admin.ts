import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from './server'

/**
 * Creates a Supabase admin client using the service role key.
 * This client bypasses Row Level Security (RLS) policies.
 * 
 * ⚠️ ONLY use this on the server-side for admin operations!
 * Never expose the service role key to the client.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set in environment variables')
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

/**
 * Auto-select the appropriate Supabase client based on user role.
 * Returns admin client for admin/moderator users, regular client for others.
 * 
 * ⚠️ ONLY use in server-side code (Server Components, Server Actions, Route Handlers)
 */
export async function getSupabaseClient() {
  const supabase = await createClient()
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return supabase // Not authenticated, return regular client
  }

  // Check user role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  // If admin or moderator, return admin client (bypasses RLS)
  if (profile?.role === 'admin' || profile?.role === 'moderator') {
    return createAdminClient()
  }

  // Regular user, return standard client
  return supabase
}
