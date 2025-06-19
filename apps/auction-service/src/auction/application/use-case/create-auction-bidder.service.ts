import { HttpStatus, Injectable } from '@nestjs/common';
import { AuctionRepositoryPort } from '../port/out/auction-repository.port';
import { ErrorCode, User, AppException } from '@app/common';
import { CreateAuctionBidderUseCase } from '../port/in/create-auction-bidder.use-case';
import { CreateAuctionBidderCommand } from '../port/dto/create-auction-bidder.command';
import AuctionBidderForCreateDomain from '../../domain/model/auction-bidder-for-create.domain';

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

    await this.auctionRepositoryPort.transaction(async (tx) => {
      const auctionCreateDomain = new AuctionBidderForCreateDomain(
        {
          auctionId: auctionSnapshot.auctionId,
          bidAmount: command.bidAmount,
          currentBidAmount: auctionSnapshot.currentBid,
          sellerUuid: auctionSnapshot.sellerUuid,
        },
        user,
      );
      const currentBidderUuid = await this.auctionRepositoryPort.findAcutionCurrentBidderForUpdate(
        command.auctionUuid,
        tx,
      );
      if (currentBidderUuid === user.memberUuid) {
        throw new AppException(
          { message: '이미 최고가를 입찰했습니다.', code: ErrorCode.VALIDATION_ERROR },
          HttpStatus.BAD_REQUEST,
        );
      }
      const res = await this.auctionRepositoryPort.updateAuctionCurrentBid(
        command.auctionUuid,
        command.bidAmount,
        user.memberUuid,
        tx,
      );
      await this.auctionRepositoryPort.createAuctionBidder(auctionCreateDomain, tx);

      if (res === 0) {
        throw new AppException(
          { message: '이미 최고 입찰가를 가진 입찰자가 있습니다.', code: ErrorCode.VALIDATION_ERROR },
          HttpStatus.BAD_REQUEST,
        );
      }
    });
  };
}
