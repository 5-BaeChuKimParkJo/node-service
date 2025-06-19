import AuctionAdminDomain, { AuctionAdminProps } from '../../domain/model/auction-admin.domain';
import { HttpStatus, Injectable } from '@nestjs/common';
import { AuctionFileStoragePort } from '../port/out/auction-file-storage-port';
import { AuctionsAdminResponse } from '../port/dto/auctions-admin.response';
import { AppException, ErrorCode } from '@app/common';

@Injectable()
export class AuctionAdminMapper {
  constructor(private readonly auctionFileStoragePort: AuctionFileStoragePort) {}

  toResponse = (auctionAdmin: AuctionAdminDomain): AuctionsAdminResponse['items'][number] => {
    const snapshot = auctionAdmin.getSnapshot();

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

  private mapAuctionStatus = ({ endAt, startAt, status }: Pick<AuctionAdminProps, 'status' | 'startAt' | 'endAt'>) => {
    if (status === 'cancelled' || status === 'hidden') {
      return status;
    } else if (status === 'visible') {
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
