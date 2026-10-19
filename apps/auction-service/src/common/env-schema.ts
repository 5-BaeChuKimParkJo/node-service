import { z } from 'zod';
export const envSchema = z
  .object({
    DB_URL: z.string(),
    CATALOG_QUERY_SERVICE: z.string(),
    MEMBER_SERVICE: z.string(),
    JWT_SECRET: z.string().min(32),
    ADMIN_INTERNAL_TOKEN: z.string().min(24),
    PAYMENT_REVIEW_HOURS: z.coerce.number().int().min(1).max(168).default(24),
    PAYMENT_REVIEW_SOON_HOURS: z.coerce.number().int().min(1).max(168).default(6),
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
    if (config.PAYMENT_REVIEW_SOON_HOURS > config.PAYMENT_REVIEW_HOURS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['PAYMENT_REVIEW_SOON_HOURS'],
        message: 'Review warning window must not exceed the deadline',
      });
    }
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
