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
import Auction from '../../domain/model/auction';
import { DemoAuctionCreationCommand } from '../model/demo-auction-creation.command';
import { DemoAuctionCreationResult } from '../model/demo-auction-creation.result';

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
    const auction = await this.validate(command, user);
    return this.toResult(await this.auctionRepositoryPort.createAuction(auction));
  };

  override executeDemo = async (
    command: CreateAuctionCommand,
    user: User,
    context: DemoAuctionCreationCommand,
  ): Promise<DemoAuctionCreationResult> => {
    const auction = await this.validate(command, user, true);
    const result = await this.auctionRepositoryPort.createDemoAuction(auction, context);
    if (result.status !== 'created') return result;
    return { status: 'created', auction: await this.toResult(result.auction) };
  };

  private async validate(command: CreateAuctionCommand, user: User, demo = false): Promise<NewAuction> {
    await this.taxonomyService.validateSelection(command.categoryId, command.tagIds);
    const keys = command.images.map((image) => image.key);
    keys.forEach((key) => assertOwnedAuctionImageKey(key, user.memberUuid));
    await Promise.all(keys.map((key) => this.auctionFileStoragePort.checkFileExists({ key })));

    return demo ? NewAuction.forDemo(command, user) : new NewAuction(command, user);
  }

  private async toResult(auction: Auction): Promise<CreateAuctionResult> {
    const response = this.auctionMapper.toResponse(auction);
    const taxonomy = await this.taxonomyService.resolveNames(response.categoryId, response.tagIds);
    return { ...response, ...taxonomy };
  }
}
