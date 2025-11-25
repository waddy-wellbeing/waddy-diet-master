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

We ship curated CSV datasets for foods, spices, and recipes under `docs/datasets/`.

1. **Configure environment** – copy `.env.local.example` to `.env.local` and fill:

	```env
	NEXT_PUBLIC_SUPABASE_URL=...
	NEXT_PUBLIC_SUPABASE_ANON_KEY=...
	SUPABASE_URL=...
	SUPABASE_ANON_KEY=...
	SUPABASE_SERVICE_ROLE_KEY=...   # keep private – needed for seeding
	```

2. **Dry run (safe)** – validates FK lookups and shows inserts/updates without touching the DB:

	```bash
	npm run seed:dry-run
	```

3. **Seed the database** – upserts foods ➜ spices ➜ recipes using the service role key:

	```bash
	npm run seed
	```

The seeding scripts automatically resolve ingredient → food relationships, flag spices, and compute recipe macros per serving. Any ingredient that cannot be matched logs a warning and keeps a `null` `food_id` so admins can reconcile it later.
