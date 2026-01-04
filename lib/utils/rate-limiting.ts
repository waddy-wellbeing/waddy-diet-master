/**
 * Rate Limiting Utility for Push Notifications
 * 
 * Prevents notification spam and respects service quotas.
 * Uses in-memory storage for simplicity (can be upgraded to Redis for distributed systems).
 */

interface RateLimitConfig {
  maxRequests: number
  windowMs: number // Time window in milliseconds
  identifier: string // User ID, IP, or other identifier
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: Date
  retryAfter?: number // Seconds until reset
}

// In-memory storage for rate limits (key: identifier, value: request timestamps)
const rateLimitStore = new Map<string, number[]>()

/**
 * Check if a request is allowed under rate limits
 * 
 * @param config - Rate limit configuration
 * @returns Result indicating if request is allowed
 * 
 * @example
 * ```ts
 * const result = checkRateLimit({
 *   identifier: userId,
 *   maxRequests: 10,
 *   windowMs: 60000, // 1 minute
 * })
 * 
 * if (!result.allowed) {
 *   throw new Error(`Rate limit exceeded. Try again in ${result.retryAfter}s`)
 * }
 * ```
 */
export function checkRateLimit(config: RateLimitConfig): RateLimitResult {
  const { identifier, maxRequests, windowMs } = config
  const now = Date.now()
  const windowStart = now - windowMs

  // Get existing requests for this identifier
  let requests = rateLimitStore.get(identifier) || []

  // Filter out requests outside the current window
  requests = requests.filter(timestamp => timestamp > windowStart)

  // Check if limit exceeded
  const allowed = requests.length < maxRequests
  const remaining = Math.max(0, maxRequests - requests.length)

  // Calculate reset time
  const oldestRequest = requests[0] || now
  const resetAt = new Date(oldestRequest + windowMs)
  const retryAfter = allowed ? undefined : Math.ceil((resetAt.getTime() - now) / 1000)

  // If allowed, record this request
  if (allowed) {
    requests.push(now)
    rateLimitStore.set(identifier, requests)
  }

  return {
    allowed,
    remaining,
    resetAt,
    retryAfter,
  }
}

/**
 * Clear rate limit data for an identifier (useful for testing or manual reset)
 */
export function clearRateLimit(identifier: string): void {
  rateLimitStore.delete(identifier)
}

/**
 * Clean up old entries from rate limit store
 * Call this periodically to prevent memory leaks
 */
export function cleanupRateLimitStore(maxAgeMs = 3600000): void {
  const now = Date.now()
  
  for (const [identifier, requests] of rateLimitStore.entries()) {
    // Filter out old requests
    const activeRequests = requests.filter(timestamp => now - timestamp < maxAgeMs)
    
    if (activeRequests.length === 0) {
      rateLimitStore.delete(identifier)
    } else {
      rateLimitStore.set(identifier, activeRequests)
    }
  }
}

// Auto-cleanup every hour
setInterval(() => cleanupRateLimitStore(), 3600000)

/**
 * Predefined rate limit configurations for common use cases
 */
export const RATE_LIMITS = {
  // User-initiated notifications (e.g., admin sending to specific user)
  ADMIN_SEND: {
    maxRequests: 30,
    windowMs: 60000, // 30 per minute
  },
  
  // Broadcast notifications (higher limit, but still controlled)
  BROADCAST: {
    maxRequests: 5,
    windowMs: 60000, // 5 per minute
  },
  
  // Automated notifications (meal reminders, summaries)
  AUTOMATED: {
    maxRequests: 1000,
    windowMs: 60000, // 1000 per minute (sufficient for most apps)
  },
  
  // Per-user notification quota (prevent spam to individual users)
  PER_USER: {
    maxRequests: 10,
    windowMs: 3600000, // 10 per hour per user
  },
} as const

/**
 * Batch processor for sending notifications with rate limiting
 * 
 * @example
 * ```ts
 * const processor = new BatchNotificationProcessor({
 *   batchSize: 50,
 *   delayBetweenBatches: 1000,
 *   rateLimit: RATE_LIMITS.BROADCAST,
 * })
 * 
 * await processor.process(
 *   subscriptions,
 *   async (sub) => await sendNotification(sub)
 * )
 * ```
 */
export class BatchNotificationProcessor<T> {
  private batchSize: number
  private delayBetweenBatches: number
  private rateLimit?: RateLimitConfig
  
  constructor(config: {
    batchSize?: number
    delayBetweenBatches?: number // Milliseconds
    rateLimit?: RateLimitConfig
  }) {
    this.batchSize = config.batchSize || 50
    this.delayBetweenBatches = config.delayBetweenBatches || 1000
    this.rateLimit = config.rateLimit
  }
  
  /**
   * Process items in batches with optional rate limiting
   * 
   * @param items - Array of items to process
   * @param processor - Function to process each item (returns true on success)
   * @param onProgress - Optional callback for progress updates
   * @returns Summary of processed items
   */
  async process(
    items: T[],
    processor: (item: T) => Promise<boolean>,
    onProgress?: (completed: number, total: number, failed: number) => void
  ): Promise<{
    total: number
    successful: number
    failed: number
  }> {
    let successful = 0
    let failed = 0
    const total = items.length
    
    // Process in batches
    for (let i = 0; i < items.length; i += this.batchSize) {
      const batch = items.slice(i, i + this.batchSize)
      
      // Check rate limit before processing batch
      if (this.rateLimit) {
        const rateLimitResult = checkRateLimit(this.rateLimit)
        
        if (!rateLimitResult.allowed) {
          console.warn(`Rate limit exceeded. Waiting ${rateLimitResult.retryAfter}s...`)
          await this.delay((rateLimitResult.retryAfter || 1) * 1000)
        }
      }
      
      // Process batch items in parallel
      const results = await Promise.allSettled(
        batch.map(item => processor(item))
      )
      
      // Count results
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value === true) {
          successful++
        } else {
          failed++
        }
      }
      
      // Report progress
      if (onProgress) {
        onProgress(successful + failed, total, failed)
      }
      
      // Delay between batches (except for last batch)
      if (i + this.batchSize < items.length) {
        await this.delay(this.delayBetweenBatches)
      }
    }
    
    return { total, successful, failed }
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

/**
 * Utility to estimate time to complete batch processing
 */
export function estimateBatchDuration(
  itemCount: number,
  batchSize: number,
  delayBetweenBatches: number
): number {
  const batchCount = Math.ceil(itemCount / batchSize)
  const totalDelay = (batchCount - 1) * delayBetweenBatches
  return totalDelay
}
