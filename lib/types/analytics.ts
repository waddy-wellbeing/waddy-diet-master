/**
 * Analytics Types - Comprehensive user activity tracking
 * Covers sessions, events, errors, and aggregated metrics
 */

// ============================================================================
// SESSION TYPES
// ============================================================================

export interface AnalyticsSession {
  id: string
  user_id: string | null
  session_id: string
  
  // Timing
  created_at: string
  last_activity_at: string
  ended_at: string | null
  total_duration_seconds: number | null
  
  // Device info
  device_type: string | null
  browser: string | null
  os: string | null
  screen_resolution: string | null
  user_agent: string | null
  ip_address: string | null
  
  // Campaign/Referrer
  referrer: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_term: string | null
  utm_content: string | null
  
  // Navigation
  landing_page: string | null
  exit_page: string | null
  pages_visited: string[]
  
  // Feature engagement
  features_used: string[]
  completed_onboarding: boolean
  logged_meals_count: number
  recipes_swapped_count: number
  
  // Engagement quality
  engagement_score: number | null
  session_type: string | null
  
  // Admin
  notes: string | null
  archived: boolean
}

export interface CreateSessionInput {
  user_id?: string
  session_id: string
  device_type?: string
  browser?: string
  os?: string
  screen_resolution?: string
  user_agent?: string
  ip_address?: string
  referrer?: string
  landing_page?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string
}

export interface UpdateSessionInput {
  session_id: string
  last_activity_at?: string
  pages_visited?: string[]
  features_used?: string[]
  logged_meals_count?: number
  recipes_swapped_count?: number
  completed_onboarding?: boolean
  engagement_score?: number
  total_duration_seconds?: number
  exit_page?: string
  ended_at?: string
}

// ============================================================================
// EVENT TYPES
// ============================================================================

export type EventType =
  | 'page_view'
  | 'button_click'
  | 'form_submit'
  | 'form_error'
  | 'feature_use'
  | 'scroll'
  | 'time_on_page'
  | 'error_occurred'

export type EventCategory =
  | 'onboarding'
  | 'dashboard'
  | 'meal_builder'
  | 'recipes'
  | 'profile'
  | 'settings'
  | 'auth'
  | 'navigation'
  | 'general'

export interface AnalyticsEvent {
  id: string
  session_id: string
  user_id: string | null
  
  // Timing
  created_at: string
  time_since_session_start_ms: number | null
  
  // Categorization
  event_type: EventType
  event_category: EventCategory
  event_action: string | null
  event_label: string | null
  
  // Location
  page_path: string
  page_section: string | null
  
  // Data & metrics
  event_data: Record<string, any>
  time_since_page_load_ms: number | null
  
  // Error signals
  is_error: boolean
  error_code: string | null
  
  // Admin
  archived: boolean
}

export interface TrackEventInput {
  event_type: EventType
  event_category: EventCategory
  event_action?: string
  event_label?: string
  page_path: string
  page_section?: string
  event_data?: Record<string, any>
  time_since_page_load_ms?: number
}

// ============================================================================
// ERROR LOG TYPES
// ============================================================================

export type ErrorSeverity = 'critical' | 'high' | 'medium' | 'low'

export type ErrorType =
  | 'RECIPE_LOAD_FAILED'
  | 'NUTRITION_CALC_ERROR'
  | 'MEAL_LOG_FAILED'
  | 'RECIPE_SWAP_FAILED'
  | 'AUTH_ERROR'
  | 'VALIDATION_ERROR'
  | 'API_ERROR'
  | 'REACT_BOUNDARY_ERROR'
  | 'UNKNOWN_ERROR'

export interface AnalyticsErrorLog {
  id: string
  user_id: string | null
  session_id: string | null
  
  // Error info
  error_type: ErrorType
  error_code: string | null
  severity: ErrorSeverity
  error_message: string
  error_stack: string | null
  
  // Context
  component: string | null
  action: string | null
  page_path: string | null
  
  // Related resources
  recipe_id: string | null
  ingredient_id: string | null
  daily_plan_id: string | null
  
  // Environment
  device_type: string | null
  browser_info: Record<string, any> | null
  screen_resolution: string | null
  viewport_size: string | null
  
  // Request context
  api_endpoint: string | null
  http_method: string | null
  http_status_code: number | null
  request_payload: Record<string, any> | null
  response_data: Record<string, any> | null
  user_input: Record<string, any> | null
  
  // Admin workflow
  is_resolved: boolean
  resolved_by: string | null
  resolved_at: string | null
  resolution_notes: string | null
  
  // Metadata
  metadata: Record<string, any> | null
  tags: string[]
  
  created_at: string
  archived: boolean
}

export interface CaptureErrorInput {
  error_type: ErrorType
  error_message: string
  severity: ErrorSeverity
  error_stack?: string
  error_code?: string
  component?: string
  action?: string
  page_path?: string
  recipe_id?: string
  ingredient_id?: string
  daily_plan_id?: string
  device_type?: string
  browser_info?: Record<string, any>
  screen_resolution?: string
  viewport_size?: string
  api_endpoint?: string
  http_method?: string
  http_status_code?: number
  request_payload?: Record<string, any>
  response_data?: Record<string, any>
  user_input?: Record<string, any>
  metadata?: Record<string, any>
  tags?: string[]
}

// ============================================================================
// PAGE VIEWS AGGREGATION
// ============================================================================

export interface AnalyticsPageView {
  id: string
  page_path: string
  event_date: string
  
  // Aggregate metrics
  total_views: number
  unique_sessions: number
  unique_users: number
  avg_time_on_page_ms: number | null
  bounce_rate: number | null
  
  // Device breakdown
  mobile_views: number
  tablet_views: number
  desktop_views: number
  
  // Conversion metrics
  onboarding_completions: number
  meal_logs_initiated: number
  recipe_swaps_count: number
  errors_count: number
  
  created_at: string
  updated_at: string | null
}

// ============================================================================
// QUERY RESPONSE TYPES (for admin queries)
// ============================================================================

export interface SessionDetail extends AnalyticsSession {
  events: AnalyticsEvent[]
  errors: AnalyticsErrorLog[]
  event_count: number
  error_count: number
}

export interface ErrorReport {
  error_type: ErrorType
  severity: ErrorSeverity
  count: number
  last_occurred: string
  first_occurred: string
  affected_users: number
  affected_sessions: number
  component_breakdown?: Record<string, number>
}

export interface UserJourneyMetrics {
  user_id: string
  total_sessions: number
  total_events: number
  total_errors: number
  avg_session_duration_seconds: number
  most_visited_pages: { page_path: string; count: number }[]
  features_used: string[]
  first_visit: string
  last_visit: string
  engagement_score: number
}

// ============================================================================
// UI COMPONENT STATE
// ============================================================================

export interface AnalyticsContextValue {
  session_id: string | null
  user_id: string | null
  initialized: boolean
  trackEvent: (input: TrackEventInput) => Promise<void>
  captureError: (input: CaptureErrorInput) => Promise<void>
}
