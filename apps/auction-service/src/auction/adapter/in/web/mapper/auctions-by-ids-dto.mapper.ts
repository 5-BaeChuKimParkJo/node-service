import { toNumber } from '@app/common/utils/number.utils';
import { AuctionsByIdsItemResponseDto, AuctionsByIdsRequestDto } from '../dto/auctions-by-ids.dto';
import { AuctionsByIdsCommand } from 'apps/auction-service/src/auction/application/port/dto/auctions-by-ids.command';
import { AuctionsByIdsResponse } from 'apps/auction-service/src/auction/application/port/dto/auctions-by-ids.response';

export class AuctionsByIdsDtoMapper {
  static toCommand = (dto: AuctionsByIdsRequestDto): AuctionsByIdsCommand => {
    return {
      type: 'user',
      ids: dto.ids,
    };
  };

  static fromResponse = (response: AuctionsByIdsResponse): AuctionsByIdsItemResponseDto[] => {
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
              }) satisfies AuctionsByIdsItemResponseDto['images'][number],
          ),
        }) satisfies AuctionsByIdsItemResponseDto,
    );
  };
}
