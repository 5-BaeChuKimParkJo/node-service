import { z } from 'zod';
import { remoteAuctionSchema } from './remote-auction.schema';
import { remoteCategorySchema } from './remote-category.schema';
import { remoteTagSchema } from './remote-tag.schema';

export const catalogAuctionSchema = z
  .object({
    type: z.enum(['auction']),
    category: remoteCategorySchema.nullable(),
    tags: z.array(remoteTagSchema),
  })
  .merge(remoteAuctionSchema);
export type CatalogAuction = z.infer<typeof catalogAuctionSchema>;

export const catalogProductSchema = z.object({
  type: z.enum(['product']),
});
export type CatalogProduct = z.infer<typeof catalogProductSchema>;

export const catalogSchema = z.union([catalogAuctionSchema, catalogProductSchema]);

export type Catalog = z.infer<typeof catalogSchema>;
