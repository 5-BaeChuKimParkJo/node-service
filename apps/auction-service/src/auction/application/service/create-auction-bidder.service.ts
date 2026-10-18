import { HttpStatus, Injectable } from '@nestjs/common';
import { AuctionRepositoryPort } from '../port/out/auction-repository.port';
import { ErrorCode } from '@app/common/common/const';
import { User } from '@app/common/types/user';
import { AppException } from '@app/common/common/app.exception';
import { CreateAuctionBidderUseCase } from '../port/in/create-auction-bidder.use-case';
import { CreateAuctionBidderCommand } from '../model/create-auction-bidder.command';
import NewBid from '../../domain/model/new-bid';

@Injectable()
export class CreateAuctionBidderService extends CreateAuctionBidderUseCase {
  constructor(private readonly auctionRepositoryPort: AuctionRepositoryPort) {
    super();
  }

  override execute = async (command: CreateAuctionBidderCommand, user: User): Promise<void> => {
    const auction = await this.auctionRepositoryPort.findAuction({ auctionUuid: command.auctionUuid, type: 'user' });
    const auctionSnapshot = auction.getSnapshot();

    if (auction.isEnded()) {
      throw new AppException(
        { message: '이미 종료된 경매입니다.', code: ErrorCode.VALIDATION_ERROR },
        HttpStatus.BAD_REQUEST,
      );
    }

    const checked = auction.validateBidAmount(command.bidAmount);
    if (!checked.isValid && checked.message) {
      throw new AppException({ message: checked.message, code: ErrorCode.VALIDATION_ERROR }, HttpStatus.BAD_REQUEST);
    }

    await this.auctionRepositoryPort.withLockedAuction(command.auctionUuid, async (session) => {
      const auctionCreateDomain = new NewBid(
        {
          auctionId: auctionSnapshot.auctionId,
          bidAmount: command.bidAmount,
          currentBidAmount: auctionSnapshot.currentBid,
          sellerUuid: auctionSnapshot.sellerUuid,
          currentBid: auctionSnapshot.currentBid,
        },
        user,
      );
      const auction = session.auction;
      const snapshot = auction.getSnapshot();
      if (snapshot.currentBidderUuid === user.memberUuid) {
        throw new AppException(
          { message: '이미 최고가를 입찰했습니다.', code: ErrorCode.VALIDATION_ERROR },
          HttpStatus.BAD_REQUEST,
        );
      }
      const res = await session.updateCurrentBid(command.bidAmount, user.memberUuid);
      await session.createBid(auctionCreateDomain);

      if (res === 0) {
        throw new AppException(
          { message: '이미 최고 입찰가를 가진 입찰자가 있습니다.', code: ErrorCode.VALIDATION_ERROR },
          HttpStatus.BAD_REQUEST,
        );
      }
    });
  };
}
