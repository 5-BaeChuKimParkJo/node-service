import { AuctionsCommand } from '../../../../application/model/auctions.command';
import { isValid, parseISO } from 'date-fns';
import { AuctionsRequest, AuctionsResponse } from '../dto/auctions.dto';
import { AuctionsResult } from '../../../../application/model/auctions.result';
import { toNumber } from '@app/common/utils/number.utils';

export class AuctionsWebMapper {
  static toCommand = (dto: AuctionsRequest): AuctionsCommand => {
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

  static fromResponse = (response: AuctionsResult): AuctionsResponse => {
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
            soldAt: item.soldAt?.toISOString() ?? null,
            sellerUuid: item.sellerUuid,
            tagIds: item.tagIds,
            images: item.images.map(
              (image) =>
                ({
                  auctionImageId: toNumber(image.auctionImageId),
                  url: image.url,
                  order: image.order,
                }) satisfies AuctionsResponse['items'][number]['images'][number],
            ),
          }) satisfies AuctionsResponse['items'][number],
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
