import { Provider } from '@nestjs/common';
import { CreateAuctionUseCase } from '../port/in/create-auction.use-case';
import { CreateAuctionService } from './create-auction.service';
import { UpdateAuctionUseCase } from '../port/in/update-auction.use-case';
import { UpdateAuctionService } from './update-auction.service';
import { AuctionsUseCase } from '../port/in/auctions.use-case';
import { AuctionsService } from './auctions.service';
import { DeleteAuctionUseCase } from '../port/in/delete-auction.use-case';
import { DeleteAuctionService } from './delete-auction.service';
import { PresignedUrlUseCase } from '../port/in/presigned-url.use-case';
import { PresignedUrlService } from './presigned-url.service';
import { AuctionUseCase } from '../port/in/auction.use-case';
import { AuctionService } from './auction.service';
import { CreateAuctionBidderUseCase } from '../port/in/create-auction-bidder.use-case';
import { CreateAuctionBidderService } from './create-auction-bidder.service';
import { AuctionBiddersUseCase } from '../port/in/auction-bidders.use-case';
import { AuctionBiddersService } from './auction-bidders.service';
import { AuctionsByIdsUseCase } from '../port/in/auctions-by-ids.use-case';
import { AuctionsByIdsService } from './auctions-by-ids.service';
import { CreateAuctionBidderKafkaService } from './create-auction-bidder-kafka.service';
import { CreateAuctionBidderKafkaUseCase } from '../port/in/create-auction-bidder-kafka.use-case';
import { CreateAuctionBidderBatchUseCase } from '../port/in/create-auction-bidder-batch.use-case';
import { CreateAuctionBidderBatchService } from './create-auction-bidder-batch.service';
import { AuctionSoldUseCase } from '../port/in/auction-sold.use-case';
import { AuctionSoldService } from './auction-sold.service';
import { AuctionViewedUseCase } from '../port/in/view-auction-batch.use-case';
import { ViewAuctionBatchService } from './view-auction-batch.service';

export const auctionUseCaseProviders: Provider[] = [
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
