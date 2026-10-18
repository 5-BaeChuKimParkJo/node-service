import { AuctionBiddersCommand } from '../model/auction-bidders.command';
import { AuctionBiddersResult } from '../model/auction-bidders.result';
import { AuctionBiddersUseCase } from '../port/in/auction-bidders.use-case';
import { AuctionRepositoryPort } from '../port/out/auction-repository.port';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AuctionBiddersService extends AuctionBiddersUseCase {
  constructor(private readonly auctionRepositoryPort: AuctionRepositoryPort) {
    super();
  }

  override execute = async (command: AuctionBiddersCommand): Promise<AuctionBiddersResult> => {
    const auctionBidders = await this.auctionRepositoryPort.findAuctionBidders(command);
    return {
      items: auctionBidders.items.map((item) => item.getSnapshot()),
      nextCursor: auctionBidders.nextCursor,
    };
  };
}
