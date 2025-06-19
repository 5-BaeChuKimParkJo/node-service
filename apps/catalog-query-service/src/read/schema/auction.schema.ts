import { z } from 'zod';
import { remoteMemberSchema } from './remote-member.schema';
import { catalogAuctionSchema } from '../../sync/schema/catalog.schema';

export const auctionSchema = catalogAuctionSchema
  .merge(
    z.object({
      seller: remoteMemberSchema,
    }),
  )
  .omit({ sellerUuid: true });

export type Auction = z.infer<typeof auctionSchema>;
