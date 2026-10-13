import AuctionAdminDomain from '../../domain/model/auction-admin.domain';
import { Injectable } from '@nestjs/common';
import { AuctionFileStoragePort } from '../port/out/auction-file-storage-port';
import { AuctionAdminResponse } from '../port/dto/auction-admin.response';

@Injectable()
export class AuctionAdminMapper {
  constructor(private readonly auctionFileStoragePort: AuctionFileStoragePort) {}

  toResponse = (auctionAdmin: AuctionAdminDomain): AuctionAdminResponse => {
    const snapshot = auctionAdmin.getSnapshot();

    return {
      auctionUuid: snapshot.auctionUuid,
      createdAt: snapshot.createdAt,
      viewCount: snapshot.viewCount,
      title: snapshot.title,
      description: snapshot.description,
      minimumBid: snapshot.minimumBid.toString(),
      currentBid: snapshot.currentBid.toString(),
      startAt: snapshot.startAt,
      endAt: snapshot.endAt,
      isDirectDeal: snapshot.isDirectDeal,
      productCondition: snapshot.productCondition,
      thumbnailUrl: this.auctionFileStoragePort.toFullUrl(snapshot.thumbnailKey),
      sellerUuid: snapshot.sellerUuid,
      status: auctionAdmin.getOperationalStatus(),
      categoryId: snapshot.categoryId,
      directDealLocation: snapshot.directDealLocation,
      tagIds: snapshot.tagIds,
      currentBidderUuid: snapshot.currentBidderUuid,
      soldAt: snapshot.soldAt,
      images: snapshot.images.map((image) => ({
        auctionImageId: image.auctionImageId,
        url: this.auctionFileStoragePort.toFullUrl(image.key),
        order: image.order,
      })),
    };
  };

}
