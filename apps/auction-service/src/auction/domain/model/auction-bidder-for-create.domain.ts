import { ErrorCode, User } from '@app/common';
import { z } from 'zod';
import { auctionBidderForCreatePropsSchema } from '../schema/auction-bidder-for-create.schema';
import { AppException } from '@app/common/common/app.exception';
import { HttpStatus } from '@nestjs/common';

export type AuctionBidderForCreateProps = z.infer<typeof auctionBidderForCreatePropsSchema>;

export type AuctionBidderForCreateArgs = Omit<AuctionBidderForCreateProps, 'bidderUuid'> & {
  currentBidAmount: bigint;
  sellerUuid: string;
};

export default class AuctionBidderForCreateDomain {
  props: AuctionBidderForCreateProps;

  constructor(input: AuctionBidderForCreateArgs, user: User) {
    if (input.sellerUuid === user.memberUuid) {
      throw new AppException(
        { message: '자신의 경매에는 입찰할 수 없습니다.', code: ErrorCode.VALIDATION_ERROR },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (input.bidAmount <= input.currentBidAmount) {
      throw new AppException(
        { message: '현재 입찰 금액보다 높은 금액으로 입찰해야 합니다.', code: ErrorCode.VALIDATION_ERROR },
        HttpStatus.BAD_REQUEST,
      );
    }

    const props: AuctionBidderForCreateProps = {
      ...input,
      bidderUuid: user.memberUuid,
    };
    this.props = auctionBidderForCreatePropsSchema.parse(props);
  }

  getSnapshot = () => {
    return this.props;
  };
}
