import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type AttemptStatus = 'READY' | 'CONFIRMING' | 'UNKNOWN' | 'WAITING_FOR_DEPOSIT' | 'DONE' | 'CANCELING' | 'CANCELED' | 'ABORTED' | 'EXPIRED';
export type PaymentAttempt = {
  orderId: string; attemptNumber: number; paymentKey: string | null; confirmIdempotencyKey: string; cancelIdempotencyKey: string;
  status: AttemptStatus; method: string | null; approvedAt: Date | null; cancelReason: string | null;
  cancelActor: string | null; errorCode: string | null; createdAt: Date;
  confirmRequestedAt: Date | null; cancelRequestedAt: Date | null;
  operationLeaseUntil: Date | null; operationLeaseToken: string | null;
};
export type Purchase = {
  purchaseUuid: string; auctionUuid: string; buyerUuid: string; sellerUuid: string; amount: bigint;
  orderName: string; customerKey: string; status: 'AWAITING_PAYMENT' | 'PAID' | 'CANCELED';
  paidAt: Date | null; attempts: PaymentAttempt[];
};
export type PaymentState = {
  auction: { auctionUuid: string; title: string; currentBid: bigint; currentBidderUuid: string | null;
    sellerUuid: string; endAt: Date; status: string; deletedAt: Date | null; checkoutLockedAt: Date | null; soldAt?: Date | null };
  purchase: Purchase | null;
};

export abstract class PaymentStore {
  abstract read(auctionUuid: string): Promise<PaymentState>;
  abstract auctionForOrder(orderId: string): Promise<string | null>;
  abstract locked<T>(auctionUuid: string, work: (state: PaymentState) => Promise<T>): Promise<T>;
}

@Injectable()
export class PrismaPaymentStore extends PaymentStore {
  constructor(private readonly prisma: PrismaService) { super(); }

  private async load(client: Pick<PrismaService, 'auctions' | 'auctionPurchase'>, auctionUuid: string): Promise<PaymentState> {
    const auction = await client.auctions.findUnique({ where: { auctionUuid } });
    if (!auction) throw new NotFoundException('Auction not found');
    const purchase = await client.auctionPurchase.findUnique({
      where: { auctionUuid }, include: { attempts: { orderBy: { attemptNumber: 'asc' } } },
    });
    return { auction, purchase };
  }

  read(auctionUuid: string) { return this.load(this.prisma, auctionUuid); }

  async auctionForOrder(orderId: string) {
    const attempt = await this.prisma.auctionPaymentAttempt.findUnique({ where: { orderId }, select: { purchase: { select: { auctionUuid: true } } } });
    return attempt?.purchase.auctionUuid ?? null;
  }

  async locked<T>(auctionUuid: string, work: (state: PaymentState) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async tx => {
      // All payment mutations share the same lock as the guarded bid UPDATE.
      const rows = await tx.$queryRaw<Array<{ auctionUuid: string }>>`
        SELECT "auctionUuid" FROM "Auctions" WHERE "auctionUuid" = ${auctionUuid}::uuid FOR UPDATE`;
      if (!rows.length) throw new NotFoundException('Auction not found');
      const state = await this.load(tx, auctionUuid);
      const lockedAt = state.auction.checkoutLockedAt;
      const result = await work(state);
      if (state.auction.checkoutLockedAt !== lockedAt) {
        await tx.auctions.update({ where: { auctionUuid }, data: { checkoutLockedAt: state.auction.checkoutLockedAt } });
      }
      if (state.purchase) {
        const { attempts, ...purchase } = state.purchase;
        await tx.auctionPurchase.upsert({ where: { auctionUuid }, create: purchase,
          update: { status: purchase.status, paidAt: purchase.paidAt } });
        for (const attempt of attempts) {
          const { orderId, createdAt, confirmIdempotencyKey, cancelIdempotencyKey, ...mutable } = attempt;
          await tx.auctionPaymentAttempt.upsert({ where: { orderId },
            create: { ...attempt, purchaseUuid: purchase.purchaseUuid }, update: mutable });
        }
      }
      return result;
    });
  }
}
