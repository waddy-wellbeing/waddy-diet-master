# Achievement & Plan Notifications Testing Guide

## Overview
This guide helps you test Steps 8 & 9: Achievement notifications and Plan update notifications.

## Prerequisites
1. ✅ Push notifications subscription active
2. ✅ Notification settings enabled in profile
3. ✅ Not in quiet hours (or disable quiet hours for testing)
4. ✅ Browser tab can be closed (notifications work in background)

## Test Scenarios

### 🎯 Achievement Notifications Testing

#### Scenario 1: First Week Completion
**Trigger:** User logs their 7th day of meals (lifetime total)

**Setup:**
1. Create test user or use existing user with <7 days logged
2. Log into dashboard
3. Log meals on 7 different dates (doesn't need to be consecutive)

**How to Test:**
```sql
-- Check current count for user
SELECT COUNT(*) FROM daily_logs 
WHERE user_id = '<user-id>' AND meals_logged > 0;

-- If less than 7, log meals until you hit exactly 7
```

**Expected Notification:**
```
Title: 🎉 First Week Complete!
Body: You've logged 7 days of meals! You're building great habits!
URL: /dashboard
```

**Verification:**
```sql
-- Check notifications_log
SELECT * FROM notifications_log 
WHERE user_id = '<user-id>' 
AND notification_type = 'achievement'
AND title LIKE '%First Week%'
ORDER BY sent_at DESC LIMIT 1;
```

---

#### Scenario 2: 3-Day Streak
**Trigger:** User logs meals for 3 consecutive days

**Setup:**
1. Start fresh or use user with no recent logs
2. Log meals for yesterday, today (you may need to manually insert yesterday's log)

**SQL Helper:**
```sql
-- Insert yesterday's log manually for testing
INSERT INTO daily_logs (user_id, log_date, log, logged_totals, meals_logged)
VALUES (
  '<user-id>',
  CURRENT_DATE - INTERVAL '1 day',
  '{"breakfast": {"items": [{"type": "recipe", "recipe_id": "some-id"}]}}',
  '{"calories": 500}',
  1
);

-- Then log today's meal via dashboard
```

**Expected Notification:**
```
Title: 🌟 3-Day Streak!
Body: You're on fire! Keep going!
```

---

#### Scenario 3: 7-Day Streak
**Trigger:** User logs meals for 7 consecutive days

**Setup:**
1. Need 7 consecutive days with meals_logged > 0
2. Use SQL to backfill if needed

**SQL Helper:**
```sql
-- Backfill 6 days of logs
DO $$
BEGIN
  FOR i IN 1..6 LOOP
    INSERT INTO daily_logs (user_id, log_date, log, logged_totals, meals_logged)
    VALUES (
      '<user-id>',
      CURRENT_DATE - (i || ' days')::INTERVAL,
      '{"breakfast": {"items": [{"type": "recipe", "recipe_id": "dummy"}]}}',
      '{"calories": 500}',
      1
    )
    ON CONFLICT (user_id, log_date) DO NOTHING;
  END LOOP;
END $$;

-- Then log today via dashboard to trigger
```

**Expected Notification:**
```
Title: 🔥 7-Day Streak!
Body: A whole week of consistency! Amazing!
```

---

#### Scenario 4: Daily Target Achievement
**Trigger:** User hits calorie ±10% AND protein target with 3+ meals

**Setup:**
1. User must have targets set in profile
2. Log 3+ meals that sum to target range

**Example:**
```typescript
// If user target is 2000 cal, 150g protein
// Valid range: 1800-2200 cal, >=150g protein

// Log 3 meals:
// Breakfast: 600 cal, 50g protein
// Lunch: 700 cal, 60g protein  
// Dinner: 600 cal, 45g protein
// Total: 1900 cal, 155g protein ✅
```

**Check Targets:**
```sql
SELECT targets FROM profiles WHERE user_id = '<user-id>';
-- Should show: {"calories": 2000, "protein": 150, ...}
```

**Expected Notification:**
```
Title: 🎯 Daily Target Achieved!
Body: Perfect day! You hit 1900 cal and 155g protein!
```

**Note:** Only sent once per day

---

### 📝 Plan Update Notifications Testing

#### Scenario 5: Admin Assigns Meal Plan
**Trigger:** Admin assigns meal structure to user for first time

**Setup:**
1. Create test user with `plan_status = 'pending_assignment'`
2. Login as admin
3. Go to `/admin/users`
4. Click "Assign Meal Plan" on test user

**Steps:**
1. Set meal structure (e.g., 3 meals: breakfast 30%, lunch 40%, dinner 30%)
2. Set daily calories (e.g., 2000)
3. Click "Assign Plan"
4. User should receive notification immediately

**Expected Notification:**
```
Title: 🎉 New Meal Plan Assigned!
Body: Your personalized meal plan for Saturday, Jan 4 is ready!
URL: /plans
```

**Verification:**
```sql
-- Check plan assignment
SELECT plan_status, preferences->'meal_structure' 
FROM profiles 
WHERE user_id = '<user-id>';

-- Check notification sent
SELECT * FROM notifications_log 
WHERE user_id = '<user-id>' 
AND notification_type = 'plan_update'
ORDER BY sent_at DESC LIMIT 1;
```

---

## Testing Utilities

### Clear Achievement Notifications (for retesting)
```sql
-- Delete achievement notifications for a user
DELETE FROM notifications_log 
WHERE user_id = '<user-id>' 
AND notification_type = 'achievement';

-- Now you can re-trigger achievements
```

### Check Streak Calculation
```sql
-- Get user's recent logs for streak verification
SELECT log_date, meals_logged 
FROM daily_logs 
WHERE user_id = '<user-id>'
ORDER BY log_date DESC 
LIMIT 30;

-- Should show consecutive days with meals_logged > 0
```

### Force Notification (bypass settings)
If notifications aren't sending, check:

1. **Subscription Active:**
```sql
SELECT * FROM push_subscriptions 
WHERE user_id = '<user-id>' AND is_active = true;
```

2. **Settings Enabled:**
```sql
SELECT * FROM notification_settings 
WHERE user_id = '<user-id>';
-- Ensure: push_enabled=true, goal_achievements=true
```

3. **Quiet Hours:**
```sql
-- Check if currently in quiet hours
SELECT 
  quiet_hours_start,
  quiet_hours_end,
  CURRENT_TIME
FROM notification_settings 
WHERE user_id = '<user-id>';
```

### Test Admin Notification Directly
```typescript
// In browser console (on admin page)
await fetch('/api/notifications/test', {
  method: 'POST',
  body: JSON.stringify({
    userId: 'user-id-here',
    type: 'achievement',
    title: '🎉 Test Achievement',
    body: 'This is a test'
  })
})
```

---

## Common Issues

### Issue 1: No notification received
**Checklist:**
- [ ] Subscription exists and is_active=true
- [ ] Settings: push_enabled AND specific type enabled
- [ ] Not in quiet hours
- [ ] Service worker registered
- [ ] Browser has notification permission granted

### Issue 2: Duplicate notifications
**Cause:** Achievement already logged in notifications_log

**Fix:**
```sql
-- Check for existing notification
SELECT * FROM notifications_log 
WHERE user_id = '<user-id>' 
AND title LIKE '%<achievement-name>%';

-- Delete to retest
DELETE FROM notifications_log WHERE id = '<notification-id>';
```

### Issue 3: Streak not triggering
**Debug:**
```sql
-- Check for gaps in daily_logs
WITH RECURSIVE dates AS (
  SELECT CURRENT_DATE - INTERVAL '30 days' AS date
  UNION ALL
  SELECT date + INTERVAL '1 day'
  FROM dates
  WHERE date < CURRENT_DATE
)
SELECT 
  d.date,
  COALESCE(dl.meals_logged, 0) AS logged
FROM dates d
LEFT JOIN daily_logs dl 
  ON dl.log_date = d.date 
  AND dl.user_id = '<user-id>'
ORDER BY d.date DESC;

-- Look for consecutive days with logged > 0
```

---

## Success Criteria

✅ **Step 8 (Achievements) Complete When:**
- [ ] 3-day streak notification received
- [ ] 7-day streak notification received  
- [ ] First week notification received
- [ ] Daily target notification received
- [ ] No duplicate notifications for same milestone
- [ ] Notifications respect quiet hours
- [ ] Failed subscriptions get deactivated (410/404)

✅ **Step 9 (Plan Updates) Complete When:**
- [ ] New plan assignment notification received
- [ ] Notification includes readable date
- [ ] Links to /plans page
- [ ] Respects user's plan_updates setting
- [ ] Works for multiple users in bulk

---

## Next Steps After Testing

1. Monitor `notifications_log` table for any errors
2. Check delivery rates (sent vs failed)
3. Gather user feedback on notification timing/content
4. Consider A/B testing notification copy
5. Add analytics dashboard (Step 10) to track engagement

---

## Rollback Plan

If issues found:
1. Disable quiet hours checking temporarily
2. Add feature flag to disable achievements
3. Fix bug and redeploy
4. Clear failed notifications from log
5. Re-enable gradually
