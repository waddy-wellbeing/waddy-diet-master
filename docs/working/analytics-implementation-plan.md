# Analytics Implementation Plan - Bite Right

## Executive Summary

Implement a comprehensive user activity tracking system to monitor client behaviors, page navigation, feature usage, and errors across authenticated users and guest sessions. This plan prioritizes user privacy, performance, and actionable insights for UX improvements.

---

## 1. Requirements Analysis

### 1.1 Core Objectives
- **Activity Tracking**: Monitor user journeys, page visits, feature interactions
- **Error Monitoring**: Capture application errors with severity levels and context
- **UX Analytics**: Track user engagement, time on page, feature adoption
- **Guest Support**: Track anonymous/guest sessions separately from authenticated users
- **Performance Insights**: Identify bottlenecks, poor UX patterns, error hotspots
- **Privacy Compliance**: No sensitive user data; compliance-ready design

### 1.2 Key Use Cases
1. User completes onboarding → Track progress, drop-off points, time spent
2. User navigates dashboard → Track page access, feature clicks, meal logging
3. User creates/swaps recipe → Track feature usage, performance issues
4. User encounters error → Capture context, severity, reproducibility
5. Guest views landing page → Track engagement, conversion intent (future marketing)

---

## 2. Database Schema Design

### 2.1 Recommended Tables & Rationale

We'll create a **Bite Right-specific** analytics schema that combines elements from the reference tables, optimized for your app's needs:

```sql
-- ============================================================================
-- ANALYTICS TABLES (Bite Right Specific)
-- ============================================================================

-- Sessions: User visit context (authenticated or guest)
-- Combines analytics_sessions concept with app-specific fields
CREATE TABLE analytics_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- NULL for guests
  session_id TEXT NOT NULL UNIQUE,                             -- Unique session identifier
  
  -- Session timing
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  total_duration_seconds INTEGER,
  
  -- Device/Environment metadata
  device_type VARCHAR(50),                    -- mobile, tablet, desktop
  browser VARCHAR(100),
  os VARCHAR(100),
  screen_resolution VARCHAR(20),
  user_agent TEXT,
  ip_address INET,
  
  -- Referrer/Campaign tracking
  referrer TEXT,
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),
  utm_term VARCHAR(100),
  utm_content VARCHAR(100),
  
  -- Navigation metadata
  landing_page VARCHAR(255),                  -- First page visited
  exit_page VARCHAR(255),                     -- Last page visited
  pages_visited TEXT[] DEFAULT '{}',          -- Ordered array of visited pages
  
  -- Bite Right specific: Feature engagement
  features_used TEXT[] DEFAULT '{}',          -- Tracked features: onboarding, meal-builder, dashboard, etc.
  completed_onboarding BOOLEAN DEFAULT FALSE,
  logged_meals_count INTEGER DEFAULT 0,       -- How many meals user logged
  recipes_swapped_count INTEGER DEFAULT 0,    -- Number of recipe swaps
  
  -- Engagement quality
  engagement_score DECIMAL(5, 2),             -- Calculated metric (0-100)
  session_type VARCHAR(50),                   -- 'onboarding', 'active_user', 'returning', 'guest'
  
  -- Admin metadata
  notes TEXT,                                 -- Notes on session quality
  archived BOOLEAN DEFAULT FALSE,
  
  CONSTRAINT sessions_user_or_anon CHECK (user_id IS NOT NULL OR session_id IS NOT NULL)
);

CREATE INDEX analytics_sessions_user_id_idx ON analytics_sessions(user_id);
CREATE INDEX analytics_sessions_session_id_idx ON analytics_sessions(session_id);
CREATE INDEX analytics_sessions_created_at_idx ON analytics_sessions(created_at);
CREATE INDEX analytics_sessions_device_type_idx ON analytics_sessions(device_type);

-- ============================================================================

-- Events: Granular user actions (page views, feature interactions)
-- Combines analytics_events concept with app context
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT NOT NULL REFERENCES analytics_sessions(session_id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Event timing
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  time_since_session_start_ms INTEGER,      -- Milliseconds from session start
  
  -- Event categorization (hierarchical)
  event_type VARCHAR(100) NOT NULL,         -- page_view, button_click, form_submit, feature_use, etc.
  event_category VARCHAR(100) NOT NULL,     -- onboarding, dashboard, recipes, profile, etc.
  event_action VARCHAR(100),                -- Added, Updated, Deleted, Viewed, etc.
  event_label VARCHAR(255),                 -- Specific identifier (recipe_id, meal_type, etc.)
  
  -- Location context
  page_path VARCHAR(255) NOT NULL,          -- /dashboard, /meal-builder, /recipes, etc.
  page_section VARCHAR(100),                -- breakfast_card, ingredient_list, nutrition_summary, etc.
  
  -- Event data (flexible)
  event_data JSONB DEFAULT '{}',            -- Duration, values, selections, etc.
                                            -- Example: {"duration_ms": 1500, "recipe_id": "abc123"}
  
  -- Performance metrics
  time_since_page_load_ms INTEGER,
  
  -- UX signals
  is_error BOOLEAN DEFAULT FALSE,
  error_code VARCHAR(100),
  
  -- Admin
  archived BOOLEAN DEFAULT FALSE
);

CREATE INDEX analytics_events_session_id_idx ON analytics_events(session_id);
CREATE INDEX analytics_events_user_id_idx ON analytics_events(user_id);
CREATE INDEX analytics_events_event_type_idx ON analytics_events(event_type);
CREATE INDEX analytics_events_event_category_idx ON analytics_events(event_category);
CREATE INDEX analytics_events_created_at_idx ON analytics_events(created_at);
CREATE INDEX analytics_events_page_path_idx ON analytics_events(page_path);

-- ============================================================================

-- Error Logs: Detailed application errors
-- Simplified from app_error_logs, focused on Bite Right needs
CREATE TABLE analytics_error_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT REFERENCES analytics_sessions(session_id) ON DELETE SET NULL,
  
  -- Error categorization
  error_type VARCHAR(100) NOT NULL,         -- RECIPE_LOAD_FAILED, NUTRITION_CALC_ERROR, etc.
  error_code VARCHAR(50),
  severity VARCHAR(50) NOT NULL,            -- critical, high, medium, low
  
  -- Error message & stack
  error_message TEXT NOT NULL,
  error_stack TEXT,
  
  -- Context
  component VARCHAR(100),                   -- Which component errored (MealCard, NutritionCalc, etc.)
  action VARCHAR(100),                      -- User action that triggered it (swap_recipe, log_meal, etc.)
  page_path VARCHAR(255),
  
  -- Related resources
  recipe_id UUID,
  ingredient_id UUID,
  daily_plan_id UUID,
  
  -- Environment
  device_type VARCHAR(50),
  browser_info JSONB,                       -- Browser version, platform, etc.
  screen_resolution VARCHAR(20),
  viewport_size VARCHAR(20),
  
  -- Request context (if API error)
  api_endpoint VARCHAR(255),
  http_method VARCHAR(10),
  http_status_code INTEGER,
  request_payload JSONB,
  response_data JSONB,
  
  -- User input (for validation errors)
  user_input JSONB,
  
  -- Admin workflow
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  
  -- Metadata
  metadata JSONB,                           -- Custom app-specific context
  tags TEXT[] DEFAULT '{}',                 -- For categorization
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived BOOLEAN DEFAULT FALSE
);

CREATE INDEX analytics_error_logs_user_id_idx ON analytics_error_logs(user_id);
CREATE INDEX analytics_error_logs_session_id_idx ON analytics_error_logs(session_id);
CREATE INDEX analytics_error_logs_error_type_idx ON analytics_error_logs(error_type);
CREATE INDEX analytics_error_logs_severity_idx ON analytics_error_logs(severity);
CREATE INDEX analytics_error_logs_created_at_idx ON analytics_error_logs(created_at);
CREATE INDEX analytics_error_logs_is_resolved_idx ON analytics_error_logs(is_resolved);

-- ============================================================================

-- Page Views Summary: Aggregated analytics (for dashboard performance)
-- Helps avoid heavy queries on raw events
CREATE TABLE analytics_page_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  page_path VARCHAR(255) NOT NULL,
  event_date DATE NOT NULL,
  
  -- Aggregate metrics
  total_views INTEGER DEFAULT 0,
  unique_sessions INTEGER DEFAULT 0,
  unique_users INTEGER DEFAULT 0,
  avg_time_on_page_ms DECIMAL(10, 2),
  bounce_rate DECIMAL(5, 2),                -- % who don't interact further
  
  -- Device breakdown
  mobile_views INTEGER DEFAULT 0,
  tablet_views INTEGER DEFAULT 0,
  desktop_views INTEGER DEFAULT 0,
  
  -- Conversion metrics (Bite Right specific)
  onboarding_completions INTEGER DEFAULT 0,
  meal_logs_initiated INTEGER DEFAULT 0,
  recipe_swaps_count INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT analytics_page_views_unique UNIQUE (page_path, event_date)
);

CREATE INDEX analytics_page_views_page_path_idx ON analytics_page_views(page_path);
CREATE INDEX analytics_page_views_event_date_idx ON analytics_page_views(event_date);

-- ============================================================================
```

### 2.2 RLS Policies (Privacy & Security)

```sql
-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE analytics_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_page_views ENABLE ROW LEVEL SECURITY;

-- Analytics: Only admin/moderator can view
CREATE POLICY analytics_sessions_admin_view ON analytics_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

CREATE POLICY analytics_events_admin_view ON analytics_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

CREATE POLICY analytics_error_logs_admin_view ON analytics_error_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

CREATE POLICY analytics_page_views_admin_view ON analytics_page_views
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

-- Server-side only insert (no client-side SELECT)
CREATE POLICY analytics_sessions_insert ON analytics_sessions
  FOR INSERT WITH CHECK (true);

CREATE POLICY analytics_events_insert ON analytics_events
  FOR INSERT WITH CHECK (true);

CREATE POLICY analytics_error_logs_insert ON analytics_error_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY analytics_page_views_upsert ON analytics_page_views
  FOR INSERT WITH CHECK (true);

CREATE POLICY analytics_page_views_update ON analytics_page_views
  FOR UPDATE USING (true);
```

---

## 3. Implementation Phases

### **Phase 1: Foundation (Weeks 1-2)** ✅ Database + Server Infrastructure
- [ ] Deploy SQL schema + indexes + RLS policies
- [ ] Create server actions for analytics capture
  - `trackSession()` - Initialize session on app load
  - `trackPageView()` - When route changes
  - `trackEvent()` - Generic event tracking
  - `captureError()` - Error logging
- [ ] Set up Supabase client utilities for admin queries
- [ ] Create TypeScript types for analytics data

**Deliverables:**
- SQL migration file
- Server actions (`lib/actions/analytics.ts`)
- TypeScript types (`lib/types/analytics.ts`)
- Database utility functions

---

### **Phase 2: Core Instrumentation (Weeks 2-3)** ⭐ Key User Flows
Instrument critical user journeys:

**Onboarding Flow:**
- [ ] Session init when user lands on onboarding
- [ ] Event per step completion (basic-info, goals, preferences)
- [ ] Track time per step, validation errors, step skips
- [ ] Error logging for form submissions

**Dashboard:**
- [ ] Page view event on load
- [ ] Track recipe swaps, meal logging, page navigation
- [ ] Measure engagement: time on page, features used
- [ ] Capture any meal-builder errors

**Meal Builder:**
- [ ] Page view event
- [ ] Track recipe selection, ingredient swaps
- [ ] Capture nutrition recalculations
- [ ] Error logs for failed saves

**Recipe Management:**
- [ ] View recipe detail → event
- [ ] Swap recipe → event with before/after data
- [ ] Edit ingredients → events

**Deliverables:**
- Instrumented page components with event tracking
- Error boundaries with fallback logging
- Session management in app layout
- Documentation: Which events fire where

---

### **Phase 3: Error Monitoring (Week 3)** 🚨 Stability Insights
Implement error capture across the app:

- [ ] Global error boundary with analytics capture
- [ ] API error handling → error logs
- [ ] Validation error tracking
- [ ] Performance warnings (slow API calls, heavy computations)
- [ ] Browser console error interception (optional, advanced)

**Error Types to Track:**
- `RECIPE_LOAD_FAILED` - Failed to fetch recipes
- `NUTRITION_CALC_ERROR` - Nutrition calculation failures
- `MEAL_LOG_FAILED` - Failed to log meal
- `RECIPE_SWAP_FAILED` - Failed recipe swap
- `AUTH_ERROR` - Authentication failures
- `VALIDATION_ERROR` - Form validation issues
- `API_ERROR` - Generic API failures

**Deliverables:**
- Error boundary wrapper component
- Error logger utility
- Error type definitions
- Severity classification system

---

### **Phase 4: Admin Dashboard (Week 4)** 📊 Analytics Visualization
Build admin panel to view analytics:

- [ ] Session list with filtering (date range, user, device type)
- [ ] Session detail view → events timeline + errors
- [ ] Error log browser with severity filters
- [ ] Page performance metrics (views, avg time, bounce rate)
- [ ] User journey visualization (funnel for onboarding)
- [ ] Error heatmap (which features/pages error most)

**Deliverables:**
- Admin routes: `/admin/analytics/`
- Session list, detail, event timeline components
- Error log browser component
- Dashboard charts (charts.js or similar)
- Query utilities for analytics data

---

### **Phase 5: Real-Time Alerts (Week 5)** ⚡ Proactive Monitoring
Set up notifications for critical issues:

- [ ] Error spike detection (>5 errors of same type in 5 min)
- [ ] Admin notifications via email/in-app when critical errors occur
- [ ] Performance degradation alerts (avg time > threshold)
- [ ] User drop-off patterns (incomplete onboarding)

**Deliverables:**
- Alert rules/thresholds configuration
- Notification service integration
- Admin notification UI

---

### **Phase 6: Data Export & Insights (Week 6)** 📈 Business Intelligence
Enable data-driven decisions:

- [ ] CSV/Excel export for sessions, events, errors
- [ ] Weekly digest email (errors, trends, user engagement)
- [ ] Custom report builder
- [ ] API endpoint for external BI tools (Metabase, Looker, etc.)

**Deliverables:**
- Export utilities
- Report generator
- Email digest service
- API endpoint for BI integration

---

### **Phase 7: Privacy & Compliance (Week 7)** 🔒 Data Governance
Ensure privacy regulations:

- [ ] GDPR-compliant data deletion (user deletion cascades)
- [ ] Data retention policies (archive old analytics after 12 months)
- [ ] Anonymization options (remove IP addresses after 90 days)
- [ ] Data access audit logs
- [ ] User consent workflow (if required by regulation)

**Deliverables:**
- Data retention policy documentation
- Cleanup job (Supabase Edge Functions)
- Admin UI for managing user analytics data
- Audit log table

---

### **Phase 8: Performance Optimization (Week 8)** ⚙️ Scale Readiness
Optimize for production scale:

- [ ] Aggregate daily summaries (Page Views table)
- [ ] Batch event inserts (collect ~10-50 events before sending)
- [ ] Compression for old data (archive to cold storage)
- [ ] Analytics database monitoring & scaling

**Deliverables:**
- Batching utility
- Aggregation jobs (Edge Functions or scheduled tasks)
- Monitoring/alerting for analytics database performance

---

## 4. Technical Implementation Details

### 4.1 Frontend Integration Points

#### Session Management (App Layout)
```typescript
// app/layout.tsx
useEffect(() => {
  const session = await trackSession()
  window.__analytics_session_id = session.session_id
}, [])
```

#### Page Navigation (Middleware or Route Guards)
```typescript
// Capture on every route change
router.beforeEach((to, from) => {
  trackPageView({
    path: to.path,
    previousPath: from.path,
    referrer: from.path || document.referrer
  })
})
```

#### Event Tracking (Component Level)
```typescript
// Components trigger events on user actions
<button onClick={() => {
  trackEvent({
    category: 'dashboard',
    action: 'swap_recipe',
    label: recipeId,
    data: { from: oldRecipe, to: newRecipe }
  })
  // ... actual swap logic
}}>
  Swap Recipe
</button>
```

#### Error Capture (Boundary + Try-Catch)
```typescript
// Global error boundary
<ErrorBoundary onError={(error) => {
  captureError({
    type: 'REACT_BOUNDARY_ERROR',
    message: error.message,
    stack: error.stack,
    component: 'MealCard'
  })
}}>
  <App />
</ErrorBoundary>
```

### 4.2 Backend Structure

```
lib/
├── actions/
│   └── analytics.ts          # Server actions for tracking
├── utils/
│   └── analytics/
│       ├── session.ts        # Session utilities
│       ├── events.ts         # Event building
│       └── errors.ts         # Error logging
├── types/
│   └── analytics.ts          # TypeScript interfaces
└── supabase/
    └── queries/
        └── analytics.ts      # Admin queries

components/
├── analytics/
│   └── error-boundary.tsx   # Error boundary with tracking
└── admin/
    └── analytics/
        ├── sessions-list.tsx
        ├── error-logs.tsx
        ├── page-metrics.tsx
        └── analytics-dashboard.tsx

supabase/
└── functions/
    └── analytics/
        ├── aggregate-daily.ts      # Daily aggregation job
        ├── alert-on-error-spike.ts # Alert trigger
        └── cleanup-old-data.ts     # Data retention
```

---

## 5. Phased Event Taxonomy

### Core Events to Track (by feature area)

**Onboarding**
- `page_view`: /onboarding
- `step_viewed`: basic-info, goals, preferences, etc.
- `step_completed`: Successfully filled step
- `step_error`: Validation error on step
- `onboarding_completed`: User finished onboarding

**Dashboard**
- `page_view`: /dashboard
- `meal_logged`: User marked meal as eaten
- `recipe_swapped`: Clicked swap button
- `page_section_viewed`: Viewed nutrition summary, weekly stats
- `time_on_page`: Duration of dashboard visit

**Meal Builder**
- `page_view`: /meal-builder
- `recipe_selected`: Clicked a recipe
- `ingredient_swapped`: Swapped ingredient
- `nutrition_recalculated`: Recalc triggered
- `recipe_saved`: Saved custom recipe
- `recipe_error`: Failed to calculate nutrition

**Profile/Settings**
- `page_view`: /profile
- `profile_updated`: Changed settings
- `mobile_verified`: Phone number verification
- `goal_updated`: Updated health goals

**Errors (All Pages)**
- `error_occurred`: Any error, with type & severity

---

## 6. Metrics & KPIs (What to Measure)

### User Engagement
- **Onboarding completion rate**: % of users who finish onboarding
- **Feature adoption**: % of DAU using meal-logger, recipe-builder
- **Session duration**: Avg time per session
- **Return rate**: % of users returning next day

### Feature Performance
- **Recipe swap frequency**: Avg swaps per user per day
- **Meal logging adherence**: Avg meals logged per day
- **Time to log meal**: Avg duration from dashboard to logged
- **Error rate by feature**: Errors per 100 interactions

### Error Metrics
- **Error frequency**: Total errors per day by type
- **Error severity distribution**: % of critical/high/medium/low
- **Time to resolution**: Avg time from error report to fix
- **Regression detection**: Compare error rates across versions

### Device & Browser Insights
- **Device breakdown**: % Mobile / Tablet / Desktop
- **Browser compatibility**: Performance by browser
- **Screen size impact**: Feature usability on different sizes

---

## 7. Privacy & Compliance Considerations

### GDPR/Data Privacy
- ✅ No personal data in analytics (names, emails, passwords)
- ✅ Minimal PII: User IDs OK (linked to profile), IP can be hashed
- ✅ User right to deletion: Cascade deletes analytics when user deletes account
- ✅ Data retention: Archive analytics after 12 months
- ⚠️ Third-party sharing: Only admin access unless external integration needed

### Data Minimization
- ✅ Only track necessary events (no tracking for tracking's sake)
- ✅ Sensitive fields encrypted (phone numbers, etc.)
- ✅ Session IDs instead of user tracking in some cases

### Transparency
- [ ] Consider adding privacy notice: "We track usage to improve your experience"
- [ ] Document what data we collect in privacy policy

---

## 8. Success Criteria & Milestones

### End of Phase 1
- ✅ Schema deployed, no errors
- ✅ Server actions work, data inserting correctly
- ✅ Unit tests for analytics utilities

### End of Phase 2
- ✅ All critical user flows instrumented
- ✅ Sample events collected from test sessions
- ✅ No performance degradation in app (analytics overhead < 100ms)

### End of Phase 3
- ✅ Errors captured across all pages
- ✅ Error logs populate on actual errors
- ✅ Error handling doesn't break user experience

### End of Phase 4
- ✅ Admin can view sessions, events, errors
- ✅ Filtering/searching works
- ✅ Charts display correctly

### End of Phase 8
- ✅ Analytics system handles 1000+ concurrent users
- ✅ Queries execute < 2 seconds
- ✅ No production incidents

---

## 9. Recommended First Integration (Quick Win)

To get started quickly:

1. **Week 1**: Deploy Phase 1 (schema + server actions)
2. **Week 2**: Integrate Phase 2 (dashboard + onboarding tracking)
3. **Week 3**: Add Phase 3 (error monitoring with global error boundary)
4. **Week 4**: Build Phase 4 (simple admin dashboard to see data)

This gives you **actionable analytics in 1 month** with:
- User journey insights
- Error detection
- Basic performance metrics
- Admin visibility

Then iterate on phases 5-8 based on priority & team capacity.

---

## 10. Reference Architecture

### How Data Flows
```
User Action (click, page load, error)
    ↓
Frontend: trackEvent() / captureError()
    ↓
Server Action: analytics.ts (calls Supabase)
    ↓
Supabase: Insert into analytics_events / analytics_error_logs
    ↓
Row-level security: Only admin can read
    ↓
Admin Dashboard: Query & visualize data
    ↓
Alerts: Detect anomalies, notify admins
    ↓
Reports: Weekly digest, custom exports
```

### Database Relationships
```
auth.users
    ↓
    └→ analytics_sessions (1 user : many sessions)
            ↓
            └→ analytics_events (1 session : many events)
            └→ analytics_error_logs (1 session : many errors)

analytics_page_views (aggregated, daily rollup of events)
```

---

## 11. Next Steps

1. **Review & Approve**: Get team sign-off on schema design & phases
2. **Create GitHub Issues**: Break each phase into tasks
3. **Start Phase 1**: Database deployment + server actions
4. **Set Up Monitoring**: Ensure no performance regression
5. **Plan Rollout**: Gradual instrumentation to catch issues early

---

## Appendix: Sample Event Payloads

### Page View Event
```json
{
  "event_type": "page_view",
  "event_category": "dashboard",
  "page_path": "/dashboard",
  "event_data": {
    "timestamp_ms": 1701700000000,
    "time_since_session_start_ms": 5000
  }
}
```

### Recipe Swap Event
```json
{
  "event_type": "button_click",
  "event_category": "dashboard",
  "event_action": "swap_recipe",
  "event_label": "breakfast",
  "page_path": "/dashboard",
  "page_section": "breakfast_card",
  "event_data": {
    "from_recipe_id": "rec-123",
    "to_recipe_id": "rec-456",
    "from_recipe_name": "Oatmeal",
    "to_recipe_name": "Scrambled Eggs",
    "from_calories": 250,
    "to_calories": 280,
    "duration_ms": 150
  }
}
```

### Error Event
```json
{
  "error_type": "NUTRITION_CALC_ERROR",
  "severity": "high",
  "error_message": "Failed to calculate macros for recipe",
  "component": "NutritionCalculator",
  "action": "swap_ingredient",
  "page_path": "/meal-builder",
  "recipe_id": "rec-123",
  "request_payload": {
    "ingredients": [...]
  },
  "http_status_code": 500
}
```

---

**Document Version**: 1.0  
**Last Updated**: Dec 4, 2025  
**Status**: Ready for Phase 1 Implementation
