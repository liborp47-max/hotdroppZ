# Admin SQL Access

This repo can apply Supabase/Postgres SQL directly from the terminal without `psql` or the Supabase CLI.

## 1. Add admin DB access

Put this in `.env.local`:

```env
SUPABASE_DB_URL=postgresql://postgres:YOUR_DB_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres?sslmode=require
```

You can also use `DATABASE_URL`; the script supports both names.

## 2. Test the connection

```bash
npm run db:ping
```

## 3. Apply SQL files

Apply one file:

```bash
npm run db:apply -- supabase/schema-pipeline.sql
```

Apply the full project schema plus the Scout/Writer pipeline:

```bash
npm run db:migrate:pipeline
```

## 4. What this unlocks

Once `SUPABASE_DB_URL` is present, Codex can:

- run new SQL migrations directly from the repo
- apply fixes to Supabase schema without opening the dashboard manually
- verify DB connectivity before running app-level changes

## Notes

- The direct DB password is not the same thing as the anon key.
- `SUPABASE_SERVICE_ROLE_KEY` is useful for server-side data access, but not for arbitrary SQL execution.
- The SQL runner loads `.env.local` automatically.
