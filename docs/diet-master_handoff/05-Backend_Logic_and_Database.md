# Backend Logic, Architecture & Database

BiteRight operates without a traditional detached backend. Instead, it leverages Next.js Server Actions backed by a PostgreSQL database managed via Supabase.

## 1. Database Architecture (PostgreSQL / Supabase)

### Core Schema Design
The database utilizes a hybrid approach: strong relational integrity for core entities, combined with `JSONB` columns for high-flexibility data.

**Key Tables:**
- `profiles`: Linked to `auth.users` via a trigger (`handle_new_user`). Uses JSONB for `basic_info`, `targets`, `preferences`, and `goals`.
- `ingredients`: Master food database. Uses JSONB for `macros` and `micros`.
- `recipes`: Uses JSONB for `ingredients` (arrays of ingredient IDs + quantities) and `instructions`. Includes array columns for `tags`, `meal_type`, and `recommendation_group` (used for themed suggestions like Ramadan).
- `daily_plans`: Stores generated meal plans. The entire plan structure for a given day is saved as a JSONB payload (`plan` for regular mode, `fasting_plan` for fasting mode), ensuring historical plans remain immutable even if underlying recipes change.
- `daily_logs`: User tracking data. JSONB is used to store the flexible structure of what a user actually consumed.
- `analytics_*`: A robust suite of tables (`analytics_sessions`, `analytics_events`, `analytics_error_logs`, `analytics_page_views`) to track usage, engagement, and system health.

### Row Level Security (RLS)
The database enforces security at the PostgreSQL level.
- **Profiles/Plans/Logs:** Users can only SELECT/INSERT/UPDATE their own records (`auth.uid() = user_id`).
- **Admin Override:** A custom PL/pgSQL function `is_admin_or_moderator()` bypasses standard user checks, allowing admins full access.
- **Public Data:** Ingredients and recipes have `is_public` flags. Regular users can read public items; only admins or the creator can edit them.

## 2. Server Actions (The "Backend API")

Located in `lib/actions/`, these functions execute exclusively on the server. They handle business logic, database mutations, and external API calls.

### Key Logic Domains
- `meal-planning.ts` / `fasting-plans.ts`: **Core Algorithmic Logic.** These files contain the logic to generate daily meal plans. They read a user's `targets` and `preferences` from their profile, query matching `recipes`, and construct a JSONB daily plan that meets the macro/micro requirements. The fasting variant adjusts timing and meal distribution.
- `recipes.ts` / `ingredients.ts`: Handle CRUD operations for the food database, including calculating aggregated nutritional info when a recipe is created or updated.
- `analytics.ts` / `notification-analytics.ts`: Ingest telemetry data from the client, formatting and inserting it into the `analytics_*` tables.
- `audit.ts`: Likely contains logic to verify database integrity (e.g., ensuring all recipe ingredients exist, image links are valid).

### Logic Example (Conceptual Flow)
*Generating a Meal Plan:*
1. **Input:** User ID and Target Date.
2. **Fetch:** Retrieve User Profile (Targets, Preferences).
3. **Filter:** Query the `recipes` table, filtering out allergies and ensuring the `recommendation_group` aligns with the user's goals.
4. **Calculate:** Iterate through combinations of breakfast, lunch, dinner, and snacks. Sum the macros from the JSONB data.
5. **Score:** Evaluate how closely the combination matches the user's target TDEE (Total Daily Energy Expenditure) and macro split.
6. **Save:** Serialize the best-fit combination into a JSON object and `INSERT` into `daily_plans`.

## 3. Background Processing & Utilities
- **Scripts (`/scripts`):** The repository contains several Node.js scripts used for database seeding (`seed-ingredients.ts`, `seed-recipes.ts`), data migration, and image optimization (`optimize-images.ts`, `audit-storage-images.ts`). These represent background jobs or admin CLI tools.
- **Push Notifications:** Handled by `web-push`. The backend stores subscription objects (likely in user profiles or settings) and triggers payloads via Server Actions.

## 4. Handoff Note for Future Architects
- **Migrating Logic:** The heavy use of Next.js Server Actions means the business logic is deeply integrated with TypeScript and the Next.js runtime context. When porting to a new backend (e.g., Java Spring, Go, Python FastAPI), you must translate the functions in `lib/actions/*` into standard REST or GraphQL endpoints.
- **JSONB Strategy:** The new database schema must either natively support JSON/JSONB (like PostgreSQL or MongoDB) or the highly flexible structures (like `daily_plans.plan`) will need to be normalized into complex relational tables (e.g., `PlanMeals`, `PlanMealItems`), which may significantly increase query complexity. It is highly recommended to retain PostgreSQL or a document-capable store.
