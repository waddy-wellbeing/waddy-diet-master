'use client'

import { createClient } from '@/lib/supabase/client'

/**
 * Centralized logout function that clears all sessions and local data.
 * Use this instead of calling signOut directly.
 */
export async function logout() {
  const supabase = createClient()
  
  // Sign out from Supabase
  await supabase.auth.signOut()
  
  // Clear all localStorage
  if (typeof window !== 'undefined') {
    localStorage.clear()
    
    // Also clear sessionStorage for good measure
    sessionStorage.clear()
    
    // Clear any specific keys that might persist
    const keysToRemove = [
      'supabase.auth.token',
      'sb-auth-token',
      'user-preferences',
      'cached-recipes',
      'meal-plans',
      'onboarding-progress',
    ]
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key)
      sessionStorage.removeItem(key)
    })
  }
  
  return true
}
