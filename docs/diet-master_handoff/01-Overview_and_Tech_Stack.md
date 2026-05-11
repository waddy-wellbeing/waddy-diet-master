# BiteRight Application Overview & Tech Stack

## 1. Application Overview
BiteRight is a comprehensive meal planning, nutrition tracking, and recipe management application. It provides personalized daily plans, accommodates fasting schedules (e.g., Ramadan), supports detailed ingredient/recipe databases, and includes robust administrative tools for content management and analytics.

## 2. Architecture Approach
The system follows a modern monolithic architecture using the **Next.js App Router (React 19)**. The frontend and backend logic (Server Actions) are co-located within the Next.js project.

### Core Paradigms
- **Server-Side Rendering & React Server Components (RSC):** Utilized heavily via Next.js App Router to reduce client-side JavaScript and improve performance.
- **Server Actions:** All data mutations and complex business logic execute on the server using Next.js Server Actions (found in `lib/actions/`). This acts as the backend API layer without needing traditional REST endpoints.
- **Direct Database Access:** Next.js Server Components and Server Actions communicate directly with the Supabase PostgreSQL database using the Supabase SSR client.

## 3. Technology Stack

### Frontend
- **Framework:** Next.js (version 16.0.10) with App Router.
- **UI Library:** React (version 19).
- **Language:** TypeScript.
- **Styling:** Tailwind CSS (v4) paired with custom CSS variables for theming.
- **Component Library:** Radix UI primitives with a Shadcn UI implementation approach (customized, accessible, copy-paste components in `components/ui/`).
- **Form Management:** React Hook Form integrated with Zod for robust client and server-side validation.
- **Animations:** Framer Motion for smooth transitions and interactions.
- **Icons:** Lucide React.
- **Notifications:** Web Push for browser-native push notifications, plus Sonner for in-app toast notifications.

### Backend & Database
- **Database:** PostgreSQL (managed by Supabase).
- **Authentication:** Supabase Auth (integrated with Next.js SSR middleware).
- **Data Access:** Supabase JS Client (`@supabase/ssr` and `@supabase/supabase-js`).
- **Schema Management:** Supabase CLI / Migrations.
- **Push Notifications:** Node `web-push` library running in Next.js API routes or Server Actions.
- **Image Processing:** `sharp` for server-side image optimization before uploading to storage.

## 4. Key Libraries and Dependencies
- `@supabase/ssr`: For managing authentication sessions across Next.js Server Components, Actions, and Client Components.
- `zod`: Schema declaration and validation library, used extensively for API payload validation and form validation.
- `framer-motion`: Handles complex UI state transitions (e.g., onboarding flows, floating widgets).
- `date-fns`: Date manipulation and formatting.
- `cmdk`: Command menu (often used for comboboxes and complex searchable select inputs).
- `class-variance-authority` (cva) & `tailwind-merge` / `clsx`: Used together to build robust, scalable component variants in Tailwind.

## 5. Handoff Note for Future Architects
When migrating this application to a new solution suite:
1. **Routing:** The Next.js file-system based routing (e.g., `(app)`, `(marketing)`, `admin`) will need to be mapped to the new framework's routing paradigm.
2. **Data Fetching:** The heavy reliance on React Server Components means data is fetched directly at the page level. In a detached frontend/backend architecture (like React SPA + Java/Go backend), these will become dedicated API endpoints.
3. **Server Actions:** Files in `lib/actions/` represent the core backend controllers and services. These functions should be translated into the backend service layer of the new system.
