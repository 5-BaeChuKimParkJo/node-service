import { Injectable } from '@nestjs/common';
import { AuctionViewedUseCase } from '../port/in/view-auction-batch.use-case';
import { ViewAuctionBatchCommand } from '../port/dto/view-auction-batch.command';
import { AuctionRepositoryPort } from '../port/out/auction-repository.port';
import AuctionViewedForCreateBulkDomain from '../../domain/model/auction-viewed-for-create-bulk.domain';
import { AuctionCachePort } from '../port/out/auction-cache.port';
import * as F from 'fp-ts/function';
import * as NEA from 'fp-ts/NonEmptyArray';
import * as REC from 'fp-ts/Record';

@Injectable()
export class ViewAuctionBatchService extends AuctionViewedUseCase {
  constructor(
    private readonly auctionRepository: AuctionRepositoryPort,
    private readonly auctionCache: AuctionCachePort,
  ) {
    super();
  }

  execute = async (commands: ViewAuctionBatchCommand[]) => {
    await this.auctionRepository.createAuctionViewedBulk(new AuctionViewedForCreateBulkDomain(commands));
    const viewCounts = F.pipe(
      commands,
      NEA.groupBy((command) => command.auctionUuid),
      REC.map((commands) => commands.length),
      REC.toEntries,
    );
    for (const [auctionUuid, count] of viewCounts) {
      await this.auctionCache.increaseViewCount(auctionUuid, Number(count));
    }
  };
}
