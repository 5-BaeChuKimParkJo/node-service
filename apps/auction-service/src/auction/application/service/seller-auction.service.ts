import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import { SellerAuctionPort } from '../port/out/seller-auction.port';
import { parseSellerAuctionChange } from '../../domain/model/seller-auction-policy';

@Injectable()
export class SellerAuctionService {
  constructor(private readonly auctions: SellerAuctionPort) {}
  private ids(memberUuid: string, auctionUuid: string) {
    if (!z.string().uuid().safeParse(memberUuid).success || !z.string().uuid().safeParse(auctionUuid).success)
      throw new BadRequestException('Invalid seller auction identity');
  }
  async read(memberUuid: string, auctionUuid: string) {
    this.ids(memberUuid, auctionUuid);
    const result = await this.auctions.read(memberUuid, auctionUuid);
    if (!result) throw new NotFoundException('Seller auction not found');
    return result;
  }
  async change(memberUuid: string, auctionUuid: string, input: unknown, action: 'update' | 'cancel'): Promise<void> {
    this.ids(memberUuid, auctionUuid);
    let command;
    try {
      command = parseSellerAuctionChange(input, action);
    } catch {
      throw new BadRequestException('Invalid seller auction change');
    }
    await this.auctions.change(memberUuid, auctionUuid, command);
  }
}
