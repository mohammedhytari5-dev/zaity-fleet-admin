# Database migrations

Run database migrations in this order:

1. Update `drizzle/schema.ts`, then run `npm run db:generate`.
2. Review the generated SQL and snapshot files before committing them.
3. Apply reviewed migrations with `npm run db:migrate` (or `npm run db:push`).

`db:push` checks migration consistency and applies existing migration files. It does not generate a migration automatically. Set `DATABASE_URL` to the intended database before running any database command.
