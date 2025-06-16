import { add } from 'date-fns';
import { auctionForCreatePropsSchema } from '../schema/auction-for-create.schema';
import { HttpStatus } from '@nestjs/common';
import { ErrorCode, User } from '@app/common';
import { AppException } from '@app/common/common/app.exception';
import { z } from 'zod';

export type AuctionForCreateProps = z.infer<typeof auctionForCreatePropsSchema>;

export type AuctionForCreateArgs = Omit<AuctionForCreateProps, 'status' | 'sellerUuid' | 'currentBid'>;

export default class AuctionForCreateDomain {
  static readonly minimumBid = 1000;
  props: AuctionForCreateProps;

  constructor(input: AuctionForCreateArgs, user: User) {
    if (input.minimumBid < AuctionForCreateDomain.minimumBid) {
      throw new AppException(
        {
          message: `최소 입찰가는 ${AuctionForCreateDomain.minimumBid}원 이상이어야 합니다.`,
          code: ErrorCode.VALIDATION_ERROR,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (input.images.length === 0 || input.images.length > 10) {
      throw new AppException(
        { message: '사진은 1장이상 10장 이하로 등록할 수 있습니다.', code: ErrorCode.VALIDATION_ERROR },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (new Date() > input.startAt) {
      throw new AppException(
        { message: '경매 시작일은 현재 시간 이후여야 합니다.', code: ErrorCode.VALIDATION_ERROR },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (add(input.startAt, { hours: 1 }) > input.endAt) {
      throw new AppException(
        { message: '경매 종료일은 시작일로부터 최소 1시간 이후여야 합니다.', code: ErrorCode.VALIDATION_ERROR },
        HttpStatus.BAD_REQUEST,
      );
    }

    for (const { key } of input.images) {
      if (!key.startsWith(`auction/${user.memberUuid}/images/`)) {
        throw new AppException(
          { message: '이미지 키가 올바르지 않습니다.', code: ErrorCode.VALIDATION_ERROR },
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const props: AuctionForCreateProps = {
      ...input,
      sellerUuid: user.memberUuid,
      status: 'visible',
      currentBid: 0n,
    };
    this.props = auctionForCreatePropsSchema.parse(props);
  }

  getSnapshot = () => {
    return this.props;
  };
}
