import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { PaymentState } from '../../../domain/payment-state';
import { PaymentStorePort } from '../../../application/port/out/payment-store.port';

@Injectable()
export class PaymentPrismaAdapter extends PaymentStorePort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  private async load(
    client: Pick<PrismaService, 'auctions' | 'auctionPurchase'>,
    auctionUuid: string,
  ): Promise<PaymentState> {
    const auction = await client.auctions.findUnique({ where: { auctionUuid } });
    if (!auction) throw new NotFoundException('Auction not found');
    const purchase = await client.auctionPurchase.findUnique({
      where: { auctionUuid },
      include: { attempts: { orderBy: { attemptNumber: 'asc' } } },
    });
    return { auction, purchase };
  }

  read(auctionUuid: string) {
    return this.load(this.prisma, auctionUuid);
  }

  async auctionForOrder(orderId: string) {
    const attempt = await this.prisma.auctionPaymentAttempt.findUnique({
      where: { orderId },
      select: { purchase: { select: { auctionUuid: true } } },
    });
    return attempt?.purchase.auctionUuid ?? null;
  }

  async locked<T>(auctionUuid: string, work: (state: PaymentState) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      // All payment mutations share the same lock as the guarded bid UPDATE.
      const rows = await tx.$queryRaw<Array<{ auctionUuid: string }>>`
        SELECT "auctionUuid" FROM "Auctions" WHERE "auctionUuid" = ${auctionUuid}::uuid FOR UPDATE`;
      if (!rows.length) throw new NotFoundException('Auction not found');
      const state = await this.load(tx, auctionUuid);
      const lockedAt = state.auction.checkoutLockedAt;
      const result = await work(state);
      if (state.auction.checkoutLockedAt !== lockedAt) {
        await tx.auctions.update({
          where: { auctionUuid },
          data: { checkoutLockedAt: state.auction.checkoutLockedAt },
        });
      }
      if (state.purchase) {
        const { attempts, ...purchase } = state.purchase;
        await tx.auctionPurchase.upsert({
          where: { auctionUuid },
          create: purchase,
          update: { status: purchase.status, paidAt: purchase.paidAt },
        });
        for (const attempt of attempts) {
          const { orderId, createdAt, confirmIdempotencyKey, cancelIdempotencyKey, ...mutable } = attempt;
          await tx.auctionPaymentAttempt.upsert({
            where: { orderId },
            create: { ...attempt, purchaseUuid: purchase.purchaseUuid },
            update: mutable,
          });
        }
      }
      return result;
    });
  }
}
