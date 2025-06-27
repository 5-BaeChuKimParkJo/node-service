import { z } from 'zod';
import { httpMemberSchema } from './http-member.schema';
import { mongoCatalogTypeAuctionSchema } from '../../common/schema/mongo-catalog.schema';

export const auctionSchema = mongoCatalogTypeAuctionSchema
  .merge(
    z.object({
      seller: httpMemberSchema,
    }),
  )
  .omit({ sellerUuid: true });

export type Auction = z.infer<typeof auctionSchema>;
