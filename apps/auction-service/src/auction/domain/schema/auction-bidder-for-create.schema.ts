import { auctionBidderPropsSchema } from './auction-bidder.schema';
import { auctionPropsSchema } from './auction.schema';

export const auctionBidderForCreatePropsSchema = auctionBidderPropsSchema
  .pick({
    auctionId: true,
    bidderUuid: true,
    bidAmount: true,
  })
  .merge(
    auctionPropsSchema.pick({
      currentBid: true,
    }),
  )
  .strip();
