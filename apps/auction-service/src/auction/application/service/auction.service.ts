import { Injectable } from '@nestjs/common';
import { AuctionRepositoryPort } from '../port/out/auction-repository.port';
import { AuctionUseCase } from '../port/in/auction.use-case';
import { AuctionCommand } from '../model/auction.command';
import { AuctionMapper } from '../mapper/auction.mapper';
import { AuctionResult } from '../model/auction.result';
import { TaxonomyUseCase } from '../../../taxonomy/application/port/in/taxonomy.use-case';

@Injectable()
export class AuctionService extends AuctionUseCase {
  constructor(
    private readonly auctionRepositoryPort: AuctionRepositoryPort,
    private readonly auctionMapper: AuctionMapper,
    private readonly taxonomyService: TaxonomyUseCase,
  ) {
    super();
  }

  override execute = async (command: AuctionCommand): Promise<AuctionResult> => {
    const row = await this.auctionRepositoryPort.findAuction(command);
    const response = this.auctionMapper.toResponse(row);
    const taxonomy = await this.taxonomyService.resolveNames(response.categoryId, response.tagIds);

    return { ...response, ...taxonomy, isDemo: Boolean(row.getSnapshot().demoTemplateUuid) };
  };
}
