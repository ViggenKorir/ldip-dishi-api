# Prisma migrations

- Name new migrations descriptively, for example `dishi_schema`.
- Never edit or remove an applied migration. Add a forward-fix migration instead.
- Generate migrations only against a throwaway or staging database, then review
  the SQL before applying it elsewhere. Production uses `prisma migrate deploy`.
- Before any real-database migration, identify the host and database, review the
  SQL, and confirm a backup or Supabase point-in-time restore is available.
- For rollback, prefer a forward-fix migration. If that is not safe, restore
  from a verified Supabase PITR point under the approved recovery plan.

The existing migration history creates legacy library tables. They are retained
as immutable history; whether they are applied or contain data has not yet been
verified. Do not remove their tables until the target database has been
inspected and the data impact has been approved.
