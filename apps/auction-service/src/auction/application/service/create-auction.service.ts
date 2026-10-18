import { Injectable } from '@nestjs/common';
import NewAuction from '../../domain/model/new-auction';
import { AuctionRepositoryPort } from '../port/out/auction-repository.port';
import { CreateAuctionUseCase } from '../port/in/create-auction.use-case';
import { AuctionMapper } from '../mapper/auction.mapper';
import { CreateAuctionCommand } from '../model/create-auction.command';
import { CreateAuctionResult } from '../model/create-auction.result';
import { User } from '@app/common/types/user';
import { AuctionFileStoragePort } from '../port/out/auction-file-storage-port';
import { TaxonomyUseCase } from '../../../taxonomy/application/port/in/taxonomy.use-case';
import { assertOwnedAuctionImageKey } from './auction-image-key';

@Injectable()
export class CreateAuctionService extends CreateAuctionUseCase {
  constructor(
    private readonly auctionRepositoryPort: AuctionRepositoryPort,
    private readonly auctionFileStoragePort: AuctionFileStoragePort,
    private readonly auctionMapper: AuctionMapper,
    private readonly taxonomyService: TaxonomyUseCase,
  ) {
    super();
  }

  override execute = async (command: CreateAuctionCommand, user: User): Promise<CreateAuctionResult> => {
    await this.taxonomyService.validateSelection(command.categoryId, command.tagIds);
    const keys = command.images.map((image) => image.key);
    keys.forEach((key) => assertOwnedAuctionImageKey(key, user.memberUuid));
    await Promise.all(keys.map((key) => this.auctionFileStoragePort.checkFileExists({ key })));

    const auctionForCreateDomain = new NewAuction(command, user);
    const res = await this.auctionRepositoryPort.createAuction(auctionForCreateDomain);
    const response = this.auctionMapper.toResponse(res);
    const taxonomy = await this.taxonomyService.resolveNames(response.categoryId, response.tagIds);
    return { ...response, ...taxonomy };
  };
}
