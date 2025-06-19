import { z } from 'zod';
export const envSchema = z.object({
  MONGO_URL: z.string(),
  AUCTION_SERVICE: z.string(),
  CATALOG_QUERY_SERVICE: z.string(),
  CATALOG_BFF_SERVICE: z.string(),
  TAG_SERVICE: z.string(),
  CATEGORY_SERVICE: z.string(),
  COUPON_SERVICE: z.string(),
  MEMBER_SERVICE: z.string(),
  PRODUCT_SERVICE: z.string(),
  REPORT_SERVICE: z.string(),
  AUTH_SERVICE: z.string(),
  SEARCH_SERVICE: z.string(),
});

export type EnvSchema = z.infer<typeof envSchema>;

export const envValidate = (config: Record<string, unknown>) => {
  try {
    return envSchema.parse(config);
  } catch (e) {
    throw new Error(`Config validation error: ${e}`);
  }
};
