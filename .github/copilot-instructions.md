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
- `nutri_foods` - Food database with JSONB: `macros`, `micros`
- `nutri_recipes` - Recipes with JSONB: `ingredients`, `instructions`, `nutrition_per_serving`
- `nutri_daily_plans` - Meal plans with JSONB: `plan`, `daily_totals`
- `nutri_daily_logs` - Food logging with JSONB: `log`, `logged_totals`

**RLS is enabled on all tables** - users can only access their own data. Public foods/recipes use `is_public` flag.

### JSONB Pattern
Flexible fields use JSONB for extensibility. Example structure for `nutri_profiles.targets`:
```json
{ "calories": 1800, "protein_g": 120, "carbs_g": 180, "fat_g": 60 }
```

## Code Patterns

### Import Aliases
Use `@/` alias for absolute imports (configured in `tsconfig.json`):
```typescript
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
```

### UI Components (shadcn/ui)
- Located in `components/ui/` - use "new-york" style variant
- Add new components via: `npx shadcn@latest add <component>`
- Use `cn()` from `lib/utils.ts` for className merging:
```typescript
className={cn("base-styles", conditional && "conditional-styles", className)}
```

### Supabase Client
Use the SSR client pattern from `lib/supabase.ts`:
```typescript
import { createClient } from "@/lib/supabase"
const supabase = createClient()
```

## File Organization

| Directory | Purpose |
|-----------|---------|
| `components/ui/` | shadcn/ui base components |
| `components/layout/` | Layout components (headers, navs) |
| `components/onboarding/` | Onboarding flow components |
| `components/recipes/` | Recipe-related components |
| `lib/validators/` | Zod schemas for validation |
| `lib/utils/` | Utility functions |
| `supabase/functions/` | Supabase Edge Functions |

## Development Commands
```bash
npm run dev    # Start dev server at localhost:3000
npm run build  # Production build
npm run lint   # Run ESLint
```

## Key Conventions

1. **Mobile-first design** - All components should be designed for mobile first with responsive breakpoints
2. **Optimistic UI** - Use React state for immediate feedback, sync with server in background
3. **Type safety** - Use TypeScript strictly, define types for all JSONB structures
4. **Meal types** - Use consistent naming: `breakfast`, `lunch`, `dinner`, `snacks`
5. **Date handling** - Plans and logs use `DATE` type keyed by `user_id + date`

## Documentation
- `docs/main/architecture.md` - System architecture and design decisions
- `docs/main/user-story.md` - Primary user persona and journey
- `docs/main/scenarios.md` - Detailed user flows and scenarios
