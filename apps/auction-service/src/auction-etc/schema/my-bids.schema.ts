import { z } from 'zod';
import { HttpAuctionSchema } from '../../common/schema/http-auction.schema';

export const MyBidsAuctionBidderSchema = z.object({
  bidderUuid: z.string(),
  bidAmount: z.bigint(),
  createdAt: z.date(),
});

export const MyBidsOutputSchema = z.object({
  bidder: MyBidsAuctionBidderSchema,
  auction: HttpAuctionSchema,
});

export type MyBidsOutput = z.infer<typeof MyBidsOutputSchema>;
