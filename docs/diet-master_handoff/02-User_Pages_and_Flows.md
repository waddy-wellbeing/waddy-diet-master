# User Pages, Scenarios & Functionality

The application is structured using Next.js route groups to separate concerns: `(marketing)` for public-facing auth, `(app)` for the authenticated user experience, and dedicated onboarding flows.

## 1. Authentication & Marketing (`app/(marketing)`)

### Pages
- **/login:** Standard user login form.
- **/signup:** User registration page.
- **/forgot-password & /update-password:** Account recovery flow.

### User Scenarios
- **Scenario:** A new user lands on the app and registers. Upon successful registration, a database trigger automatically creates a `profiles` record for them. They are then directed to the onboarding flow.

## 2. Onboarding Flow (`app/get-started` & `app/onboarding`)

### Functionality
The onboarding flow gathers essential user data to initialize their profile, nutrition targets, and dietary preferences. It utilizes stateful wizards with rich UI components (`framer-motion` for transitions, custom selectors like `visual-select.tsx`, `chip-select.tsx`).

### User Scenarios
- **Scenario:** A user completes the multi-step wizard. The system captures their physical attributes, goals (e.g., weight loss, maintenance), and dietary restrictions (e.g., vegan, gluten-free). This data is persisted as JSONB in the `profiles` table under `basic_info`, `targets`, and `preferences`.

## 3. Core Application (`app/(app)`)

### Dashboard (`/dashboard`)
- **Functionality:** The main hub. It checks the user's settings and can render either standard dashboard components or a specialized `fasting-dashboard-content.tsx` (e.g., for Ramadan). It displays daily progress, adherence scores, and quick actions.
- **Scenarios:** A user logs in and sees their daily macronutrient progress against their targets. During fasting periods, the UI shifts to emphasize Suhoor and Iftar timings and meals.

### Meal Builder (`/meal-builder`)
- **Functionality:** An interactive interface to create or customize meals. It integrates with the ingredients and recipes database.
- **Scenarios:** A user wants to log a custom meal. They search for ingredients, adjust serving sizes (handling dynamic macro recalculations), and save the compilation to their daily log.

### Nutrition (`/nutrition`)
- **Functionality:** Detailed analytics and charts regarding the user's nutritional intake over time.

### Daily Plans (`/plans`)
- **Functionality:** Displays the user's assigned or generated daily meal plan.
- **Scenarios:** A user views their plan for tomorrow, sees recommended recipes, and can mark meals as consumed, which updates their `daily_logs`.

### Recipes (`/recipes/[id]`)
- **Functionality:** Detailed view of a specific recipe, including ingredients, instructions, and macro breakdown per serving. Features sharing capabilities (`/r/[id]` acts as a shortlink router).

### Profile & Settings (`/profile`)
- **Functionality:** Allows the user to update their onboarding data, toggle fasting modes (`fasting-mode-toggle.tsx`), and manage account settings.

## 4. Shared User Components
- **Floating Widget:** A sticky action button/widget available across the app for quick actions (e.g., quick logging).
- **Push Notification Prompt:** Asks for browser notification permissions to send reminders for meals or water intake.

## 5. Handoff Note for Future Architects
The user experience heavily relies on JSONB structures for flexibility (e.g., dynamic meal structures). When rebuilding:
- **State Management:** The current app likely relies on server state + React context/hooks. A new SPA might require robust state management (Redux, Zustand) to handle complex flows like the Meal Builder.
- **Offline/PWA:** The presence of `public/sw.js` indicates PWA capabilities. Ensure the new system accounts for service workers and offline caching if this functionality is critical.
