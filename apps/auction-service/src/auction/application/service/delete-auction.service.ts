import { Injectable } from '@nestjs/common';
import AuctionDeletion from '../../domain/model/auction-deletion';
import { AuctionRepositoryPort } from '../port/out/auction-repository.port';
import { User } from '@app/common/types/user';
import { DeleteAuctionUseCase } from '../port/in/delete-auction.use-case';
import { DeleteAuctionCommand } from '../model/delete-auction.command';

@Injectable()
export class DeleteAuctionService extends DeleteAuctionUseCase {
  constructor(private readonly auctionRepositoryPort: AuctionRepositoryPort) {
    super();
  }

  override execute = async (command: DeleteAuctionCommand, user: User): Promise<void> => {
    const auctionForDeleteDomain = new AuctionDeletion(command, user);
    await this.auctionRepositoryPort.deleteAuction(auctionForDeleteDomain);
  };
}
