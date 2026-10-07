import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: './prisma/schema.prisma',
  migrations: {
    path: './prisma/migrations',
    seed: 'npx tsx prisma/seed/seed.ts', //was ts-node instead of tsx
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
