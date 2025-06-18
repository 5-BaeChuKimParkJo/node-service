import { AuctionsCommand } from 'apps/auction-service/src/auction/application/port/dto/auctions.command';
import { isValid, parseISO } from 'date-fns';
import { AuctionsRequestDto, AuctionsResponseDto } from '../dto/auctions.dto';
import { AuctionsResponse } from 'apps/auction-service/src/auction/application/port/dto/auctions.response';
import { toNumber } from '@app/common/utils/number.utils';

export class AuctionsDtoMapper {
  static toCommand = (dto: AuctionsRequestDto): AuctionsCommand => {
    const parsed = dto.createdAt ? parseISO(dto.createdAt) : undefined;
    const createdAt = parsed && isValid(parsed) ? parsed : undefined;
    return {
      type: 'user',
      cursor:
        dto.auctionUuid && createdAt
          ? {
              auctionUuid: dto.auctionUuid,
              createdAt,
            }
          : undefined,
    };
  };

  static fromResponse = (response: AuctionsResponse): AuctionsResponseDto => {
    return {
      items: response.items.map(
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
                }) satisfies AuctionsResponseDto['items'][number]['images'][number],
            ),
          }) satisfies AuctionsResponseDto['items'][number],
      ),
      nextCursor: response.nextCursor
        ? {
            auctionUuid: response.nextCursor.auctionUuid,
            createdAt: response.nextCursor.createdAt.toISOString(),
          }
        : null,
    };
  };
}
