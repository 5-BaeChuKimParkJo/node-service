export type AttemptStatus =
  | 'READY'
  | 'CONFIRMING'
  | 'UNKNOWN'
  | 'WAITING_FOR_DEPOSIT'
  | 'DONE'
  | 'CANCELING'
  | 'CANCELED'
  | 'ABORTED'
  | 'EXPIRED';
export type PaymentAttempt = {
  orderId: string;
  attemptNumber: number;
  paymentKey: string | null;
  confirmIdempotencyKey: string;
  cancelIdempotencyKey: string;
  status: AttemptStatus;
  method: string | null;
  approvedAt: Date | null;
  cancelReason: string | null;
  cancelActor: string | null;
  errorCode: string | null;
  createdAt: Date;
  confirmRequestedAt: Date | null;
  cancelRequestedAt: Date | null;
  operationLeaseUntil: Date | null;
  operationLeaseToken: string | null;
};
export type Purchase = {
  purchaseUuid: string;
  auctionUuid: string;
  buyerUuid: string;
  sellerUuid: string;
  amount: bigint;
  orderName: string;
  customerKey: string;
  status: 'AWAITING_PAYMENT' | 'PAID' | 'CANCELED';
  paidAt: Date | null;
  attempts: PaymentAttempt[];
};
export type PaymentState = {
  auction: {
    auctionUuid: string;
    title: string;
    currentBid: bigint;
    currentBidderUuid: string | null;
    sellerUuid: string;
    endAt: Date;
    status: string;
    deletedAt: Date | null;
    checkoutLockedAt: Date | null;
    soldAt?: Date | null;
  };
  purchase: Purchase | null;
};
