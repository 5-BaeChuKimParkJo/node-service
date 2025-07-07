import { AppException, ErrorCode } from '@app/common';
import { AuctionResponseDto } from '../dto/auction-dto';
import { Auction } from '../schema/auction.schema';
import { HttpStatus } from '@nestjs/common';
import { UsersAuctionResponseDto } from '../dto/users-auction-dto';

export class UsersAuctionMapper {
  static toResponseDto = (auction: Omit<Auction, 'seller'>): UsersAuctionResponseDto => {
    return {
      ...auction,
      status: UsersAuctionMapper.mapAuctionStatus(auction),
      soldAt: auction.soldAt ? auction.soldAt.toISOString() : null,
      startAt: auction.startAt.toISOString(),
      endAt: auction.endAt.toISOString(),
      createdAt: auction.createdAt.toISOString(),
    };
  };

  private static mapAuctionStatus = ({ endAt, startAt, status }: Pick<Auction, 'status' | 'startAt' | 'endAt'>) => {
    if (status === 'visible') {
      const now = new Date();
      if (now < startAt) {
        return 'waiting';
      } else if (now > endAt) {
        return 'ended';
      } else {
        return 'active';
      }
    } else {
      const _exhaustiveCheck: never = status;
      throw new AppException(
        { message: status + '는 유효하지 않은 상태입니다.', code: ErrorCode.INTERNAL_VALIDATION_ERROR },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  };
}
