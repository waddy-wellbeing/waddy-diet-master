# Admin Panel Roadmap

> **Last updated:** 2025-11-28
> 
> This document tracks the implementation progress of the BiteRight admin panel.

---

## Phase 1: Authentication & Authorization ✅ COMPLETE

### Goals
- Implement Supabase Auth with login/signup
- Auto-create profile on user signup
- Role-based access control (admin, moderator, client)

### Tasks

| Task | Status | Notes |
|------|--------|-------|
| Update database schema (roles, triggers) | ✅ Complete | Added role enum, profile auto-trigger |
| Create `/login` page | ✅ Complete | Email/password login with react-hook-form |
| Create `/signup` page | ✅ Complete | No email confirmation required |
| Create auth middleware | ✅ Complete | Protects (app) and admin routes |
| Update Supabase client utilities | ✅ Complete | SSR auth with cookies |
| Create auth helper functions | ✅ Complete | lib/auth.ts with getUser, requireAdmin |

### Database Changes
```sql
-- Role enum
CREATE TYPE user_role AS ENUM ('admin', 'moderator', 'client');

-- Add role to profiles
ALTER TABLE profiles ADD COLUMN role user_role NOT NULL DEFAULT 'client';

-- Auto-create profile on signup trigger
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, role)
  VALUES (NEW.id, 'client');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
```

---

## Phase 2: Admin Layout & Navigation ✅ COMPLETE

### Goals
- Create admin route group with protected layout
- Sidebar navigation
- Dashboard overview page

### Tasks

| Task | Status | Notes |
|------|--------|-------|
| Create `app/admin/layout.tsx` | ✅ Complete | Sidebar, header, auth check |
| Create admin dashboard page | ✅ Complete | Stats overview with counts |
| Add shadcn components | ✅ Complete | Table, Dialog, Tabs, Select, Badge, etc. |
| Responsive design | ✅ Complete | Mobile sidebar sheet |
| Create placeholder pages | ✅ Complete | Recipes, Ingredients, Spices, Plans, Users |
| Add logout functionality | ✅ Complete | In sidebar component |

### Route Structure
```
app/admin/
├── layout.tsx              # Admin layout with sidebar
├── page.tsx                # Dashboard overview
├── recipes/
│   └── page.tsx            # Recipe management
├── ingredients/
│   └── page.tsx            # Ingredient management
├── spices/
│   └── page.tsx            # Spice management
├── plans/
│   └── page.tsx            # Meal plan analytics
└── users/
    └── page.tsx            # User management
```

---

## Phase 3: Recipes Module 🔲 TODO

### Goals
- Full CRUD for recipes
- Ingredient picker with nutrition calculation
- Image upload integration

### Tasks

| Task | Status | Notes |
|------|--------|-------|
| Recipe list with search/filter | 🔲 Todo | Table, pagination |
| Recipe create/edit form | 🔲 Todo | All fields, validation |
| Ingredient picker component | 🔲 Todo | Search, add, set quantity |
| Auto-calculate nutrition | 🔲 Todo | Sum from ingredients |
| Image upload | 🔲 Todo | Supabase Storage integration |
| Recipe preview | 🔲 Todo | User-facing view |

---

## Phase 4: Ingredients Module 🔲 TODO

### Goals
- Full CRUD for ingredients
- Macro/micro editing
- Bulk import

### Tasks

| Task | Status | Notes |
|------|--------|-------|
| Ingredient list with search | 🔲 Todo | Filter by food group |
| Ingredient create/edit form | 🔲 Todo | Macros, micros, serving |
| Bulk CSV import | 🔲 Todo | Upload & validate |
| Duplicate detection | 🔲 Todo | Warn on similar names |

---

## Phase 5: Spices Module 🔲 TODO

### Goals
- Simple CRUD for spices
- Alias management

### Tasks

| Task | Status | Notes |
|------|--------|-------|
| Spice list | 🔲 Todo | Simple table |
| Spice create/edit | 🔲 Todo | Name EN/AR, aliases |
| Merge duplicates | 🔲 Todo | Combine spices |

---

## Phase 6: Daily Plans Module 🔲 TODO (Stretch)

### Goals
- View user meal plans
- Analytics

### Tasks

| Task | Status | Notes |
|------|--------|-------|
| Plans overview | 🔲 Todo | List by date/user |
| Analytics dashboard | 🔲 Todo | Popular recipes, stats |

---

## Technical Decisions

| Area | Decision |
|------|----------|
| **UI Framework** | shadcn/ui components |
| **Forms** | React Hook Form + Zod |
| **Data Fetching** | Server Components + Server Actions |
| **Auth** | Supabase Auth with SSR |
| **Roles** | admin, moderator, client (stored in profiles.role) |
| **Admin Check** | Middleware checks role before allowing access |

---

## Progress Legend

- ✅ Complete
- 🔄 In Progress
- 🔲 Todo
- ❌ Blocked

---

## Changelog

| Date | Changes |
|------|---------|
| 2025-11-28 | Created roadmap, started Phase 1 (Auth) |
| 2025-11-28 | Completed Phase 1: login/signup pages, middleware, auth helpers |
| 2025-11-28 | ✅ Tested: signup creates profile, login works, middleware protects routes |
| 2025-11-28 | Completed Phase 2: admin layout, sidebar, dashboard, placeholder pages |
