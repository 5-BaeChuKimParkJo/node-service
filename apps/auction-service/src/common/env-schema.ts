import { z } from 'zod';
export const envSchema = z.object({
  DB_URL: z.string(),
  CATALOG_QUERY_SERVICE: z.string(),
  MEMBER_SERVICE: z.string(),
  JWT_SECRET: z.string().min(32),
});

export type EnvSchema = z.infer<typeof envSchema>;

export const envValidate = (config: Record<string, unknown>) => {
  try {
    return envSchema.parse(config);
  } catch (e) {
    throw new Error(`Config validation error: ${e}`);
  }
};
