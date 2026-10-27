import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Prisma 7. Migrations use the DIRECT Supabase connection (port 5432),
// never the pgbouncer pooler (port 6543).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed/seed.ts",
  },
  datasource: {
    url: env("DIRECT_URL"),
  },
});
