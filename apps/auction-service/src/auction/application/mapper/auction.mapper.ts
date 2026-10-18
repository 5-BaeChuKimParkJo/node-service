import Auction, { AuctionProps } from '../../domain/model/auction';
import { AuctionsResult } from '../model/auctions.result';
import { HttpStatus, Injectable } from '@nestjs/common';
import { AuctionFileStoragePort } from '../port/out/auction-file-storage-port';
import { ErrorCode } from '@app/common/common/const';
import { AppException } from '@app/common/common/app.exception';

@Injectable()
export class AuctionMapper {
  constructor(private readonly auctionFileStoragePort: AuctionFileStoragePort) {}

  toResponse = (auction: Auction): AuctionsResult['items'][number] => {
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
      currentBidderUuid: snapshot.currentBidderUuid,
      productCondition: snapshot.productCondition,
      thumbnailUrl: this.auctionFileStoragePort.toFullUrl(snapshot.thumbnailKey),
      sellerUuid: snapshot.sellerUuid,
      status: this.mapAuctionStatus(snapshot),
      categoryId: snapshot.categoryId,
      directDealLocation: snapshot.directDealLocation,
      tagIds: snapshot.tagIds,
      soldAt: snapshot.soldAt,
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
