import { ErrorCode } from '@app/common/common/const';
import { User } from '@app/common/types/user';
import { BusinessError } from '@app/common/common/business-error';
import { auctionForUpdatePropsSchema } from '../schema/auction-for-update.schema';
import { z } from 'zod';

export type AuctionForUpdateProps = z.infer<typeof auctionForUpdatePropsSchema>;

export type AuctionForUpdateArgs = AuctionForUpdateProps;

export default class AuctionUpdate {
  private props: AuctionForUpdateProps;

  constructor(input: AuctionForUpdateArgs, user: User) {
    if (Object.keys(input).length === 2 && input.soldAt !== undefined) {
    } else if (user.role !== 'admin') {
      throw new BusinessError(
        { message: '관리자 권한이 필요합니다.', code: ErrorCode.FORBIDDEN_ADMIN_REQUIRED },
        'unauthorized',
      );
    }

    if (input.images && input.images.length > 10) {
      throw new BusinessError(
        { message: '사진은 10장까지 등록할 수 있습니다.', code: ErrorCode.VALIDATION_ERROR },
        'validation',
      );
    }

    const props: AuctionForUpdateProps = input;
    this.props = auctionForUpdatePropsSchema.parse(props);
  }

  getSnapshot = () => {
    return this.props;
  };
}
