import { z } from 'zod';
import { AuctionSchema } from './auction.schema';
import { categorySchema } from './category.schema';
import { tagSchema } from './tag.schema';

export const CatalogAuctionSchema = z
  .object({
    type: z.enum(['auction']),
    category: categorySchema.nullable(),
    tags: z.array(tagSchema),
  })
  .merge(AuctionSchema);
export type CatalogAuction = z.infer<typeof CatalogAuctionSchema>;

export const CatalogProductSchema = z.object({
  type: z.enum(['product']),
});
export type CatalogProduct = z.infer<typeof CatalogProductSchema>;

export const CatalogSchema = z.union([CatalogAuctionSchema, CatalogProductSchema]);

export type Catalog = z.infer<typeof CatalogSchema>;
