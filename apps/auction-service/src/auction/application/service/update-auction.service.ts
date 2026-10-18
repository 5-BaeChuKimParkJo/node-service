import { Injectable } from '@nestjs/common';
import AuctionUpdate from '../../domain/model/auction-update';
import { AuctionRepositoryPort } from '../port/out/auction-repository.port';
import { AuctionMapper } from '../mapper/auction.mapper';
import { User } from '@app/common/types/user';
import { UpdateAuctionUseCase } from '../port/in/update-auction.use-case';
import { UpdateAuctionCommand } from '../model/update-auction.command';
import { UpdateAuctionResult } from '../model/update-auction.result';

@Injectable()
export class UpdateAuctionService extends UpdateAuctionUseCase {
  constructor(
    private readonly auctionRepositoryPort: AuctionRepositoryPort,
    private readonly auctionMapper: AuctionMapper,
  ) {
    super();
  }

  override execute = async (command: UpdateAuctionCommand, user: User): Promise<UpdateAuctionResult> => {
    const auctionForUpdateDomain = new AuctionUpdate(command, user);
    const res = await this.auctionRepositoryPort.updateAuction(auctionForUpdateDomain);
    return this.auctionMapper.toResponse(res);
  };
}
