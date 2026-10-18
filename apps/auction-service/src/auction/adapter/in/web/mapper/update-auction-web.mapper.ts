import { parseISO } from 'date-fns';
import { toNumber } from '@app/common/utils/number.utils';
import { UpdateAuctionRequest, UpdateAuctionResponse } from '../dto/update-auction.dto';
import { UpdateAuctionCommand } from '../../../../application/model/update-auction.command';
import { UpdateAuctionResult } from '../../../../application/model/update-auction.result';

export class UpdateAuctionWebMapper {
  static toCommand = (auctionUuid: string, dto: UpdateAuctionRequest): UpdateAuctionCommand => {
    return {
      auctionUuid: auctionUuid,
      description: dto.description,
      title: dto.title,
      minimumBid: dto.minimumBid ? BigInt(dto.minimumBid) : undefined,
      startAt: dto.startAt ? parseISO(dto.startAt) : undefined,
      endAt: dto.endAt ? parseISO(dto.endAt) : undefined,
      images: dto.images
        ? dto.images.map((image) => ({
            key: image.key,
            order: image.order,
          }))
        : undefined,
      isDirectDeal: dto.isDirectDeal,
      directDealLocation: dto.directDealLocation,
      productCondition: dto.productCondition,
      thumbnailKey: dto.thumbnailKey,
      categoryId: dto.categoryId,
      tagIds: dto.tagIds,
      ...(dto.soldAt !== undefined && { soldAt: dto.soldAt === null ? null : parseISO(dto.soldAt) }),
    };
  };

  static fromResponse = (response: UpdateAuctionResult): UpdateAuctionResponse => {
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
          }) satisfies UpdateAuctionResponse['images'][number],
      ),
    };
  };
}
