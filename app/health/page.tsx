import { createClient } from '@/lib/supabase/server'

/**
 * Health Check Page
 * 
 * Verifies that the app can connect to Supabase.
 * Access at: /health
 */
export default async function HealthPage() {
  let status: 'ok' | 'error' = 'ok'
  let message = 'Connected to Supabase successfully'
  let details: Record<string, unknown> = {}

  try {
    const supabase = await createClient()
    
    // Try a simple query to verify connection
    const { data, error } = await supabase
      .from('ingredients')
      .select('id')
      .limit(1)

    if (error) {
      // If table doesn't exist yet, that's expected before running schema
      if (error.code === '42P01') {
        status = 'ok'
        message = 'Connected to Supabase, but ingredients table does not exist yet. Run the schema.sql first.'
        details = { hint: 'Run supabase/schema.sql in your Supabase SQL Editor' }
      } else {
        status = 'error'
        message = error.message
        details = { code: error.code, hint: error.hint }
      }
    } else {
      details = { 
        ingredients_count: data?.length ?? 0,
        table_exists: true 
      }
    }
  } catch (err) {
    status = 'error'
    message = err instanceof Error ? err.message : 'Unknown error'
    details = { 
      hint: 'Check your .env.local file has correct NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY' 
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-4">
        <div className={`p-6 rounded-lg border ${
          status === 'ok' 
            ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' 
            : 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'
        }`}>
          <h1 className="text-2xl font-bold mb-2">
            BiteRight Health Check
          </h1>
          
          <div className="space-y-2">
            <p className="flex items-center gap-2">
              <span className={`inline-block w-3 h-3 rounded-full ${
                status === 'ok' ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <span className="font-medium capitalize">{status}</span>
            </p>
            
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {message}
            </p>

            {Object.keys(details).length > 0 && (
              <pre className="mt-4 p-3 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-auto">
                {JSON.stringify(details, null, 2)}
              </pre>
            )}
          </div>
        </div>

        <p className="text-sm text-center text-gray-500">
          Environment: {process.env.NODE_ENV}
        </p>
      </div>
    </main>
  )
}
