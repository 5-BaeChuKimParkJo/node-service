import type { SellerAuctionChange } from '../../model/seller-auction.command';
import type { SellerAuctionResult } from '../../model/seller-auction.result';
export abstract class SellerAuctionPort {
  abstract read(memberUuid: string, auctionUuid: string): Promise<SellerAuctionResult | null>;
  abstract change(memberUuid: string, auctionUuid: string, command: SellerAuctionChange): Promise<void>;
}
