import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/notifications/track-click
 * 
 * Called by service worker when user clicks a notification.
 * Updates the clicked_at timestamp in notifications_log for analytics.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { notificationId } = body

    if (!notificationId) {
      return NextResponse.json(
        { error: 'notificationId is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Update the notification log with click timestamp
    const { error } = await supabase
      .from('notifications_log')
      .update({ 
        clicked_at: new Date().toISOString(),
        status: 'clicked' 
      })
      .eq('id', notificationId)
      .is('clicked_at', null) // Only update if not already clicked

    if (error) {
      console.error('Error updating notification click:', error)
      return NextResponse.json(
        { error: 'Failed to track click' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Unexpected error tracking notification click:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/notifications/track-click
 * 
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({ 
    status: 'ok',
    endpoint: '/api/notifications/track-click',
    methods: ['POST']
  })
}
