import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session if expired
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Public routes that don't require auth
  const publicRoutes = ['/', '/login', '/signup', '/health', '/get-started']
  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith('/health') || pathname.startsWith('/get-started')
  )

  // Auth routes (login/signup) - redirect to dashboard if already logged in
  const isAuthRoute = pathname === '/login' || pathname === '/signup'

  // Admin routes - require admin or moderator role
  const isAdminRoute = pathname.startsWith('/admin')

  // App routes - require authentication
  const isAppRoute =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/recipes') ||
    pathname.startsWith('/plans')

  // If user is logged in and tries to access auth routes, redirect to dashboard
  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // If user is not logged in and tries to access protected routes
  if (!user && (isAppRoute || isAdminRoute)) {
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // For admin routes, check if user has admin or moderator role
  if (user && isAdminRoute) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    const isAdmin = profile?.role === 'admin' || profile?.role === 'moderator'

    if (!isAdmin) {
      // Redirect non-admin users to dashboard
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
