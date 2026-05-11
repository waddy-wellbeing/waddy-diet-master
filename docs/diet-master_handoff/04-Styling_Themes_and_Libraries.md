# Styling, Themes, and UI Libraries

BiteRight utilizes a highly modern, utility-first styling approach combined with headless UI primitives to deliver a customized and accessible user experience.

## 1. Styling Architecture: Tailwind CSS v4
- The project uses **Tailwind CSS v4**, configured primarily through `@tailwindcss/postcss` and standard CSS imports (`app/globals.css`).
- **Theming via CSS Variables:** Instead of hardcoding hex values in Tailwind config, the application uses CSS variables defined in `globals.css` (e.g., `--primary`, `--background`, `--muted`). This allows for seamless theme switching (Light/Dark mode) and dynamic branding changes.
- **Utility Classes:** Styling is co-located with component logic using Tailwind utility classes, merged cleanly using `tailwind-merge` and `clsx` via a utility function (typically `cn(...)` in `lib/utils.ts`).

## 2. UI Component Library: Shadcn UI Pattern
The application does not use a monolithic, pre-compiled UI framework (like MUI or Ant Design). Instead, it uses the **Shadcn UI** approach:
- **Primitives:** It relies on `@radix-ui/react-*` libraries (Dialog, Select, Tabs, Popover, etc.) for accessible, unstyled foundation components.
- **Ownership:** The customized components reside directly in the codebase under `components/ui/` (e.g., `button.tsx`, `dialog.tsx`, `input.tsx`).
- **Variants:** Components like Buttons and Badges use `class-variance-authority` (CVA) to define distinct visual variants (e.g., `default`, `destructive`, `outline`, `ghost`) and sizes.

## 3. Forms and Validation
- **React Hook Form:** The standard for handling form state, preventing unnecessary re-renders, and managing complex nested inputs (like the recipe builder or onboarding wizard).
- **Zod Integration:** Forms are strongly typed and validated using `@hookform/resolvers/zod`. Zod schemas act as the single source of truth for data shape, shared between client-side form validation and server-side request validation.

## 4. Animation and Interactivity
- **Framer Motion (`framer-motion`):** Used for fluid, physics-based animations. Examples include the step transitions in the onboarding flow, expanding floating widgets, and smooth list reordering.
- **Tailwind Animate (`tw-animate-css`):** Provides utility classes for simpler, CSS-based keyframe animations (like standard fades or slide-ins used in dialogs).

## 5. Icons and Assets
- **Lucide React:** The primary icon set. It is an open-source, customizable SVG icon library that matches the modern aesthetic of Radix/Shadcn.
- **SVGs:** Custom graphics (like `ramadan-badge.tsx` or general illustrations) are used inline or stored in `/public`.

## 6. Handoff Note for Future Architects
- **Replicability:** Because the UI components are owned by the codebase (`components/ui/`), migrating the UI to another React-based framework (e.g., a standard Vite SPA) is simply a matter of copying the `components/ui` folder, `lib/utils.ts`, and `tailwind.config` / `globals.css`.
- **Non-React Migration:** If migrating to Angular, Vue, or Flutter, the design tokens (CSS variables in `globals.css`) and variant logic (from CVA) will serve as the exact specification for rebuilding the component library in the new framework.
