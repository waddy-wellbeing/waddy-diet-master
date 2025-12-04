# Analytics Quick Reference Guide

## Phase 1 Implementation Summary

All core infrastructure is deployed and ready for Phase 2 integration.

---

## 📦 API Reference

### Server Actions (Backend - Use These!)

```typescript
import {
  trackSession,
  updateSession,
  endSession,
  trackEvent,
  trackPageView,
  batchTrackEvents,
  captureError,
  batchCaptureErrors,
  generateSessionId,
} from '@/lib/actions/analytics'
```

#### Session Management
```typescript
// Start new session (call once on app load)
const session = await trackSession({
  session_id: generateSessionId(),
  user_id: currentUser?.id,
  device_type: 'mobile',
  browser: 'Chrome',
  os: 'iOS',
  screen_resolution: '375x667',
  user_agent: navigator.userAgent,
  landing_page: window.location.pathname,
  utm_source: urlParams.get('utm_source'),
})

// Update session periodically or on events
await updateSession({
  session_id: session.session_id,
  pages_visited: ['/dashboard', '/meal-builder'],
  features_used: ['meal_logger', 'recipe_swapper'],
  logged_meals_count: 2,
  recipes_swapped_count: 3,
  completed_onboarding: true,
})

// End session (on logout or page close)
await endSession(session.session_id, Math.floor((Date.now() - startTime) / 1000))
```

#### Event Tracking
```typescript
// Track single event
await trackEvent(
  sessionId,
  userId,
  {
    event_type: 'button_click',
    event_category: 'dashboard',
    event_action: 'click',
    event_label: 'swap_recipe',
    page_path: '/dashboard',
    page_section: 'breakfast_card',
    event_data: {
      from_recipe_id: 'rec-123',
      to_recipe_id: 'rec-456',
    },
  },
  timeSinceSessionStart // milliseconds
)

// Track page view (convenience)
await trackPageView(sessionId, userId, '/dashboard')

// Batch track (for performance)
await batchTrackEvents(sessionId, userId, [
  {
    event_type: 'page_view',
    event_category: 'dashboard',
    page_path: '/dashboard',
  },
  {
    event_type: 'button_click',
    event_category: 'dashboard',
    event_action: 'click',
    event_label: 'swap_recipe',
    page_path: '/dashboard',
  },
])
```

#### Error Logging
```typescript
// Capture error
await captureError(
  sessionId,
  userId,
  {
    error_type: 'RECIPE_LOAD_FAILED',
    error_message: 'Failed to fetch recipe',
    severity: 'high',
    error_code: '500',
    component: 'RecipeCard',
    action: 'load_recipe',
    page_path: '/dashboard',
    recipe_id: 'rec-123',
    api_endpoint: '/api/recipes/rec-123',
    http_status_code: 500,
  }
)

// Batch capture errors
await batchCaptureErrors(sessionId, userId, [
  {
    error_type: 'API_ERROR',
    error_message: 'Network timeout',
    severity: 'medium',
    api_endpoint: '/api/meals',
  },
  {
    error_type: 'VALIDATION_ERROR',
    error_message: 'Invalid meal data',
    severity: 'low',
    component: 'MealForm',
  },
])
```

---

### Client Utilities (Frontend - Use These!)

```typescript
import {
  getOrCreateSessionId,
  clearSessionId,
  getTimeSinceSessionStart,
  detectDeviceType,
  getScreenResolution,
  getViewportSize,
  getBrowserInfo,
  buildPageViewEvent,
  buildButtonClickEvent,
  buildFormSubmitEvent,
  buildFeatureUseEvent,
  buildTimeOnPageEvent,
  buildScrollEvent,
  buildErrorCapture,
  buildValidationError,
  buildApiError,
  buildReactError,
  buildNutritionError,
  buildRecipeError,
  buildMealLogError,
  PageTimeTracker,
  ScrollDepthTracker,
} from '@/lib/utils/analytics'
```

#### Session Management (Client-side)
```typescript
// Get persistent session ID
const sessionId = getOrCreateSessionId()

// Get time since session started
const elapsedMs = getTimeSinceSessionStart()

// Clear on logout
clearSessionId()
```

#### Device Info (Client-side)
```typescript
// Detect device
const device = detectDeviceType() // 'mobile' | 'tablet' | 'desktop'

// Get dimensions
const resolution = getScreenResolution() // '1920x1080'
const viewport = getViewportSize() // '1024x768'

// Get browser info
const { browser, os, version } = getBrowserInfo()
// { browser: 'Chrome', os: 'Windows', version: '120' }
```

#### Event Builders (Create event payloads)
```typescript
// Create page view event
const pageViewEvent = buildPageViewEvent(
  '/dashboard',
  '/onboarding' // previous page
)

// Create click event
const clickEvent = buildButtonClickEvent(
  'dashboard',
  'swap_recipe',
  '/dashboard',
  { recipe_id: 'rec-123' }
)

// Create form submission event
const formEvent = buildFormSubmitEvent(
  'onboarding',
  'basic_info',
  '/onboarding/step-1',
  true, // isSuccess
  { fields_filled: 5 }
)

// Create feature usage event
const featureEvent = buildFeatureUseEvent(
  'dashboard',
  'recipe_swapper',
  '/dashboard',
  { swap_count: 1 }
)

// Create time-on-page event
const timeEvent = buildTimeOnPageEvent('/dashboard', 15000) // 15 seconds

// Create scroll event
const scrollEvent = buildScrollEvent('/dashboard', 75) // 75% scrolled
```

#### Error Builders (Create error payloads)
```typescript
// Generic error
const error = buildErrorCapture(
  'RECIPE_LOAD_FAILED',
  'Failed to load recipe details',
  'high',
  { recipe_id: 'rec-123' }
)

// Validation error
const validationError = buildValidationError(
  'BasicInfoForm',
  'email',
  'Invalid email format'
)

// API error
const apiError = buildApiError(
  '/api/recipes',
  'POST',
  500,
  'Internal server error',
  { error: 'Database connection failed' }
)

// React error boundary
const reactError = buildReactError(new Error('Component crashed'), {
  componentStack: 'MealCard > RecipeImage > Image'
})

// Nutrition calculation error
const nutritionError = buildNutritionError(
  'Failed to calculate macros',
  'rec-123',
  ['ing-1', 'ing-2']
)

// Recipe operation error
const recipeError = buildRecipeError(
  'swap', // 'load' | 'swap' | 'save'
  'rec-123',
  'Recipe not found'
)

// Meal logging error
const mealError = buildMealLogError(
  'breakfast',
  'Failed to save meal log',
  'plan-123'
)
```

#### Time Tracking (Advanced)
```typescript
// Track time on page
const tracker = new PageTimeTracker('/dashboard')

// Later, get duration
const durationMs = tracker.getDuration()

// Get event ready to send
const event = tracker.getEvent()

// ---

// Track scroll depth
const scrollTracker = new ScrollDepthTracker('/dashboard')

// On scroll events (add to window scroll listener)
const scrollEvent = scrollTracker.reportScrollDepth()
if (scrollEvent) {
  await trackEvent(sessionId, userId, scrollEvent)
}

// Cleanup
scrollTracker.destroy()
```

---

### Admin Queries (Backend - Admin Dashboard)

```typescript
import {
  getSessions,
  getSessionDetail,
  getUserSessions,
  getEvents,
  getSessionTimeline,
  getPopularPages,
  getErrorLogs,
  getErrorReport,
  getCriticalErrors,
  resolveError,
  getUserJourneyMetrics,
  getPageViewMetrics,
} from '@/lib/supabase/queries/analytics'
```

#### Retrieve Sessions
```typescript
// Get sessions list (paginated)
const { sessions, total } = await getSessions({
  limit: 50,
  offset: 0,
  userId: 'user-123',
  deviceType: 'mobile',
  startDate: '2025-12-01',
  endDate: '2025-12-04',
})

// Get detailed session with all events/errors
const detail = await getSessionDetail('session_123')
// Returns: {
//   ...session,
//   events: [...],
//   errors: [...],
//   event_count: 5,
//   error_count: 1
// }

// Get user's all sessions
const userSessions = await getUserSessions('user-123')
```

#### Retrieve Events
```typescript
// Get events with filters
const { events, total } = await getEvents({
  limit: 100,
  offset: 0,
  sessionId: 'session_123',
  userId: 'user-123',
  eventType: 'page_view',
  eventCategory: 'dashboard',
  pagePath: '/dashboard',
  startDate: '2025-12-01',
  endDate: '2025-12-04',
})

// Get session timeline (ordered events)
const timeline = await getSessionTimeline('session_123')

// Get popular pages
const topPages = await getPopularPages(7) // last 7 days
// Returns: [
//   { page_path: '/dashboard', count: 150 },
//   { page_path: '/meal-builder', count: 120 },
// ]
```

#### Retrieve Errors
```typescript
// Get error logs with filters
const { errors, total } = await getErrorLogs({
  limit: 100,
  offset: 0,
  userId: 'user-123',
  errorType: 'RECIPE_LOAD_FAILED',
  severity: 'high',
  isResolved: false,
  startDate: '2025-12-01',
  endDate: '2025-12-04',
})

// Get error report (aggregated)
const report = await getErrorReport(7) // last 7 days
// Returns: [
//   {
//     error_type: 'API_ERROR',
//     severity: 'high',
//     count: 25,
//     last_occurred: '2025-12-04T...',
//     first_occurred: '2025-12-02T...',
//     affected_users: 5,
//     affected_sessions: 8,
//     component_breakdown: { RecipeCard: 12, ... }
//   },
// ]

// Get critical unresolved errors
const critical = await getCriticalErrors() // limit 20

// Mark error as resolved
await resolveError('error-id', 'admin-user-id', 'Fixed in v2.1.0')
```

#### User Analytics
```typescript
// Get complete user journey metrics
const metrics = await getUserJourneyMetrics('user-123')
// Returns: {
//   user_id: 'user-123',
//   total_sessions: 12,
//   total_events: 342,
//   total_errors: 3,
//   avg_session_duration_seconds: 1450,
//   most_visited_pages: [
//     { page_path: '/dashboard', count: 45 },
//     { page_path: '/meal-builder', count: 38 },
//   ],
//   features_used: ['meal_logger', 'recipe_swapper'],
//   first_visit: '2025-11-15T...',
//   last_visit: '2025-12-04T...',
//   engagement_score: 78
// }

// Get page view metrics by date
const pageMetrics = await getPageViewMetrics('/dashboard', 7) // last 7 days
// Returns: [
//   {
//     page_path: '/dashboard',
//     event_date: '2025-12-04',
//     total_views: 150,
//     unique_sessions: 95,
//     unique_users: 65,
//     avg_time_on_page_ms: 45230,
//     bounce_rate: 15.2,
//     mobile_views: 95,
//     tablet_views: 30,
//     desktop_views: 25,
//     onboarding_completions: 0,
//     meal_logs_initiated: 45,
//     recipe_swaps_count: 23,
//     errors_count: 2,
//   },
// ]
```

---

## 🎯 Event Types & Categories

### Event Types
```
'page_view' | 'button_click' | 'form_submit' | 'form_error' | 
'feature_use' | 'scroll' | 'time_on_page' | 'error_occurred'
```

### Event Categories
```
'onboarding' | 'dashboard' | 'meal_builder' | 'recipes' | 
'profile' | 'settings' | 'auth' | 'general'
```

### Error Types
```
'RECIPE_LOAD_FAILED' | 'NUTRITION_CALC_ERROR' | 'MEAL_LOG_FAILED' |
'RECIPE_SWAP_FAILED' | 'AUTH_ERROR' | 'VALIDATION_ERROR' |
'API_ERROR' | 'REACT_BOUNDARY_ERROR' | 'UNKNOWN_ERROR'
```

### Error Severity
```
'critical' | 'high' | 'medium' | 'low'
```

---

## 🚀 Usage Examples

### Example 1: Track Dashboard Visit
```typescript
'use client'
import { useEffect } from 'react'
import { trackPageView, buildTimeOnPageEvent, PageTimeTracker } from '@/lib/utils/analytics'
import { trackEvent } from '@/lib/actions/analytics'

export function Dashboard() {
  useEffect(() => {
    const sessionId = getOrCreateSessionId()
    const userId = currentUser?.id
    
    // Track page view
    trackPageView(sessionId, userId, '/dashboard')
    
    // Track time on page
    const timeTracker = new PageTimeTracker('/dashboard')
    
    return () => {
      // On unmount, track duration
      trackEvent(sessionId, userId, timeTracker.getEvent())
    }
  }, [])
  
  return <div>Dashboard content</div>
}
```

### Example 2: Track Recipe Swap
```typescript
async function handleSwapRecipe(mealType: string, oldId: string, newId: string) {
  const sessionId = getOrCreateSessionId()
  const userId = currentUser?.id
  
  try {
    // Perform swap
    await swapRecipe(mealType, oldId, newId)
    
    // Track success
    await trackEvent(sessionId, userId, {
      event_type: 'button_click',
      event_category: 'dashboard',
      event_action: 'swap_recipe',
      event_label: mealType,
      page_path: '/dashboard',
      page_section: `${mealType}_card`,
      event_data: {
        from_recipe_id: oldId,
        to_recipe_id: newId,
      },
    })
  } catch (error) {
    // Track error
    await captureError(
      sessionId,
      userId,
      buildRecipeError('swap', oldId, error.message)
    )
  }
}
```

### Example 3: Global Error Boundary
```typescript
'use client'
import { ReactNode } from 'react'
import { captureError } from '@/lib/actions/analytics'
import { buildReactError, getOrCreateSessionId } from '@/lib/utils/analytics'

export class ErrorBoundary extends React.Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  async componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const sessionId = getOrCreateSessionId()
    
    await captureError(
      sessionId,
      currentUser?.id || null,
      buildReactError(error, errorInfo)
    )
  }

  render() {
    if (this.state.hasError) {
      return <div>Something went wrong. Our team has been notified.</div>
    }
    return this.props.children
  }
}
```

---

## 📊 What's Being Tracked

✅ **Session Data**: Device, browser, OS, screen size, referrer, UTM params  
✅ **User Journey**: Pages visited, features used, time on page  
✅ **Features**: Meal logging, recipe swaps, ingredient customization  
✅ **Errors**: Type, severity, component, affected resources  
✅ **Engagement**: Session duration, feature adoption, conversion actions  
✅ **Device Analytics**: Mobile/tablet/desktop, screen sizes, browsers  

---

## 🔐 Privacy & Security

- ✅ No personal data in analytics
- ✅ RLS policies restrict to admin/moderator
- ✅ Server-side only inserts
- ✅ Cascade deletion on user removal
- ✅ Session-based, not user-based tracking

---

## Next: Phase 2 Integration

Ready to start tracking? Phase 2 will cover:
- App layout session initialization
- Route-based page tracking
- Component-level event tracking
- Error boundary implementation
- Feature tracking for all major flows

See `/docs/working/analytics-implementation-plan.md` for details.
