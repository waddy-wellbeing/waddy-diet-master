# Weekly Report Edge Function

Automated weekly progress summary that runs every Sunday at 7 PM to send users a comprehensive review of their week.

## Configuration

### Environment Variables Required:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin access
- `VAPID_PUBLIC_KEY` - VAPID public key for web push
- `VAPID_PRIVATE_KEY` - VAPID private key for web push
- `VAPID_SUBJECT` - VAPID subject (mailto: or https: URL)

### Default Run Time:
- **7:00 PM every Sunday**

## How It Works

1. Runs once weekly on Sunday at 7 PM via cron trigger
2. Queries users with:
   - `weekly_report = true`
   - `push_enabled = true`
   - Not in quiet hours
   - Have logged at least once in the past 7 days
3. Aggregates data from past 7 days of `daily_logs`
4. Calculates:
   - Days logged (out of 7)
   - Current logging streak
   - Average calories & protein
   - Average meals per day
   - Progress toward targets
5. Generates personalized summary with motivation
6. Sends notification with achievement emoji

## Weekly Statistics Calculated

- **Days Logged**: Number of days with at least one meal logged (out of 7)
- **Streak**: Consecutive days logged (resets if a day is skipped)
- **Average Calories**: Daily average (only counting logged days)
- **Average Protein**: Daily average in grams
- **Average Meals/Day**: Rounded to 1 decimal
- **Target Progress**: Percentage of calorie target achieved

## Achievement Emojis

- 🔥 **Fire Week** - All 7 days logged (perfect week!)
- ⭐ **Star Week** - 5-6 days logged (great consistency)
- 📈 **Growth Week** - 3-4 days logged (good progress)
- 💪 **Building Week** - 1-2 days logged (needs improvement)
- 📊 **Fresh Start** - 0 days logged (encouragement)

## Example Notifications

### Perfect Week (7/7 days):
```
🔥 Your Week in Review
7-day streak! 🔥 • 7/7 days logged • 98% on track • 145g protein
```

### Great Week (5-6 days):
```
⭐ Your Week in Review
5-day streak • 5/7 days logged • 92% on track • 130g protein
```

### Good Week (3-4 days):
```
📈 Your Week in Review
3-day streak • 4/7 days logged • 88% on track • 120g protein
```

### Building Week (1-2 days):
```
💪 Your Week in Review
1/7 days logged • 1,850 avg cal • 140g protein
```

## Motivational Messages

Based on performance, users receive contextual encouragement:
- **7-day streak**: "You're crushing it! Keep the momentum going! 💪"
- **Perfect week**: "Perfect week! You're building amazing habits! 🎯"
- **5-6 days**: "Great consistency! You're so close to a perfect week! ⭐"
- **3-4 days**: "Solid progress! Aim for more days next week! 📈"
- **1-2 days**: "Good start! Try to log daily for best results! 💪"
- **0 days**: "Ready for a fresh start this week? Let's go! 🚀"

## Deployment

```bash
# Deploy the function
supabase functions deploy weekly-report

# Set up cron trigger (in Supabase Dashboard → Edge Functions)
# Schedule: 0 19 * * 0 (7 PM every Sunday)
# HTTP Method: POST
```

## Testing Locally

```bash
# Serve locally
supabase functions serve weekly-report

# Test with curl
curl -i --location --request POST 'http://localhost:54321/functions/v1/weekly-report' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json'
```

## Response Format

```json
{
  "success": true,
  "sent": 25,
  "failed": 0,
  "total": 25
}
```

## Streak Calculation Logic

The streak counter tracks **consecutive days** with at least one meal logged:
- Starts from the most recent day and counts backward
- Resets to 0 if any day has no meals logged
- Does not count missing daily_log entries (treats as 0)
- Maximum practical streak is 7 days (week window)

Example:
- Mon ✅, Tue ✅, Wed ✅, Thu ❌, Fri ✅, Sat ✅, Sun ✅
- Result: **3-day streak** (Fri-Sat-Sun)

## Error Handling

- Invalid subscriptions (410/404 status) are automatically marked as inactive
- Failed notifications are logged with `status = 'failed'`
- Users in quiet hours are automatically filtered out
- Only sends to users who logged food this week
- Missing daily_log entries are treated as 0 meals logged
- Function returns success even if no eligible users

## Future Enhancements

- Week-over-week comparison (vs. last week)
- Monthly trends and patterns
- Personalized insights based on user goals
- Weight progress tracking (when implemented)
- Achievement badges unlocked this week
- Social comparisons (optional, privacy-conscious)
