import { Injectable } from '@nestjs/common';
import { MySalesQueryPort } from '../port/out/my-sales-query.port';
import type { MySalesQuery, MySalesResult } from '../model/my-sales.result';

@Injectable()
export class MySalesService {
  constructor(private readonly queryPort: MySalesQueryPort) {}

  async list(memberUuid: string, query: MySalesQuery, now = new Date()): Promise<MySalesResult> {
    const result = await this.queryPort.list(memberUuid, query, now);
    return {
      summary: result.summary,
      total: result.total,
      page: query.page,
      pageSize: 20,
      items: result.items.map((item) => ({
        auctionUuid: item.auctionUuid,
        title: item.title,
        thumbnailUrl: item.thumbnailUrl,
        minimumBid: item.minimumBid,
        currentBid: item.currentBid,
        bidCount: item.bidCount,
        status: item.status,
        startAt: item.startAt.toISOString(),
        endAt: item.endAt.toISOString(),
        createdAt: item.createdAt.toISOString(),
      })),
    };
  }
}
