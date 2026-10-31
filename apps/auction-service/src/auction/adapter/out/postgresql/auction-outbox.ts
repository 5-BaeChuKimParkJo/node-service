import type { Prisma } from '../../../../prisma/generated';
import type { PrismaService } from '../../../../prisma/prisma.service';
import type Auction from '../../../domain/model/auction';
import type { TaxonomyUseCase } from '../../../../taxonomy/application/port/in/taxonomy.use-case';
import type { S3Service } from '@app/common/s3/s3.service';
import type { KafkaAuctionServiceOutboxTopicValue } from '@app/common/schema/kafka-auction-service-outbox-topic.schema';
import { toNumber } from '@app/common/utils/number.utils';

export async function writeAuctionOutbox(
  auction: Auction,
  op: 'c' | 'u' | 'd',
  prisma: PrismaService | Prisma.TransactionClient,
  taxonomyService: TaxonomyUseCase,
  s3Service: S3Service,
): Promise<void> {
  const snapshot = auction.getSnapshot();
  const { auctionId: _, demoTemplateUuid: _demoTemplateUuid, ...row } = snapshot;
  const taxonomy = await taxonomyService.resolveNames(row.categoryId, row.tagIds);
  const event: KafkaAuctionServiceOutboxTopicValue = {
    aggregateType: 'auction',
    aggregateId: snapshot.auctionUuid,
    eventType: op === 'c' ? 'AuctionCreated' : op === 'u' ? 'AuctionUpdated' : 'AuctionDeleted',
    op,
    payload: {
      ...row,
      ...taxonomy,
      currentBid: toNumber(row.currentBid),
      minimumBid: toNumber(row.minimumBid),
      viewCount: toNumber(row.viewCount),
      thumbnailUrl: s3Service.toFullUrl(row.thumbnailKey),
      images: snapshot.images.map((image) => ({
        ...image,
        auctionImageId: toNumber(image.auctionImageId),
        url: s3Service.toFullUrl(image.key),
      })),
    },
  };
  await prisma.outbox.create({ data: event });
}
