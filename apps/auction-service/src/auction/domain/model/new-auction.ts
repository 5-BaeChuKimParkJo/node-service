import { add } from 'date-fns';
import { auctionForCreatePropsSchema, demoAuctionForCreatePropsSchema } from '../schema/auction-for-create.schema';
import { ErrorCode } from '@app/common/common/const';
import { User } from '@app/common/types/user';
import { BusinessError } from '@app/common/common/business-error';
import { z } from 'zod';

export type AuctionForCreateProps = z.infer<typeof auctionForCreatePropsSchema>;

export type AuctionForCreateArgs = Omit<AuctionForCreateProps, 'status' | 'sellerUuid' | 'currentBid'>;

export default class NewAuction {
  static readonly minimumBid = 1000;
  props: AuctionForCreateProps;

  static forDemo(input: AuctionForCreateArgs, user: User): NewAuction {
    return new NewAuction(input, user, 'demo');
  }

  constructor(input: AuctionForCreateArgs, user: User, schedule: 'standard' | 'demo' = 'standard') {
    if (input.minimumBid < NewAuction.minimumBid) {
      throw new BusinessError(
        {
          message: `최소 입찰가는 ${NewAuction.minimumBid}원 이상이어야 합니다.`,
          code: ErrorCode.VALIDATION_ERROR,
        },
        'validation',
      );
    }

    if (input.images.length === 0 || input.images.length > 10) {
      throw new BusinessError(
        { message: '사진은 1장이상 10장 이하로 등록할 수 있습니다.', code: ErrorCode.VALIDATION_ERROR },
        'validation',
      );
    }

    // if (new Date() > input.startAt) {
    //   throw new BusinessError(
    //     { message: '경매 시작일은 현재 시간 이후여야 합니다.', code: ErrorCode.VALIDATION_ERROR },
    //     'validation',
    //   );
    // }

    const duration = input.endAt.getTime() - input.startAt.getTime();
    if (schedule === 'demo' && ![300000, 1800000, 86400000].includes(duration)) {
      throw new BusinessError(
        { message: '데모 경매는 5분, 30분 또는 24시간만 운영할 수 있습니다.', code: ErrorCode.VALIDATION_ERROR },
        'validation',
      );
    }
    if (schedule === 'standard' && add(input.startAt, { hours: 1 }) > input.endAt) {
      throw new BusinessError(
        { message: '경매 종료일은 시작일로부터 최소 1시간 이후여야 합니다.', code: ErrorCode.VALIDATION_ERROR },
        'validation',
      );
    }

    // for (const { key } of input.images) {
    //   if (!key.startsWith(`auction/${user.memberUuid}/images/`)) {
    //     throw new BusinessError(
    //       { message: '이미지 키가 올바르지 않습니다.', code: ErrorCode.VALIDATION_ERROR },
    //       'validation',
    //     );
    //   }
    // }

    const props: AuctionForCreateProps = {
      ...input,
      sellerUuid: user.memberUuid,
      status: 'visible',
      currentBid: 0n,
    };
    this.props = (schedule === 'demo' ? demoAuctionForCreatePropsSchema : auctionForCreatePropsSchema).parse(props);
  }

  getSnapshot = () => {
    return this.props;
  };
}
