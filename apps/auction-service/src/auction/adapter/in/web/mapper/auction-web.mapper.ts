import { AuctionCommand } from '../../../../application/model/auction.command';
import { toNumber } from '@app/common/utils/number.utils';
import { AuctionResponse } from '../dto/auction.dto';
import { AuctionResult } from '../../../../application/model/auction.result';

export class AuctionWebMapper {
  static toCommand = (auctionUuid: string): AuctionCommand => {
    return {
      type: 'user',
      auctionUuid,
    };
  };

  static fromResponse = (response: AuctionResult): AuctionResponse => {
    return {
      auctionUuid: response.auctionUuid,
      categoryId: response.categoryId,
      categoryName: response.categoryName,
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
      tagNames: response.tagNames,
      soldAt: response.soldAt?.toISOString() ?? null,
      images: response.images.map(
        (image) =>
          ({
            auctionImageId: toNumber(image.auctionImageId),
            url: image.url,
            order: image.order,
          }) satisfies AuctionResponse['images'][number],
      ),
    };
  };
}
