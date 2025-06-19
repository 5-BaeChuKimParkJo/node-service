import AuctionDomain, { AuctionProps } from '../../domain/model/auction.domain';
import { AuctionsResponse } from '../port/dto/auctions.response';
import { HttpStatus, Injectable } from '@nestjs/common';
import { AuctionFileStoragePort } from '../port/out/auction-file-storage-port';
import { ErrorCode, AppException } from '@app/common';

@Injectable()
export class AuctionMapper {
  constructor(private readonly auctionFileStoragePort: AuctionFileStoragePort) {}

  toResponse = (auction: AuctionDomain): AuctionsResponse['items'][number] => {
    const snapshot = auction.getSnapshot();

    return {
      auctionUuid: snapshot.auctionUuid,
      createdAt: snapshot.createdAt,
      viewCount: snapshot.viewCount,
      title: snapshot.title,
      description: snapshot.description,
      minimumBid: snapshot.minimumBid,
      startAt: snapshot.startAt,
      endAt: snapshot.endAt,
      isDirectDeal: snapshot.isDirectDeal,
      productCondition: snapshot.productCondition,
      thumbnailUrl: this.auctionFileStoragePort.toFullUrl(snapshot.thumbnailKey),
      sellerUuid: snapshot.sellerUuid,
      status: this.mapAuctionStatus(snapshot),
      categoryId: snapshot.categoryId,
      directDealLocation: snapshot.directDealLocation,
      tagIds: snapshot.tagIds,
      images: snapshot.images.map((image) => ({
        auctionImageId: image.auctionImageId,
        url: this.auctionFileStoragePort.toFullUrl(image.key),
        order: image.order,
      })),
    };
  };

  private mapAuctionStatus = ({ endAt, startAt, status }: Pick<AuctionProps, 'status' | 'startAt' | 'endAt'>) => {
    if (status === 'visible') {
      const now = new Date();
      if (now < startAt) {
        return 'waiting';
      } else if (now > endAt) {
        return 'ended';
      } else {
        return 'active';
      }
    } else {
      const _exhaustiveCheck: never = status;
      throw new AppException(
        { message: status + '는 유효하지 않은 상태입니다.', code: ErrorCode.INTERNAL_VALIDATION_ERROR },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  };
}
