# Testing Push Notifications - Step by Step Guide

**Date:** December 29, 2025  
**Steps Tested:** Step 1 (Click Tracking) + Step 2 (Icon Assets)  
**Prerequisites:** Local dev server running

---

## 🚀 Quick Start

```bash
# 1. Start your dev server (if not already running)
npm run dev

# 2. Open browser to http://localhost:3000
```

---

## ✅ Test Checklist

### Phase 1: User Subscription (5 minutes)

#### 1.1 Enable Notifications
1. **Navigate to Profile:**
   - Go to `http://localhost:3000` and login
   - Click on your profile/avatar
   - Find the "Notifications" section

2. **Subscribe to Push Notifications:**
   - Toggle "Push Notifications" ON
   - Browser will show permission request: **Click "Allow"**
   - ✅ Verify you see "Active" indicator

3. **Verify in Database:**
   ```sql
   -- In Supabase SQL Editor
   SELECT 
     user_id, 
     endpoint, 
     device_type, 
     device_name, 
     is_active, 
     created_at
   FROM push_subscriptions
   ORDER BY created_at DESC
   LIMIT 5;
   ```
   - ✅ Should see your new subscription with `is_active = true`

---

### Phase 2: Send Test Notification (5 minutes)

#### 2.1 Access Admin Panel
1. **Navigate to Admin:**
   - Go to `http://localhost:3000/admin/notifications`
   - Must be logged in as admin user

2. **Verify Stats Dashboard:**
   - ✅ Check "Active Devices" shows 1 (your subscription)
   - ✅ Check "Users with Push" shows 1
   - ✅ Stats should update in real-time

#### 2.2 Send Notification to Yourself
1. **Fill Out Notification Form:**
   ```
   Send Mode: [Single User]
   
   Select User: [Your Name/Email]
   
   Title: "🍽️ Test Notification"
   
   Message: "This is a test notification with click tracking!"
   
   URL (optional): "/dashboard"
   ```

2. **Click "Send to User"**
   - ✅ Should see success message: "Sent to 1 device(s)"
   - No error messages

3. **Verify Notification Appears:**
   - **Desktop:** Notification appears in system tray (top-right on Mac/Windows)
   - **Mobile:** Notification appears in notification center
   - ✅ Check icon shows lime green with lightning bolt ⚡
   - ✅ Check title shows "🍽️ Test Notification"
   - ✅ Check body shows your message

---

### Phase 3: Test Click Tracking (3 minutes)

#### 3.1 Click the Notification
1. **Click on the notification** (within 30 seconds of receiving)
   - ✅ Should open/focus browser window
   - ✅ Should navigate to `/dashboard` (if you set URL)
   - ✅ Notification should disappear after clicking

#### 3.2 Verify Click Tracking in Database
```sql
-- In Supabase SQL Editor
SELECT 
  id,
  title,
  body,
  notification_type,
  status,
  sent_at,
  clicked_at,
  EXTRACT(EPOCH FROM (clicked_at - sent_at)) AS seconds_to_click
FROM notifications_log
ORDER BY sent_at DESC
LIMIT 5;
```

**Expected Results:**
- ✅ Your test notification appears in the list
- ✅ `status` = 'clicked' (was 'sent' before you clicked)
- ✅ `clicked_at` has a timestamp
- ✅ `seconds_to_click` shows how long between send and click

---

### Phase 4: Test Broadcast (Optional - 3 minutes)

#### 4.1 Create Second User (if available)
1. Create another test user account
2. Subscribe them to notifications (same process as Phase 1)

#### 4.2 Send Broadcast
1. **In Admin Panel:**
   ```
   Send Mode: [Broadcast]
   
   Title: "📢 Team Announcement"
   
   Message: "Testing broadcast to all users!"
   
   URL: "/"
   ```

2. **Click "Send Broadcast"**
   - ✅ Should see: "Broadcast sent to 2/2 devices" (or similar)
   - Both users receive notification

3. **Verify in Database:**
   ```sql
   SELECT 
     title,
     is_broadcast,
     status,
     COUNT(*) as recipient_count
   FROM notifications_log
   WHERE is_broadcast = true
   GROUP BY title, is_broadcast, status
   ORDER BY MAX(sent_at) DESC;
   ```
   - ✅ Should show your broadcast with count

---

## 🔍 Troubleshooting

### Issue: Permission Denied
**Symptom:** Browser blocks notification permission request

**Solutions:**
1. **Chrome:** Settings → Privacy → Site Settings → Notifications → Allow `localhost`
2. **Firefox:** Settings → Privacy → Permissions → Notifications → Settings → Allow `localhost`
3. **Safari:** Preferences → Websites → Notifications → Allow `localhost`

**Quick Reset:**
```javascript
// In browser console
navigator.serviceWorker.getRegistrations().then(r => r.forEach(reg => reg.unregister()))
// Refresh page and try again
```

---

### Issue: No Notification Appears
**Checklist:**
- [ ] Browser has notification permission granted
- [ ] Do Not Disturb mode is OFF on your OS
- [ ] Service worker is registered (check console)
- [ ] Admin panel shows "Sent to 1 device(s)" success message
- [ ] No errors in browser console or terminal

**Debug Commands:**
```javascript
// In browser console

// 1. Check service worker status
navigator.serviceWorker.getRegistrations()
  .then(r => console.log('Registrations:', r))

// 2. Check push subscription
navigator.serviceWorker.ready
  .then(reg => reg.pushManager.getSubscription())
  .then(sub => console.log('Subscription:', sub))

// 3. Check permission
console.log('Permission:', Notification.permission)
```

---

### Issue: Icons Don't Display
**Symptom:** Notification shows but no icon/badge

**Verify:**
```bash
# Check icon files exist
ls -lh public/icons/

# Should see:
# icon-192x192.png (2-3KB)
# badge-72x72.png (700B-1KB)
```

**Regenerate if needed:**
```bash
node scripts/generate-notification-icons.mjs
```

---

### Issue: Click Tracking Not Working
**Symptom:** Notification received but `clicked_at` remains NULL

**Debug:**
1. **Check API endpoint:**
   ```bash
   curl http://localhost:3000/api/notifications/track-click
   # Should return: {"status":"ok","endpoint":"/api/notifications/track-click","methods":["POST"]}
   ```

2. **Check browser console** after clicking notification
   - Look for any fetch errors to `/api/notifications/track-click`
   - Look for CORS issues

3. **Check notification payload includes ID:**
   ```sql
   -- Verify notification was logged with an ID
   SELECT id, title, sent_at FROM notifications_log ORDER BY sent_at DESC LIMIT 1;
   ```

4. **Manual test API:**
   ```bash
   curl -X POST http://localhost:3000/api/notifications/track-click \
     -H "Content-Type: application/json" \
     -d '{"notificationId":"<ID_FROM_DATABASE>"}'
   # Should return: {"success":true}
   ```

---

## 📊 Success Criteria

After completing all tests, you should have:

✅ **Subscription Working:**
- [ ] User can enable notifications in profile
- [ ] Subscription saved to database with correct user_id
- [ ] Admin panel shows 1+ active devices

✅ **Sending Working:**
- [ ] Admin can send notification to specific user
- [ ] Notification appears on user's device
- [ ] Custom icons display (lime green with lightning bolt)
- [ ] Title and body text correct

✅ **Click Tracking Working:**
- [ ] Clicking notification opens/focuses app
- [ ] Navigation to specified URL works
- [ ] `clicked_at` timestamp recorded in database
- [ ] Status updates from 'sent' to 'clicked'

✅ **No Errors:**
- [ ] No console errors in browser
- [ ] No errors in terminal/server logs
- [ ] Admin panel shows success messages

---

## 🎯 Advanced Testing (Optional)

### Test Offline Behavior
1. Send notification
2. Close browser completely
3. Wait for notification
4. ✅ Should still receive it (service worker works offline!)

### Test Multiple Devices
1. Open app on phone (same WiFi)
2. Subscribe to notifications
3. Send notification
4. ✅ Both devices receive it

### Test Background Delivery
1. Subscribe to notifications
2. Navigate away from site (different tab/site)
3. Send notification
4. ✅ Should still receive it (background push works!)

### Test Notification Persistence
1. Receive notification but don't click
2. Wait 1 minute
3. ✅ Notification should remain visible
4. Click it
5. ✅ Still tracks the click

---

## 📝 Testing Notes Template

Copy this template to document your testing:

```markdown
## Testing Session: [Date/Time]

### Environment
- Browser: [Chrome 120 / Firefox 121 / Safari 17]
- OS: [macOS 14 / Windows 11 / iOS 17]
- Device: [Desktop / Mobile]

### Test Results

#### Subscription
- [ ] Permission granted successfully
- [ ] Subscription saved to database
- [ ] Admin panel shows active device
- Issues: [None / Description]

#### Sending
- [ ] Notification received
- [ ] Icons display correctly
- [ ] Text formatting correct
- Issues: [None / Description]

#### Click Tracking
- [ ] Click opens app
- [ ] Navigation works
- [ ] Database updated with clicked_at
- Issues: [None / Description]

#### Performance
- Time to receive: [X seconds]
- Time to click: [X seconds]
- Database lag: [X seconds]

### Overall Status: [✅ PASS / ❌ FAIL]

### Notes
[Any additional observations]
```

---

## 📞 Need Help?

**Common Solutions:**
1. Clear browser data and try again
2. Restart dev server
3. Check Supabase connection is working
4. Verify VAPID keys in `.env.local`

**Documentation:**
- Setup: `docs/working/push-notifications-setup.md`
- Implementation: `docs/working/notifications-implementation-plan.md`
- Code: `lib/actions/notifications.ts`

**Database Queries:**
```sql
-- View all subscriptions
SELECT * FROM push_subscriptions ORDER BY created_at DESC;

-- View all notifications
SELECT * FROM notifications_log ORDER BY sent_at DESC LIMIT 20;

-- View click rate
SELECT 
  COUNT(*) as total,
  COUNT(clicked_at) as clicked,
  ROUND(COUNT(clicked_at)::numeric / COUNT(*) * 100, 2) as click_rate_percent
FROM notifications_log
WHERE sent_at > NOW() - INTERVAL '24 hours';
```

---

**Good luck testing! 🚀**
