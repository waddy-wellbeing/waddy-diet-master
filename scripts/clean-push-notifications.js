/**
 * Clean Push Notifications - Browser Cleanup Script
 * 
 * Run this in the browser console if you're having issues with push notifications:
 * 1. Open DevTools (F12)
 * 2. Go to Console tab
 * 3. Copy and paste this entire script
 * 4. Press Enter
 * 5. Refresh the page after it completes
 */

(async function cleanPushNotifications() {
  console.log('🧹 Starting push notification cleanup...\n')

  // Step 1: Unregister all service workers
  console.log('1️⃣ Unregistering service workers...')
  try {
    const registrations = await navigator.serviceWorker.getRegistrations()
    console.log(`   Found ${registrations.length} service worker(s)`)
    
    for (const registration of registrations) {
      console.log(`   Unregistering: ${registration.scope}`)
      await registration.unregister()
    }
    console.log('   ✅ All service workers unregistered\n')
  } catch (err) {
    console.error('   ❌ Error unregistering service workers:', err)
  }

  // Step 2: Clear all push subscriptions
  console.log('2️⃣ Clearing push subscriptions...')
  try {
    const registrations = await navigator.serviceWorker.getRegistrations()
    for (const registration of registrations) {
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        console.log(`   Found subscription: ${subscription.endpoint.substring(0, 50)}...`)
        await subscription.unsubscribe()
        console.log('   ✅ Unsubscribed')
      }
    }
    console.log('   ✅ All push subscriptions cleared\n')
  } catch (err) {
    console.error('   ❌ Error clearing subscriptions:', err)
  }

  // Step 3: Clear cache storage
  console.log('3️⃣ Clearing cache storage...')
  try {
    const cacheNames = await caches.keys()
    console.log(`   Found ${cacheNames.length} cache(s)`)
    
    for (const cacheName of cacheNames) {
      console.log(`   Deleting: ${cacheName}`)
      await caches.delete(cacheName)
    }
    console.log('   ✅ All caches cleared\n')
  } catch (err) {
    console.error('   ❌ Error clearing caches:', err)
  }

  // Step 4: Clear IndexedDB
  console.log('4️⃣ Clearing IndexedDB...')
  try {
    const dbs = await indexedDB.databases()
    console.log(`   Found ${dbs.length} database(s)`)
    
    for (const db of dbs) {
      if (db.name) {
        console.log(`   Deleting: ${db.name}`)
        indexedDB.deleteDatabase(db.name)
      }
    }
    console.log('   ✅ IndexedDB cleared\n')
  } catch (err) {
    console.error('   ❌ Error clearing IndexedDB:', err)
  }

  // Step 5: Clear localStorage and sessionStorage
  console.log('5️⃣ Clearing storage...')
  try {
    localStorage.clear()
    sessionStorage.clear()
    console.log('   ✅ localStorage and sessionStorage cleared\n')
  } catch (err) {
    console.error('   ❌ Error clearing storage:', err)
  }

  // Final summary
  console.log('✨ Cleanup complete!')
  console.log('\n📝 Next steps:')
  console.log('   1. Refresh this page (Cmd+R / Ctrl+R)')
  console.log('   2. Re-enable push notifications in your profile')
  console.log('   3. The error should be gone! 🎉\n')
})()
