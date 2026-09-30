import { Injectable } from '@nestjs/common';
import AuctionForCreateDomain from '../../domain/model/auction-for-create.domain';
import { AuctionRepositoryPort } from '../port/out/auction-repository.port';
import { CreateAuctionUseCase } from '../port/in/create-auction.use-case';
import { AuctionMapper } from '../mapper/auction.mapper';
import { CreateAuctionCommand } from '../port/dto/create-auction.command';
import { CreateAuctionResponse } from '../port/dto/create-auction.response';
import { User } from '@app/common';
import { AuctionFileStoragePort } from '../port/out/auction-file-storage-port';
import { TaxonomyService } from '../../../taxonomy/taxonomy.service';

@Injectable()
export class CreateAuctionService extends CreateAuctionUseCase {
  constructor(
    private readonly auctionRepositoryPort: AuctionRepositoryPort,
    private readonly auctionFileStoragePort: AuctionFileStoragePort,
    private readonly auctionMapper: AuctionMapper,
    private readonly taxonomyService: TaxonomyService,
  ) {
    super();
  }

  override execute = async (command: CreateAuctionCommand, user: User): Promise<CreateAuctionResponse> => {
    await this.taxonomyService.validateSelection(command.categoryId, command.tagIds);
    const keys = command.images.map((image) => image.key);
    await Promise.all(keys.map((key) => this.auctionFileStoragePort.checkFileExists({ key })));

    const auctionForCreateDomain = new AuctionForCreateDomain(command, user);
    const res = await this.auctionRepositoryPort.createAuction(auctionForCreateDomain);
    const response = this.auctionMapper.toResponse(res);
    const taxonomy = await this.taxonomyService.resolveNames(response.categoryId, response.tagIds);
    return { ...response, ...taxonomy };
  };
}
