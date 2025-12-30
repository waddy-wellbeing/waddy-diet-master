# Performance Quick Start Guide

> **TL;DR**: Page transitions are slow (1-3s). This guide shows you the fastest way to fix it.

## 🚀 Immediate Actions (30 minutes, 40% improvement)

### 1. Add Suspense to Dashboard (10 min)
```bash
# Edit app/(app)/dashboard/page.tsx
# Split into async sections with Suspense boundaries
```

**Before**: Page waits for all 5 queries (1.5s)
**After**: Header shows instantly, sections stream in (0.3s perceived)

### 2. Cache Middleware Auth (10 min)
```bash
# Edit middleware.ts
# Add Map-based cache with 5-min TTL
```

**Before**: 200-500ms per navigation
**After**: <10ms for cached routes (95% of navigations)

### 3. Add Loading States (10 min)
```bash
# Add loading.tsx to missing routes:
touch app/(app)/recipes/loading.tsx
touch app/(app)/recipes/[id]/loading.tsx
```

**Before**: Blank screen while loading
**After**: Instant skeleton feedback

---

## 📊 Performance Issues Priority List

| Issue | Impact | Effort | ROI | Phase |
|-------|--------|--------|-----|-------|
| Middleware overhead | 🔴 High | Low | ⭐⭐⭐⭐⭐ | 1 |
| Missing Suspense | 🔴 High | Low | ⭐⭐⭐⭐⭐ | 1 |
| Client components | 🟡 Medium | High | ⭐⭐⭐ | 2 |
| Heavy dependencies | 🟡 Medium | Medium | ⭐⭐⭐⭐ | 2 |
| Route config missing | 🟡 Medium | Low | ⭐⭐⭐⭐ | 1 |
| Layout queries | 🟠 Moderate | Low | ⭐⭐⭐ | 3 |
| Image optimization | 🟠 Moderate | Medium | ⭐⭐⭐ | 4 |
| No prefetching | 🟠 Moderate | Low | ⭐⭐⭐ | 3 |
| Slow queries | 🟠 Moderate | Medium | ⭐⭐⭐ | 3 |

---

## 🎯 Quick Wins Checklist

### Day 1: Core Improvements (4 hours)
- [ ] Add Suspense boundaries to dashboard
- [ ] Add Suspense boundaries to meal-builder  
- [ ] Add Suspense boundaries to recipes list
- [ ] Implement middleware auth caching
- [ ] Add missing loading.tsx files
- [ ] Add `display: 'swap'` to fonts in layout.tsx
- [ ] Change all `select('*')` to specific columns

**Expected**: 1-3s → 500-800ms transitions

### Day 2: Bundle Optimization (4 hours)
- [ ] Audit 59 client components
- [ ] Convert 15-20 display-only components to server
- [ ] Replace 5 simple framer-motion animations with CSS
- [ ] Create `lib/icons.ts` barrel file
- [ ] Add dynamic imports for 3 heavy components

**Expected**: 500-800ms → 300-500ms transitions

### Day 3: Caching Strategy (4 hours)
- [ ] Add route segment config to 10 main pages
- [ ] Implement `unstable_cache` for public recipes
- [ ] Implement `unstable_cache` for user profile
- [ ] Create database performance indexes migration
- [ ] Cache layout data in app/(app)/layout.tsx

**Expected**: 300-500ms → 150-250ms transitions

---

## 📁 Files to Edit (Priority Order)

### 🔴 High Priority (Do First)
1. `middleware.ts` - Add auth caching
2. `app/(app)/dashboard/page.tsx` - Add Suspense
3. `app/(app)/meal-builder/page.tsx` - Add Suspense
4. `app/(app)/recipes/page.tsx` - Add Suspense
5. `app/layout.tsx` - Optimize font loading
6. `app/(app)/recipes/loading.tsx` - Create file
7. `app/(app)/recipes/[id]/loading.tsx` - Create file

### 🟡 Medium Priority (Week 1)
8. `lib/actions/recipes.ts` - Add unstable_cache
9. `lib/actions/profiles.ts` - Add unstable_cache  
10. `next.config.ts` - Add bundle analyzer
11. `components/dashboard/*.tsx` - Replace framer-motion
12. `components/ui/*.tsx` - Convert to server components
13. `app/(app)/layout.tsx` - Cache layout queries

### 🟢 Low Priority (Week 2+)
14. Add database indexes migration
15. Generate blur placeholders for images
16. Implement prefetching strategy
17. Add PWA service worker

---

## 💻 Code Snippets (Copy-Paste Ready)

### Middleware Caching
```typescript
// middleware.ts - Add at top
const authCache = new Map<string, { user: any; profile: any; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function middleware(request: NextRequest) {
  const sessionToken = request.cookies.get('sb-access-token')?.value
  const cached = authCache.get(sessionToken || '')
  const now = Date.now()
  
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return handleRouteWithAuth(request, cached.user, cached.profile)
  }
  
  // ... rest of existing code
  
  // Before returning, cache the result:
  if (sessionToken) {
    authCache.set(sessionToken, { user, profile, timestamp: now })
  }
}
```

### Dashboard Suspense
```typescript
// app/(app)/dashboard/page.tsx
import { Suspense } from 'react'

export default async function DashboardPage() {
  return (
    <div className="min-h-screen">
      <Suspense fallback={<HeaderSkeleton />}>
        <DashboardHeader />
      </Suspense>
      
      <Suspense fallback={<CalorieRingSkeleton />}>
        <CalorieRingSection />
      </Suspense>
      
      <Suspense fallback={<MealsSkeleton />}>
        <MealsSection />
      </Suspense>
    </div>
  )
}
```

### Route Segment Config
```typescript
// Add to any page.tsx
export const revalidate = 60  // Revalidate every 60 seconds
export const dynamic = 'force-dynamic'  // or 'auto'
export const fetchCache = 'force-cache'
```

### Font Optimization
```typescript
// app/layout.tsx
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: 'swap',  // ✅ Add this
  preload: true,
})
```

### Specific Column Selection
```typescript
// ❌ Before
const { data: profile } = await supabase
  .from('profiles')
  .select('*')
  .eq('user_id', user.id)
  .single()

// ✅ After
const { data: profile } = await supabase
  .from('profiles')
  .select('targets, preferences, basic_info')
  .eq('user_id', user.id)
  .single()
```

---

## 🧪 Testing Your Changes

### Before Making Changes
```bash
# 1. Build production version
npm run build
npm run start

# 2. Test navigation speed
# Open Chrome DevTools → Network → Slow 3G
# Navigate between pages and note times

# 3. Run Lighthouse
npx lighthouse http://localhost:3000 --view
# Note the Performance score
```

### After Each Change
```bash
# 1. Rebuild
npm run build

# 2. Compare navigation speed
# Should feel noticeably faster

# 3. Check for errors
# Ensure no console errors
# Test all major routes
```

---

## 📈 Success Metrics

### Track These Numbers

**Before Optimization** (baseline):
- Dashboard load: ~1.5s
- Recipe details: ~1.2s  
- Page transitions: 1-3s
- Lighthouse score: ~75

**After Phase 1** (Day 1):
- Dashboard load: ~0.6s
- Recipe details: ~0.5s
- Page transitions: 0.5-0.8s  
- Lighthouse score: ~82

**After Phase 2** (Day 2):
- Dashboard load: ~0.4s
- Recipe details: ~0.3s
- Page transitions: 0.3-0.5s
- Lighthouse score: ~86

**After Phase 3** (Day 3):
- Dashboard load: ~0.2s
- Recipe details: ~0.2s
- Page transitions: 0.15-0.25s
- Lighthouse score: ~90

### User Experience Goals
- ✅ No blank screens during navigation
- ✅ Content appears < 200ms
- ✅ Smooth, jank-free animations
- ✅ Works well on slow networks (3G)
- ✅ Feels instant and responsive

---

## 🆘 Common Issues

### "Middleware cache causing stale data"
**Solution**: Reduce TTL from 5 min to 1 min, or invalidate on auth changes

### "Suspense causing hydration errors"
**Solution**: Ensure client/server components are properly separated

### "Page still feels slow after changes"
**Solution**: Check Network tab for slow API calls, may need database indexes

### "Build size increased"
**Solution**: Run bundle analyzer: `ANALYZE=true npm run build`

---

## 📚 Full Documentation

For detailed explanations, code examples, and advanced optimization:

👉 **[Read Full Performance Optimization Guide](./PERFORMANCE_OPTIMIZATION.md)**

The full guide includes:
- Detailed problem analysis with metrics
- Multiple solution approaches per issue
- Complete code examples
- Migration strategies
- Database optimization queries
- Advanced techniques (PWA, service workers)
- 4-phase implementation roadmap

---

## 🤝 Need Help?

1. **Check the full guide**: Most questions answered there
2. **Next.js Docs**: https://nextjs.org/docs/app/building-your-application/optimizing
3. **Supabase Performance**: https://supabase.com/docs/guides/database/performance
4. **Team Slack/Discord**: Ask in #performance channel

---

**Last Updated**: 2025-12-30  
**Quick Start Version**: 1.0  
**Estimated Time to Complete**: 3 days for 90% improvement
