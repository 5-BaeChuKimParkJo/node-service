import { z } from 'zod';
export const envSchema = z
  .object({
    DB_URL: z.string(),
    CATALOG_QUERY_SERVICE: z.string(),
    MEMBER_SERVICE: z.string(),
    JWT_SECRET: z.string().min(32),
    ADMIN_INTERNAL_TOKEN: z.string().min(24),
    TOSS_PAYMENTS_ENABLED: z
      .union([z.boolean(), z.enum(['true', 'false']).transform((value) => value === 'true')])
      .default(false),
    TOSS_CLIENT_KEY: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z
        .string()
        .regex(/^test_gck_[A-Za-z0-9_-]+$/)
        .optional(),
    ),
    TOSS_SECRET_KEY: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z
        .string()
        .regex(/^test_gsk_[A-Za-z0-9_-]+$/)
        .optional(),
    ),
  })
  .superRefine((config, ctx) => {
    if (config.TOSS_PAYMENTS_ENABLED && (!config.TOSS_CLIENT_KEY || !config.TOSS_SECRET_KEY)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Enabled test payments require test_gck_ and test_gsk_ keys',
        path: ['TOSS_PAYMENTS_ENABLED'],
      });
    }
  });

export type EnvSchema = z.infer<typeof envSchema>;

export const envValidate = (config: Record<string, unknown>) => {
  try {
    return envSchema.parse(config);
  } catch (e) {
    throw new Error(`Config validation error: ${e}`);
  }
};
