# Notifications Implementation Plan

**Created:** December 29, 2025  
**Status:** In Progress  
**Project:** Waddy Diet Master Push Notifications

---

## Overview

This document tracks the implementation of the complete push notifications system for Waddy Diet Master. The system uses Web Push API with VAPID authentication to deliver timely nutrition reminders, summaries, and achievements to users.

### Current Status: Infrastructure Complete ✅
- VAPID keys configured
- Database schema migrated
- Service worker implemented
- Admin panel UI ready
- Basic subscription management working

### Goal: Automated Notification System
Complete all missing pieces to have a fully automated, production-ready notification system.

---

## Implementation Steps

### 🔴 Phase 1: Core Functionality (Priority: HIGH)

#### ✅ Step 1: Create Click Tracking API Endpoint
**Status:** ✅ COMPLETED  
**Completed:** December 29, 2025  
**Time Taken:** 10 minutes  
**Files Created:**
- ✅ `app/api/notifications/track-click/route.ts`

**Files Modified:**
- ✅ `lib/actions/notifications.ts` - Added notification ID to payload

**Description:**  
Create API endpoint to handle notification click tracking from service worker. Updates `notifications_log` table with `clicked_at` timestamp for analytics.

**Acceptance Criteria:**
- [x] POST endpoint accepts `notificationId`
- [x] Updates `clicked_at` in `notifications_log`
- [x] Returns appropriate status codes
- [x] No console errors in service worker
- [x] Notification ID included in push payload
- [x] Both single and broadcast notifications tracked

**Implementation Notes:**
- Created POST endpoint at `/api/notifications/track-click`
- Modified `sendNotificationToUser()` to log notification first, then include ID in payload
- Modified `sendBroadcastNotification()` to log notification first, then include ID in payload
- Click tracking only updates if not already clicked (prevents duplicate clicks)
- Updates status from 'sent' to 'clicked' for analytics

**Testing:**
```bash
# Send test notification from admin panel
# Click notification
# Check database: SELECT id, title, sent_at, clicked_at, status FROM notifications_log ORDER BY sent_at DESC LIMIT 5
```

---

#### ⬜ Step 2: Add Notification Icon Assets
**Status:** Not Started  
**Estimated Time:** 5 minutes  
**Files to Create:**
- `public/icons/icon-192x192.png`
- `public/icons/badge-72x72.png`

**Description:**  
Add missing icon files referenced in service worker for proper notification display with branding.

**Acceptance Criteria:**
- [ ] Icons created from brand assets
- [ ] Correct dimensions (192x192, 72x72)
- [ ] PNG format with transparency
- [ ] Displays correctly in notifications

---

#### ⬜ Step 3: Test Admin Notification System
**Status:** Not Started  
**Estimated Time:** 15 minutes  

**Description:**  
Comprehensive end-to-end testing of notification flow to ensure all components work together.

**Test Checklist:**
- [ ] Subscribe to notifications from profile
- [ ] Verify subscription saved in database
- [ ] Send notification to self from admin panel
- [ ] Receive notification while app closed
- [ ] Click notification and verify navigation
- [ ] Check click tracked in database
- [ ] Test broadcast to multiple users
- [ ] Verify quiet hours respected (if set)

**Issues Found:**
- Document any bugs or unexpected behavior here

---

### 🟡 Phase 2: User Experience (Priority: MEDIUM)

#### ⬜ Step 4: Add Quiet Hours UI to Profile
**Status:** Not Started  
**Estimated Time:** 30 minutes  
**Files to Modify:**
- `app/(app)/profile/profile-content.tsx`

**Description:**  
Add time picker inputs in notification settings for users to set do-not-disturb hours.

**Acceptance Criteria:**
- [ ] Time pickers for start and end times
- [ ] Saved to `notification_settings` table
- [ ] Visual indication when in quiet hours
- [ ] Server respects quiet hours when sending

**UI Design:**
```
Quiet Hours
⏰ Don't send notifications between:
  [22:00 ▼] and [08:00 ▼]
  Toggle: [●] Enable Quiet Hours
```

---

### 🟢 Phase 3: Automated Triggers (Priority: HIGH)

#### ⬜ Step 5: Implement Meal Reminder Scheduler
**Status:** Not Started  
**Estimated Time:** 2 hours  
**Files to Create:**
- `supabase/functions/meal-reminders/index.ts` (Edge Function)
- OR: `lib/jobs/meal-reminders.ts` (Cron)

**Description:**  
Automated system to send meal reminders based on user meal times and preferences.

**Logic:**
1. Query users with `meal_reminders = true`
2. Check their daily plan for today
3. For each meal, check if reminder time (e.g., 30min before)
4. Filter out users in quiet hours
5. Send reminder with meal details

**Notification Payload:**
```typescript
{
  title: "🍽️ Time for Lunch!",
  body: "Your grilled chicken salad is ready to log",
  url: "/dashboard",
  notification_type: "meal_reminder"
}
```

**Acceptance Criteria:**
- [ ] Runs every 15 minutes
- [ ] Checks user meal times
- [ ] Respects quiet hours
- [ ] Respects user preferences
- [ ] Logs all sent reminders

**Deployment:**
```bash
# Supabase Edge Function
supabase functions deploy meal-reminders

# Set up cron trigger
# cron: "*/15 * * * *"  # Every 15 minutes
```

---

#### ⬜ Step 6: Implement Daily Summary Notification
**Status:** Not Started  
**Estimated Time:** 1.5 hours  
**Files to Create:**
- `supabase/functions/daily-summary/index.ts`

**Description:**  
Send end-of-day nutrition summary at configurable time (default: 8 PM).

**Logic:**
1. Run daily at 8 PM (configurable)
2. Query users with `daily_summary = true`
3. Aggregate today's nutrition from `daily_logs`
4. Compare to targets
5. Send summary with progress

**Notification Payload:**
```typescript
{
  title: "📊 Your Day in Review",
  body: "1,850 cal • 140g protein • 3/3 meals logged",
  url: "/nutrition",
  notification_type: "daily_summary"
}
```

**Acceptance Criteria:**
- [ ] Runs once daily at configured time
- [ ] Calculates accurate nutrition totals
- [ ] Includes macro breakdown
- [ ] Shows progress vs targets
- [ ] Only sends if user logged food

---

#### ⬜ Step 7: Implement Weekly Report Notification
**Status:** Not Started  
**Estimated Time:** 1.5 hours  
**Files to Create:**
- `supabase/functions/weekly-report/index.ts`

**Description:**  
Send weekly progress report every Monday morning with insights and achievements.

**Logic:**
1. Run weekly on Monday at 9 AM
2. Query users with `weekly_report = true`
3. Aggregate past 7 days from `daily_logs`
4. Calculate trends, consistency, achievements
5. Send personalized report

**Notification Payload:**
```typescript
{
  title: "📈 Your Week in Review",
  body: "7-day streak! You're 92% on track with your goals",
  url: "/profile?tab=progress",
  notification_type: "weekly_report"
}
```

**Acceptance Criteria:**
- [ ] Runs every Monday at 9 AM
- [ ] Calculates weekly averages
- [ ] Identifies trends (improving/declining)
- [ ] Celebrates consistency streaks
- [ ] Includes actionable insights

---

#### ⬜ Step 8: Implement Goal Achievement Notifications
**Status:** Not Started  
**Estimated Time:** 2 hours  
**Files to Create:**
- `lib/utils/achievement-detector.ts`
- Trigger in relevant server actions

**Description:**  
Real-time notifications when users hit milestones and achievements.

**Triggers:**
- Weight goal reached (±5% of target)
- 7-day logging streak
- 30-day logging streak
- First week completed
- 90% macro target hit 3 days in a row
- Custom goal completed

**Notification Payload:**
```typescript
{
  title: "🎯 Goal Achieved!",
  body: "You've logged meals for 7 days straight! 🔥",
  url: "/profile?tab=achievements",
  notification_type: "goal_achievement"
}
```

**Acceptance Criteria:**
- [ ] Detects all milestone types
- [ ] Prevents duplicate notifications
- [ ] Celebratory tone and emoji
- [ ] Links to achievement page
- [ ] Logged for user history

**Integration Points:**
- After daily log saved
- After weight updated
- After plan completion

---

#### ⬜ Step 9: Implement Plan Update Notifications
**Status:** Not Started  
**Estimated Time:** 45 minutes  
**Files to Modify:**
- `lib/actions/plans.ts` (or admin plan actions)

**Description:**  
Notify users when admin updates or assigns them a meal plan.

**Triggers:**
- Admin creates new plan for user
- Admin updates existing plan
- Plan automatically renewed

**Notification Payload:**
```typescript
{
  title: "📝 New Meal Plan Ready!",
  body: "Your nutrition coach updated your plan for this week",
  url: "/plans",
  notification_type: "plan_update"
}
```

**Acceptance Criteria:**
- [ ] Triggered after plan saved
- [ ] Only if `plan_updates = true`
- [ ] Includes plan name/date
- [ ] Direct link to new plan
- [ ] Admin can preview before sending

---

### 🔵 Phase 4: Analytics & Optimization (Priority: MEDIUM)

#### ⬜ Step 10: Add Notification Analytics Dashboard
**Status:** Not Started  
**Estimated Time:** 2 hours  
**Files to Modify:**
- `components/admin/notifications-panel.tsx`
- `lib/actions/notifications.ts`

**Description:**  
Enhanced admin panel with delivery rates, engagement metrics, and subscription management.

**New Sections:**
1. **Delivery Rate Chart**
   - Sent vs Failed over time
   - Success rate percentage
   
2. **Engagement Metrics**
   - Click-through rate by notification type
   - Average time to click
   - Most engaging notification types

3. **Subscription Health**
   - Inactive subscriptions (no notifications in 30 days)
   - Cleanup tool to remove invalid endpoints
   - Device type distribution

**Acceptance Criteria:**
- [ ] Visual charts for metrics
- [ ] Date range filters
- [ ] Export to CSV
- [ ] Bulk cleanup tool
- [ ] Performance optimized queries

---

#### ⬜ Step 11: Add Rate Limiting and Batch Processing
**Status:** Not Started  
**Estimated Time:** 1.5 hours  
**Files to Modify:**
- `lib/actions/notifications.ts`

**Description:**  
Optimize notification sending with rate limiting and batch processing for scalability.

**Changes:**
1. **Rate Limiting:**
   - Max 100 notifications per minute per user
   - Prevent admin spam
   - Exponential backoff on failures

2. **Batch Processing:**
   - Send broadcasts in batches of 100
   - Parallel processing with Promise.allSettled
   - Progress reporting

3. **Queue System (Optional):**
   - Consider Redis queue for large broadcasts
   - Background job processing

**Acceptance Criteria:**
- [ ] Rate limiter implemented
- [ ] Batch size configurable
- [ ] Progress indicators for admin
- [ ] Failed notifications retried
- [ ] Logs rate limit events

**Code Example:**
```typescript
// Batch processing
const BATCH_SIZE = 100
for (let i = 0; i < subscriptions.length; i += BATCH_SIZE) {
  const batch = subscriptions.slice(i, i + BATCH_SIZE)
  await Promise.allSettled(batch.map(sub => sendToSubscription(sub)))
}
```

---

#### ⬜ Step 12: Browser Compatibility and Mobile Testing
**Status:** Not Started  
**Estimated Time:** 2 hours  

**Description:**  
Comprehensive testing across browsers and devices with documented workarounds.

**Test Matrix:**

| Browser/Device | Version | Push Support | PWA Required | Status |
|----------------|---------|--------------|--------------|--------|
| Chrome Desktop | 90+ | ✅ Full | No | ⬜ |
| Firefox Desktop | 88+ | ✅ Full | No | ⬜ |
| Safari Desktop | 16+ | ✅ Limited | No | ⬜ |
| Edge Desktop | 90+ | ✅ Full | No | ⬜ |
| Chrome Android | 90+ | ✅ Full | No | ⬜ |
| Safari iOS | 16.4+ | ⚠️ PWA Only | Yes | ⬜ |
| Samsung Internet | 14+ | ✅ Full | No | ⬜ |

**iOS/Safari Testing Checklist:**
- [ ] Install as PWA (Add to Home Screen)
- [ ] Enable notifications from within PWA
- [ ] Test background delivery
- [ ] Test notification actions
- [ ] Document limitations

**Known Issues:**
- Safari: Requires PWA installation
- iOS: Background sync limitations
- Firefox: Different icon size preferences

**Workarounds Documented:**
- Add iOS installation instructions to UI
- Feature detection for unsupported browsers
- Graceful fallbacks

---

## Progress Tracking

### Completed: 1/12 (8%)
- ✅ Step 1: Click tracking API endpoint

### In Progress: 0/12
- None

### Blocked: 0/12
- None

---

## Testing Checklist

### Local Testing (Localhost)
- [ ] Subscribe to notifications
- [ ] Receive test notification
- [ ] Click notification
- [ ] Unsubscribe
- [ ] Check all logs in database

### Staging Testing
- [ ] Test with HTTPS domain
- [ ] Test on mobile devices
- [ ] Test offline behavior
- [ ] Test background delivery
- [ ] Test multiple devices

### Production Testing
- [ ] Monitor error rates
- [ ] Check delivery success rate
- [ ] Verify scheduled jobs running
- [ ] User feedback collection
- [ ] Performance monitoring

---

## Deployment Notes

### Environment Variables Required
```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public-key>
VAPID_PRIVATE_KEY=<private-key>
VAPID_SUBJECT=mailto:support@waddydiet.com
```

### Supabase Edge Functions
```bash
# Deploy all notification functions
supabase functions deploy meal-reminders
supabase functions deploy daily-summary
supabase functions deploy weekly-report

# Set up cron schedules in Supabase Dashboard
```

### Database Migrations
- [x] 20241203_push_notifications.sql (Already applied)

### Service Worker
- Service worker auto-updates on next app visit
- Force update: `navigator.serviceWorker.getRegistrations().then(r => r[0].update())`

---

## Rollback Plan

If issues arise in production:

1. **Disable scheduled jobs** in Supabase Dashboard
2. **Pause broadcasts** - Add feature flag in admin panel
3. **Investigate issues** - Check logs and error rates
4. **Fix and redeploy** - Test in staging first
5. **Re-enable gradually** - Start with small user segment

---

## Future Enhancements (Post-MVP)

- [ ] Custom notification sounds
- [ ] Rich notifications with images
- [ ] Action buttons in notifications (e.g., "Log Meal Now")
- [ ] Notification scheduling (send at specific time)
- [ ] A/B testing notification copy
- [ ] Localization (Arabic notifications)
- [ ] SMS fallback for critical notifications
- [ ] Email digest option
- [ ] Notification templates library

---

## Resources

- [Web Push API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [VAPID Protocol Spec](https://tools.ietf.org/html/rfc8292)
- [Service Worker Cookbook](https://serviceworke.rs/)
- [web-push Library Docs](https://github.com/web-push-libs/web-push)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)

---

## Notes & Decisions

### December 29, 2025
- Created implementation plan
- Current status: Infrastructure complete, starting implementation
- Decision: Use Supabase Edge Functions for scheduled tasks
- Decision: Start with click tracking, then test, then automated triggers
- ✅ **Completed Step 1:** Click tracking API endpoint
  - Created `/api/notifications/track-click` route
  - Modified server actions to include notification ID in payload
  - Both single user and broadcast notifications now trackable
  - Ready for testing in Step 3

---

## Contact

**Questions or Issues?**  
- See: `docs/working/push-notifications-setup.md` for technical setup
- Admin panel: `/admin/notifications` for testing
- User settings: Profile > Notifications section

**Last Updated:** December 29, 2025
