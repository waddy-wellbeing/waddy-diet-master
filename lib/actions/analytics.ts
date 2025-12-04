'use server'

/**
 * Analytics Server Actions
 * Handle all analytics data collection and storage
 * Runs server-side for security and performance
 */

import { createClient } from '@/lib/supabase/server'
import {
  AnalyticsSession,
  CreateSessionInput,
  UpdateSessionInput,
  TrackEventInput,
  CaptureErrorInput,
  AnalyticsEvent,
  AnalyticsErrorLog,
} from '@/lib/types/analytics'

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Initialize a new analytics session
 * Called once per user visit/page load
 * Uses upsert to handle duplicate session IDs gracefully
 */
export async function trackSession(input: CreateSessionInput): Promise<AnalyticsSession> {
  const supabase = await createClient()

  const sessionData = {
    user_id: input.user_id || null,
    session_id: input.session_id,
    device_type: input.device_type || null,
    browser: input.browser || null,
    os: input.os || null,
    screen_resolution: input.screen_resolution || null,
    user_agent: input.user_agent || null,
    ip_address: input.ip_address || null,
    referrer: input.referrer || null,
    landing_page: input.landing_page || null,
    utm_source: input.utm_source || null,
    utm_medium: input.utm_medium || null,
    utm_campaign: input.utm_campaign || null,
    utm_term: input.utm_term || null,
    utm_content: input.utm_content || null,
    created_at: new Date().toISOString(),
    last_activity_at: new Date().toISOString(),
  }

  // Try to upsert - if session already exists, just update last_activity_at
  const { data, error } = await supabase
    .from('analytics_sessions')
    .upsert(sessionData, { onConflict: 'session_id' })
    .select()
    .single()

  if (error) {
    console.error('Failed to create analytics session:', error)
    throw new Error(`Failed to track session: ${error.message}`)
  }

  return data
}

/**
 * Update session activity
 * Called periodically to update last_activity_at and feature tracking
 */
export async function updateSession(input: UpdateSessionInput): Promise<AnalyticsSession> {
  const supabase = await createClient()

  const updateData: any = {
    last_activity_at: input.last_activity_at || new Date().toISOString(),
  }

  if (input.pages_visited) updateData.pages_visited = input.pages_visited
  if (input.features_used) updateData.features_used = input.features_used
  if (input.logged_meals_count !== undefined) updateData.logged_meals_count = input.logged_meals_count
  if (input.recipes_swapped_count !== undefined) updateData.recipes_swapped_count = input.recipes_swapped_count
  if (input.completed_onboarding !== undefined) updateData.completed_onboarding = input.completed_onboarding
  if (input.engagement_score !== undefined) updateData.engagement_score = input.engagement_score
  if (input.total_duration_seconds !== undefined) updateData.total_duration_seconds = input.total_duration_seconds
  if (input.exit_page) updateData.exit_page = input.exit_page
  if (input.ended_at) updateData.ended_at = input.ended_at

  const { data, error } = await supabase
    .from('analytics_sessions')
    .update(updateData)
    .eq('session_id', input.session_id)
    .select()
    .single()

  if (error) {
    console.error('Failed to update analytics session:', error)
    throw new Error(`Failed to update session: ${error.message}`)
  }

  return data
}

/**
 * End session (user leaves or browser closes)
 */
export async function endSession(sessionId: string, durationSeconds: number): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('analytics_sessions')
    .update({
      ended_at: new Date().toISOString(),
      total_duration_seconds: durationSeconds,
    })
    .eq('session_id', sessionId)

  if (error) {
    console.error('Failed to end analytics session:', error)
    // Don't throw - this is a non-critical operation
  }
}

// ============================================================================
// EVENT TRACKING
// ============================================================================

/**
 * Track a user event (page view, button click, etc.)
 */
export async function trackEvent(
  sessionId: string,
  userId: string | null,
  eventData: TrackEventInput,
  timeSinceSessionStartMs?: number
): Promise<AnalyticsEvent> {
  const supabase = await createClient()

  const insertData = {
    session_id: sessionId,
    user_id: userId,
    event_type: eventData.event_type,
    event_category: eventData.event_category,
    event_action: eventData.event_action || null,
    event_label: eventData.event_label || null,
    page_path: eventData.page_path,
    page_section: eventData.page_section || null,
    event_data: eventData.event_data || {},
    time_since_page_load_ms: eventData.time_since_page_load_ms || null,
    time_since_session_start_ms: timeSinceSessionStartMs || null,
    created_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('analytics_events')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    console.error('Failed to track event:', error)
    // Don't throw - analytics shouldn't break the app
    return { ...insertData, id: '', archived: false } as AnalyticsEvent
  }

  return data
}

/**
 * Track page view (convenience method)
 */
export async function trackPageView(
  sessionId: string,
  userId: string | null,
  pagePath: string,
  previousPath?: string,
  timeSinceSessionStartMs?: number
): Promise<void> {
  await trackEvent(
    sessionId,
    userId,
    {
      event_type: 'page_view',
      event_category: categorizePagePath(pagePath),
      page_path: pagePath,
      event_data: previousPath ? { from_page: previousPath } : {},
    },
    timeSinceSessionStartMs
  )
}

/**
 * Batch track multiple events (for performance optimization)
 */
export async function batchTrackEvents(
  sessionId: string,
  userId: string | null,
  events: Array<TrackEventInput & { timeSinceSessionStartMs?: number }>
): Promise<void> {
  if (events.length === 0) return

  const supabase = await createClient()

  const insertData = events.map((event) => ({
    session_id: sessionId,
    user_id: userId,
    event_type: event.event_type,
    event_category: event.event_category,
    event_action: event.event_action || null,
    event_label: event.event_label || null,
    page_path: event.page_path,
    page_section: event.page_section || null,
    event_data: event.event_data || {},
    time_since_page_load_ms: event.time_since_page_load_ms || null,
    time_since_session_start_ms: event.timeSinceSessionStartMs || null,
    created_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('analytics_events')
    .insert(insertData)

  if (error) {
    console.error('Failed to batch track events:', error)
    // Non-critical, don't throw
  }
}

// ============================================================================
// ERROR LOGGING
// ============================================================================

/**
 * Capture and log an application error
 */
export async function captureError(
  sessionId: string | null,
  userId: string | null,
  errorInput: CaptureErrorInput
): Promise<AnalyticsErrorLog> {
  const supabase = await createClient()

  const insertData = {
    session_id: sessionId,
    user_id: userId,
    error_type: errorInput.error_type,
    error_message: errorInput.error_message,
    severity: errorInput.severity,
    error_code: errorInput.error_code || null,
    error_stack: errorInput.error_stack || null,
    component: errorInput.component || null,
    action: errorInput.action || null,
    page_path: errorInput.page_path || null,
    recipe_id: errorInput.recipe_id || null,
    ingredient_id: errorInput.ingredient_id || null,
    daily_plan_id: errorInput.daily_plan_id || null,
    device_type: errorInput.device_type || null,
    browser_info: errorInput.browser_info || null,
    screen_resolution: errorInput.screen_resolution || null,
    viewport_size: errorInput.viewport_size || null,
    api_endpoint: errorInput.api_endpoint || null,
    http_method: errorInput.http_method || null,
    http_status_code: errorInput.http_status_code || null,
    request_payload: errorInput.request_payload || null,
    response_data: errorInput.response_data || null,
    user_input: errorInput.user_input || null,
    metadata: errorInput.metadata || null,
    tags: errorInput.tags || [],
    created_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('analytics_error_logs')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    console.error('Failed to capture error log:', error)
    // Still return something for client-side handling
    return { ...insertData, id: '', is_resolved: false, archived: false } as AnalyticsErrorLog
  }

  return data
}

/**
 * Batch capture multiple errors
 */
export async function batchCaptureErrors(
  sessionId: string | null,
  userId: string | null,
  errors: CaptureErrorInput[]
): Promise<void> {
  if (errors.length === 0) return

  const supabase = await createClient()

  const insertData = errors.map((errorInput) => ({
    session_id: sessionId,
    user_id: userId,
    error_type: errorInput.error_type,
    error_message: errorInput.error_message,
    severity: errorInput.severity,
    error_code: errorInput.error_code || null,
    error_stack: errorInput.error_stack || null,
    component: errorInput.component || null,
    action: errorInput.action || null,
    page_path: errorInput.page_path || null,
    recipe_id: errorInput.recipe_id || null,
    ingredient_id: errorInput.ingredient_id || null,
    daily_plan_id: errorInput.daily_plan_id || null,
    device_type: errorInput.device_type || null,
    browser_info: errorInput.browser_info || null,
    screen_resolution: errorInput.screen_resolution || null,
    viewport_size: errorInput.viewport_size || null,
    api_endpoint: errorInput.api_endpoint || null,
    http_method: errorInput.http_method || null,
    http_status_code: errorInput.http_status_code || null,
    request_payload: errorInput.request_payload || null,
    response_data: errorInput.response_data || null,
    user_input: errorInput.user_input || null,
    metadata: errorInput.metadata || null,
    tags: errorInput.tags || [],
    created_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('analytics_error_logs')
    .insert(insertData)

  if (error) {
    console.error('Failed to batch capture errors:', error)
    // Non-critical, don't throw
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Categorize page path for event categorization
 */
function categorizePagePath(path: string): 'onboarding' | 'dashboard' | 'meal_builder' | 'recipes' | 'profile' | 'settings' | 'auth' | 'general' {
  if (path.includes('onboarding')) return 'onboarding'
  if (path.includes('dashboard')) return 'dashboard'
  if (path.includes('meal-builder')) return 'meal_builder'
  if (path.includes('recipes')) return 'recipes'
  if (path.includes('profile')) return 'profile'
  if (path.includes('settings')) return 'settings'
  if (path.includes('auth') || path.includes('login') || path.includes('signup')) return 'auth'
  return 'general'
}
