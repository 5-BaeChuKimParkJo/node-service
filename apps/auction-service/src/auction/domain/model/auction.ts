import { z } from 'zod';
import { auctionPropsSchema } from '../schema/auction.schema';

export type AuctionProps = z.infer<typeof auctionPropsSchema>;

export type AuctionArgs = AuctionProps;

export default class Auction {
  static readonly maxAllowedBidRange = 30n;
  private props: AuctionProps;

  constructor(input: AuctionArgs) {
    const props: AuctionProps = input;
    this.props = auctionPropsSchema.parse(props);
  }

  validateBidAmount = (bidAmount: bigint) => {
    if (this.props.minimumBid > bidAmount) {
      return { isValid: false, message: '최소 입찰가보다 높은 입찰가를 입력해주세요.' };
    }
    if (this.props.currentBid >= bidAmount) {
      return { isValid: false, message: '현재 입찰가보다 높은 입찰가를 입력해주세요.' };
    }
    const maximumBid = this.props.currentBid > this.props.minimumBid ? this.props.currentBid : this.props.minimumBid;
    const maxAllowed = maximumBid + (maximumBid * Auction.maxAllowedBidRange) / 100n;
    if (maxAllowed < bidAmount) {
      return {
        isValid: false,
        message: `최고 입찰가의 ${Auction.maxAllowedBidRange}%를 초과할 수 없습니다.`,
      };
    }
    return { isValid: true };
  };

  isEnded = () => {
    return new Date() > this.props.endAt;
  };

  getSnapshot = () => {
    return this.props;
  };
}
