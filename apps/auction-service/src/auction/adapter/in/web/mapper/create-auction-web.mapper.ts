import { parseISO } from 'date-fns';
import { toNumber } from '@app/common/utils/number.utils';
import { CreateAuctionRequest, CreateAuctionResponse } from '../dto/create-auction.dto';
import { CreateAuctionCommand } from '../../../../application/model/create-auction.command';
import { CreateAuctionResult } from '../../../../application/model/create-auction.result';

export class CreateAuctionWebMapper {
  static toCommand = (dto: CreateAuctionRequest): CreateAuctionCommand => {
    return {
      description: dto.description,
      title: dto.title,
      minimumBid: BigInt(dto.minimumBid),
      startAt: parseISO(dto.startAt),
      endAt: parseISO(dto.endAt),
      images: dto.images.map((image) => ({
        key: image.key,
        order: image.order,
      })),
      isDirectDeal: dto.isDirectDeal,
      directDealLocation: dto.directDealLocation,
      productCondition: dto.productCondition,
      thumbnailKey: dto.thumbnailKey,
      categoryId: dto.categoryId,
      tagIds: dto.tagIds,
    };
  };

  static fromResponse = (response: CreateAuctionResult): CreateAuctionResponse => {
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
      images: response.images.map(
        (image) =>
          ({
            auctionImageId: toNumber(image.auctionImageId),
            url: image.url,
            order: image.order,
          }) satisfies CreateAuctionResponse['images'][number],
      ),
    };
  };
}
