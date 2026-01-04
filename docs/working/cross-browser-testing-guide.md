# Cross-Browser Testing Guide - Push Notifications

## Overview

This guide provides comprehensive testing procedures for push notifications across different browsers and platforms. Push notification behavior varies significantly between browsers, so thorough testing is essential.

---

## Browser Support Matrix

| Browser | Desktop Support | Mobile Support | Notes |
|---------|----------------|----------------|-------|
| **Chrome** | ✅ Full | ✅ Full | Best support, reference implementation |
| **Firefox** | ✅ Full | ✅ Full | Excellent support on Android |
| **Safari** | ✅ macOS 13+ | ⚠️ iOS 16.4+ PWA only | iOS requires PWA installation |
| **Edge** | ✅ Full | ✅ Full | Chromium-based, similar to Chrome |
| **Opera** | ✅ Full | ✅ Full | Chromium-based |
| **Samsung Internet** | N/A | ✅ Full | Popular on Android |
| **Brave** | ✅ Full | ⚠️ Shields may block | Privacy-focused, may require adjustments |

---

## Pre-Testing Checklist

### Backend Requirements
- [ ] VAPID keys generated and configured in `.env`
- [ ] `NEXT_PUBLIC_VAPID_PUBLIC_KEY` set in environment
- [ ] `VAPID_PRIVATE_KEY` set securely (server-side only)
- [ ] `VAPID_SUBJECT` set (mailto: or https: URL)
- [ ] Service worker deployed and accessible at `/sw.js`
- [ ] HTTPS enabled (required for push notifications)

### Database Setup
- [ ] `push_subscriptions` table exists with RLS enabled
- [ ] `notifications_log` table exists
- [ ] `notification_settings` table exists with default values
- [ ] Test user account created with admin access

### Application Setup
- [ ] Notification permission prompt working
- [ ] Subscription save flow functional
- [ ] Admin panel accessible
- [ ] Click tracking API endpoint working (`/api/notifications/track-click`)

---

## Testing Procedures by Browser

### 1. Google Chrome (Desktop & Mobile)

**Version Tested:** Chrome 120+ (update to current)

#### Desktop Testing Steps

1. **Initial Permission**
   ```
   1. Navigate to app homepage
   2. Clear site data: DevTools → Application → Clear storage
   3. Refresh page
   4. Look for permission prompt (or click bell icon)
   5. Click "Allow"
   6. Verify permission granted in chrome://settings/content/notifications
   ```

2. **Subscription**
   ```
   1. Open DevTools → Console
   2. Check for "Subscription successful" message
   3. Verify subscription in database: SELECT * FROM push_subscriptions
   4. Check is_active = true
   ```

3. **Send Test Notification**
   ```
   1. Go to Admin Panel → Notifications
   2. Send test to your user
   3. Notification should appear in system tray (top-right on Windows, top-right on macOS)
   4. Click notification → should navigate to specified URL
   5. Check database: clicked_at should be populated
   ```

4. **Service Worker**
   ```
   1. DevTools → Application → Service Workers
   2. Verify service worker registered and activated
   3. Test "Update on reload" checkbox
   4. Send notification with browser closed → should still receive
   ```

#### Mobile Testing Steps (Android)

1. **Enable Notifications**
   ```
   1. Open Chrome on Android
   2. Visit app URL (HTTPS required)
   3. Accept notification permission
   4. Verify in Chrome Settings → Site Settings → Notifications
   ```

2. **Background Notifications**
   ```
   1. Send test notification
   2. Lock phone
   3. Notification should appear on lock screen
   4. Tap notification → should open app to correct page
   ```

3. **PWA Mode**
   ```
   1. Add app to home screen: Menu → Add to Home screen
   2. Launch from home screen icon
   3. Send notification → should work in standalone mode
   ```

**Known Issues:**
- Incognito mode: Notifications disabled by default
- Localhost: May have issues, use ngrok for testing

---

### 2. Mozilla Firefox (Desktop & Mobile)

**Version Tested:** Firefox 120+ (update to current)

#### Desktop Testing Steps

1. **Permission Prompt**
   ```
   1. Clear site data in Firefox: Settings → Privacy → Clear Data
   2. Visit app
   3. Firefox shows permission bar at top (not popup)
   4. Click "Allow Notifications"
   5. Verify in about:preferences#privacy → Permissions → Notifications
   ```

2. **Send & Receive**
   ```
   1. Send test from admin panel
   2. Notification appears in system tray
   3. Firefox logo visible on notification
   4. Click → navigates correctly
   ```

3. **Debugging**
   ```
   1. about:serviceworkers - View registered workers
   2. about:debugging#/runtime/this-firefox - Debug service workers
   3. Console logs visible in Browser Console (Ctrl+Shift+J)
   ```

#### Mobile Testing Steps (Android)

1. **Setup**
   ```
   1. Firefox for Android supports push fully
   2. Grant notification permission
   3. Test with app in background and foreground
   ```

**Known Issues:**
- Desktop: Windows notification center integration varies
- Mobile: Excellent support, sometimes better than Chrome on Android

---

### 3. Safari (macOS & iOS)

**Version Tested:** Safari 16.4+ (iOS), Safari 16+ (macOS)

#### macOS Testing Steps

1. **Enable Push (macOS 13+ Ventura)**
   ```
   1. System Settings → Notifications → Safari
   2. Ensure Safari allowed to send notifications
   3. Visit app, grant permission
   4. Test notification appearance
   ```

2. **Service Worker**
   ```
   1. Safari → Develop → Service Workers (show Develop menu in preferences)
   2. Verify service worker registered
   3. May need to close/reopen Safari for updates
   ```

**Known Issues:**
- macOS: Requires macOS 13 Ventura or later
- Service worker caching aggressive - may need force refresh

#### iOS Testing Steps (iOS 16.4+)

**CRITICAL:** iOS Safari only supports push in PWA mode (not regular browser tabs)

1. **Add to Home Screen**
   ```
   1. Open app in Safari
   2. Tap Share button → Add to Home Screen
   3. Name the app and add
   4. Launch from home screen icon (NOT Safari)
   ```

2. **Grant Permission**
   ```
   1. In PWA mode, prompt appears
   2. Grant notification permission
   3. Verify in Settings → [App Name] → Notifications
   ```

3. **Test Notifications**
   ```
   1. Lock iPhone
   2. Send test notification from admin
   3. Notification should appear on lock screen
   4. Tap to open PWA
   ```

**Known Issues:**
- iOS: Must be installed as PWA (standalone mode)
- iOS: Regular Safari tabs do NOT support push
- iOS: Notifications may be delayed by system battery optimization
- iOS: "Add to Home Screen" must be done manually (no browser prompt)

**Testing Checklist iOS:**
- [ ] App added to home screen
- [ ] Launched from home screen (standalone mode)
- [ ] Permission prompt appeared
- [ ] Notification received when app closed
- [ ] Notification received when phone locked
- [ ] Tapping notification opens app

---

### 4. Microsoft Edge (Desktop & Mobile)

**Version Tested:** Edge 120+ (Chromium-based)

#### Testing Steps

1. **General**
   ```
   - Edge uses Chromium, so behavior similar to Chrome
   - Test permission, subscription, delivery same as Chrome
   - Windows Action Center integration excellent
   ```

2. **Differences from Chrome**
   ```
   - May show "Microsoft Edge" branding on notifications
   - Settings: edge://settings/content/notifications
   - Service workers: edge://serviceworker-internals
   ```

**Known Issues:**
- None major - excellent support

---

### 5. Samsung Internet (Mobile - Android)

**Version Tested:** Samsung Internet 20+

#### Testing Steps

1. **Setup**
   ```
   1. Popular default browser on Samsung devices
   2. Grant notification permission
   3. Test same as Chrome Android
   ```

2. **Differences**
   ```
   - May use Samsung-specific notification style
   - Check Settings → Sites and downloads → Notifications
   - Generally good support
   ```

---

## Common Testing Scenarios

### Scenario 1: Meal Reminder (Automated)

**Test:** Breakfast reminder at 7:30 AM

1. Set system time to 7:25 AM (or use cron override)
2. Ensure user has:
   - `meal_reminders = true`
   - `push_enabled = true`
   - Daily plan with breakfast
   - Not in quiet hours
3. Trigger edge function or wait for cron
4. Verify notification received with recipe name
5. Click notification → should open `/dashboard`

### Scenario 2: Achievement (Real-time)

**Test:** 7-day streak achievement

1. Manually set up 6 consecutive days of logs
2. Log a meal on 7th day
3. Achievement notification should fire immediately
4. Verify emoji, title, body correct
5. Click → opens `/dashboard`

### Scenario 3: Broadcast (Admin)

**Test:** Send to all users

1. Admin panel → Broadcast
2. Enter title, body, URL
3. Send
4. Should respect:
   - Quiet hours (filter out)
   - `push_enabled = false` (skip)
   - Invalid subscriptions (mark inactive)
5. Verify delivery report accurate

### Scenario 4: Quiet Hours

**Test:** Notification blocked during quiet hours

1. User sets quiet hours 22:00-08:00
2. Send test at 23:00 (11 PM)
3. Notification should NOT be sent
4. Check logs - no record created
5. Send test at 09:00 (9 AM)
6. Notification should deliver

---

## Debugging Tools

### Chrome DevTools

```bash
# Console commands
navigator.serviceWorker.getRegistration()
  .then(reg => console.log(reg))

# Check push subscription
navigator.serviceWorker.ready.then(registration => {
  registration.pushManager.getSubscription()
    .then(sub => console.log(sub))
})

# Test service worker message
navigator.serviceWorker.controller.postMessage({ test: true })
```

### Firefox DevTools

```
about:debugging#/runtime/this-firefox
→ Inspect service worker
→ View console logs
```

### Safari DevTools

```
Develop → Service Workers
→ Inspect service worker
→ May need to enable Develop menu in Preferences
```

---

## Troubleshooting Guide

### Issue: Permission Denied

**Symptoms:** User clicks "Allow" but subscription fails

**Solutions:**
1. Check VAPID keys are correct in environment
2. Verify HTTPS enabled
3. Clear browser cache and try again
4. Check browser console for errors
5. Ensure service worker registered before subscribing

### Issue: Notifications Not Appearing

**Symptoms:** API call succeeds but notification doesn't show

**Solutions:**
1. Check system notification settings enabled
2. Verify browser notification permission granted
3. Test with browser open (foreground)
4. Check "Do Not Disturb" mode disabled
5. iOS: Ensure PWA mode, not Safari browser
6. Check service worker `push` event listener

### Issue: Click Not Tracked

**Symptoms:** Notification shows but clicked_at remains null

**Solutions:**
1. Verify `/api/notifications/track-click` endpoint working
2. Check `notificationId` in payload
3. Ensure service worker `notificationclick` handler sends fetch
4. Check browser console for CORS errors
5. Verify database UPDATE permissions (RLS)

### Issue: Service Worker Not Updating

**Symptoms:** Code changes not reflected in notifications

**Solutions:**
1. Clear browser cache completely
2. Unregister service worker manually
3. Chrome: DevTools → Application → Service Workers → Unregister
4. Hard refresh (Ctrl+Shift+R / Cmd+Shift+R)
5. Update service worker version number

---

## Performance Testing

### Load Testing

**Test:** Send broadcast to 100+ users

1. Create 100 test users with subscriptions
2. Send broadcast notification
3. Monitor:
   - Time to complete
   - Success vs failure rate
   - Server CPU/memory usage
   - Database query performance
4. Batch processing should keep time reasonable (< 5 minutes)

### Rate Limiting

**Test:** Verify rate limits prevent abuse

1. Send 30 notifications in 1 minute (admin send limit)
2. 31st should fail with rate limit error
3. Wait 1 minute, try again → should succeed
4. Broadcast: 5 per minute limit
5. Automated: 1000 per minute (sufficient)

---

## Compliance & Privacy

### GDPR Compliance

- [ ] Users can opt-out via profile settings
- [ ] Subscription data deleted when user deletes account
- [ ] Clear privacy policy regarding notification data
- [ ] Consent obtained before subscribing

### Accessibility

- [ ] Notification titles clear and descriptive
- [ ] Screen reader friendly
- [ ] High contrast icons
- [ ] Text not reliant on color alone

---

## Production Checklist

Before launching to production:

### Infrastructure
- [ ] VAPID keys generated and secured
- [ ] HTTPS certificate valid and auto-renewing
- [ ] Service worker cached properly (set cache headers)
- [ ] Rate limiting configured appropriately
- [ ] Database backups include notification tables

### Testing
- [ ] Tested on Chrome (Desktop + Android)
- [ ] Tested on Firefox (Desktop + Android)
- [ ] Tested on Safari (macOS + iOS PWA)
- [ ] Tested on Edge (Desktop)
- [ ] All 4 notification types tested (meal reminder, daily summary, weekly report, achievement)
- [ ] Quiet hours respected
- [ ] Click tracking verified
- [ ] Invalid subscriptions cleaned up

### Monitoring
- [ ] Error logging configured
- [ ] Analytics dashboard accessible
- [ ] Delivery rate > 90%
- [ ] Click rate > 5%
- [ ] Alerts set up for high failure rate

### Documentation
- [ ] User-facing docs on enabling notifications
- [ ] Admin training on broadcast usage
- [ ] Privacy policy updated
- [ ] Support team trained on troubleshooting

---

## Resources

### Specifications
- [Web Push API](https://www.w3.org/TR/push-api/)
- [Service Worker API](https://www.w3.org/TR/service-workers/)
- [Notifications API](https://notifications.spec.whatwg.org/)

### Browser Documentation
- [Chrome Push Notifications](https://developer.chrome.com/docs/web-platform/push-notifications/)
- [Firefox Push](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Safari Push](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers)

### Testing Tools
- [Pushpad Test](https://pushpad.xyz/test) - Test web push
- [web-push-testing](https://github.com/GoogleChrome/web-push-testing) - Command-line testing
- [Can I Use](https://caniuse.com/push-api) - Browser support

---

## Summary

**Recommended Testing Order:**
1. Chrome Desktop (easiest, best debugging)
2. Firefox Desktop (good debugging tools)
3. Chrome Android (mobile standard)
4. Safari iOS PWA (most complex, requires PWA)
5. Edge Desktop (quick verification)

**Critical Success Criteria:**
- ✅ Notifications deliver on Chrome, Firefox, Safari
- ✅ iOS works in PWA mode
- ✅ Click tracking functional
- ✅ Quiet hours respected
- ✅ Rate limiting prevents abuse
- ✅ Invalid subscriptions cleaned up

**Common Pitfalls:**
- ❌ Testing iOS in Safari browser (won't work - needs PWA)
- ❌ Localhost without HTTPS (won't work)
- ❌ Forgetting to update service worker
- ❌ Not testing with browser closed (background)
- ❌ Ignoring quiet hours in tests

---

**Next Steps:**
1. Test on primary browser (Chrome)
2. Fix any issues before proceeding
3. Test on Safari (most restricted)
4. Document any browser-specific workarounds
5. Set up monitoring and alerts
6. Deploy to production incrementally
