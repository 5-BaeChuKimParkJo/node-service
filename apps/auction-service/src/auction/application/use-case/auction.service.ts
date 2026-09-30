import { Injectable } from '@nestjs/common';
import { AuctionRepositoryPort } from '../port/out/auction-repository.port';
import { AuctionUseCase } from '../port/in/auction.use-case';
import { AuctionCommand } from '../port/dto/auction.command';
import { AuctionMapper } from '../mapper/auction.mapper';
import { AuctionResponse } from '../port/dto/auction.response';
import { TaxonomyService } from '../../../taxonomy/taxonomy.service';

@Injectable()
export class AuctionService extends AuctionUseCase {
  constructor(
    private readonly auctionRepositoryPort: AuctionRepositoryPort,
    private readonly auctionMapper: AuctionMapper,
    private readonly taxonomyService: TaxonomyService,
  ) {
    super();
  }

  override execute = async (command: AuctionCommand): Promise<AuctionResponse> => {
    const row = await this.auctionRepositoryPort.findAuction(command);
    const response = this.auctionMapper.toResponse(row);
    const taxonomy = await this.taxonomyService.resolveNames(response.categoryId, response.tagIds);

    return { ...response, ...taxonomy };
  };
}
