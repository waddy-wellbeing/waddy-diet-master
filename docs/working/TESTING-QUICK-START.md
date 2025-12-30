# 🚀 Quick Testing Reference

## ⚠️ Having Issues? Run Cleanup First!

**If you get "push service error" or other subscription errors:**

### Quick Cleanup (30 seconds):
1. Open browser DevTools (F12)
2. Go to **Console** tab
3. Copy/paste this and press Enter:
   ```javascript
   navigator.serviceWorker.getRegistrations().then(regs => 
     Promise.all(regs.map(r => r.unregister()))
   ).then(() => console.log('✅ Cleanup done! Refresh page now.'))
   ```
4. Refresh page (Cmd+R / Ctrl+R)
5. Try enabling notifications again

### Full Cleanup (if quick cleanup doesn't work):
Run the script at `scripts/clean-push-notifications.js` in browser console.

---

## Start Testing in 3 Steps:

### 1️⃣ Subscribe (1 min)
```
→ Go to Profile → Notifications → Toggle ON
→ Click "Allow" when browser asks
→ Verify "Active" indicator appears
```

### 2️⃣ Send Test (1 min)
```
→ Go to /admin/notifications
→ Select your user
→ Title: "Test Notification"
→ Message: "Testing click tracking!"
→ Click "Send to User"
```

### 3️⃣ Verify (30 sec)
```
→ Notification appears with lime green icon ⚡
→ Click the notification
→ App opens/navigates to dashboard
```

---

## Verify in Database:

```sql
-- Check subscription created
SELECT * FROM push_subscriptions WHERE user_id = auth.uid();

-- Check notification sent
SELECT id, title, status, sent_at, clicked_at 
FROM notifications_log 
ORDER BY sent_at DESC LIMIT 5;
```

**Expected:**
- status = 'clicked' (after you clicked)
- clicked_at has timestamp
- Your notification appears

---

## Quick Debug:

**No notification?**
```javascript
// Browser console
console.log('Permission:', Notification.permission) // Should be "granted"
navigator.serviceWorker.getRegistrations().then(r => console.log(r))
```

**Icon not showing?**
```bash
ls public/icons/*.png  # Should show icon-192x192.png and badge-72x72.png
```

**API not working?**
```bash
curl http://localhost:3000/api/notifications/track-click
# Should return: {"status":"ok",...}
```

---

## Full Guide:
See `docs/working/testing-notifications.md` for complete instructions.
