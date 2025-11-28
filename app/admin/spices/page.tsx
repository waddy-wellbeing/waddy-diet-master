import { getDefaultSpices } from '@/lib/spices'

/**
 * Admin Spices Page
 * 
 * Lists all default spices from the spices table.
 * This page verifies that the spices table is reachable and types are wired up.
 */
export default async function AdminSpicesPage() {
  const spices = await getDefaultSpices()

  return (
    <main className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Spices Database</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Reference spices for recipe ingredients. These do not contribute to macro calculations.
        </p>
      </div>

      {spices.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-2">
            No spices found in the database.
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Add spices to the <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">spices</code> table
            using the Supabase dashboard or SQL.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Showing {spices.length} spice{spices.length !== 1 ? 's' : ''}
          </p>
          
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Arabic Name</th>
                  <th className="px-4 py-3 text-left font-medium">Aliases</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {spices.map((spice) => (
                  <tr key={spice.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3 font-medium">{spice.name}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {spice.name_ar || '—'}
                    </td>
                    <td className="px-4 py-3">
                      {spice.aliases.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {spice.aliases.map((alias, i) => (
                            <span
                              key={i}
                              className="inline-block px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 rounded"
                            >
                              {alias}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  )
}
