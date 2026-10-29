import { Injectable, NotFoundException } from '@nestjs/common';
import { SavedAuctionRepositoryPort } from '../port/out/saved-auction-repository.port';
import type { SavedAuctionListResult } from '../model/saved-auction.result';

@Injectable()
export class SavedAuctionService {
  constructor(private readonly repository: SavedAuctionRepositoryPort) {}

  async list(memberUuid: string, cursor: string | null, now = new Date()): Promise<SavedAuctionListResult> {
    const page = await this.repository.list(memberUuid, cursor);
    return {
      items: page.items.map((row) => ({
        ...row,
        startAt: row.startAt.toISOString(),
        endAt: row.endAt.toISOString(),
        savedAt: row.savedAt.toISOString(),
        status: now >= row.endAt ? 'ended' : now < row.startAt ? 'waiting' : 'active',
      })),
      nextCursor: page.nextCursor,
    };
  }

  async state(memberUuid: string, auctionUuid: string): Promise<{ saved: boolean }> {
    const saved = await this.repository.state(memberUuid, auctionUuid);
    if (saved === null) throw new NotFoundException('Auction is not available');
    return { saved };
  }

  async save(memberUuid: string, auctionUuid: string): Promise<{ saved: true }> {
    if (!(await this.repository.save(memberUuid, auctionUuid))) throw new NotFoundException('Auction is not available');
    return { saved: true };
  }

  async remove(memberUuid: string, auctionUuid: string): Promise<{ saved: false }> {
    await this.repository.remove(memberUuid, auctionUuid);
    return { saved: false };
  }
}
