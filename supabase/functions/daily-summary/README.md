# Daily Summary Edge Function

Automated daily nutrition summary that runs once per day at 8 PM to send users their day's nutrition progress.

## Configuration

### Environment Variables Required:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin access
- `VAPID_PUBLIC_KEY` - VAPID public key for web push
- `VAPID_PRIVATE_KEY` - VAPID private key for web push
- `VAPID_SUBJECT` - VAPID subject (mailto: or https: URL)

### Default Run Time:
- **8:00 PM** daily

## How It Works

1. Runs once daily at 8 PM via cron trigger
2. Queries users with:
   - `daily_summary = true`
   - `push_enabled = true`
   - Not in quiet hours
   - Have logged at least one meal today
3. Aggregates nutrition totals from `daily_logs`
4. Compares to user targets from profile
5. Generates personalized summary message
6. Sends notification with achievement emoji

## Achievement Emojis

- 🎯 **Perfect Day** - Hit calorie target (±10%) with 3+ meals logged
- ⭐ **Great Job** - Logged 3+ meals
- 📊 **Summary** - 1-2 meals logged
- 📝 **Reminder** - No meals logged (not sent by this function)

## Example Notifications

### Perfect Day:
```
🎯 Your Day in Review
1,850 cal (98% of goal) • 140g protein • 3 meals logged
```

### Great Day:
```
⭐ Your Day in Review
1,650 cal (88% of goal) • 125g protein • 3 meals logged
```

### Partial Day:
```
📊 Your Day in Review
980 cal • 65g protein • 2 meals logged
```

## Deployment

```bash
# Deploy the function
supabase functions deploy daily-summary

# Set up cron trigger (in Supabase Dashboard → Edge Functions)
# Schedule: 0 20 * * * (8 PM daily)
# HTTP Method: POST
```

## Testing Locally

```bash
# Serve locally
supabase functions serve daily-summary

# Test with curl
curl -i --location --request POST 'http://localhost:54321/functions/v1/daily-summary' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json'
```

## Response Format

```json
{
  "success": true,
  "sent": 12,
  "failed": 0,
  "total": 12
}
```

## Error Handling

- Invalid subscriptions (410/404 status) are automatically marked as inactive
- Failed notifications are logged with `status = 'failed'`
- Users in quiet hours are automatically filtered out
- Only sends to users who logged food today
- Function returns success even if no eligible users
