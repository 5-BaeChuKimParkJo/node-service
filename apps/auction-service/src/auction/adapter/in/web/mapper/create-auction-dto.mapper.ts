import { parseISO } from 'date-fns';
import { toNumber } from '@app/common/utils/number.utils';
import { CreateAuctionRequestDto, CreateAuctionResponseDto } from '../dto/create-auction.dto';
import { CreateAuctionCommand } from 'apps/auction-service/src/auction/application/port/dto/create-auction.command';
import { CreateAuctionResponse } from 'apps/auction-service/src/auction/application/port/dto/create-auction.response';

export class CreateAuctionDtoMapper {
  static toCommand = (dto: CreateAuctionRequestDto): CreateAuctionCommand => {
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

  static fromResponse = (response: CreateAuctionResponse): CreateAuctionResponseDto => {
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
      images: response.images.map(
        (image) =>
          ({
            auctionImageId: toNumber(image.auctionImageId),
            url: image.url,
            order: image.order,
          }) satisfies CreateAuctionResponseDto['images'][number],
      ),
    };
  };
}
