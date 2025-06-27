import { AuctionCommand } from 'apps/auction-service/src/auction/application/port/dto/auction.command';
import { toNumber } from '@app/common/utils/number.utils';
import { AuctionResponseDto } from '../dto/auction.dto';
import { AuctionResponse } from 'apps/auction-service/src/auction/application/port/dto/auction.response';

export class AuctionDtoMapper {
  static toCommand = (auctionUuid: string): AuctionCommand => {
    return {
      type: 'user',
      auctionUuid,
    };
  };

  static fromResponse = (response: AuctionResponse): AuctionResponseDto => {
    return {
      auctionUuid: response.auctionUuid,
      categoryId: response.categoryId,
      title: response.title,
      description: response.description,
      minimumBid: toNumber(response.minimumBid),
      startAt: response.startAt.toISOString(),
      endAt: response.endAt.toISOString(),
      isDirectDeal: response.isDirectDeal,
      directDealLocation: response.directDealLocation,
      status: response.status,
      productCondition: response.productCondition,
      viewCount: toNumber(response.viewCount),
      thumbnailUrl: response.thumbnailUrl,
      createdAt: response.createdAt.toISOString(),
      sellerUuid: response.sellerUuid,
      tagIds: response.tagIds,
      soldAt: response.soldAt?.toISOString() ?? null,
      images: response.images.map(
        (image) =>
          ({
            auctionImageId: toNumber(image.auctionImageId),
            url: image.url,
            order: image.order,
          }) satisfies AuctionResponseDto['images'][number],
      ),
    };
  };
}
