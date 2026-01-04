# Meal Reminders Edge Function

Automated meal reminder system that runs every 15 minutes to notify users about upcoming meals.

## Configuration

### Environment Variables Required:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin access
- `VAPID_PUBLIC_KEY` - VAPID public key for web push
- `VAPID_PRIVATE_KEY` - VAPID private key for web push
- `VAPID_SUBJECT` - VAPID subject (mailto: or https: URL)

### Default Meal Times:
- **Breakfast**: 8:00 AM (reminder at 7:30 AM)
- **Lunch**: 1:00 PM (reminder at 12:30 PM)
- **Dinner**: 7:00 PM (reminder at 6:30 PM)

## How It Works

1. Runs every 15 minutes via cron trigger
2. Checks if current time matches any meal reminder window
3. Queries users with:
   - `meal_reminders = true`
   - `push_enabled = true`
   - Not in quiet hours
   - Have a plan for today with the specific meal
4. Gets recipe name from plan if available
5. Sends personalized notification with recipe name
6. Logs all sent notifications

## Deployment

```bash
# Deploy the function
supabase functions deploy meal-reminders

# Set up cron trigger (in Supabase Dashboard → Edge Functions)
# Schedule: */15 * * * * (every 15 minutes)
# HTTP Method: POST
```

## Testing Locally

```bash
# Serve locally
supabase functions serve meal-reminders

# Test with curl
curl -i --location --request POST 'http://localhost:54321/functions/v1/meal-reminders' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json'
```

## Response Format

```json
{
  "success": true,
  "meal": "Breakfast",
  "sent": 5,
  "failed": 0,
  "total": 5
}
```

## Error Handling

- Invalid subscriptions (410/404 status) are automatically marked as inactive
- Failed notifications are logged with `status = 'failed'`
- Users in quiet hours are automatically filtered out
- Function returns success even if no reminders needed
