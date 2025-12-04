/**
 * Analytics Client Utilities
 * Helpers for frontend analytics tracking
 */

import { TrackEventInput, CaptureErrorInput, ErrorType, EventType, EventCategory } from '@/lib/types/analytics'

// ============================================================================
// SESSION UTILITIES
// ============================================================================

const SESSION_STORAGE_KEY = 'bite_right_session_id'
const SESSION_START_TIME_KEY = 'bite_right_session_start'

/**
 * Get or create session ID (persists in localStorage)
 */
export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return ''

  let sessionId = localStorage.getItem(SESSION_STORAGE_KEY)
  if (!sessionId) {
    sessionId = generateSessionId()
    localStorage.setItem(SESSION_STORAGE_KEY, sessionId)
    localStorage.setItem(SESSION_START_TIME_KEY, Date.now().toString())
  }
  return sessionId
}

/**
 * Clear session (on logout)
 */
export function clearSessionId(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(SESSION_STORAGE_KEY)
  localStorage.removeItem(SESSION_START_TIME_KEY)
}

/**
 * Get time since session started (in milliseconds)
 */
export function getTimeSinceSessionStart(): number {
  if (typeof window === 'undefined') return 0
  const startTime = localStorage.getItem(SESSION_START_TIME_KEY)
  if (!startTime) return 0
  return Date.now() - parseInt(startTime)
}

/**
 * Generate unique session ID
 */
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

// ============================================================================
// PAGE TRACKING UTILITIES
// ============================================================================

/**
 * Track page in local state (for building pages_visited array)
 */
export function trackPageInSession(pagePath: string): void {
  if (typeof window === 'undefined') return
  const key = 'bite_right_pages_visited'
  const pages = JSON.parse(sessionStorage.getItem(key) || '[]') as string[]
  if (!pages.includes(pagePath)) {
    pages.push(pagePath)
    sessionStorage.setItem(key, JSON.stringify(pages))
  }
}

/**
 * Get pages visited in current session
 */
export function getTrackedPages(): string[] {
  if (typeof window === 'undefined') return []
  const key = 'bite_right_pages_visited'
  return JSON.parse(sessionStorage.getItem(key) || '[]')
}

/**
 * Get current page path
 */
export function getCurrentPagePath(): string {
  if (typeof window === 'undefined') return ''
  return window.location.pathname
}

// ============================================================================
// DEVICE INFO UTILITIES
// ============================================================================

/**
 * Detect device type from user agent
 */
export function detectDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  if (typeof navigator === 'undefined') return 'desktop'

  const userAgent = navigator.userAgent.toLowerCase()

  if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/.test(userAgent)) {
    return 'mobile'
  }
  if (/tablet|ipad|playbook|silk|(android(?!.*mobi))/.test(userAgent)) {
    return 'tablet'
  }
  return 'desktop'
}

/**
 * Get screen resolution
 */
export function getScreenResolution(): string {
  if (typeof window === 'undefined') return ''
  return `${window.screen.width}x${window.screen.height}`
}

/**
 * Get viewport size
 */
export function getViewportSize(): string {
  if (typeof window === 'undefined') return ''
  return `${window.innerWidth}x${window.innerHeight}`
}

/**
 * Extract browser info
 */
export function getBrowserInfo(): { browser: string; os: string; version?: string } {
  if (typeof navigator === 'undefined') return { browser: 'Unknown', os: 'Unknown' }

  const userAgent = navigator.userAgent
  let browser = 'Unknown'
  let os = 'Unknown'
  let version = ''

  // Browser detection
  if (/edg/.test(userAgent)) {
    browser = 'Edge'
    version = userAgent.match(/edg\/(\d+)/)?.[1] || ''
  } else if (/chrome/.test(userAgent)) {
    browser = 'Chrome'
    version = userAgent.match(/chrome\/(\d+)/)?.[1] || ''
  } else if (/firefox/.test(userAgent)) {
    browser = 'Firefox'
    version = userAgent.match(/firefox\/(\d+)/)?.[1] || ''
  } else if (/safari/.test(userAgent)) {
    browser = 'Safari'
    version = userAgent.match(/version\/(\d+)/)?.[1] || ''
  } else if (/opr/.test(userAgent)) {
    browser = 'Opera'
    version = userAgent.match(/opr\/(\d+)/)?.[1] || ''
  }

  // OS detection
  if (/windows/.test(userAgent)) os = 'Windows'
  else if (/mac/.test(userAgent)) os = 'macOS'
  else if (/iphone|ios/.test(userAgent)) os = 'iOS'
  else if (/android/.test(userAgent)) os = 'Android'
  else if (/linux/.test(userAgent)) os = 'Linux'
  else if (/x11/.test(userAgent)) os = 'Unix'

  return { browser, os, version }
}

/**
 * Get full user agent string
 */
export function getUserAgent(): string {
  if (typeof navigator === 'undefined') return ''
  return navigator.userAgent
}

// ============================================================================
// EVENT BUILDER UTILITIES
// ============================================================================

/**
 * Build a page view event
 */
export function buildPageViewEvent(pagePath: string, previousPath?: string): TrackEventInput {
  return {
    event_type: 'page_view',
    event_category: categorizePagePath(pagePath),
    page_path: pagePath,
    event_data: previousPath ? { from_page: previousPath } : {},
  }
}

/**
 * Build a button click event
 */
export function buildButtonClickEvent(
  category: EventCategory,
  buttonLabel: string,
  pagePath: string,
  additionalData?: Record<string, any>
): TrackEventInput {
  return {
    event_type: 'button_click',
    event_category: category,
    event_action: 'click',
    event_label: buttonLabel,
    page_path: pagePath,
    event_data: additionalData || {},
  }
}

/**
 * Build a form submission event
 */
export function buildFormSubmitEvent(
  category: EventCategory,
  formName: string,
  pagePath: string,
  isSuccess: boolean,
  additionalData?: Record<string, any>
): TrackEventInput {
  return {
    event_type: 'form_submit',
    event_category: category,
    event_action: isSuccess ? 'submit_success' : 'submit_error',
    event_label: formName,
    page_path: pagePath,
    event_data: {
      is_success: isSuccess,
      ...additionalData,
    },
  }
}

/**
 * Build a form error event
 */
export function buildFormErrorEvent(
  category: EventCategory,
  formName: string,
  pagePath: string,
  fieldName: string,
  errorMessage: string
): TrackEventInput {
  return {
    event_type: 'form_error',
    event_category: category,
    event_label: formName,
    page_path: pagePath,
    page_section: `form_field_${fieldName}`,
    event_data: {
      field_name: fieldName,
      error_message: errorMessage,
    },
  }
}

/**
 * Build a feature use event
 */
export function buildFeatureUseEvent(
  category: EventCategory,
  featureName: string,
  pagePath: string,
  additionalData?: Record<string, any>
): TrackEventInput {
  return {
    event_type: 'feature_use',
    event_category: category,
    event_label: featureName,
    page_path: pagePath,
    event_data: additionalData || {},
  }
}

/**
 * Build a time on page event
 */
export function buildTimeOnPageEvent(
  pagePath: string,
  durationMs: number,
  category?: EventCategory
): TrackEventInput {
  return {
    event_type: 'time_on_page',
    event_category: category || categorizePagePath(pagePath),
    page_path: pagePath,
    event_data: {
      duration_ms: durationMs,
    },
  }
}

/**
 * Build scroll event
 */
export function buildScrollEvent(
  pagePath: string,
  scrollPercentage: number,
  category?: EventCategory
): TrackEventInput {
  return {
    event_type: 'scroll',
    event_category: category || categorizePagePath(pagePath),
    page_path: pagePath,
    event_data: {
      scroll_percentage: scrollPercentage,
    },
  }
}

// ============================================================================
// ERROR BUILDER UTILITIES
// ============================================================================

/**
 * Build an error capture input
 */
export function buildErrorCapture(
  errorType: ErrorType,
  errorMessage: string,
  severity: 'critical' | 'high' | 'medium' | 'low' = 'medium',
  additionalContext?: Partial<CaptureErrorInput>
): CaptureErrorInput {
  const { browser, os } = getBrowserInfo()

  return {
    error_type: errorType,
    error_message: errorMessage,
    severity,
    device_type: detectDeviceType(),
    page_path: getCurrentPagePath(),
    browser_info: { browser, os },
    screen_resolution: getScreenResolution(),
    viewport_size: getViewportSize(),
    ...additionalContext,
  }
}

/**
 * Build validation error capture
 */
export function buildValidationError(
  formName: string,
  fieldName: string,
  errorMessage: string
): CaptureErrorInput {
  return buildErrorCapture('VALIDATION_ERROR', `${formName}.${fieldName}: ${errorMessage}`, 'low', {
    component: 'FormValidation',
    action: 'validate_field',
    user_input: {
      form_name: formName,
      field_name: fieldName,
    },
  })
}

/**
 * Build API error capture
 */
export function buildApiError(
  endpoint: string,
  method: string,
  statusCode: number,
  errorMessage: string,
  responseData?: Record<string, any>,
  requestPayload?: Record<string, any>
): CaptureErrorInput {
  const severity = statusCode >= 500 ? 'high' : statusCode >= 400 ? 'medium' : 'low'

  return buildErrorCapture('API_ERROR', errorMessage, severity, {
    api_endpoint: endpoint,
    http_method: method,
    http_status_code: statusCode,
    response_data: responseData,
    request_payload: requestPayload,
    component: 'APIClient',
  })
}

/**
 * Build React error boundary capture
 */
export function buildReactError(
  error: Error,
  errorInfo?: { componentStack?: string }
): CaptureErrorInput {
  return buildErrorCapture('REACT_BOUNDARY_ERROR', error.message, 'critical', {
    error_stack: error.stack,
    component: 'ReactErrorBoundary',
    metadata: {
      component_stack: errorInfo?.componentStack,
    },
  })
}

/**
 * Build nutrition calculation error
 */
export function buildNutritionError(
  errorMessage: string,
  recipeId?: string,
  ingredientIds?: string[]
): CaptureErrorInput {
  return buildErrorCapture('NUTRITION_CALC_ERROR', errorMessage, 'high', {
    component: 'NutritionCalculator',
    recipe_id: recipeId,
    metadata: {
      ingredient_ids: ingredientIds,
    },
  })
}

/**
 * Build recipe operation error
 */
export function buildRecipeError(
  operation: 'load' | 'swap' | 'save',
  recipeId: string,
  errorMessage: string
): CaptureErrorInput {
  const errorTypeMap: Record<string, ErrorType> = {
    load: 'RECIPE_LOAD_FAILED',
    swap: 'RECIPE_SWAP_FAILED',
    save: 'RECIPE_LOAD_FAILED',
  }

  return buildErrorCapture(errorTypeMap[operation] || 'RECIPE_LOAD_FAILED', errorMessage, 'high', {
    component: 'RecipeManager',
    action: `recipe_${operation}`,
    recipe_id: recipeId,
  })
}

/**
 * Build meal logging error
 */
export function buildMealLogError(
  mealType: string,
  errorMessage: string,
  dailyPlanId?: string
): CaptureErrorInput {
  return buildErrorCapture('MEAL_LOG_FAILED', errorMessage, 'high', {
    component: 'MealLogger',
    action: 'log_meal',
    daily_plan_id: dailyPlanId,
    metadata: {
      meal_type: mealType,
    },
  })
}

// ============================================================================
// CATEGORIZATION UTILITY
// ============================================================================

/**
 * Categorize page path for event categorization
 */
function categorizePagePath(path: string): EventCategory {
  if (path.includes('onboarding')) return 'onboarding'
  if (path.includes('dashboard')) return 'dashboard'
  if (path.includes('meal-builder')) return 'meal_builder'
  if (path.includes('recipes')) return 'recipes'
  if (path.includes('profile')) return 'profile'
  if (path.includes('settings')) return 'settings'
  if (path.includes('auth') || path.includes('login') || path.includes('signup')) return 'auth'
  return 'general'
}

// ============================================================================
// TIME TRACKING UTILITIES
// ============================================================================

/**
 * Track time on page and report when user leaves or after timeout
 */
export class PageTimeTracker {
  private startTime: number
  private pagePath: string

  constructor(pagePath: string) {
    this.startTime = performance.now()
    this.pagePath = pagePath
  }

  getDuration(): number {
    return Math.round(performance.now() - this.startTime)
  }

  getEvent(): TrackEventInput {
    return buildTimeOnPageEvent(this.pagePath, this.getDuration())
  }
}

/**
 * Scroll depth tracker
 */
export class ScrollDepthTracker {
  private maxScrollPercentage: number = 0
  private pagePath: string
  private lastReportedPercentage: number = 0

  constructor(pagePath: string) {
    this.pagePath = pagePath
    this.initializeScrollListener()
  }

  private initializeScrollListener(): void {
    if (typeof window === 'undefined') return

    window.addEventListener('scroll', this.updateScrollDepth, { passive: true })
  }

  private updateScrollDepth = (): void => {
    const scrollPercentage = this.calculateScrollPercentage()
    if (scrollPercentage > this.maxScrollPercentage) {
      this.maxScrollPercentage = scrollPercentage
    }
  }

  private calculateScrollPercentage(): number {
    if (typeof window === 'undefined') return 0

    const scrollTop = window.scrollY
    const docHeight = document.documentElement.scrollHeight - window.innerHeight
    return docHeight > 0 ? Math.round((scrollTop / docHeight) * 100) : 0
  }

  reportScrollDepth(): TrackEventInput | null {
    const currentPercentage = this.calculateScrollPercentage()

    // Only report if scrolled at least 25% beyond last report
    if (currentPercentage - this.lastReportedPercentage >= 25) {
      this.lastReportedPercentage = currentPercentage
      return buildScrollEvent(this.pagePath, currentPercentage)
    }

    return null
  }

  destroy(): void {
    if (typeof window === 'undefined') return
    window.removeEventListener('scroll', this.updateScrollDepth)
  }
}
