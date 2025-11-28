This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Database Seeding

We ship curated CSV datasets for ingredients, spices, and recipes under `docs/datasets/`.

### Setup

1. **Configure environment** – copy `.env.local.example` to `.env.local` and fill:

	```env
	NEXT_PUBLIC_SUPABASE_URL=...
	NEXT_PUBLIC_SUPABASE_ANON_KEY=...
	SUPABASE_URL=...
	SUPABASE_ANON_KEY=...
	SUPABASE_SERVICE_ROLE_KEY=...   # keep private – needed for seeding
	```

### Available Commands

#### 1. Dry Run (Validation Only)
Validates FK lookups and shows what would be inserted/updated without touching the database:

```bash
npm run seed:dry-run
```

**Output includes:**
- Number of ingredients, spices, and recipes that would be inserted/updated
- List of duplicate names in CSV files
- Unmatched recipe ingredients with sample recipes
- FK validation summary with match rate
- Recipe image audit (counts missing assets in `docs/datasets/images`)

#### 2. Full Seed
Upserts all ingredients ➜ spices ➜ recipes using the service role key:

```bash
npm run seed
```

**What it does:**
- Upserts 742 ingredients into `ingredients`
- Upserts 75 spices into `spices`
- Upserts 453 recipes into `recipes` with FK resolution
- Sets `image_url` for each recipe when a matching image exists in `docs/datasets/images`
- Automatically calculates recipe nutrition from ingredients
- Flags spices and resolves ingredient → ingredient table relationships
- Any unmatched ingredients get `ingredient_id = null` and `admin_notes` listing missing items for admin review

#### 3. Skip Unmatched Mode
Seeds only recipes where **all ingredients match** ingredient records or spices:

```bash
npm run seed:skip-unmatched
```

**Use this when:**
- You want to seed clean data first
- Plan to fix unmatched ingredients separately
- Need to verify matched recipes work correctly

**Example workflow:**
1. Run `seed:dry-run` to see match rate
2. Run `seed:skip-unmatched` to load complete recipes
3. Fix unmatched ingredients in CSVs
4. Run `seed` again to load the rest

#### 4. Export Unmatched Recipes
Generates a CSV file with all unmatched recipe ingredients for manual fixing:

```bash
npm run seed:export-unmatched
```

**Output file:** `docs/datasets/unmatched-recipes.csv`

**CSV columns:**
- `Recipe Name` – which recipe contains the ingredient
- `Ingredient` – the unmatched ingredient name
- `Quantity` – amount needed
- `Unit` – measurement unit
- `Suggested Ingredient Name` – (empty, for you to fill)

**Workflow:**
1. Run `npm run seed:export-unmatched`
2. Open `docs/datasets/unmatched-recipes.csv`
3. Fill the "Suggested Ingredient Name" column with correct ingredient/spice names
4. Add missing ingredients to `food_dataset.csv` or `spices_dataset.csv`
5. Run `npm run seed` to load everything with proper FKs

### Two-Pass Seeding Strategy

For best results, use this approach:

```bash
# Step 1: Export unmatched ingredients for review
npm run seed:export-unmatched

# Step 2: Seed only recipes with complete ingredient matches
npm run seed:skip-unmatched

# Step 3: Fix unmatched ingredients in CSVs
# - Edit docs/datasets/unmatched-recipes.csv
# - Add missing items to food_dataset.csv or spices_dataset.csv
# - Update ingredient names in recipies_dataset.csv to match

# Step 4: Seed everything (will upsert/update existing records)
npm run seed
```

### Notes

- All seed commands use **upsert** (insert or update) based on the `name` column
- Duplicate names in CSV will keep only the last occurrence
- Recipes with `null` ingredient_id entries will have understated nutrition totals
- You can run `npm run seed` multiple times safely—it won't create duplicates
