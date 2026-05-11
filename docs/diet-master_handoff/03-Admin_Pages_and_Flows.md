# Admin Pages & Functionality

The admin portal (`app/admin/*`) provides comprehensive tools for managing the platform's data, users, and system behavior. Access to these routes is protected by authentication checks enforcing the `admin` or `moderator` roles.

## 1. Content Management

### Ingredients (`/admin/ingredients`)
- **Functionality:** A CRUD interface for the core food database.
- **Features:** Includes a data table (`ingredients-table.tsx`), an ingredient form dialog for creating/editing, and bulk operations. Ingredients contain precise macro and micro-nutritional data per defined serving size.

### Spices (`/admin/spices`)
- **Functionality:** Management of common spices and condiments. Since spices often contribute negligible macros but are essential for recipe logic, they are managed in a separate reference table.

### Recipes (`/admin/recipes`)
- **Functionality:** A complex builder for system recipes.
- **Features:** Admins can define meal types, cuisines, difficulty, and construct the recipe by linking ingredients and specifying quantities. It includes an image upload utility (`recipe-image-upload.tsx`) that integrates with the optimization pipeline.

## 2. User & Plan Management

### Users (`/admin/users`)
- **Functionality:** Directory of all registered users. Admins can view user details, modify roles, and access deep-links into specific user profiles (`/admin/users/[userId]`).

### Plans (`/admin/plans`)
- **Functionality:** An interface to review, generate, and assign daily plans to users.
- **Features:** Integrates with `plan-assignment-dialog.tsx` to handle the assignment logic, moving a user's plan status from `pending_assignment` to `active`.

## 3. System Operations

### Settings (`/admin/settings`)
- **Functionality:** Management of global application parameters (e.g., default macro distribution, system-wide toggles).
- **Storage:** Persisted in the `system_settings` table using key-value JSONB pairs.

### Notifications (`/admin/notifications`)
- **Functionality:** Dashboard for triggering manual push notifications and viewing notification engagement analytics.

### Test Console (`/admin/test-console`)
- **Functionality:** A suite of internal tools for admins and developers to simulate and debug complex logic without affecting real users.
- **Sub-tools:**
  - `meal-planner`: Tests the algorithmic generation of meal plans.
  - `swaps`: Tests the logic for recommending ingredient or recipe alternatives.
  - `tdee-calculator`: Verifies the Total Daily Energy Expenditure math.
  - `full-tester`: Runs comprehensive end-to-end logic checks.

## 4. Handoff Note for Future Architects
The Admin portal is heavily data-driven. When migrating:
- **Validation:** Rely on the existing Zod schemas (found in `lib/validators/` or embedded in components) to understand the strict data requirements for ingredients and recipes.
- **Test Console Logic:** The `test-console` is a goldmine for understanding the core business logic (how meals are planned, how calories are calculated). Extract the logic tested here to build the new system's unit and integration tests.
