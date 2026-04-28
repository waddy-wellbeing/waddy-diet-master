'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth'

/**
 * Admin action: reset a user's password to a temporary value and flag
 * their account so they are forced to set a new password on next login.
 *
 * Uses the Supabase admin client (service-role key) which bypasses RLS.
 */
export async function adminResetUserPassword(
  userId: string,
  temporaryPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Ensure the caller is an admin/moderator
    await requireAdmin()

    if (!userId || !temporaryPassword) {
      return { success: false, error: 'User ID and temporary password are required' }
    }

    if (temporaryPassword.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters' }
    }

    const adminClient = createAdminClient()

    const { error } = await adminClient.auth.admin.updateUserById(userId, {
      password: temporaryPassword,
      user_metadata: { force_password_reset: true },
    })

    if (error) {
      console.error('[adminResetUserPassword] Error:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred'
    console.error('[adminResetUserPassword] Unexpected error:', err)
    return { success: false, error: message }
  }
}
