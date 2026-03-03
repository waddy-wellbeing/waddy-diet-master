import { NextResponse } from 'next/server'

/**
 * GET /api/config/vapid
 * Returns the VAPID public key so the client can subscribe to push notifications.
 * The key is read from the server-side environment at request time, which means it
 * works correctly regardless of whether NEXT_PUBLIC_VAPID_PUBLIC_KEY was available
 * at build time.
 */
export async function GET() {
  // Support both the NEXT_PUBLIC_ version (compiled into the client bundle) and
  // the plain server-side VAPID_PUBLIC_KEY env var (more flexible for deployments).
  const publicKey =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    process.env.VAPID_PUBLIC_KEY ||
    null

  if (!publicKey) {
    return NextResponse.json(
      { error: 'VAPID public key is not configured on the server. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY or VAPID_PUBLIC_KEY in your environment variables.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ publicKey }, {
    headers: {
      // Cache for 1 hour – the key practically never changes in production
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
