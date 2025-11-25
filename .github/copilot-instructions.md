# BiteRight - Copilot Instructions

## Project Overview
BiteRight is a personalized nutrition app built with Next.js 16 (App Router), TypeScript, Tailwind CSS 4, and Supabase. The app helps users plan meals, track nutrition, and achieve health goals.

## Architecture

### Route Groups
- `app/(marketing)/` - Public pages (landing, about) with lightweight layout
- `app/(app)/` - Authenticated app routes: `dashboard/`, `onboarding/`, `recipes/`, `plans/`

Use **Server Components by default**. Only use Client Components (`"use client"`) when interactivity is required.

### Database Schema (`supabase/schema.sql`)
All tables are prefixed with `nutri_`:
- `nutri_profiles` - User profiles with JSONB: `basic_info`, `targets`, `preferences`, `goals`
- `nutri_foods` - Food database with JSONB: `macros`, `micros` + optional `name_ar`, `food_group`, `subgroup`
- `nutri_recipes` - Recipes with JSONB: `ingredients`, `instructions`, `nutrition_per_serving`
- `nutri_daily_plans` - Meal plans with JSONB: `plan`, `daily_totals`
- `nutri_daily_logs` - Food logging with JSONB: `log`, `logged_totals`

**RLS is enabled on all tables** - users can only access their own data. Public foods/recipes use `is_public` flag.

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
| `components/ui/` | shadcn/ui base components |
| `components/layout/` | Layout components (headers, navs) |
| `components/onboarding/` | Onboarding flow components |
| `components/recipes/` | Recipe-related components |
| `lib/types/` | TypeScript types (especially `nutri.ts` for DB types) |
| `lib/supabase/` | Supabase client utilities (server.ts, client.ts) |
| `lib/validators/` | Zod schemas for validation |
| `lib/utils/` | Utility functions |
| `supabase/functions/` | Supabase Edge Functions |

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
6. **Recipe ingredients** - Use `{ food_id, raw_name, quantity, unit, is_spice, is_optional }` structure

## Documentation
- `docs/main/architecture.md` - System architecture and design decisions
- `docs/main/user-story.md` - Primary user persona and journey
- `docs/main/scenarios.md` - Detailed user flows and scenarios
