import { HttpStatus, Injectable } from '@nestjs/common';
import AuctionForUpdateDomain from '../../domain/model/auction-for-update.domain';
import { AuctionRepositoryPort } from '../port/out/auction-repository.port';
import { AppException, User } from '@app/common';
import { AuctionSoldUseCase } from '../port/in/auction-sold.use-case';
import { AuctionSoldCommand } from '../port/dto/auction-sold.command';

@Injectable()
export class AuctionSoldService extends AuctionSoldUseCase {
  constructor(private readonly auctionRepositoryPort: AuctionRepositoryPort) {
    super();
  }

  override execute = async (command: AuctionSoldCommand, user: User): Promise<void> => {
    const auctionForUpdateDomain = new AuctionForUpdateDomain({ ...command, soldAt: new Date() }, user);
    const auction = (
      await this.auctionRepositoryPort.findAuction({ type: 'user', auctionUuid: command.auctionUuid })
    ).getSnapshot();
    if (auction.sellerUuid !== user.memberUuid) {
      throw new AppException(
        {
          message: '해당 유저에 대한 경매가 존재하지 않습니다.',
          code: HttpStatus.NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );
    }
    // if (auction.soldAt) {
    //   throw new AppException(
    //     {
    //       message: '이미 판매가 완료된 경매입니다.',
    //       code: HttpStatus.BAD_REQUEST,
    //     },
    //     HttpStatus.BAD_REQUEST,
    //   );
    // }
    await this.auctionRepositoryPort.updateAuction(auctionForUpdateDomain);
  };
}
