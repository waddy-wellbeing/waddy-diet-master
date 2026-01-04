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

#### ✅ Step 2: Add Notification Icon Assets
**Status:** ✅ COMPLETED  
**Completed:** December 29, 2025  
**Time Taken:** 8 minutes  
**Files Created:**
- ✅ `public/icons/icon-192x192.svg` (source)
- ✅ `public/icons/icon-192x192.png` (192x192)
- ✅ `public/icons/badge-72x72.svg` (source)
- ✅ `public/icons/badge-72x72.png` (72x72)
- ✅ `scripts/generate-notification-icons.mjs` (generator)

**Description:**  
Added notification icon files with brand styling (lime green gradient with lightning bolt ⚡).

**Acceptance Criteria:**
- [x] Icons created from brand assets
- [x] Correct dimensions (192x192, 72x72)
- [x] PNG format with transparency
- [x] SVG sources for future editing
- [x] Automated generation script

**Implementation Notes:**
- Created SVG icons with brand colors (oklch lime green)
- Lightning bolt design matches brand identity
- Used sharp library to convert SVG → PNG
- Icons feature gradient background for visual appeal
- Badge is simpler design for small notification badges

**Visual Design:**
- Main icon: 192x192 with gradient lime background + white lightning
- Badge: 72x72 solid lime background + white lightning
- Both use rounded corners and high contrast

---

#### ✅ Step 3: Test Admin Notification System
**Status:** ✅ COMPLETED  
**Started:** December 30, 2025  
**Completed:** January 2, 2026  
**Time Taken:** 15 minutes  

**Description:**  
Comprehensive end-to-end testing of notification flow to ensure all components work together. This validates that Steps 1 & 2 are fully functional.

**Test Checklist:**
- [x] Subscribe to notifications from profile
- [x] Verify subscription saved in database
- [x] Send notification to self from admin panel
- [x] Receive notification with proper icon
- [x] Click notification and verify navigation
- [x] Check click tracked in database
- [x] Test with custom URL parameter
- [x] Verify notification closes after click
- [x] Test broadcast to multiple users (if available)

**Testing Instructions:**
See `docs/working/TESTING-QUICK-START.md` for detailed steps.

**Expected Results:**
- Notifications appear with lime green lightning bolt icon
- Click tracking records timestamp in database
- Navigation works to specified URLs
- Admin panel shows "Sent to X device(s)" success message

**Test Results:**
- ✅ All core functionality working as expected
- ✅ Icons display correctly with brand styling
- ✅ Click tracking working properly
- ✅ Admin panel UI functional
- ⚠️ Chrome localhost push service error - Known limitation, use ngrok/Firefox for local testing

---

### 🟡 Phase 2: User Experience (Priority: MEDIUM)

#### ✅ Step 4: Add Quiet Hours UI to Profile
**Status:** ✅ COMPLETED  
**Started:** January 2, 2026  
**Completed:** January 2, 2026  
**Time Taken:** 30 minutes  
**Files Modified:**
- ✅ `app/(app)/profile/profile-content.tsx` - Added quiet hours UI with time pickers
- ✅ `lib/actions/notifications.ts` - Added quiet hours validation logic

**Description:**  
Added time picker inputs in notification settings for users to set do-not-disturb hours.

**Acceptance Criteria:**
- [x] Time pickers for start and end times
- [x] Saved to `notification_settings` table
- [x] Visual indication when in quiet hours
- [x] Server respects quiet hours when sending

**Implementation Notes:**
- Added `Moon` icon import to profile-content.tsx
- Created new section after notification types with two time pickers
- Added `handleQuietHoursChange` handler for updating times
- Created `isInQuietHours()` helper function to check if current time is within quiet hours
- Updated `sendNotificationToUser()` to check quiet hours before sending
- Updated `sendBroadcastNotification()` to filter out users in quiet hours
- Handles overnight quiet hours (e.g., 22:00 to 08:00)
- Shows informative message with current quiet hours settings

**UI Design:**
```
Quiet Hours
⏰ Don't send notifications between:
  Start Time: [22:00 ▼]  End Time: [08:00 ▼]
  🕐 Notifications paused from 22:00 to 08:00
```

---

### 🟢 Phase 3: Automated Triggers (Priority: HIGH)

#### ✅ Step 5: Implement Meal Reminder Scheduler
**Status:** ✅ COMPLETED  
**Started:** January 2, 2026  
**Completed:** January 2, 2026  
**Time Taken:** 45 minutes  
**Files Created:**
- ✅ `supabase/functions/meal-reminders/index.ts` - Edge Function for automated reminders
- ✅ `supabase/functions/meal-reminders/README.md` - Documentation and deployment guide

**Description:**  
Automated system to send meal reminders based on user meal times and preferences.

**Implementation Details:**
- Uses default meal times: Breakfast (8 AM), Lunch (1 PM), Dinner (7 PM)
- Sends reminders 30 minutes before each meal
- Runs every 15 minutes to check for reminder windows
- Queries users with `meal_reminders = true` and `push_enabled = true`
- Filters out users currently in quiet hours
- Only sends to users who have that specific meal in today's plan
- Includes recipe name in notification when available
- Logs all sent notifications to `notifications_log` table

**Logic Flow:**
1. Check if current time matches any meal reminder window (±15 min)
2. Query users with meal reminders enabled and not in quiet hours
3. Get daily plans for today and filter users with the specific meal
4. Fetch recipe names for personalized notifications
5. Send notifications to all active subscriptions
6. Log results and mark failed notifications

**Notification Payload:**
```typescript
{
  title: "🥞 Time for Breakfast!",
  body: "Your greek yogurt parfait is ready to log",
  url: "/dashboard",
  notification_type: "meal_reminder",
  data: { meal: "breakfast", notificationId: "uuid" }
}
```

**Acceptance Criteria:**
- [x] Runs every 15 minutes
- [x] Checks user meal times (using defaults)
- [x] Respects quiet hours
- [x] Respects user preferences
- [x] Logs all sent reminders
- [x] Handles invalid subscriptions gracefully
- [x] Includes recipe name when available

**Deployment Instructions:**
```bash
# Deploy the function
supabase functions deploy meal-reminders

# Set up cron trigger in Supabase Dashboard:
# Edge Functions → meal-reminders → Add Cron Trigger
# Schedule: */15 * * * * (every 15 minutes)
# HTTP Method: POST
```

**Future Enhancements:**
- Allow users to customize meal times in profile settings
- Add timezone support for international users
- Allow configurable reminder minutes (15, 30, 60 minutes before)
- Support for mid-morning/afternoon snack reminders

---

#### ✅ Step 6: Implement Daily Summary Notification
**Status:** ✅ COMPLETED  
**Started:** January 2, 2026  
**Completed:** January 2, 2026  
**Time Taken:** 40 minutes  
**Files Created:**
- ✅ `supabase/functions/daily-summary/index.ts` - Edge Function for daily summaries
- ✅ `supabase/functions/daily-summary/README.md` - Documentation and deployment guide

**Description:**  
Send end-of-day nutrition summary at 8 PM with progress towards targets.

**Implementation Details:**
- Runs once daily at 8 PM
- Queries users with `daily_summary = true` and `push_enabled = true`
- Filters out users in quiet hours
- Only sends to users who logged at least one meal today
- Aggregates nutrition from `daily_logs.logged_totals`
- Compares to user targets from `profiles.targets`
- Generates personalized message based on performance
- Uses achievement emojis: 🎯 (perfect day), ⭐ (great), 📊 (standard)

**Logic Flow:**
1. Query eligible users (settings enabled, not in quiet hours)
2. Get daily logs for today (filter users with meals_logged > 0)
3. Get user targets from profiles
4. Calculate performance and generate summary message
5. Send notification with personalized content
6. Log all sent notifications

**Notification Payload Examples:**
```typescript
// Perfect day (within ±10% of target)
{
  title: "🎯 Your Day in Review",
  body: "1,850 cal (98% of goal) • 140g protein • 3 meals logged",
  url: "/nutrition",
  notification_type: "daily_summary"
}

// Great day (3+ meals)
{
  title: "⭐ Your Day in Review",
  body: "1,650 cal (88% of goal) • 125g protein • 3 meals logged",
  url: "/nutrition",
  notification_type: "daily_summary"
}

// Partial day
{
  title: "📊 Your Day in Review",
  body: "980 cal • 65g protein • 2 meals logged",
  url: "/nutrition",
  notification_type: "daily_summary"
}
```

**Acceptance Criteria:**
- [x] Runs once daily at configured time (8 PM)
- [x] Calculates accurate nutrition totals
- [x] Includes macro breakdown (calories, protein)
- [x] Shows progress vs targets (percentage)
- [x] Only sends if user logged food
- [x] Respects quiet hours
- [x] Achievement-based emojis
- [x] Handles invalid subscriptions gracefully

**Deployment Instructions:**
```bash
# Deploy the function
supabase functions deploy daily-summary

# Set up cron trigger in Supabase Dashboard:
# Edge Functions → daily-summary → Add Cron Trigger
# Schedule: 0 20 * * * (8 PM daily)
# HTTP Method: POST
```

**Future Enhancements:**
- Allow users to customize summary time in profile settings
- Add weekly comparison (vs. last week)
- Include hydration tracking if added to app
- Show streaks and milestones
- Add motivational messages based on progress

---

#### ✅ Step 7: Implement Weekly Report Notification
**Status:** ✅ COMPLETED  
**Started:** January 2, 2026  
**Completed:** January 2, 2026  
**Time Taken:** 45 minutes  
**Files Created:**
- ✅ `supabase/functions/weekly-report/index.ts` - Edge Function for weekly reports
- ✅ `supabase/functions/weekly-report/README.md` - Documentation and deployment guide
- ✅ `supabase/functions/CRON_SETUP.md` - Cron configuration guide for all functions

**Description:**  
Send weekly progress report every Sunday evening with insights, streaks, and achievements.

**Implementation Details:**
- Runs every Sunday at 7 PM
- Queries users with `weekly_report = true` and `push_enabled = true`
- Filters out users in quiet hours
- Analyzes past 7 days of data from `daily_logs`
- Calculates comprehensive weekly statistics
- Generates personalized summary with achievement emojis
- Includes motivational messages based on performance

**Weekly Statistics:**
- Days logged (out of 7)
- Current logging streak (consecutive days)
- Average calories per logged day
- Average protein per logged day
- Average meals per day
- Target progress percentage
- Consistency score

**Achievement Emojis:**
- 🔥 Perfect week (7/7 days logged)
- ⭐ Great week (5-6 days)
- 📈 Good week (3-4 days)
- 💪 Building habits (1-2 days)
- 📊 Fresh start (0 days)

**Notification Payload Examples:**
```typescript
// Perfect week
{
  title: "🔥 Your Week in Review",
  body: "7-day streak! 🔥 • 7/7 days logged • 98% on track • 145g protein",
  url: "/nutrition",
  notification_type: "weekly_report",
  data: {
    motivation: "You're crushing it! Keep the momentum going! 💪"
  }
}

// Good week
{
  title: "📈 Your Week in Review",
  body: "3-day streak • 4/7 days logged • 88% on track • 120g protein",
  url: "/nutrition",
  notification_type: "weekly_report",
  data: {
    motivation: "Solid progress! Aim for more days next week! 📈"
  }
}
```

**Acceptance Criteria:**
- [x] Runs every Sunday at 7 PM
- [x] Calculates weekly averages accurately
- [x] Identifies trends (streak counter)
- [x] Celebrates consistency with emojis
- [x] Includes actionable motivation
- [x] Respects quiet hours
- [x] Only sends to users who logged this week
- [x] Handles missing days gracefully

**Deployment Instructions:**
```bash
# Deploy the function
supabase functions deploy weekly-report

# Set up cron trigger in Supabase Dashboard:
# Edge Functions → weekly-report → Add Cron Trigger
# Schedule: 0 19 * * 0 (7 PM every Sunday)
# HTTP Method: POST
```

**Cron Configuration Summary:**
See [CRON_SETUP.md](../functions/CRON_SETUP.md) for complete setup instructions:
- **meal-reminders**: `*/15 * * * *` (every 15 minutes)
- **daily-summary**: `0 20 * * *` (8 PM daily)
- **weekly-report**: `0 19 * * 0` (7 PM Sunday)

**Future Enhancements:**
- Week-over-week comparison trends
- Personalized insights based on goal types
- Weight progress when implemented
- Social features (opt-in comparisons)
- Achievement badges system
- Customizable report day/time

---

### 🎉 Phase 3 Complete!

All automated notification triggers are now implemented:
- ✅ Meal reminders (3x daily)
- ✅ Daily summaries (8 PM)
- ✅ Weekly reports (Sunday 7 PM)

---

#### ✅ Step 8: Implement Goal Achievement Notifications
**Status:** ✅ Completed  
**Actual Time:** 1.5 hours  
**Completed:** January 4, 2026  
**Files Created/Modified:**
- ✅ `lib/utils/achievement-detector.ts` - Achievement detection logic
- ✅ `lib/actions/daily-logs.ts` - Achievement check after logging
- ✅ `lib/actions/notifications.ts` - sendAchievementNotification function
- ✅ `app/(app)/dashboard/dashboard-content.tsx` - Integration point

**Description:**  
Real-time notifications when users hit milestones and achievements.

**Implemented Triggers:**
- ✅ 3-day logging streak 🌟
- ✅ 7-day logging streak 🔥
- ✅ 14-day logging streak 💪
- ✅ 30-day logging streak 🏆
- ✅ First week completed (7 days total) 🎉
- ✅ Daily nutrition targets achieved 🎯

**Achievement Types:**
```typescript
type AchievementType = 'streak' | 'first_week' | 'target_hit' | 'consistency'
```

**Detection Logic:**
- **Streaks:** Calculated from consecutive days with meals logged
- **First Week:** Triggered on exactly 7th day logged (lifetime)
- **Target Hit:** Triggered when calories within ±10% AND protein met (requires 3+ meals)
- **Duplicate Prevention:** Uses `notifications_log` table to check if milestone already sent

**Notification Payloads:**
```typescript
// 3-day streak
{ title: "🌟 3-Day Streak!", body: "You're on fire! Keep going!" }

// 7-day streak
{ title: "🔥 7-Day Streak!", body: "A whole week of consistency! Amazing!" }

// First week
{ title: "🎉 First Week Complete!", body: "You've logged 7 days of meals! You're building great habits!" }

// Daily target
{ title: "🎯 Daily Target Achieved!", body: "Perfect day! You hit [calories] cal and [protein]g protein!" }
```

**Acceptance Criteria:**
- ✅ Detects milestone types (streaks, first week, targets)
- ✅ Prevents duplicate notifications via notifications_log check
- ✅ Celebratory tone and emoji for each milestone
- ✅ Links to dashboard for context
- ✅ Logged with type='achievement' for history
- ✅ Respects quiet_hours_start/quiet_hours_end
- ✅ Non-blocking execution (won't fail meal logging)

**Integration Points:**
- ✅ After daily log saved in dashboard-content.tsx
- ✅ checkAndNotifyAchievements() server action
- ✅ Runs asynchronously via .catch() pattern

---

#### ✅ Step 9: Implement Plan Update Notifications
**Status:** ✅ Completed  
**Actual Time:** 30 minutes  
**Completed:** January 4, 2026  
**Files Modified:**
- ✅ `lib/actions/notifications.ts` - sendPlanUpdateNotification function
- ✅ `lib/actions/users.ts` - Integration in assignMealStructure

**Description:**  
Notify users when admin assigns them a meal plan structure.

**Implemented Triggers:**
- ✅ Admin assigns meal structure for first time (via Assign Meal Plan dialog)
- Plan status changes from 'pending_assignment' → 'active'

**Notification Payloads:**
```typescript
// New assignment
{
  title: "🎉 New Meal Plan Assigned!",
  body: "Your personalized meal plan for [date] is ready!",
  url: "/plans",
  notification_type: "plan_update"
}

// Plan update
{
  title: "📝 Meal Plan Updated",
  body: "Your meal plan for [date] has been updated.",
  url: "/plans",
  notification_type: "plan_update"
}
```

**Function Signature:**
```typescript
export async function sendPlanUpdateNotification(
  userId: string,
  planDate: string,
  isNewAssignment = false
): Promise<ActionResult>
```

**Integration:**
- Called after successful `assignMealStructure()` in users.ts
- Non-blocking import + catch pattern
- Uses today's date as effective date

**Acceptance Criteria:**
- ✅ Triggered after meal structure assigned
- ✅ Only if `push_enabled = true` AND `plan_updates = true`
- ✅ Includes formatted date (e.g., "Monday, Jan 4")
- ✅ Direct link to /plans page
- ✅ Respects quiet hours
- ✅ Handles invalid subscriptions (410/404 deactivation)
- ✅ Logged with type='plan_update' for analytics

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

### Completed: 9/12 (75%)
- ✅ Step 1: Database Schema & Migrations
- ✅ Step 2: Core Push Subscription Flow
- ✅ Step 3: Admin Notification Testing UI
- ✅ Step 4: Add Quiet Hours (UX Enhancement)
- ✅ Step 5: Meal Reminder Notifications (Automation)
- ✅ Step 6: Daily Summary Notifications (Automation)
- ✅ Step 7: Weekly Report Notifications (Automation)
- ✅ Step 8: Goal Achievement Notifications (Real-time)
- ✅ Step 9: Plan Update Notifications (Admin trigger)

### In Progress: 0/12
- None

### Not Started: 3/12 (25%)
- ⬜ Step 10: Notification Analytics Dashboard
- ⬜ Step 11: Rate Limiting & Batch Processing
- ⬜ Step 12: Cross-Browser Testing

### Blocked: 0/12
- None

---

## 🎊 Core Notification Features Complete!

All user-facing notification features are now implemented and ready to use:

### ✅ Phase 1: Core (Infrastructure)
- Push subscription management
- Web Push API integration
- Database schema with RLS

### ✅ Phase 2: UX (User Experience)
- Profile notification settings
- Quiet hours configuration
- Admin testing interface

### ✅ Phase 3: Automation (Scheduled)
- Meal reminders (every 15 min, 30 min before meals)
- Daily summaries (8 PM daily)
- Weekly reports (Sunday 7 PM)

### ✅ Phase 4: Real-Time Triggers
- Achievement celebrations (streaks, targets, milestones)
- Plan updates (admin assigns meal structure)

### 📊 Phase 5: Analytics & Polish (Optional)
Steps 10-12 focus on production optimization:
- Analytics dashboard for admins
- Rate limiting for high-volume scenarios
- Cross-browser compatibility testing

**Recommendation:** Consider completing Phase 5 later or pivot to other app features.

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
  - Both single user and broadc
- ✅ **Completed Step 2:** Notification icon assets
  - Created brand-styled icons with lime green gradient + lightning bolt
  - Generated 192x192 main icon and 72x72 badge icon
  - Created reusable generation script with sharp library
  - Icons now display properly in notifications
  - **Next:** Ready to test full notification flow (Step 3)ast notifications now trackable
  - Ready for testing in Step 3

---

## Contact

**Questions or Issues?**  
- See: `docs/working/push-notifications-setup.md` for technical setup
- Admin panel: `/admin/notifications` for testing
- User settings: Profile > Notifications section

**Last Updated:** December 29, 2025
