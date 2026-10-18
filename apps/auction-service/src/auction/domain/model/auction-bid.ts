import { z } from 'zod';
import { auctionBidderPropsSchema } from '../schema/auction-bidder.schema';

export type AuctionBidderProps = z.infer<typeof auctionBidderPropsSchema>;

export type AuctionBidderArgs = AuctionBidderProps;

export default class AuctionBid {
  private props: AuctionBidderProps;

  constructor(input: AuctionBidderArgs) {
    const props: AuctionBidderProps = input;
    this.props = auctionBidderPropsSchema.parse(props);
  }

  getSnapshot = () => {
    return this.props;
  };
}
