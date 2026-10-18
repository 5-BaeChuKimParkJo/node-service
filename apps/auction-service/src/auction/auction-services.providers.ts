import { Provider } from '@nestjs/common';
import { CreateAuctionUseCase } from './application/port/in/create-auction.use-case';
import { CreateAuctionService } from './application/service/create-auction.service';
import { UpdateAuctionUseCase } from './application/port/in/update-auction.use-case';
import { UpdateAuctionService } from './application/service/update-auction.service';
import { AuctionsUseCase } from './application/port/in/auctions.use-case';
import { AuctionsService } from './application/service/auctions.service';
import { DeleteAuctionUseCase } from './application/port/in/delete-auction.use-case';
import { DeleteAuctionService } from './application/service/delete-auction.service';
import { PresignedUrlUseCase } from './application/port/in/presigned-url.use-case';
import { PresignedUrlService } from './application/service/presigned-url.service';
import { AuctionUseCase } from './application/port/in/auction.use-case';
import { AuctionService } from './application/service/auction.service';
import { CreateAuctionBidderUseCase } from './application/port/in/create-auction-bidder.use-case';
import { CreateAuctionBidderService } from './application/service/create-auction-bidder.service';
import { AuctionBiddersUseCase } from './application/port/in/auction-bidders.use-case';
import { AuctionBiddersService } from './application/service/auction-bidders.service';
import { AuctionsByIdsUseCase } from './application/port/in/auctions-by-ids.use-case';
import { AuctionsByIdsService } from './application/service/auctions-by-ids.service';
import { CreateAuctionBidderKafkaService } from './application/service/create-auction-bidder-kafka.service';
import { CreateAuctionBidderKafkaUseCase } from './application/port/in/create-auction-bidder-kafka.use-case';
import { CreateAuctionBidderBatchUseCase } from './application/port/in/create-auction-bidder-batch.use-case';
import { CreateAuctionBidderBatchService } from './application/service/create-auction-bidder-batch.service';
import { AuctionSoldUseCase } from './application/port/in/auction-sold.use-case';
import { AuctionSoldService } from './application/service/auction-sold.service';
import { AuctionViewedUseCase } from './application/port/in/view-auction-batch.use-case';
import { ViewAuctionBatchService } from './application/service/view-auction-batch.service';
import { UploadAuctionImageUseCase } from './application/port/in/upload-auction-image.use-case';
import { UploadAuctionImageService } from './application/service/upload-auction-image.service';
import { AuctionAdminService } from './application/service/auction-admin.service';

export const auctionUseCaseProviders: Provider[] = [
  AuctionAdminService,
  {
    provide: UploadAuctionImageUseCase,
    useClass: UploadAuctionImageService,
  },
  {
    provide: AuctionUseCase,
    useClass: AuctionService,
  },
  {
    provide: AuctionsUseCase,
    useClass: AuctionsService,
  },
  {
    provide: CreateAuctionUseCase,
    useClass: CreateAuctionService,
  },
  {
    provide: UpdateAuctionUseCase,
    useClass: UpdateAuctionService,
  },
  {
    provide: DeleteAuctionUseCase,
    useClass: DeleteAuctionService,
  },
  {
    provide: PresignedUrlUseCase,
    useClass: PresignedUrlService,
  },
  {
    provide: CreateAuctionBidderUseCase,
    useClass: CreateAuctionBidderService,
  },
  {
    provide: CreateAuctionBidderKafkaUseCase,
    useClass: CreateAuctionBidderKafkaService,
  },
  {
    provide: AuctionBiddersUseCase,
    useClass: AuctionBiddersService,
  },
  {
    provide: AuctionsByIdsUseCase,
    useClass: AuctionsByIdsService,
  },
  {
    provide: CreateAuctionBidderBatchUseCase,
    useClass: CreateAuctionBidderBatchService,
  },
  {
    provide: AuctionSoldUseCase,
    useClass: AuctionSoldService,
  },
  {
    provide: AuctionViewedUseCase,
    useClass: ViewAuctionBatchService,
  },
];
