# BiteRight Architecture

## Overview

BiteRight is built as a modern web application using Next.js App Router with a Supabase backend. The architecture is designed to be simple, maintainable, and extensible for future B2B features.

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | Next.js 14+ (App Router) | React framework with SSR/SSG |
| Language | TypeScript | Type safety and better DX |
| Styling | Tailwind CSS | Utility-first CSS |
| UI Components | shadcn/ui | Accessible, customizable components |
| Backend | Supabase | Postgres, Auth, Storage, Edge Functions |
| Database | PostgreSQL (via Supabase) | Relational data with JSONB for flexibility |

---

## Project Structure

```
bite-right/
├── app/                          # Next.js App Router
│   ├── (marketing)/              # Public pages (landing, about)
│   ├── (app)/                    # Authenticated app
│   │   ├── dashboard/            # Main dashboard
│   │   ├── onboarding/           # Onboarding flow
│   │   ├── recipes/              # Recipe browsing
│   │   └── plans/                # Meal plans
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Home page
├── components/
│   ├── ui/                       # shadcn/ui components
│   ├── layout/                   # Layout components
│   ├── recipes/                  # Recipe components
│   └── onboarding/               # Onboarding components
├── lib/
│   ├── supabase.ts               # Supabase client
│   ├── validators/               # Zod schemas
│   └── utils/                    # Utility functions
├── supabase/
│   ├── schema.sql                # Database schema
│   └── functions/                # Edge functions
└── docs/
    ├── main/                     # Core documentation
    └── working/                  # Working notes
```

---

## Database Design

### Tables (all prefixed with `nutri_`)

| Table | Purpose | Key JSONB Fields |
|-------|---------|------------------|
| `nutri_profiles` | User profiles, targets, preferences | `basic_info`, `targets`, `preferences`, `goals` |
| `nutri_foods` | Food database | `macros`, `micros` |
| `nutri_recipes` | Recipe collection | `ingredients`, `instructions`, `nutrition_per_serving` |
| `nutri_daily_plans` | Daily meal plans | `plan`, `daily_totals` |
| `nutri_daily_logs` | Food logging | `log`, `logged_totals` |

### JSONB Strategy

We use JSONB columns for:
1. **Flexibility**: Easy to add new fields without migrations
2. **Nested data**: One-to-many relationships that don't need separate joins
3. **Extensibility**: Future B2B features can add trainer-specific fields

### Row Level Security

All tables have RLS policies:
- Users can only access their own data
- Public foods/recipes are visible to all
- User-created content is private by default

---

## Authentication Flow

1. User signs up via Supabase Auth
2. Trigger creates `nutri_profiles` record
3. User is redirected to onboarding
4. After onboarding, user accesses main app

---

## Key Design Decisions

### 1. Route Groups
Using Next.js route groups `(marketing)` and `(app)` to:
- Separate public and authenticated layouts
- Keep marketing pages lightweight
- Apply auth middleware only where needed

### 2. Server Components by Default
- Use Server Components for data fetching
- Client Components only for interactivity
- Reduces bundle size and improves performance

### 3. Optimistic UI
- Use React state for immediate feedback
- Sync with server in background
- Show loading states for longer operations

### 4. Mobile-First Design
- All components designed for mobile first
- Responsive breakpoints for tablet/desktop
- Touch-friendly interaction patterns

---

## Future B2B Extension Points

The architecture supports future trainer/nutritionist features:

1. **Multi-tenancy**: Add `organization_id` to tables
2. **Client Management**: Trainers can view client profiles
3. **Custom Plans**: Trainers assign plans to clients
4. **White-labeling**: Custom branding per organization
5. **Analytics**: Aggregate insights across clients

---

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# App
NEXT_PUBLIC_APP_URL=
```

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2024-11-25 | 1.0 | Initial architecture document |
