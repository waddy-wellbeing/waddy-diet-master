# BiteRight - Copilot Instructions

## Project Overview
BiteRight is a personalized nutrition app built with Next.js 16 (App Router), TypeScript, Tailwind CSS 4, and Supabase. The app helps users plan meals, track nutrition, and achieve health goals.

## Architecture

### Route Groups
- `app/(marketing)/` - Public pages (landing, about) with lightweight layout
- `app/(app)/` - Authenticated app routes: `dashboard/`, `onboarding/`, `recipes/`, `plans/`

Use **Server Components by default**. Only use Client Components (`"use client"`) when interactivity is required.

### Database Schema (`supabase/schema.sql`)
Tables are prefix-free for clarity:
- `profiles` - User profiles with JSONB: `basic_info`, `targets`, `preferences`, `goals`
- `ingredients` - Ingredient database with JSONB: `macros`, `micros` + optional `name_ar`, `food_group`, `subgroup`
- `spices` - Reference spices used when `ingredients.is_spice = true`
- `recipes` - Recipes with JSONB: `ingredients`, `instructions`, `nutrition_per_serving`, `admin_notes`
- `daily_plans` - Meal plans with JSONB: `plan`, `daily_totals`
- `daily_logs` - Food logging with JSONB: `log`, `logged_totals`

**RLS is enabled on all tables** - users can only access their own data. Public ingredients/recipes use `is_public` flag.

### JSONB Patterns
Flexible fields use JSONB for extensibility. See `lib/types/nutri.ts` for all TypeScript interfaces:
```typescript
import type { ProfileTargets, RecipeIngredient, DailyPlan } from '@/lib/types/nutri'
```

## Code Patterns

### Import Aliases
Use `@/` alias for absolute imports (configured in `tsconfig.json`):
```typescript
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
```

### Supabase Clients
Use the appropriate client based on component type:
```typescript
// Server Components, Server Actions, Route Handlers
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient()

// Client Components ("use client")
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()
```

### UI Components (shadcn/ui)
- Located in `components/ui/` - use "new-york" style variant
- Add new components via: `npx shadcn@latest add <component>`
- Use `cn()` from `lib/utils.ts` for className merging:
```typescript
className={cn("base-styles", conditional && "conditional-styles", className)}
```

## File Organization

| Directory | Purpose |
|-----------|---------|
| `app/admin/` | Admin panel routes (recipes, ingredients, settings, test-console) |
| `app/(app)/` | Authenticated user routes (dashboard, onboarding, recipes, plans) |
| `app/(marketing)/` | Public marketing pages |
| `app/api/` | API routes (uploads, etc.) |
| `components/ui/` | shadcn/ui base components |
| `components/admin/` | Admin panel components |
| `components/layout/` | Layout components (headers, navs) |
| `components/onboarding/` | Onboarding flow components |
| `components/recipes/` | Recipe-related components |
| `lib/types/` | TypeScript types (especially `nutri.ts` for DB types) |
| `lib/supabase/` | Supabase client utilities (server.ts, client.ts) |
| `lib/actions/` | Server actions for data mutations |
| `lib/validators/` | Zod schemas for validation |
| `lib/utils/` | Utility functions |
| `scripts/` | Utility scripts (audits, migrations) |
| `supabase/migrations/` | SQL migration files |
| `supabase/functions/` | Supabase Edge Functions |
| `docs/working/` | Planning documents and working notes |

## Development Commands
```bash
npm install  # Install dependencies (including @supabase/ssr)
npm run dev  # Start dev server at localhost:3000
npm run build  # Production build
npm run lint  # Run ESLint
```

## Key Conventions

1. **Mobile-first design** - All components designed for mobile first with responsive breakpoints
2. **Optimistic UI** - Use React state for immediate feedback, sync with server in background
3. **Type safety** - Use TypeScript strictly; import types from `@/lib/types/nutri`
4. **Meal types** - Use consistent naming: `breakfast`, `lunch`, `dinner`, `snacks`
5. **Date handling** - Plans and logs use `DATE` type keyed by `user_id + date`
6. **Recipe ingredients** - Use `{ ingredient_id, raw_name, quantity, unit, is_spice, is_optional }` structure

## Documentation
- `docs/main/architecture.md` - System architecture and design decisions
- `docs/main/database-erd.md` - Database ERD diagrams and JSONB structures
- `docs/main/user-story.md` - Primary user persona and journey
- `docs/main/scenarios.md` - Detailed user flows and scenarios

## Schema Change Checklist
When modifying the database schema, update these files:
1. `supabase/schema.sql` - The source of truth
2. `docs/main/database-erd.md` - ERD diagrams and JSONB examples
3. `lib/types/nutri.ts` - TypeScript interfaces
4. This file if major structural changes

## UI/UX & Performance Priorities

**Exceptional UI/UX is a top priority.** Follow these guidelines:

### Design Principles
1. **Delightful micro-interactions** - Smooth transitions, hover states, loading skeletons
2. **Consistent visual hierarchy** - Clear typography, spacing, and color usage
3. **Immediate feedback** - Optimistic updates, loading states, success/error toasts
4. **Accessibility first** - Proper ARIA labels, keyboard navigation, focus states
5. **Empty states** - Always design meaningful empty states with CTAs

### Performance Guidelines
1. **Server Components by default** - Only use `"use client"` when truly needed
2. **Suspense boundaries** - Wrap async components for streaming
3. **Image optimization** - Use Next.js Image component, WebP format, proper sizing
4. **Pagination** - Never load unbounded lists; use cursor or offset pagination
5. **Debounce search** - 300ms debounce on search inputs
6. **Skeleton loading** - Show content placeholders during data fetch
7. **Revalidation** - Use `revalidatePath` for cache invalidation after mutations

### Admin Panel Patterns
1. **Data tables** - Sortable columns, search, filters, pagination
2. **Forms** - Inline validation, disabled states during submit, clear error messages
3. **Modals** - For create/edit, with form reset on close
4. **Bulk actions** - Select multiple rows for batch operations
5. **Confirmation dialogs** - For destructive actions (delete)
