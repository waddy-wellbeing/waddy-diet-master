# Admin Panel Roadmap

> **Last updated:** 2025-11-29
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

## Phase 3: Ingredients Module ✅ COMPLETE

### Goals
- Full CRUD for ingredients
- Macro/micro editing with exceptional UX
- Search, filter, pagination

### Tasks

| Task | Status | Notes |
|------|--------|-------|
| Ingredient list with DataTable | ✅ Complete | Sortable, searchable, paginated |
| Create ingredient dialog | ✅ Complete | Tabbed modal (Basic, Macros, Micros) |
| Edit ingredient dialog | ✅ Complete | Pre-populated form with useEffect reset |
| Delete with confirmation | ✅ Complete | Confirmation dialog |
| Inline search & filters | ✅ Complete | By name, food group filter |
| Loading skeletons | ✅ Complete | Suspense with skeleton component |
| Toast notifications | ✅ Complete | Using sonner for success/error |
| Admin RLS policies | ✅ Complete | Migration 002 for admin bypass |

### Files Created
- `lib/validators/ingredients.ts` - Zod schemas
- `lib/actions/ingredients.ts` - Server actions
- `components/admin/ingredients-table.tsx` - DataTable component
- `components/admin/ingredient-form-dialog.tsx` - Create/edit modal

---

## Phase 3.5: Spices Module ✅ COMPLETE

### Goals
- Simple CRUD for spices
- Alias management with tag input

### Tasks

| Task | Status | Notes |
|------|--------|-------|
| Spice list with DataTable | ✅ Complete | Same patterns as ingredients |
| Create/edit spice dialog | ✅ Complete | Name EN/AR, aliases as tags |
| Delete with confirmation | ✅ Complete | Confirmation dialog |
| Search & pagination | ✅ Complete | Consistent with ingredients |

### Files Created
- `lib/validators/spices.ts` - Zod schemas
- `lib/actions/spices.ts` - Server actions
- `components/admin/spices-table.tsx` - DataTable component
- `components/admin/spice-form-dialog.tsx` - Create/edit modal

---

## Phase 4: Recipes Module 🔄 IN PROGRESS

### Goals
- Full CRUD for recipes
- Ingredient picker with nutrition calculation
- Image URL management
- Multi-step instructions

### Tasks

| Task | Status | Notes |
|------|--------|-------|
| Recipe validator schema | ✅ Complete | `lib/validators/recipes.ts` with constants |
| Recipe server actions | ✅ Complete | CRUD + search functions |
| Recipe list with search/filter | ✅ Complete | DataTable with pagination, filters |
| Debounce hook utility | ✅ Complete | `lib/hooks/use-debounce.ts` |
| Ingredient picker component | ✅ Complete | Search ingredients/spices with debounce |
| Recipe create/edit form | ✅ Complete | 4-tab dialog (Basic, Ingredients, Instructions, Nutrition) |
| Recipe page integration | ✅ Complete | Server-side data fetching with Suspense |
| Dietary flags display | ✅ Complete | Badge icons for vegan/vegetarian/GF/DF |
| Auto-calculate nutrition | 🔲 Todo | Sum from ingredients based on quantity |
| Image URL input | ✅ Complete | Text input for cover image URL |
| Recipe preview | 🔲 Todo | Card preview in modal |

### Files Created
- `lib/validators/recipes.ts` - Zod schemas, MEAL_TYPES, CUISINES, DIFFICULTIES constants
- `lib/actions/recipes.ts` - Server actions (CRUD + getCuisines + searchIngredients/Spices)
- `lib/hooks/use-debounce.ts` - Debounced callback and value hooks
- `components/admin/recipes-table.tsx` - DataTable with filters and dietary badges
- `components/admin/recipe-form-dialog.tsx` - Multi-tab create/edit modal
- `components/admin/ingredient-picker.tsx` - Ingredient/spice search component

### Schema Reference
```typescript
interface Recipe {
  id: string
  name: string
  description: string | null
  image_url: string | null
  meal_type: string[]        // breakfast, lunch, dinner, snack
  cuisine: string | null
  tags: string[]
  prep_time_minutes: number | null
  cook_time_minutes: number | null
  servings: number
  difficulty: string | null  // easy, medium, hard
  ingredients: RecipeIngredient[]  // JSONB
  instructions: RecipeInstruction[] // JSONB
  nutrition_per_serving: RecipeNutrition // JSONB
  is_vegetarian: boolean
  is_vegan: boolean
  is_gluten_free: boolean
  is_dairy_free: boolean
  admin_notes: string | null
  created_by: string | null
  is_public: boolean
}
```

---

## Phase 4.5: Recipe Ingredients Refactor 🚨 URGENT

### Problem
JSONB ingredients in recipes table has no referential integrity:
- Cannot enforce FK relationships
- Duplicate ingredients possible in same recipe
- Orphaned references to non-existent ingredients
- Hard to query "which recipes use ingredient X?"
- No database-level validation

### Solution
New `recipe_ingredients` junction table with proper FKs + recipe validation status.

### Tasks

| Task | Status | Notes |
|------|--------|-------|
| Create migration file | ✅ Complete | `004_recipe_ingredients_table.sql` |
| Add recipe status enum | ✅ Complete | draft, complete, needs_review, error |
| Add validation_errors JSONB | ✅ Complete | Array of error objects |
| Create recipe_ingredients table | ✅ Complete | Proper FKs to ingredients/spices |
| Create migration function | ✅ Complete | `migrate_recipe_ingredients()` |
| Create unmatched view | ✅ Complete | `unmatched_ingredients_view` |
| Create match function | ✅ Complete | `match_recipe_ingredient()` |
| Run migration in Supabase | 🔲 Todo | Execute SQL in dashboard |
| Run data migration | 🔲 Todo | `SELECT * FROM migrate_recipe_ingredients()` |
| Update recipe actions | 🔲 Todo | Use new table instead of JSONB |
| Create ingredient matcher UI | 🔲 Todo | Admin page to fix unmatched |
| Add missing ingredients | 🔲 Todo | From unmatched-recipes.csv |

### New Database Schema

```sql
-- Recipe status for validation
CREATE TYPE recipe_status AS ENUM ('draft', 'complete', 'needs_review', 'error');

-- Junction table with referential integrity
CREATE TABLE recipe_ingredients (
  id UUID PRIMARY KEY,
  recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES ingredients(id) ON DELETE SET NULL,
  spice_id UUID REFERENCES spices(id) ON DELETE SET NULL,
  raw_name TEXT NOT NULL,
  quantity DECIMAL(10, 2),
  unit VARCHAR(50),
  is_spice BOOLEAN NOT NULL DEFAULT FALSE,
  is_optional BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_matched BOOLEAN NOT NULL DEFAULT FALSE,
  -- Unique constraint prevents duplicates
  UNIQUE(recipe_id, ingredient_id) WHERE ingredient_id IS NOT NULL
);
```

### Missing Ingredients from CSV
These ingredients need to be added to the database:
- كعك الارز (Rice Cakes)
- بابريكا (Paprika) - should be spice
- بكينج بودر/باودر (Baking Powder)
- مكعبات ثلج (Ice Cubes) - may not need nutrition
- توت (Berries)
- كبدة بقري/دجاج (Beef/Chicken Liver)
- بهارات شاورما (Shawarma Spices)
- بهارات تندوري (Tandoori Spices)
- بهارات فراخ (Chicken Spices)
- توابل سمك (Fish Spices)
- سبع بهارات (Seven Spices)
- أوريجانو (Oregano)
- مرقة دجاج/لحم (Chicken/Beef Broth)
- كريمة طهي (Cooking Cream)
- عجينة جلاش (Filo/Phyllo Dough)
- عيش تورتيلا (Tortilla Bread)
- صلصة طماطم (Tomato Sauce)

---

## Phase 5: Users Module 🔲 TODO

### Goals
- User list with role management
- Profile viewing

### Tasks

| Task | Status | Notes |
|------|--------|-------|
| User list with search | 🔲 Todo | DataTable with roles |
| Role management | 🔲 Todo | Admin can change user roles |
| Profile detail view | 🔲 Todo | View user info, targets |

---

## Phase 6: Polish & Deploy 🔲 TODO

### Goals
- Responsive testing
- Performance optimization
- Documentation

### Tasks

| Task | Status | Notes |
|------|--------|-------|
| Mobile responsive | 🔲 Todo | Test on various screens |
| Error boundaries | 🔲 Todo | Graceful error handling |
| Loading states | 🔲 Todo | All async ops covered |
| README updates | 🔲 Todo | Document admin features |

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
| **Toasts** | sonner for notifications |

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
| 2025-11-28 | Completed Phase 3: Ingredients CRUD with full DataTable experience |
| 2025-11-28 | Fixed ingredient form bindings (useEffect reset, micros field names) |
| 2025-11-28 | Added subgroup column, created admin RLS policies migration |
| 2025-11-29 | Completed Phase 3.5: Spices CRUD matching ingredients experience |
| 2025-11-29 | Started Phase 4: Recipes Module |
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
