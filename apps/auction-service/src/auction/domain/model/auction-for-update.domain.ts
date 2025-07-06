import { ErrorCode, User, AppException } from '@app/common';
import { auctionForUpdatePropsSchema } from '../schema/auction-for-update.schema';
import { HttpStatus } from '@nestjs/common';
import { z } from 'zod';

export type AuctionForUpdateProps = z.infer<typeof auctionForUpdatePropsSchema>;

export type AuctionForUpdateArgs = AuctionForUpdateProps;

export default class AuctionForUpdateDomain {
  private props: AuctionForUpdateProps;

  constructor(input: AuctionForUpdateArgs, user: User) {
    if (Object.keys(input).length === 2 && input.soldAt !== undefined) {
    } else if (user.role !== 'admin') {
      throw new AppException(
        { message: '관리자 권한이 필요합니다.', code: ErrorCode.FORBIDDEN_ADMIN_REQUIRED },
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (input.images && input.images.length > 10) {
      throw new AppException(
        { message: '사진은 10장까지 등록할 수 있습니다.', code: ErrorCode.VALIDATION_ERROR },
        HttpStatus.BAD_REQUEST,
      );
    }

    const props: AuctionForUpdateProps = input;
    this.props = auctionForUpdatePropsSchema.parse(props);
  }

  getSnapshot = () => {
    return this.props;
  };
}
