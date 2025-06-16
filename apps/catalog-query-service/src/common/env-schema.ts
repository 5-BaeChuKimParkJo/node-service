import { z } from 'zod';
export const envSchema = z.object({
  MONGO_URL: z.string(),
});

export type EnvSchema = z.infer<typeof envSchema>;

export const envValidate = (config: Record<string, unknown>) => {
  try {
    return envSchema.parse(config);
  } catch (e) {
    throw new Error(`Config validation error: ${e}`);
  }
};
