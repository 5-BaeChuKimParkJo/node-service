import { isValid, parseISO } from 'date-fns';
import { AuctionBiddersRequest, AuctionBiddersResponse } from '../dto/auction-bidders.dto';
import { AuctionBiddersCommand } from '../../../../application/model/auction-bidders.command';
import { AuctionBiddersResult } from '../../../../application/model/auction-bidders.result';

export class AuctionBiddersWebMapper {
  static toCommand = (auctionUuid: string, dto: AuctionBiddersRequest): AuctionBiddersCommand => {
    const parsed = dto.createdAt ? parseISO(dto.createdAt) : undefined;
    const createdAt = parsed && isValid(parsed) ? parsed : undefined;
    return {
      auctionUuid: auctionUuid,
      cursor:
        dto.bidAmount && createdAt
          ? {
              bidAmount: BigInt(dto.bidAmount),
              createdAt,
            }
          : undefined,
    };
  };

  static fromResponse = (response: AuctionBiddersResult): AuctionBiddersResponse => {
    return {
      items: response.items.map((item) => ({
        auctionUuid: item.auctionUuid,
        bidderUuid: item.bidderUuid,
        bidAmount: Number(item.bidAmount),
        createdAt: item.createdAt.toISOString(),
      })),
      nextCursor: response.nextCursor
        ? {
            bidAmount: Number(response.nextCursor.bidAmount),
            createdAt: response.nextCursor.createdAt.toISOString(),
          }
        : null,
    };
  };
}
