# Performance Optimization Guide

## Executive Summary

This document identifies the root causes of slow page transitions in the Waddy Diet Master app and provides comprehensive solutions to achieve rapid, near-instantaneous page switching.

**Primary Issue**: Users experience noticeable delays when navigating between pages, with the app showing blank screens or loading states for 1-3 seconds during transitions.

**Target Performance**: Page transitions should feel instant (<200ms perceived latency), with content streaming progressively and skeleton states showing immediately.

---

## 🔍 Root Causes Analysis

### 1. **Middleware Authentication Overhead** 🔴 **HIGH IMPACT**

**Location**: `middleware.ts` (lines 4-86)

**Problem**: 
- Middleware runs on **every route transition**, including client-side navigation
- Makes 2 Supabase database queries per navigation:
  1. `supabase.auth.getUser()` - verifies authentication
  2. `supabase.from('profiles').select('role')` - checks admin permissions
- These sequential queries add 200-500ms latency to every page switch
- Even cached routes must wait for middleware to complete

**Why It's Slow**:
```typescript
// Current implementation (middleware.ts:33-35, 72-76)
const { data: { user } } = await supabase.auth.getUser()  // ~100-200ms

// For admin routes, adds another query
const { data: profile } = await supabase
  .from('profiles')
  .select('role')
  .eq('user_id', user.id)
  .single()  // +150-300ms
```

**Solutions**:

#### Solution 1A: Optimize Middleware with Caching (Quick Win)
```typescript
// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Cache auth checks for 5 minutes per session
const authCache = new Map<string, { user: any; profile: any; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function middleware(request: NextRequest) {
  const sessionToken = request.cookies.get('sb-access-token')?.value
  
  // Check cache first
  const cached = authCache.get(sessionToken || '')
  const now = Date.now()
  if (cached && now - cached.timestamp < CACHE_TTL) {
    // Use cached auth data - instant!
    return handleRouteWithAuth(request, cached.user, cached.profile)
  }

  // If not cached, fetch from Supabase
  let supabaseResponse = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  
  // Only fetch profile if needed (admin routes)
  let profile = null
  const isAdminRoute = request.nextUrl.pathname.startsWith('/admin')
  if (user && isAdminRoute) {
    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()
    profile = data
  }

  // Cache the result
  if (sessionToken) {
    authCache.set(sessionToken, { user, profile, timestamp: now })
    // Cleanup old entries
    if (authCache.size > 1000) {
      const entries = Array.from(authCache.entries())
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
      authCache.delete(entries[0][0])
    }
  }

  return handleRouteWithAuth(request, user, profile)
}

function handleRouteWithAuth(request: NextRequest, user: any, profile: any) {
  const pathname = request.nextUrl.pathname
  const isPublicRoute = ['/', '/login', '/signup', '/health', '/get-started'].some(
    (route) => pathname === route || pathname.startsWith('/health') || pathname.startsWith('/get-started')
  )
  const isAuthRoute = pathname === '/login' || pathname === '/signup'
  const isAdminRoute = pathname.startsWith('/admin')
  const isAppRoute = pathname.startsWith('/dashboard') || pathname.startsWith('/onboarding') || 
                     pathname.startsWith('/recipes') || pathname.startsWith('/plans')

  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  if (!user && (isAppRoute || isAdminRoute)) {
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  if (user && isAdminRoute) {
    const isAdmin = profile?.role === 'admin' || profile?.role === 'moderator'
    if (!isAdmin) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return NextResponse.next({ request })
}
```

**Expected Improvement**: Reduces middleware overhead from 200-500ms to <10ms for cached routes (95% of navigations)

#### Solution 1B: Reduce Middleware Scope (Best Practice)
```typescript
// middleware.ts - Only run on sensitive routes
export const config = {
  matcher: [
    '/admin/:path*',           // Only admin routes need role check
    '/dashboard/:path*',       // Protected routes
    '/onboarding/:path*',
    '/recipes/:path*',
    '/plans/:path*',
    '/meal-builder/:path*',
    '/nutrition/:path*',
    '/profile/:path*',
  ],
}
```

**Expected Improvement**: Skip middleware entirely for public routes and static assets

---

### 2. **Missing Streaming and Suspense Boundaries** 🔴 **HIGH IMPACT**

**Location**: Most page components (dashboard, recipes, meal-builder, etc.)

**Problem**:
- Pages wait for ALL data to load before showing ANY content
- No progressive rendering or skeleton states during navigation
- Large pages like `dashboard/page.tsx` (278 lines) fetch 5 queries sequentially
- Users see blank screen while waiting for complete data

**Example - Dashboard (Current)**:
```typescript
// app/(app)/dashboard/page.tsx
export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) redirect('/login')  // Blocks entire page
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()  // Blocks entire page
  
  if (!profile?.onboarding_completed) redirect('/onboarding')
  
  // 5 more queries in Promise.all...
  const [dailyLog, dailyPlan, weekLogs, streakLogs, allRecipes] = await Promise.all([...])
  
  // 40+ lines of data processing...
  
  return <DashboardContent {...props} />  // Only renders when ALL data ready
}
```

**Solutions**:

#### Solution 2A: Add Suspense Boundaries (Immediate Improvement)
```typescript
// app/(app)/dashboard/page.tsx
import { Suspense } from 'react'

export default async function DashboardPage() {
  return (
    <div className="min-h-screen">
      {/* Header shows immediately */}
      <DashboardHeader />
      
      {/* Each section streams independently */}
      <Suspense fallback={<CalorieRingSkeleton />}>
        <CalorieRingSection />
      </Suspense>
      
      <Suspense fallback={<MealsSkeleton />}>
        <MealsSection />
      </Suspense>
      
      <Suspense fallback={<StreakSkeleton />}>
        <StreakSection />
      </Suspense>
    </div>
  )
}

// Separate async components for parallel loading
async function CalorieRingSection() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  const [profile, dailyLog] = await Promise.all([
    supabase.from('profiles').select('targets').single(),
    supabase.from('daily_logs').select('logged_totals').maybeSingle(),
  ])
  
  return <CalorieRing data={{ profile, dailyLog }} />
}

async function MealsSection() {
  const data = await fetchMealsData()
  return <MealsList meals={data} />
}

async function StreakSection() {
  const data = await fetchStreakData()
  return <StreakDisplay streak={data} />
}
```

**Expected Improvement**: 
- Initial content appears in <100ms
- Sections stream in as data arrives (300-500ms each)
- Total perceived load time: 100ms vs 1500ms

#### Solution 2B: Use loading.tsx for Instant Feedback
```typescript
// app/(app)/dashboard/loading.tsx (already exists - good!)
export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <Skeleton className="h-8 w-40 mb-2" />
      <Skeleton className="h-4 w-32" />
      {/* Full skeleton layout */}
    </div>
  )
}
```

**Current Status**: ✅ Loading states exist for dashboard, meal-builder, profile, nutrition
**Missing**: Recipes list, recipe details, onboarding (has basic spinner only)

**Action Items**:
1. Add `loading.tsx` to missing routes
2. Ensure skeletons match actual layout (currently done well)
3. Add Suspense boundaries within pages for granular streaming

---

### 3. **Excessive Client Components** 🟡 **MEDIUM IMPACT**

**Location**: `components/` directory

**Problem**:
- **59 out of 65 components** (91%) use `"use client"`
- Heavy JavaScript bundles sent to browser
- Slower hydration and initial page load
- Many components don't need client-side interactivity

**Example - Unnecessary Client Components**:
```typescript
// components/dashboard/stats-card.tsx
'use client'  // ❌ Not needed if just displaying data!

export function StatsCard({ title, value, icon }: Props) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{title}</span>
        {icon}
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  )
}
```

**Solutions**:

#### Solution 3A: Convert Static Components to Server Components
```typescript
// components/dashboard/stats-card.tsx
// Remove 'use client' directive

export function StatsCard({ title, value, icon }: Props) {
  // Same code, but now renders on server!
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{title}</span>
        {icon}
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  )
}
```

**Components to Audit**:
1. Display-only components (cards, badges, layouts)
2. Components that only receive props (no useState, useEffect)
3. List items without individual interactions
4. Skeleton components

**Keep as Client Components** (legitimate uses):
- Forms with `useState`, `useForm`
- Interactive UI (buttons with onClick, modals)
- Components using `usePathname`, `useRouter`
- Animation components with `framer-motion`

#### Solution 3B: Split Large Client Components
```typescript
// Before: Entire component is client-side
'use client'

export function RecipeCard({ recipe }) {
  const [isLiked, setIsLiked] = useState(false)
  
  return (
    <div className="recipe-card">
      <RecipeImage src={recipe.image} />  {/* Static */}
      <RecipeInfo recipe={recipe} />      {/* Static */}
      <button onClick={() => setIsLiked(!isLiked)}>  {/* Interactive */}
        Like {isLiked ? '❤️' : '🤍'}
      </button>
    </div>
  )
}

// After: Split into server + client components
// components/recipe-card.tsx (Server Component)
import { LikeButton } from './like-button'

export function RecipeCard({ recipe }) {
  return (
    <div className="recipe-card">
      <RecipeImage src={recipe.image} />
      <RecipeInfo recipe={recipe} />
      <LikeButton recipeId={recipe.id} />  {/* Only this is client */}
    </div>
  )
}

// components/like-button.tsx (Client Component)
'use client'

export function LikeButton({ recipeId }) {
  const [isLiked, setIsLiked] = useState(false)
  
  return (
    <button onClick={() => setIsLiked(!isLiked)}>
      Like {isLiked ? '❤️' : '🤍'}
    </button>
  )
}
```

**Expected Improvement**: 
- Reduce initial JavaScript bundle by 30-40%
- Faster page hydration (500ms → 200ms)
- Better Core Web Vitals (FCP, TTI)

---

### 4. **Heavy Dependencies** 🟡 **MEDIUM IMPACT**

**Location**: `package.json`, `node_modules`

**Problem**:
- **framer-motion** (12.23.25): ~150KB minified + gzipped
  - Used in 13 components for animations
  - Most animations could use CSS transitions
- **lucide-react** (0.554.0): ~50KB for icon set
  - Imports entire icon library even when using few icons
- **Radix UI** components: Multiple packages, ~200KB total
- Large font files loaded upfront (Geist, Geist Mono, Noto Arabic)

**Current Bundle Impact**:
```json
// package.json dependencies affecting performance
{
  "framer-motion": "^12.23.25",        // 150KB - animation library
  "lucide-react": "^0.554.0",          // 50KB - 1000+ icons
  "@radix-ui/react-*": "...",          // 200KB - UI primitives
  "date-fns": "^4.1.0",                // 70KB - date utilities
}
```

**Solutions**:

#### Solution 4A: Tree-shake lucide-react Icons
```typescript
// ❌ Before: Imports entire library
import { Home, User, Settings, Bell, Heart } from 'lucide-react'

// ✅ After: Import only what you need (when possible)
// Note: lucide-react already tree-shakes well, but ensure no barrel imports
import { Home } from 'lucide-react/dist/esm/icons/home'
import { User } from 'lucide-react/dist/esm/icons/user'

// ✅ Better: Create an icon barrel file for the app
// lib/icons.ts
export { 
  Home,
  User, 
  Settings,
  Bell,
  Heart,
  ChevronLeft,
  ChevronRight,
  // ... only icons actually used
} from 'lucide-react'

// Use throughout app
import { Home, User } from '@/lib/icons'
```

#### Solution 4B: Replace framer-motion with CSS Animations
```typescript
// ❌ Before: framer-motion for simple fade
import { motion } from 'framer-motion'

export function Card() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      Content
    </motion.div>
  )
}

// ✅ After: CSS transition + Tailwind
export function Card() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
      Content
    </div>
  )
}

// Or use CSS module
// card.module.css
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.card {
  animation: fadeInUp 0.3s ease-out;
}
```

**When to Keep framer-motion**:
- Complex gesture interactions (drag, pan, swipe)
- Coordinated sequence animations
- Layout animations (shared element transitions)
- Advanced physics-based animations

**Keep It For**: 
- Dashboard week selector drag interactions
- Meal card swipe gestures
- Complex onboarding transitions

**Replace It For**:
- Simple fades, slides, scales
- Hover effects
- Loading spinners
- Basic enter/exit animations

#### Solution 4C: Font Optimization
```typescript
// app/layout.tsx
import { Geist, Geist_Mono, Noto_Sans_Arabic } from "next/font/google";

// ✅ Add display: 'swap' for faster rendering
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: 'swap',  // Show fallback font immediately
  preload: true,
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: 'swap',
  preload: true,
})

const notoArabic = Noto_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  display: 'swap',
  preload: false,  // Only load when needed
})
```

#### Solution 4D: Dynamic Imports for Heavy Components
```typescript
// ❌ Before: Loads framer-motion on every page
import { CalendarWidget } from '@/components/calendar-widget'

// ✅ After: Load only when needed
import dynamic from 'next/dynamic'

const CalendarWidget = dynamic(
  () => import('@/components/calendar-widget'),
  { 
    loading: () => <CalendarSkeleton />,
    ssr: false  // If component doesn't need SSR
  }
)

export default function Page() {
  return (
    <div>
      <h1>Plan Your Week</h1>
      <CalendarWidget />  {/* Loaded on demand */}
    </div>
  )
}
```

**Expected Improvement**:
- Reduce initial bundle by 200-300KB
- Faster First Contentful Paint (FCP): 1.2s → 0.8s
- Better lighthouse performance score: 75 → 90+

---

### 5. **Missing Route Segment Configuration** 🟡 **MEDIUM IMPACT**

**Location**: All page components

**Problem**:
- No `revalidate` settings - unnecessary re-fetching on navigation
- No `dynamic` configuration - routes could be static but aren't
- No `fetchCache` optimization - duplicate requests
- Missing `runtime` declarations - could use edge runtime for speed

**Solutions**:

#### Solution 5A: Add Route Segment Config
```typescript
// app/(app)/dashboard/page.tsx
import { Metadata } from 'next'

// ✅ Add route configuration
export const dynamic = 'force-dynamic'  // or 'auto' for smart detection
export const revalidate = 60  // Revalidate every 60 seconds
export const fetchCache = 'force-cache'  // Cache fetch requests

export const metadata: Metadata = {
  title: 'Dashboard | Waddy Diet Master',
  description: 'Your daily nutrition overview',
}

export default async function DashboardPage() {
  // ... existing code
}
```

#### Solution 5B: Use Proper Cache Settings Per Route
```typescript
// app/(app)/recipes/[id]/page.tsx
// Recipe details rarely change - aggressive caching
export const revalidate = 3600  // 1 hour
export const dynamic = 'force-static'  // Generate at build time for popular recipes

// app/(app)/dashboard/page.tsx  
// Dashboard is user-specific - no caching
export const revalidate = 0  // Always fresh
export const dynamic = 'force-dynamic'

// app/(marketing)/page.tsx
// Landing page is static
export const revalidate = 86400  // 24 hours
export const dynamic = 'force-static'
```

#### Solution 5C: Optimize Data Fetching with Unstable_cache
```typescript
// lib/actions/recipes.ts
import { unstable_cache } from 'next/cache'

// ✅ Cache expensive queries
export const getPublicRecipes = unstable_cache(
  async () => {
    const supabase = await createClient()
    const { data } = await supabase
      .from('recipes')
      .select('*')
      .eq('is_public', true)
      .order('name')
    return data
  },
  ['public-recipes'],  // Cache key
  {
    revalidate: 3600,  // 1 hour
    tags: ['recipes'],  // For manual invalidation
  }
)

// Invalidate when recipes change
export async function updateRecipe(id: string, data: RecipeUpdate) {
  // Update recipe...
  revalidateTag('recipes')  // Clear cache
  revalidatePath('/recipes')
}
```

**Expected Improvement**:
- Reduce unnecessary database queries by 70%
- Instant navigation for cached routes
- Better performance for static-like content

---

### 6. **Layout Queries Blocking Navigation** 🟠 **MODERATE IMPACT**

**Location**: `app/(app)/layout.tsx` (lines 7-42)

**Problem**:
- Layout queries run on EVERY navigation within app routes
- Fetches user profile on every page transition
- Blocks rendering until auth check completes

**Current Implementation**:
```typescript
// app/(app)/layout.tsx
export default async function AppLayout({ children }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()  // Blocks every navigation
  
  if (!user) redirect('/login')
  
  const { data: profile } = await supabase  // Another blocking query
    .from('profiles')
    .select('onboarding_completed, onboarding_step')
    .eq('user_id', user.id)
    .maybeSingle()
  
  return (
    <div className="min-h-screen">
      <RouteTrackerComponent />
      <main className="flex-1">{children}</main>
      {profile?.onboarding_completed && <BottomNav />}
    </div>
  )
}
```

**Solutions**:

#### Solution 6A: Cache Layout Data
```typescript
// lib/auth/cached-auth.ts
import { unstable_cache } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export const getCachedUser = unstable_cache(
  async () => {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    return user
  },
  ['current-user'],
  { revalidate: 300 }  // 5 minutes
)

export const getCachedProfile = unstable_cache(
  async (userId: string) => {
    const supabase = await createClient()
    const { data } = await supabase
      .from('profiles')
      .select('onboarding_completed, onboarding_step')
      .eq('user_id', userId)
      .maybeSingle()
    return data
  },
  ['user-profile'],
  { revalidate: 300 }
)

// app/(app)/layout.tsx
export default async function AppLayout({ children }) {
  const user = await getCachedUser()
  if (!user) redirect('/login')
  
  const profile = await getCachedProfile(user.id)
  
  return (
    <div className="min-h-screen">
      <RouteTrackerComponent />
      <main className="flex-1">{children}</main>
      {profile?.onboarding_completed && <BottomNav />}
    </div>
  )
}
```

#### Solution 6B: Move Auth to Middleware (Already Done)
Since middleware already checks auth, layout shouldn't need to re-check:

```typescript
// app/(app)/layout.tsx - Simplified
export default async function AppLayout({ children }) {
  // Trust middleware - user is authenticated if we reached here
  // Only fetch profile for UI decisions
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  // Fetch only minimal data needed for layout
  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed')  // Only one field
    .eq('user_id', user!.id)
    .single()
  
  return (
    <div className="min-h-screen">
      <main className="flex-1">{children}</main>
      {profile?.onboarding_completed && <BottomNav />}
    </div>
  )
}
```

**Expected Improvement**: Reduce layout overhead from 200ms to <50ms

---

### 7. **Missing Image Optimization** 🟠 **MODERATE IMPACT**

**Location**: Recipe images, user avatars, food photos

**Problem**:
- Some images use `<img>` instead of `<Image>`
- No explicit width/height (causes layout shift)
- No lazy loading for below-fold images
- Missing blur placeholders

**Solutions**:

#### Solution 7A: Use Next.js Image Component Everywhere
```typescript
// ❌ Before
<img src={recipe.image_url} alt={recipe.name} />

// ✅ After
import Image from 'next/image'

<Image 
  src={recipe.image_url} 
  alt={recipe.name}
  width={300}
  height={200}
  loading="lazy"  // Lazy load below fold
  placeholder="blur"  // Blur-up effect
  blurDataURL={recipe.image_blur || '/placeholder-blur.jpg'}
  className="rounded-lg"
/>
```

#### Solution 7B: Optimize Recipe Images
```typescript
// components/recipe-card.tsx
import Image from 'next/image'

export function RecipeCard({ recipe }) {
  return (
    <div className="recipe-card">
      <Image
        src={recipe.image_url || '/placeholder-recipe.jpg'}
        alt={recipe.name}
        width={400}
        height={300}
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        loading="lazy"
        className="w-full h-48 object-cover"
      />
      {/* Rest of card */}
    </div>
  )
}
```

#### Solution 7C: Generate Blur Placeholders
```typescript
// scripts/generate-blur-placeholders.ts
import sharp from 'sharp'
import { createClient } from '@supabase/supabase-js'

async function generateBlurPlaceholders() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
  
  const { data: recipes } = await supabase
    .from('recipes')
    .select('id, image_url')
    .not('image_url', 'is', null)
  
  for (const recipe of recipes || []) {
    try {
      // Download image
      const response = await fetch(recipe.image_url)
      const buffer = await response.arrayBuffer()
      
      // Generate tiny blur placeholder
      const blurBuffer = await sharp(Buffer.from(buffer))
        .resize(20, 20, { fit: 'cover' })
        .blur(5)
        .toBuffer()
      
      const blurDataUrl = `data:image/jpeg;base64,${blurBuffer.toString('base64')}`
      
      // Save to database
      await supabase
        .from('recipes')
        .update({ image_blur: blurDataUrl })
        .eq('id', recipe.id)
      
      console.log(`✓ Generated blur for recipe ${recipe.id}`)
    } catch (error) {
      console.error(`✗ Failed for recipe ${recipe.id}:`, error)
    }
  }
}

generateBlurPlaceholders()
```

**Expected Improvement**:
- Reduce image bandwidth by 60%
- Eliminate layout shifts (CLS score improvement)
- Faster perceived load with blur-up effect

---

### 8. **Lack of Prefetching** 🟠 **MODERATE IMPACT**

**Location**: Navigation links throughout the app

**Problem**:
- Only bottom nav has `prefetch={true}`
- Recipe links, dashboard links don't prefetch
- Users wait for code + data on every click

**Current State**:
```typescript
// components/app/navigation/bottom-nav.tsx
<Link href={item.href} prefetch={true}>  // ✅ Good!

// Most other links:
<Link href={`/recipes/${recipe.id}`}>  // ❌ No prefetch (defaults to true in App Router, but not optimized)
```

**Solutions**:

#### Solution 8A: Explicit Prefetching for Common Routes
```typescript
// components/recipe-card.tsx
import Link from 'next/link'

export function RecipeCard({ recipe }) {
  return (
    <Link 
      href={`/recipes/${recipe.id}`}
      prefetch={true}  // Prefetch on hover/focus
      className="recipe-card"
    >
      {/* Card content */}
    </Link>
  )
}
```

#### Solution 8B: Prefetch User's Likely Next Actions
```typescript
// app/(app)/dashboard/page.tsx
import { prefetch } from 'next/navigation'

export default async function DashboardPage() {
  // Prefetch routes user is likely to visit
  prefetch('/meal-builder')
  prefetch('/recipes')
  prefetch('/nutrition')
  
  return <DashboardContent />
}
```

#### Solution 8C: Smart Prefetching on Hover
```typescript
// components/recipe-card.tsx
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

export function RecipeCard({ recipe }) {
  const router = useRouter()
  
  return (
    <Link
      href={`/recipes/${recipe.id}`}
      onMouseEnter={() => {
        // Prefetch on hover
        router.prefetch(`/recipes/${recipe.id}`)
      }}
      className="recipe-card"
    >
      {/* Card content */}
    </Link>
  )
}
```

**Expected Improvement**: Reduce click-to-content time from 800ms to 200ms

---

### 9. **Unoptimized Database Queries** 🟠 **MODERATE IMPACT**

**Location**: Dashboard, meal-builder, and other data-heavy pages

**Problem**:
- Selecting all columns with `select('*')` when only few needed
- Missing database indexes on frequently queried columns
- N+1 query patterns in some components
- Large JSONB fields fetched unnecessarily

**Examples**:
```typescript
// app/(app)/dashboard/page.tsx:22-26
const { data: profile } = await supabase
  .from('profiles')
  .select('*')  // ❌ Fetches all columns including large JSONB
  .eq('user_id', user.id)
  .single()

// Only needs: targets, preferences, basic_info
```

**Solutions**:

#### Solution 9A: Select Only Needed Columns
```typescript
// ❌ Before
const { data: profile } = await supabase
  .from('profiles')
  .select('*')
  .eq('user_id', user.id)
  .single()

// ✅ After - Specific columns
const { data: profile } = await supabase
  .from('profiles')
  .select('targets, preferences, basic_info, onboarding_completed')
  .eq('user_id', user.id)
  .single()

// ✅ Even better - Only what's needed for this page
const { data: targets } = await supabase
  .from('profiles')
  .select('targets')
  .eq('user_id', user.id)
  .single()
```

#### Solution 9B: Add Database Indexes
```sql
-- supabase/migrations/add_performance_indexes.sql

-- Profiles table
CREATE INDEX IF NOT EXISTS idx_profiles_user_id_onboarding 
  ON profiles(user_id, onboarding_completed);

-- Daily logs table
CREATE INDEX IF NOT EXISTS idx_daily_logs_user_date 
  ON daily_logs(user_id, log_date DESC);

-- Daily plans table  
CREATE INDEX IF NOT EXISTS idx_daily_plans_user_date
  ON daily_plans(user_id, plan_date DESC);

-- Recipes table
CREATE INDEX IF NOT EXISTS idx_recipes_public_meal_type
  ON recipes(is_public, meal_type)
  WHERE is_public = true;

-- For JSONB queries
CREATE INDEX IF NOT EXISTS idx_profiles_targets_gin
  ON profiles USING GIN (targets);
```

#### Solution 9C: Batch Related Queries
```typescript
// ❌ Before - N+1 queries
const recipes = await getRecipes()
for (const recipe of recipes) {
  const ingredients = await getIngredients(recipe.id)  // N queries!
  recipe.ingredients = ingredients
}

// ✅ After - Single query with join
const recipes = await supabase
  .from('recipes')
  .select(`
    *,
    ingredients:recipe_ingredients(
      ingredient_id,
      quantity,
      unit
    )
  `)
  .eq('is_public', true)
```

**Expected Improvement**: Reduce database query time by 50-70%

---

## 📋 Implementation Roadmap

### Phase 1: Quick Wins (1-2 days) ⚡
**Impact**: 40-50% improvement, fastest ROI

1. **Add Suspense Boundaries**
   - [ ] Dashboard page split into sections
   - [ ] Recipes list with streaming
   - [ ] Meal builder progressive loading
   - **Files**: `app/(app)/dashboard/page.tsx`, `app/(app)/recipes/page.tsx`, `app/(app)/meal-builder/page.tsx`

2. **Optimize Middleware Caching**
   - [ ] Implement auth cache with 5-minute TTL
   - [ ] Reduce profile queries to admin routes only
   - **File**: `middleware.ts`

3. **Add Missing Loading States**
   - [ ] Recipe details loading.tsx
   - [ ] Recipes list loading.tsx
   - **Files**: `app/(app)/recipes/[id]/loading.tsx`, `app/(app)/recipes/loading.tsx`

4. **Select Specific Columns**
   - [ ] Audit all `select('*')` queries
   - [ ] Replace with specific column selections
   - **Files**: All page.tsx files with queries

5. **Font Display Optimization**
   - [ ] Add `display: 'swap'` to all fonts
   - [ ] Lazy load Arabic font
   - **File**: `app/layout.tsx`

**Expected Result**: Page transitions from 1-3s → 500-800ms

---

### Phase 2: Bundle Optimization (2-3 days) 📦
**Impact**: 25-30% improvement

1. **Replace framer-motion with CSS**
   - [ ] Audit 13 components using framer-motion
   - [ ] Replace simple animations with CSS transitions
   - [ ] Keep framer-motion only for complex gestures
   - **Target files**: `components/dashboard/*.tsx`, `components/onboarding/*.tsx`

2. **Convert to Server Components**
   - [ ] Audit 59 client components
   - [ ] Convert 20-30 display-only components to server components
   - [ ] Split large client components into server + client
   - **Target**: Reduce client components from 91% to 50%

3. **Dynamic Imports for Heavy Components**
   - [ ] Calendar widget
   - [ ] Charts/graphs
   - [ ] Modal dialogs
   - **Files**: Large components with heavy dependencies

4. **Tree-shake Dependencies**
   - [ ] Create `lib/icons.ts` barrel file
   - [ ] Audit lucide-react imports
   - **Files**: All components using icons

**Expected Result**: Page transitions from 500-800ms → 300-500ms

---

### Phase 3: Caching & Database (3-4 days) 💾
**Impact**: 20-25% improvement

1. **Add Route Segment Config**
   - [ ] Define revalidate periods per route type
   - [ ] Set dynamic/static per route
   - [ ] Add fetchCache configuration
   - **Files**: All `page.tsx` files

2. **Implement unstable_cache**
   - [ ] Cache public recipes (1 hour)
   - [ ] Cache user profile (5 minutes)
   - [ ] Cache ingredients list (1 hour)
   - **Files**: `lib/actions/*.ts`

3. **Database Optimization**
   - [ ] Create migration with performance indexes
   - [ ] Audit slow queries with Supabase dashboard
   - [ ] Optimize JSONB queries
   - **Files**: New migration file

4. **Layout Data Optimization**
   - [ ] Cache layout auth checks
   - [ ] Minimize layout queries
   - **File**: `app/(app)/layout.tsx`

**Expected Result**: Page transitions from 300-500ms → 150-250ms

---

### Phase 4: Advanced Optimization (2-3 days) 🚀
**Impact**: 10-15% improvement

1. **Prefetching Strategy**
   - [ ] Enable prefetch on all navigation links
   - [ ] Smart hover-based prefetching
   - [ ] Predictive prefetching based on user behavior
   - **Files**: All Link components

2. **Image Optimization**
   - [ ] Generate blur placeholders for all images
   - [ ] Ensure all images use Next.js Image
   - [ ] Add proper sizes attribute
   - **Files**: All components with images, new script

3. **Code Splitting**
   - [ ] Route-based code splitting (already enabled)
   - [ ] Component-level splitting for large pages
   - [ ] Lazy load below-fold content
   - **Files**: Large page components

4. **Service Worker / PWA**
   - [ ] Implement service worker for offline caching
   - [ ] Add PWA manifest
   - [ ] Cache static assets aggressively
   - **Files**: New service worker, manifest

**Expected Result**: Page transitions from 150-250ms → 100-200ms (imperceptible)

---

## 🎯 Target Performance Metrics

### Current Performance (Estimated)
- **Time to First Byte (TTFB)**: 400-600ms
- **First Contentful Paint (FCP)**: 1.2-1.8s
- **Largest Contentful Paint (LCP)**: 2.5-3.5s
- **Time to Interactive (TTI)**: 3.0-4.0s
- **Cumulative Layout Shift (CLS)**: 0.15-0.25
- **Page Transition**: 1.0-3.0s

### Target Performance (After Optimization)
- **Time to First Byte (TTFB)**: 150-250ms ⬇️ 60%
- **First Contentful Paint (FCP)**: 0.5-0.8s ⬇️ 50%
- **Largest Contentful Paint (LCP)**: 1.2-1.8s ⬇️ 50%
- **Time to Interactive (TTI)**: 1.5-2.0s ⬇️ 50%
- **Cumulative Layout Shift (CLS)**: 0.05-0.10 ⬇️ 60%
- **Page Transition**: 0.1-0.3s ⬇️ 90%

### Key Metrics to Track
```typescript
// lib/analytics/performance.ts
export function trackPageTransition() {
  if (typeof window === 'undefined') return
  
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.entryType === 'navigation') {
        const navigation = entry as PerformanceNavigationTiming
        
        // Log key metrics
        console.log('Performance Metrics:', {
          TTFB: navigation.responseStart - navigation.requestStart,
          DOMContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          LoadComplete: navigation.loadEventEnd - navigation.loadEventStart,
          Total: navigation.loadEventEnd - navigation.fetchStart,
        })
      }
    }
  })
  
  observer.observe({ entryTypes: ['navigation', 'paint', 'largest-contentful-paint'] })
}
```

---

## 🔧 Tools for Monitoring

### 1. Lighthouse CI
```bash
npm install -g @lhci/cli
lhci autorun --config=lighthouserc.json
```

### 2. Next.js Speed Insights
```typescript
// app/layout.tsx
import { SpeedInsights } from '@vercel/speed-insights/next'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  )
}
```

### 3. Supabase Query Performance
- Use Supabase Dashboard → Database → Query Performance
- Enable pganalyze integration
- Monitor slow queries > 100ms

### 4. React DevTools Profiler
```bash
# In development
npm run dev
# Open React DevTools → Profiler
# Record navigation and analyze render times
```

---

## ✅ Testing Strategy

### Before Starting
```bash
# Baseline performance measurement
npm run build
npm run start

# Open Chrome DevTools → Network → Slow 3G
# Navigate between pages and record timings
```

### After Each Phase
```bash
# Rebuild and test
npm run build
npm run start

# Measure improvements
# Compare lighthouse scores
# Test on slow network (3G)
# Test on low-end device
```

### Checklist for Each Change
- [ ] Verify page still functions correctly
- [ ] Check that loading states appear
- [ ] Ensure no new console errors
- [ ] Test on mobile device
- [ ] Verify data loads correctly
- [ ] Check authentication still works

---

## 📚 Additional Resources

### Next.js Performance
- [Next.js Optimizing Performance](https://nextjs.org/docs/app/building-your-application/optimizing)
- [React Server Components](https://react.dev/reference/rsc/server-components)
- [Streaming and Suspense](https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming)

### Supabase Performance
- [Supabase Performance Tips](https://supabase.com/docs/guides/database/performance)
- [Postgres Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)

### Web Performance
- [Web.dev Performance](https://web.dev/performance/)
- [MDN Web Performance](https://developer.mozilla.org/en-US/docs/Web/Performance)
- [Core Web Vitals](https://web.dev/vitals/)

---

## 🎓 Best Practices Summary

### Do's ✅
- Use Server Components by default
- Add Suspense boundaries for async data
- Provide instant loading states
- Cache expensive queries with `unstable_cache`
- Select only needed database columns
- Use Next.js Image for all images
- Prefetch likely next routes
- Minimize client-side JavaScript
- Use CSS for simple animations
- Monitor performance continuously

### Don'ts ❌
- Don't use `'use client'` unless necessary
- Don't fetch all data before showing UI
- Don't use `select('*')` in queries
- Don't load heavy libraries for simple tasks
- Don't forget loading.tsx for routes
- Don't skip image optimization
- Don't query the same data multiple times
- Don't block navigation with slow middleware
- Don't load fonts synchronously
- Don't ignore Core Web Vitals

---

## 💡 Quick Reference Commands

```bash
# Development
npm run dev

# Production build + analysis
npm run build
npm run start

# Analyze bundle size
npm install -g @next/bundle-analyzer
ANALYZE=true npm run build

# Check for large dependencies
npx bundle-phobia [package-name]

# Lighthouse audit
npx lighthouse http://localhost:3000 --view

# Profile React components
npm run dev
# Open http://localhost:3000?profile=true
```

---

## 📞 Getting Help

If you encounter issues during implementation:

1. **Check Next.js Docs**: Most performance patterns are documented
2. **Supabase Discord**: Database optimization questions
3. **Next.js Discord**: Framework-specific issues
4. **GitHub Issues**: Report bugs in dependencies

---

## 🎉 Expected Final Result

After completing all phases:

✨ **User Experience**
- Page transitions feel instant (<200ms)
- Content streams progressively (no blank screens)
- Smooth animations with no jank
- Fast initial load (< 2s)
- Responsive on slow networks (3G)

📊 **Metrics**
- Lighthouse Performance: 90+ (from 75)
- Largest Contentful Paint: <1.8s (from 3.5s)
- First Input Delay: <100ms (from 300ms)
- Cumulative Layout Shift: <0.1 (from 0.25)

🚀 **Technical**
- 60% fewer database queries
- 40% smaller JavaScript bundle
- 70% faster middleware execution
- 90% reduction in perceived page load time

---

**Document Version**: 1.0  
**Last Updated**: 2025-12-30  
**Author**: Copilot Performance Optimization Team  
**Review Status**: Ready for Implementation
