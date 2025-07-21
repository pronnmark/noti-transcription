import type { Config } from 'drizzle-kit';

export default {
  schema: './src/lib/database/schema/index.ts',
  out: './src/lib/database/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: 'sqlite.db',
  },
} satisfies Config;