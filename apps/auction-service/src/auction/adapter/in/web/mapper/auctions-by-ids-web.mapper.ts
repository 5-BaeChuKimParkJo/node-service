import { toNumber } from '@app/common/utils/number.utils';
import { AuctionsByIdsItemResponse, AuctionsByIdsRequest } from '../dto/auctions-by-ids.dto';
import { AuctionsByIdsCommand } from '../../../../application/model/auctions-by-ids.command';
import { AuctionsByIdsResult } from '../../../../application/model/auctions-by-ids.result';

export class AuctionsByIdsWebMapper {
  static toCommand = (dto: AuctionsByIdsRequest): AuctionsByIdsCommand => {
    return {
      type: 'user',
      ids: dto.ids,
    };
  };

  static fromResponse = (response: AuctionsByIdsResult): AuctionsByIdsItemResponse[] => {
    return response.map(
      (item) =>
        ({
          auctionUuid: item.auctionUuid,
          categoryId: item.categoryId,
          title: item.title,
          description: item.description,
          minimumBid: toNumber(item.minimumBid),
          startAt: item.startAt.toISOString(),
          endAt: item.endAt.toISOString(),
          isDirectDeal: item.isDirectDeal,
          directDealLocation: item.directDealLocation,
          status: item.status,
          productCondition: item.productCondition,
          viewCount: toNumber(item.viewCount),
          thumbnailUrl: item.thumbnailUrl,
          createdAt: item.createdAt.toISOString(),
          sellerUuid: item.sellerUuid,
          tagIds: item.tagIds,
          images: item.images.map(
            (image) =>
              ({
                auctionImageId: toNumber(image.auctionImageId),
                url: image.url,
                order: image.order,
              }) satisfies AuctionsByIdsItemResponse['images'][number],
          ),
        }) satisfies AuctionsByIdsItemResponse,
    );
  };
}
