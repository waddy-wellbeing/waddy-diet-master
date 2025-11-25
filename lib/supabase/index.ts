/**
 * Supabase Client Utilities
 * 
 * Usage:
 * - Client Components: import { createClient } from '@/lib/supabase/client'
 * - Server Components: import { createClient } from '@/lib/supabase/server'
 * 
 * The browser client is for "use client" components only.
 * The server client handles cookie-based auth automatically.
 */

// Re-export for convenience - but prefer direct imports for clarity
export { createClient as createBrowserClient } from './client'
export { createClient as createServerClient } from './server'
