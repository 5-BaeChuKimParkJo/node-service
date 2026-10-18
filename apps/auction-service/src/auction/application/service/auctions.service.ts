import { Injectable } from '@nestjs/common';
import { AuctionRepositoryPort } from '../port/out/auction-repository.port';
import { AuctionsUseCase } from '../port/in/auctions.use-case';
import { AuctionsCommand } from '../model/auctions.command';
import { AuctionMapper } from '../mapper/auction.mapper';
import { AuctionsResult } from '../model/auctions.result';

@Injectable()
export class AuctionsService extends AuctionsUseCase {
  constructor(
    private readonly auctionRepositoryPort: AuctionRepositoryPort,
    private readonly auctionMapper: AuctionMapper,
  ) {
    super();
  }

  override execute = async (command: AuctionsCommand): Promise<AuctionsResult> => {
    const res = await this.auctionRepositoryPort.findAuctions(command);

    return {
      items: res.items.map((auction) => this.auctionMapper.toResponse(auction)),
      nextCursor: res.nextCursor,
    };
  };
}
