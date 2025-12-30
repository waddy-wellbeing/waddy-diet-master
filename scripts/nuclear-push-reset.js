/**
 * NUCLEAR OPTION: Complete Push Notification Reset
 * 
 * This will completely reset ALL browser push notification state.
 * Use this ONLY if the regular cleanup doesn't work.
 * 
 * HOW TO USE:
 * 1. Close ALL tabs/windows of localhost:3000
 * 2. Open ONE new tab with localhost:3000
 * 3. Open DevTools (F12) → Console tab
 * 4. Copy/paste this entire script and press Enter
 * 5. Wait for it to complete
 * 6. Close and reopen browser completely
 * 7. Navigate back to localhost:3000
 */

(async function nuclearReset() {
  console.log('💣 NUCLEAR RESET STARTING...\n')
  console.log('⚠️  This will completely reset push notifications\n')

  try {
    // Step 1: Get all registrations
    const regs = await navigator.serviceWorker.getRegistrations()
    console.log(`Found ${regs.length} service worker registrations`)

    // Step 2: For each registration, get and unsubscribe from push
    for (const reg of regs) {
      console.log(`\nProcessing: ${reg.scope}`)
      
      try {
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          console.log('  → Found push subscription:', sub.endpoint.substring(0, 60) + '...')
          await sub.unsubscribe()
          console.log('  ✅ Unsubscribed from push')
        } else {
          console.log('  → No push subscription found')
        }
      } catch (e) {
        console.log('  ⚠️  Error with push subscription:', e.message)
      }

      // Unregister the service worker
      try {
        await reg.unregister()
        console.log('  ✅ Service worker unregistered')
      } catch (e) {
        console.log('  ⚠️  Error unregistering:', e.message)
      }
    }

    // Step 3: Clear everything
    console.log('\n🗑️  Clearing storage...')
    
    // Clear caches
    const cacheNames = await caches.keys()
    await Promise.all(cacheNames.map(name => caches.delete(name)))
    console.log(`  ✅ Cleared ${cacheNames.length} caches`)

    // Clear storage
    localStorage.clear()
    sessionStorage.clear()
    console.log('  ✅ Cleared local/session storage')

    // Clear IndexedDB
    const dbs = await indexedDB.databases()
    dbs.forEach(db => db.name && indexedDB.deleteDatabase(db.name))
    console.log(`  ✅ Cleared ${dbs.length} IndexedDB databases`)

    console.log('\n✨ NUCLEAR RESET COMPLETE!\n')
    console.log('📋 IMPORTANT NEXT STEPS:')
    console.log('   1. Close this browser completely (⌘+Q on Mac, Alt+F4 on Windows)')
    console.log('   2. Wait 5 seconds')
    console.log('   3. Reopen browser')
    console.log('   4. Go to chrome://gcm-internals/ (Chrome) or about:serviceworkers (Firefox)')
    console.log('   5. Clear any push subscriptions there')
    console.log('   6. Navigate back to localhost:3000')
    console.log('   7. Try enabling notifications again\n')

  } catch (error) {
    console.error('❌ Nuclear reset failed:', error)
  }
})()
