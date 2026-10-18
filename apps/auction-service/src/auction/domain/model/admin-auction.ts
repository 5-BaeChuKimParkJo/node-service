import { z } from 'zod';
import { auctionAdminPropsSchema } from '../schema/auction-admin.schema';
import { BusinessError } from '@app/common/common/business-error';
import { ErrorCode } from '@app/common/common/const';

export type AuctionAdminProps = z.infer<typeof auctionAdminPropsSchema>;

export type AuctionAdminArgs = AuctionAdminProps;
export type AuctionAdminAction = 'hide' | 'restore' | 'force-end';
export type AuctionOperationalStatus = 'waiting' | 'active' | 'ended' | 'hidden' | 'cancelled';

export default class AdminAuction {
  static readonly maxAllowedBidRange = 30n;
  private props: AuctionAdminProps;

  constructor(input: AuctionAdminArgs) {
    const props: AuctionAdminProps = input;
    this.props = auctionAdminPropsSchema.parse(props);
  }

  validateBidAmount = (bidAmount: bigint) => {
    if (this.props.minimumBid > bidAmount) {
      return { isValid: false, message: '최소 입찰가보다 높은 입찰가를 입력해주세요.' };
    }
    if (this.props.currentBid >= bidAmount) {
      return { isValid: false, message: '현재 입찰가보다 높은 입찰가를 입력해주세요.' };
    }
    const maximumBid = this.props.currentBid > this.props.minimumBid ? this.props.currentBid : this.props.minimumBid;
    const maxAllowed = maximumBid + (maximumBid * AdminAuction.maxAllowedBidRange) / 100n;
    if (maxAllowed < bidAmount) {
      return {
        isValid: false,
        message: `최고 입찰가의 ${AdminAuction.maxAllowedBidRange}%를 초과할 수 없습니다.`,
      };
    }
    return { isValid: true };
  };

  isEnded = () => {
    return new Date() > this.props.endAt;
  };

  getOperationalStatus = (now = new Date()): AuctionOperationalStatus => {
    if (this.props.status === 'hidden' || this.props.status === 'cancelled') {
      return this.props.status;
    }
    if (now < this.props.startAt) {
      return 'waiting';
    }
    if (now >= this.props.endAt) {
      return 'ended';
    }
    return 'active';
  };

  planAction = (action: AuctionAdminAction, now = new Date()) => {
    const previousStatus = this.getOperationalStatus(now);
    if (previousStatus === 'ended' || previousStatus === 'cancelled') {
      this.invalidTransition(action, previousStatus);
    }

    if (action === 'hide') {
      if (previousStatus === 'hidden') {
        this.invalidTransition(action, previousStatus);
      }
      return {
        previousStatus,
        nextStatus: 'hidden' as const,
        persistedStatus: 'hidden' as const,
        endAt: this.props.endAt,
      };
    }

    if (action === 'restore') {
      if (previousStatus !== 'hidden') {
        this.invalidTransition(action, previousStatus);
      }
      return {
        previousStatus,
        nextStatus: this.timeDerivedStatus(now),
        persistedStatus: 'visible' as const,
        endAt: this.props.endAt,
      };
    }

    const endAt = new Date(now);
    endAt.setUTCMinutes(0, 0, 0);
    return {
      previousStatus,
      nextStatus: 'ended' as const,
      persistedStatus: 'visible' as const,
      endAt,
    };
  };

  private timeDerivedStatus = (now: Date): 'waiting' | 'active' | 'ended' => {
    if (now < this.props.startAt) return 'waiting';
    if (now >= this.props.endAt) return 'ended';
    return 'active';
  };

  private invalidTransition = (action: AuctionAdminAction, status: AuctionOperationalStatus): never => {
    throw new BusinessError(
      {
        message: `${status} 상태에서는 ${action} 작업을 수행할 수 없습니다.`,
        code: ErrorCode.VALIDATION_ERROR,
      },
      'conflict',
    );
  };

  getSnapshot = () => {
    return this.props;
  };
}
