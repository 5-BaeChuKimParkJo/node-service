import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PaymentAttempt, PaymentState } from '../../domain/payment-state';
import { PaymentStorePort } from '../port/out/payment-store.port';
import {
  PaymentProviderResult,
  PaymentProviderPort,
  PaymentProviderUnavailable,
} from '../port/out/payment-provider.port';

export type ConfirmPayment = { orderId: string; paymentKey: string; amount: string };
export type CheckoutView = ReturnType<PaymentService['view']>;
type ProviderAction = {
  kind: 'confirm' | 'cancel';
  orderId: string;
  paymentKey: string;
  amount: number;
  reason: string | null;
  key: string;
  leaseToken: string;
};
const terminal = new Set(['ABORTED', 'EXPIRED', 'CANCELED']);

@Injectable()
export class PaymentService {
  constructor(
    private readonly store: PaymentStorePort,
    private readonly provider: PaymentProviderPort,
    private readonly config: ConfigService,
  ) {}

  private enabled() {
    return this.config.get('TOSS_PAYMENTS_ENABLED') === true;
  }
  private requireEnabled() {
    if (!this.enabled()) throw new ServiceUnavailableException('Test payments disabled');
  }
  private owner(state: PaymentState, memberUuid: string) {
    const owner = state.purchase?.buyerUuid ?? state.auction.currentBidderUuid;
    if (memberUuid === state.auction.sellerUuid || memberUuid !== owner) throw new ForbiddenException('Winner only');
  }
  private reason(state: PaymentState) {
    const a = state.auction;
    if (a.deletedAt || a.status !== 'visible') return 'AUCTION_UNAVAILABLE';
    if (a.endAt.getTime() > Date.now()) return 'AUCTION_NOT_ENDED';
    if (!a.currentBidderUuid) return 'NO_WINNING_BID';
    if (a.currentBidderUuid === a.sellerUuid) return 'INVALID_WINNER';
    if (a.soldAt && !state.purchase) return 'AUCTION_ALREADY_SOLD';
    if (a.currentBid <= 0n || a.currentBid > BigInt(Number.MAX_SAFE_INTEGER)) return 'INVALID_AMOUNT';
    if (state.purchase?.status === 'CANCELED') return 'PURCHASE_CANCELED';
    if (state.purchase?.status === 'PAID') return 'ALREADY_PAID';
    return null;
  }
  private latest(state: PaymentState) {
    return state.purchase?.attempts.at(-1) ?? null;
  }

  view(state: PaymentState, memberUuid?: string) {
    const reason = !this.enabled() ? 'PAYMENTS_DISABLED' : this.reason(state);
    const p = state.purchase;
    const a = this.latest(state);
    const eligible = !!memberUuid && !reason;
    return {
      enabled: this.enabled(),
      auctionUuid: state.auction.auctionUuid,
      eligible,
      reason: memberUuid ? reason : null,
      clientKey: eligible ? (this.config.get<string>('TOSS_CLIENT_KEY') ?? null) : null,
      purchase: p
        ? {
            purchaseUuid: p.purchaseUuid,
            buyerUuid: p.buyerUuid,
            sellerUuid: p.sellerUuid,
            amount: p.amount.toString(),
            orderName: p.orderName,
            customerKey: p.customerKey,
            status: p.status,
            paidAt: p.paidAt?.toISOString() ?? null,
            attempt: a
              ? {
                  orderId: a.orderId,
                  status: a.status,
                  method: a.method,
                  approvedAt: a.approvedAt?.toISOString() ?? null,
                  cancelReason: a.cancelReason,
                  errorCode: a.errorCode,
                }
              : null,
          }
        : null,
    };
  }

  async get(auctionUuid: string, memberUuid?: string) {
    const state = await this.store.read(auctionUuid);
    if (memberUuid) this.owner(state, memberUuid);
    return this.view(state, memberUuid);
  }

  async prepare(auctionUuid: string, memberUuid: string) {
    this.requireEnabled();
    return this.store.locked(auctionUuid, async (state) => {
      this.owner(state, memberUuid);
      const reason = this.reason(state);
      if (reason && reason !== 'ALREADY_PAID') throw new ConflictException(reason);
      if (!state.purchase) {
        state.auction.checkoutLockedAt = new Date();
        state.purchase = {
          purchaseUuid: randomUUID(),
          auctionUuid,
          buyerUuid: memberUuid,
          sellerUuid: state.auction.sellerUuid,
          amount: state.auction.currentBid,
          orderName: state.auction.title.slice(0, 100),
          customerKey: randomUUID(),
          status: 'AWAITING_PAYMENT',
          paidAt: null,
          attempts: [],
        };
      }
      const last = this.latest(state);
      if (!last || last.status === 'ABORTED' || last.status === 'EXPIRED') {
        state.purchase.attempts.push({
          orderId: `auction_${randomUUID()}`,
          attemptNumber: (last?.attemptNumber ?? 0) + 1,
          paymentKey: null,
          confirmIdempotencyKey: randomUUID(),
          cancelIdempotencyKey: randomUUID(),
          status: 'READY',
          method: null,
          approvedAt: null,
          cancelReason: null,
          cancelActor: null,
          errorCode: null,
          createdAt: new Date(),
          confirmRequestedAt: null,
          cancelRequestedAt: null,
          operationLeaseUntil: null,
          operationLeaseToken: null,
        });
      }
      return this.view(state, memberUuid);
    });
  }

  async confirm(auctionUuid: string, memberUuid: string, body: ConfirmPayment) {
    this.requireEnabled();
    if (!/^[1-9]\d*$/.test(body.amount) || !body.paymentKey || body.paymentKey.length > 200)
      throw new BadRequestException('Invalid payment');
    const claim = await this.store.locked(auctionUuid, async (state) => {
      this.owner(state, memberUuid);
      const p = state.purchase;
      const a = this.latest(state);
      if (
        !p ||
        !a ||
        a.orderId !== body.orderId ||
        p.amount.toString() !== body.amount ||
        (a.paymentKey && a.paymentKey !== body.paymentKey)
      ) {
        throw new ConflictException('Payment does not match the frozen order');
      }
      if (a.status !== 'READY' || p.status !== 'AWAITING_PAYMENT') return null;
      if (this.reason(state)) throw new ConflictException('Auction unavailable');
      a.paymentKey = body.paymentKey;
      a.status = 'CONFIRMING';
      a.confirmRequestedAt = new Date();
      return this.claimAction(state, 'confirm');
    });
    if (claim) {
      await this.perform(auctionUuid, claim);
    } else {
      const action = await this.query(auctionUuid, body.orderId);
      if (action) await this.resume(auctionUuid, body.orderId, action);
    }
    return this.get(auctionUuid, memberUuid);
  }

  async reconcile(auctionUuid: string, memberUuid?: string) {
    this.requireEnabled();
    const state = await this.store.read(auctionUuid);
    if (memberUuid) this.owner(state, memberUuid);
    const a = this.latest(state);
    if (a) {
      const action = await this.query(auctionUuid, a.orderId);
      if (action) await this.resume(auctionUuid, a.orderId, action);
    }
    return this.get(auctionUuid, memberUuid);
  }

  async webhook(body: unknown) {
    this.requireEnabled();
    const event = body as { data?: { orderId?: unknown }; orderId?: unknown } | null;
    const orderId = event?.data?.orderId ?? event?.orderId;
    if (typeof orderId === 'string' && /^[A-Za-z0-9_-]{6,64}$/.test(orderId)) {
      const auctionUuid = await this.store.auctionForOrder(orderId);
      if (auctionUuid) await this.query(auctionUuid, orderId);
    }
    return { received: true };
  }

  async cancel(auctionUuid: string, actor: string, reason: string) {
    this.requireEnabled();
    if (
      typeof actor !== 'string' ||
      !actor.trim() ||
      actor.length > 200 ||
      typeof reason !== 'string' ||
      reason.trim().length < 5 ||
      reason.trim().length > 500
    )
      throw new BadRequestException('Actor and cancellation reason required');
    const claim = await this.store.locked(auctionUuid, async (state) => {
      const a = this.latest(state);
      if (state.purchase?.status === 'CANCELED') return null;
      if (!a?.paymentKey || !['DONE', 'WAITING_FOR_DEPOSIT', 'CANCELING'].includes(a.status))
        throw new ConflictException('Payment cannot be canceled yet; reconcile first');
      if (!a.cancelRequestedAt) {
        a.cancelRequestedAt = new Date();
        a.cancelReason = reason.trim();
        a.cancelActor = actor.trim();
      }
      a.status = 'CANCELING';
      return this.claimAction(state, 'cancel');
    });
    if (claim) {
      await this.perform(auctionUuid, claim);
    }
    return this.get(auctionUuid);
  }

  private claimAction(state: PaymentState, kind: ProviderAction['kind']): ProviderAction | null {
    const a = this.latest(state);
    if (!a?.paymentKey || !state.purchase) return null;
    const requestedAt = kind === 'cancel' ? a.cancelRequestedAt : a.confirmRequestedAt;
    if (!requestedAt || Date.now() - requestedAt.getTime() >= 14 * 86400000) {
      a.errorCode = 'IDEMPOTENCY_WINDOW_EXPIRED';
      return null;
    }
    if (a.operationLeaseUntil && a.operationLeaseUntil.getTime() > Date.now()) return null;
    a.operationLeaseUntil = new Date(Date.now() + 30000);
    a.operationLeaseToken = randomUUID();
    return {
      kind,
      orderId: a.orderId,
      paymentKey: a.paymentKey,
      amount: Number(state.purchase.amount),
      reason: a.cancelReason,
      key: kind === 'cancel' ? a.cancelIdempotencyKey : a.confirmIdempotencyKey,
      leaseToken: a.operationLeaseToken,
    };
  }

  private async resume(auctionUuid: string, orderId: string, kind: ProviderAction['kind']) {
    const claim = await this.store.locked(auctionUuid, async (state) => {
      const a = this.latest(state);
      if (
        !a ||
        a.orderId !== orderId ||
        ['PROVIDER_MISMATCH', 'PARTIAL_CANCELLATION_REVIEW'].includes(a.errorCode ?? '') ||
        state.purchase?.status === 'CANCELED'
      )
        return null;
      if (kind === 'cancel' && a.status === 'CANCELING') return this.claimAction(state, 'cancel');
      if (kind === 'confirm' && this.reason(state)) return null;
      if (
        kind === 'confirm' &&
        ['CONFIRMING', 'UNKNOWN'].includes(a.status) &&
        state.purchase?.status === 'AWAITING_PAYMENT'
      )
        return this.claimAction(state, 'confirm');
      return null;
    });
    if (claim) await this.perform(auctionUuid, claim);
  }

  private async perform(auctionUuid: string, claim: ProviderAction) {
    try {
      const remote =
        claim.kind === 'cancel'
          ? await this.provider.cancel(claim.paymentKey, claim.reason!, claim.key)
          : await this.provider.confirm(claim.orderId, claim.paymentKey, claim.amount, claim.key);
      await this.apply(auctionUuid, claim.orderId, remote);
    } catch (error) {
      await this.markUncertain(auctionUuid, claim.orderId, error);
      await this.query(auctionUuid, claim.orderId);
    } finally {
      await this.store.locked(auctionUuid, async (state) => {
        const a = state.purchase?.attempts.find((a) => a.orderId === claim.orderId);
        if (a?.operationLeaseToken === claim.leaseToken) {
          a.operationLeaseUntil = null;
          a.operationLeaseToken = null;
        }
      });
    }
  }

  private async markUncertain(auctionUuid: string, orderId: string, error: unknown) {
    await this.store.locked(auctionUuid, async (state) => {
      const a = state.purchase?.attempts.find((a) => a.orderId === orderId);
      if (!a || terminal.has(a.status) || a.status === 'DONE' || a.errorCode === 'PARTIAL_CANCELLATION_REVIEW') return;
      a.status = a.cancelRequestedAt ? 'CANCELING' : 'UNKNOWN';
      a.errorCode = error instanceof PaymentProviderUnavailable ? error.code : 'PROVIDER_UNAVAILABLE';
    });
  }

  private async query(auctionUuid: string, orderId: string): Promise<ProviderAction['kind'] | null> {
    try {
      const payment = await this.provider.lookup(orderId);
      if (payment) await this.apply(auctionUuid, orderId, payment);
      if (!payment || ['READY', 'IN_PROGRESS'].includes(payment.status)) return 'confirm';
      if (['DONE', 'WAITING_FOR_DEPOSIT'].includes(payment.status)) return 'cancel';
      return null;
    } catch (error) {
      await this.markUncertain(auctionUuid, orderId, error);
      return null;
    }
  }

  private async apply(auctionUuid: string, orderId: string, remote: PaymentProviderResult) {
    await this.store.locked(auctionUuid, async (state) => {
      const p = state.purchase;
      const a = p?.attempts.find((a) => a.orderId === orderId);
      if (!p || !a || terminal.has(a.status) || p.status === 'CANCELED') return;
      if (
        remote.orderId !== a.orderId ||
        !remote.paymentKey ||
        (a.paymentKey && remote.paymentKey !== a.paymentKey) ||
        !Number.isSafeInteger(remote.totalAmount) ||
        BigInt(remote.totalAmount) !== p.amount ||
        remote.currency !== 'KRW'
      ) {
        a.status = a.cancelRequestedAt ? 'CANCELING' : a.status === 'DONE' ? 'DONE' : 'UNKNOWN';
        a.errorCode = 'PROVIDER_MISMATCH';
        return;
      }
      // Only the latest attempt may settle a purchase; old terminal attempts remain immutable.
      if (this.latest(state)?.orderId !== orderId) return;
      a.paymentKey = remote.paymentKey;
      if (remote.status === 'CANCELED' && remote.balanceAmount === 0) {
        a.status = 'CANCELED';
        p.status = 'CANCELED';
        a.errorCode = null;
        return;
      }
      if (remote.status === 'PARTIAL_CANCELED') {
        a.status = 'UNKNOWN';
        a.errorCode = 'PARTIAL_CANCELLATION_REVIEW';
        return;
      }
      if (a.errorCode === 'PARTIAL_CANCELLATION_REVIEW') return;
      if (a.status === 'CANCELING') return;
      if (a.status === 'DONE') return;
      if (
        remote.status === 'DONE' &&
        remote.approvedAt &&
        Number.isFinite(Date.parse(remote.approvedAt)) &&
        remote.balanceAmount === remote.totalAmount
      ) {
        a.status = 'DONE';
        a.approvedAt = new Date(remote.approvedAt);
        a.method = remote.method ?? null;
        a.errorCode = null;
        p.status = 'PAID';
        p.paidAt = a.approvedAt;
      } else if (['ABORTED', 'EXPIRED', 'WAITING_FOR_DEPOSIT'].includes(remote.status)) {
        a.status = remote.status as PaymentAttempt['status'];
        a.method = remote.method ?? null;
        a.errorCode = null;
      } else if (a.status !== 'READY' || remote.status !== 'READY') {
        a.status = 'UNKNOWN';
        a.errorCode = 'UNRESOLVED_PROVIDER_STATUS';
      }
    });
  }
}
