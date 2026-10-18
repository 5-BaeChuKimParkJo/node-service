import AdminAuction from '../../domain/model/admin-auction';
import { Injectable } from '@nestjs/common';
import { AuctionFileStoragePort } from '../port/out/auction-file-storage-port';
import { AuctionAdminResult } from '../model/auction-admin.result';
import { AuctionAdminBidsResult } from '../model/auction-admin-bids.result';
import { AdminAuctionBidsReturn } from '../port/out/auction-repository.port.type';

@Injectable()
export class AuctionAdminMapper {
  constructor(private readonly auctionFileStoragePort: AuctionFileStoragePort) {}

  toResponse = (auctionAdmin: AdminAuction): AuctionAdminResult => {
    const snapshot = auctionAdmin.getSnapshot();

    return {
      auctionUuid: snapshot.auctionUuid,
      createdAt: snapshot.createdAt.toISOString(),
      viewCount: snapshot.viewCount,
      title: snapshot.title,
      description: snapshot.description,
      minimumBid: snapshot.minimumBid.toString(),
      currentBid: snapshot.currentBid.toString(),
      startAt: snapshot.startAt.toISOString(),
      endAt: snapshot.endAt.toISOString(),
      isDirectDeal: snapshot.isDirectDeal,
      productCondition: snapshot.productCondition,
      thumbnailUrl: this.auctionFileStoragePort.toFullUrl(snapshot.thumbnailKey),
      sellerUuid: snapshot.sellerUuid,
      status: auctionAdmin.getOperationalStatus(),
      visibility: snapshot.status,
      updatedAt: snapshot.updatedAt.toISOString(),
      deletedAt: snapshot.deletedAt?.toISOString() ?? null,
      version: snapshot.version,
      categoryId: snapshot.categoryId,
      directDealLocation: snapshot.directDealLocation,
      tagIds: snapshot.tagIds,
      currentBidderUuid: snapshot.currentBidderUuid,
      soldAt: snapshot.soldAt?.toISOString() ?? null,
      images: snapshot.images.map((image) => ({
        auctionImageId: image.auctionImageId,
        url: this.auctionFileStoragePort.toFullUrl(image.key),
        order: image.order,
      })),
    };
  };

  toBidsResponse = (result: AdminAuctionBidsReturn): AuctionAdminBidsResult => ({
    items: result.items.map((bid) => ({
      auctionBidderUuid: bid.auctionBidderUuid,
      bidderUuid: bid.bidderUuid,
      bidAmount: bid.bidAmount.toString(),
      createdAt: bid.createdAt,
    })),
    totalCount: result.totalCount,
    nextCursor: result.nextCursor,
  });
}
