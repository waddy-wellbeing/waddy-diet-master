# Edge Functions Cron Configuration

This document provides the cron schedule configuration for all automated Edge Functions.

## Setup Instructions

Cron jobs for Supabase Edge Functions are configured via the Supabase Dashboard:

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Edge Functions** in the sidebar
4. For each function below, click the function name → **Settings** → **Add Cron Trigger**

---

## Cron Jobs Configuration

### 1. Meal Reminders
**Function:** `meal-reminders`  
**Schedule:** `*/15 * * * *` (Every 15 minutes)  
**HTTP Method:** POST  
**Description:** Sends meal reminders 30 minutes before breakfast, lunch, and dinner

**Cron Expression Breakdown:**
- `*/15` = Every 15 minutes
- `*` = Every hour
- `*` = Every day of month
- `*` = Every month
- `*` = Every day of week

---

### 2. Daily Summary
**Function:** `daily-summary`  
**Schedule:** `0 20 * * *` (8:00 PM daily)  
**HTTP Method:** POST  
**Description:** Sends end-of-day nutrition summary to users

**Cron Expression Breakdown:**
- `0` = At minute 0
- `20` = At hour 20 (8 PM)
- `*` = Every day of month
- `*` = Every month
- `*` = Every day of week

---

### 3. Weekly Report (Coming Soon)
**Function:** `weekly-report`  
**Schedule:** `0 19 * * 0` (7:00 PM every Sunday)  
**HTTP Method:** POST  
**Description:** Sends weekly progress summary

**Cron Expression Breakdown:**
- `0` = At minute 0
- `19` = At hour 19 (7 PM)
- `*` = Every day of month
- `*` = Every month
- `0` = Sunday

---

## Alternative: SQL-Based Cron (pg_cron)

If you prefer database-level cron jobs, you can use PostgreSQL's `pg_cron` extension:

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule meal reminders (every 15 minutes)
SELECT cron.schedule(
  'meal-reminders',
  '*/15 * * * *',
  $$
    SELECT
      net.http_post(
        url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/meal-reminders',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
        ),
        body := '{}'::jsonb
      ) AS request_id;
  $$
);

-- Schedule daily summary (8 PM daily)
SELECT cron.schedule(
  'daily-summary',
  '0 20 * * *',
  $$
    SELECT
      net.http_post(
        url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/daily-summary',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
        ),
        body := '{}'::jsonb
      ) AS request_id;
  $$
);

-- Schedule weekly report (7 PM every Sunday)
SELECT cron.schedule(
  'weekly-report',
  '0 19 * * 0',
  $$
    SELECT
      net.http_post(
        url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/weekly-report',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
        ),
        body := '{}'::jsonb
      ) AS request_id;
  $$
);
```

---

## Verifying Cron Jobs

### Dashboard Method:
- Go to Edge Functions → Function Name → Settings
- Check "Cron Triggers" section

### pg_cron Method:
```sql
-- List all scheduled jobs
SELECT * FROM cron.job;

-- View job run history
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 10;
```

---

## Testing Manually

You can trigger any function manually via CLI:

```bash
# Test meal reminders
curl -i --location --request POST \
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/meal-reminders' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json'

# Test daily summary
curl -i --location --request POST \
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/daily-summary' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json'
```

---

## Timezone Considerations

- Supabase Edge Functions run in UTC timezone
- If you need different timezones, adjust the hour in the cron expression
- For example, if you want 8 PM EST (UTC-5), use hour 1 (8 PM + 5 hours = 1 AM UTC next day)
- Consider implementing timezone support in the functions themselves for per-user customization

---

## Monitoring

Monitor cron job executions:
1. **Dashboard**: Edge Functions → Logs
2. **CLI**: `supabase functions logs meal-reminders`
3. **Database**: Query `notifications_log` table for sent notifications
