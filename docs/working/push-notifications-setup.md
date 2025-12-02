# Push Notifications Setup

This document explains how to set up push notifications for Waddy Diet Master.

## 1. Generate VAPID Keys

Run this command in your terminal to generate VAPID keys:

```bash
npx web-push generate-vapid-keys
```

This will output something like:

```
=======================================

Public Key:
BNYhzVABuLw8RA3H-xxx-yyy-zzz

Private Key:
abc123xyz456-private-key

=======================================
```

## 2. Set Environment Variables

Add the following to your `.env.local` file:

```env
# Push Notifications (VAPID Keys)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BNYhzVABuLw8RA3H-xxx-yyy-zzz
VAPID_PRIVATE_KEY=abc123xyz456-private-key
VAPID_SUBJECT=mailto:support@waddydiet.com
```

**Important:**
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is public and can be exposed to the client
- `VAPID_PRIVATE_KEY` is SECRET and should never be exposed
- `VAPID_SUBJECT` should be either a `mailto:` or `https://` URL

## 3. Run Database Migrations

Apply the push notifications migration to your Supabase database:

```bash
supabase db push
```

Or manually run the SQL in `supabase/migrations/20241203_push_notifications.sql`.

## 4. Register Service Worker

The service worker at `/public/sw.js` handles push events. It's automatically registered by the `usePushNotifications` hook when users enable notifications.

## 5. Testing

1. Go to Admin Panel > Notifications
2. Select a user with an active subscription
3. Enter a title and message
4. Click "Send to User" to test

## Architecture

### Flow

1. **User enables notifications** → Browser requests permission
2. **Permission granted** → Browser creates PushSubscription
3. **Subscription saved** → Stored in `push_subscriptions` table
4. **Admin sends notification** → Server uses `web-push` library
5. **Push received** → Service worker shows native notification
6. **User clicks** → Opens app at specified URL

### Database Tables

- `push_subscriptions` - Stores device push endpoints
- `notification_settings` - User preferences for notification types
- `notifications_log` - History of sent notifications

### Files

- `/public/sw.js` - Service worker for handling push events
- `/lib/hooks/use-push-notifications.ts` - Client hook for subscription management
- `/lib/actions/notifications.ts` - Server actions for sending notifications
- `/app/admin/notifications/page.tsx` - Admin panel for testing
- `/components/admin/notifications-panel.tsx` - Admin UI component

## Notification Types

Users can toggle these notification types in their profile:

- `meal_reminders` - Reminders when it's time to eat
- `daily_summary` - End of day nutrition summary
- `weekly_report` - Weekly progress insights
- `goal_achievements` - Milestone celebrations
- `plan_updates` - When meal plans are updated

## Troubleshooting

### Notifications not showing

1. Check browser permissions in Settings
2. Verify VAPID keys are correctly set
3. Check browser console for errors
4. Ensure service worker is registered (`navigator.serviceWorker.getRegistrations()`)

### "Push service error"

- VAPID keys may be misconfigured
- Subscription may have expired (re-subscribe)
- Check server logs for `web-push` errors

### Safari/iOS Notes

- iOS requires the app to be "installed" as a PWA for push notifications
- Add to Home Screen first, then enable notifications from within the app
