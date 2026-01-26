# Complete Database Schema

**WARNING:** This schema is for context only and is not meant to be run.
Table order and constraints may not be valid for execution.

## Tables Overview

### analytics_error_logs

Error tracking and logging for analytics.

```sql
CREATE TABLE public.analytics_error_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  session_id text,
  error_type character varying NOT NULL,
  error_code character varying,
  severity character varying NOT NULL,
  error_message text NOT NULL,
  error_stack text,
  component character varying,
  action character varying,
  page_path character varying,
  recipe_id uuid,
  ingredient_id uuid,
  daily_plan_id uuid,
  device_type character varying,
  browser_info jsonb,
  screen_resolution character varying,
  viewport_size character varying,
  api_endpoint character varying,
  http_method character varying,
  http_status_code integer,
  request_payload jsonb,
  response_data jsonb,
  user_input jsonb,
  is_resolved boolean DEFAULT false,
  resolved_by uuid,
  resolved_at timestamp with time zone,
  resolution_notes text,
  metadata jsonb,
  tags ARRAY DEFAULT '{}'::text[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  archived boolean DEFAULT false,
  CONSTRAINT analytics_error_logs_pkey PRIMARY KEY (id),
  CONSTRAINT analytics_error_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT analytics_error_logs_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.analytics_sessions(session_id),
  CONSTRAINT analytics_error_logs_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES auth.users(id)
);
```

### analytics_events

User interaction events tracking.

```sql
CREATE TABLE public.analytics_events (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  session_id text NOT NULL,
  user_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  time_since_session_start_ms integer,
  event_type character varying NOT NULL,
  event_category character varying NOT NULL,
  event_action character varying,
  event_label character varying,
  page_path character varying NOT NULL,
  page_section character varying,
  event_data jsonb DEFAULT '{}'::jsonb,
  time_since_page_load_ms integer,
  is_error boolean DEFAULT false,
  error_code character varying,
  archived boolean DEFAULT false,
  CONSTRAINT analytics_events_pkey PRIMARY KEY (id),
  CONSTRAINT analytics_events_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.analytics_sessions(session_id),
  CONSTRAINT analytics_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
```

### analytics_page_views

Aggregated page view statistics.

```sql
CREATE TABLE public.analytics_page_views (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  page_path character varying NOT NULL,
  event_date date NOT NULL,
  total_views integer DEFAULT 0,
  unique_sessions integer DEFAULT 0,
  unique_users integer DEFAULT 0,
  avg_time_on_page_ms numeric,
  bounce_rate numeric,
  mobile_views integer DEFAULT 0,
  tablet_views integer DEFAULT 0,
  desktop_views integer DEFAULT 0,
  onboarding_completions integer DEFAULT 0,
  meal_logs_initiated integer DEFAULT 0,
  recipe_swaps_count integer DEFAULT 0,
  errors_count integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT analytics_page_views_pkey PRIMARY KEY (id)
);
```

### analytics_sessions

User session tracking.

```sql
CREATE TABLE public.analytics_sessions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  session_id text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_activity_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone,
  total_duration_seconds integer,
  device_type character varying,
  browser character varying,
  os character varying,
  screen_resolution character varying,
  user_agent text,
  ip_address inet,
  referrer text,
  utm_source character varying,
  utm_medium character varying,
  utm_campaign character varying,
  utm_term character varying,
  utm_content character varying,
  landing_page character varying,
  exit_page character varying,
  pages_visited ARRAY DEFAULT '{}'::text[],
  features_used ARRAY DEFAULT '{}'::text[],
  completed_onboarding boolean DEFAULT false,
  logged_meals_count integer DEFAULT 0,
  recipes_swapped_count integer DEFAULT 0,
  engagement_score numeric,
  session_type character varying,
  notes text,
  archived boolean DEFAULT false,
  CONSTRAINT analytics_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT analytics_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
```

### audit_logs

System audit logging.

```sql
CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  level USER-DEFINED NOT NULL DEFAULT 'info'::log_level,
  category USER-DEFINED NOT NULL DEFAULT 'system'::log_category,
  user_id uuid,
  user_email text,
  user_role text,
  ip_address inet,
  user_agent text,
  action text NOT NULL,
  resource_type text,
  resource_id text,
  request_id text,
  request_path text,
  request_method text,
  details jsonb DEFAULT '{}'::jsonb,
  old_values jsonb,
  new_values jsonb,
  error_message text,
  error_stack text,
  error_code text,
  error_digest text,
  duration_ms integer,
  tags ARRAY,
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
```

### daily_logs

User's daily food logging.

```sql
CREATE TABLE public.daily_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  log_date date NOT NULL,
  log jsonb NOT NULL DEFAULT '{}'::jsonb,
  logged_totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  meals_logged integer NOT NULL DEFAULT 0,
  adherence_score numeric,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT daily_logs_pkey PRIMARY KEY (id),
  CONSTRAINT daily_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
```

### daily_plans

**User's daily meal plans - CRITICAL TABLE**

```sql
CREATE TABLE public.daily_plans (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  plan_date date NOT NULL,
  plan jsonb NOT NULL DEFAULT '{}'::jsonb,
  daily_totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_generated boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT daily_plans_pkey PRIMARY KEY (id),
  CONSTRAINT daily_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
```

**plan JSONB Structure:**

```json
{
  "breakfast": {
    "recipe_id": "32f2b278-d464-40bf-82ea-9614e5a5c972",
    "servings": 1
  },
  "lunch": {
    "recipe_id": "e27343bb-bb56-42c7-8b9f-607b47aa666b",
    "servings": 1
  },
  "dinner": {
    "recipe_id": "1a8dddcf-401a-42aa-a724-0aa47c72c3a9",
    "servings": 1
  },
  "snacks": [
    {
      "recipe_id": "98ac3862-42a8-43f1-83fa-431bce77284e",
      "servings": 1
    }
  ]
}
```

### ingredients

Ingredient database with nutritional information.

```sql
CREATE TABLE public.ingredients (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name character varying NOT NULL UNIQUE,
  name_ar text,
  brand character varying,
  category character varying,
  food_group text,
  subgroup text,
  serving_size numeric NOT NULL,
  serving_unit character varying NOT NULL,
  macros jsonb NOT NULL DEFAULT '{}'::jsonb,
  micros jsonb DEFAULT '{}'::jsonb,
  is_verified boolean NOT NULL DEFAULT false,
  source character varying,
  created_by uuid,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ingredients_pkey PRIMARY KEY (id),
  CONSTRAINT ingredients_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
```

### notification_settings

User notification preferences.

```sql
CREATE TABLE public.notification_settings (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL UNIQUE,
  push_enabled boolean NOT NULL DEFAULT true,
  meal_reminders boolean NOT NULL DEFAULT true,
  daily_summary boolean NOT NULL DEFAULT true,
  weekly_report boolean NOT NULL DEFAULT true,
  goal_achievements boolean NOT NULL DEFAULT true,
  plan_updates boolean NOT NULL DEFAULT true,
  quiet_hours_start time without time zone,
  quiet_hours_end time without time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notification_settings_pkey PRIMARY KEY (id),
  CONSTRAINT notification_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
```

### notifications_log

Notification delivery tracking.

```sql
CREATE TABLE public.notifications_log (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  title character varying NOT NULL,
  body text NOT NULL,
  icon character varying,
  url character varying,
  notification_type character varying NOT NULL,
  is_broadcast boolean NOT NULL DEFAULT false,
  status character varying NOT NULL DEFAULT 'sent'::character varying,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  clicked_at timestamp with time zone,
  error_message text,
  CONSTRAINT notifications_log_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
```

### profiles

**User profiles - CRITICAL TABLE**

```sql
CREATE TABLE public.profiles (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL UNIQUE,
  basic_info jsonb NOT NULL DEFAULT '{}'::jsonb,
  targets jsonb NOT NULL DEFAULT '{}'::jsonb,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  goals jsonb NOT NULL DEFAULT '{}'::jsonb,
  onboarding_completed boolean NOT NULL DEFAULT false,
  onboarding_step integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  role USER-DEFINED NOT NULL DEFAULT 'client'::user_role,
  plan_status USER-DEFINED NOT NULL DEFAULT 'pending_assignment'::plan_status,
  name character varying,
  email character varying,
  avatar_url text,
  mobile text UNIQUE,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
```

**Note:** Email and name are stored in BOTH direct columns AND basic_info JSONB for flexibility.

### push_subscriptions

Push notification subscriptions.

```sql
CREATE TABLE public.push_subscriptions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  device_type character varying,
  device_name character varying,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
```

### recipe_ingredients

Recipe-ingredient relationship table.

```sql
CREATE TABLE public.recipe_ingredients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL,
  ingredient_id uuid,
  spice_id uuid,
  raw_name text NOT NULL,
  quantity numeric,
  unit character varying,
  is_spice boolean NOT NULL DEFAULT false,
  is_optional boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  is_matched boolean NOT NULL DEFAULT false,
  match_confidence numeric,
  suggested_ingredient_id uuid,
  suggested_spice_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT recipe_ingredients_pkey PRIMARY KEY (id),
  CONSTRAINT recipe_ingredients_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.recipes(id),
  CONSTRAINT recipe_ingredients_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id),
  CONSTRAINT recipe_ingredients_spice_id_fkey FOREIGN KEY (spice_id) REFERENCES public.spices(id),
  CONSTRAINT recipe_ingredients_suggested_ingredient_id_fkey FOREIGN KEY (suggested_ingredient_id) REFERENCES public.ingredients(id),
  CONSTRAINT recipe_ingredients_suggested_spice_id_fkey FOREIGN KEY (suggested_spice_id) REFERENCES public.spices(id)
);
```

### recipes

Recipe database.

```sql
CREATE TABLE public.recipes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name character varying NOT NULL UNIQUE,
  description text,
  image_url character varying,
  meal_type ARRAY,
  cuisine character varying,
  tags ARRAY,
  prep_time_minutes integer,
  cook_time_minutes integer,
  servings integer NOT NULL DEFAULT 1,
  difficulty character varying,
  instructions jsonb NOT NULL DEFAULT '[]'::jsonb,
  nutrition_per_serving jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_vegetarian boolean DEFAULT false,
  is_vegan boolean DEFAULT false,
  is_gluten_free boolean DEFAULT false,
  is_dairy_free boolean DEFAULT false,
  admin_notes text,
  created_by uuid,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  status USER-DEFINED NOT NULL DEFAULT 'draft'::recipe_status,
  validation_errors jsonb DEFAULT '[]'::jsonb,
  last_validated_at timestamp with time zone,
  CONSTRAINT recipes_pkey PRIMARY KEY (id),
  CONSTRAINT recipes_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
```

### spices

Spices reference table.

```sql
CREATE TABLE public.spices (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  name_ar text,
  aliases ARRAY DEFAULT '{}'::text[],
  is_default boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT spices_pkey PRIMARY KEY (id)
);
```

### system_settings

System configuration settings.

```sql
CREATE TABLE public.system_settings (
  key character varying NOT NULL,
  value jsonb NOT NULL,
  description text,
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid,
  CONSTRAINT system_settings_pkey PRIMARY KEY (key),
  CONSTRAINT system_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);
```
