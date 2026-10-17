# Winning Bidder Checkout
Date: 2026-10-17

## Scope
Only the winning bidder pays the frozen final bid after auction end. No deposit,
seller payout, partial refund, automatic charge, or live-mode keys.
Use the existing Nest auction service, Next customer UI and Spring/React admin.
Keep payment state separate from Auctions.soldAt (historical trade completion).

## Data and Safety
Add Auctions.checkoutLockedAt DateTime?; lock the auction row during prepare and
freeze winner, amount and title in one unique purchase per auction. Bid writes must
reject checkoutLockedAt != null, ended, hidden, cancelled or deleted auctions.
Purchase has unique auction UUID, buyer/seller UUIDs, positive BigInt amount,
orderName, random UUID customerKey, status, timestamps and payment attempts.
Each attempt has unique orderId, optional unique paymentKey, persisted confirm
and cancel idempotency keys and status. Uncertain remote results must remain
UNKNOWN/CONFIRMING: query Toss and never offer another charge until resolved.
A terminal failed/expired attempt can be replaced; canceled purchases cannot.
No secret or full card data in responses/logs. DTO money is decimal strings and
dates ISO strings to survive the existing global interceptor.

## HTTP Contract
Prefix in Nest: /api/v1; via Kong/customer server: /auction-service/api/v1.
Authenticated ownership uses @JwtUser(), not a trusted arbitrary member header.
GET /auctions/:uuid/checkout returns CheckoutView, no writes.
POST /auctions/:uuid/checkout prepares/reuses an attempt, winner only.
POST /auctions/:uuid/checkout/confirm body {orderId,paymentKey,amount:string}
POST /auctions/:uuid/checkout/reconcile body {}.
POST /payments/toss/webhook verifies a known order by querying Toss, never trusts
the webhook's payment status/amount. Normal payment webhooks have no signature.
Internal-token protected:
GET /internal/admin/auctions/:uuid/payment returns CheckoutView
POST /internal/admin/auctions/:uuid/payment/cancel body {reason:string(5..500)}
and x-admin-actor. Full cancellation only.
POST /internal/admin/auctions/:uuid/payment/reconcile body {} and x-admin-actor.
Explicit reconciliation queries Toss first and may safely resume the original
pending confirmation/cancellation with its original stored body/key, never a
new order. It must not replay after the provider idempotency window or after a
provider identity mismatch/unsupported state. Webhooks query only, never replay.

CheckoutView = {
 enabled:boolean, auctionUuid:string, eligible:boolean, reason:string|null,
 clientKey:string|null,
 purchase:null|{
  purchaseUuid:string,buyerUuid:string,sellerUuid:string,amount:string,
  orderName:string,customerKey:string,status:'AWAITING_PAYMENT'|'PAID'|'CANCELED',
  paidAt:string|null,
  attempt:null|{
   orderId:string,status:'READY'|'CONFIRMING'|'UNKNOWN'|'WAITING_FOR_DEPOSIT'|
    'DONE'|'CANCELING'|'CANCELED'|'ABORTED'|'EXPIRED',
   method:string|null,approvedAt:string|null,cancelReason:string|null,
   errorCode:string|null
  }
 }
}
GET not-winner -> 403; before end/missing bids can return eligible:false/reason.
Admin gets the same shape, eligible:false and clientKey:null.
Provider DONE alone plus exact key/orderId/amount/currency checks can set PAID.
Cancellation and terminal states cannot regress from stale webhooks.

## Provider
Use v2 standard order-page widgets(), test_gck_ client and test_gsk_ secret.
TOSS_PAYMENTS_ENABLED=false by default. TOSS_CLIENT_KEY, TOSS_SECRET_KEY.
Server calls fixed https://api.tosspayments.com/v1 with Basic secret-colon and
persisted Idempotency-Key for POST. Request timeout then reconcile safely.
Client fetches public clientKey from authorized CheckoutView, never secret.
Success URL parameters are untrusted until server confirms. Pending virtual
accounts are not PAID. Tests use a fake provider; no financial requests now.

## UI
Customer: winner-only entry on ended detail, checkout, success and fail routes
under /auctions/[id]/checkout. Explicit prepare click; never POST on server render.
Order-page payment methods/agreement widgets, amount from server. Unknown state
offers reconcile, not a new charge. Errors have retry/back actions.
Admin: payment tab shows buyer, amount, orderId, provider/local status, paid time;
full test cancellation requires a reason/confirmation and handles pending state.

## Acceptance
Reject another bidder, seller, pre-end, deleted/hidden/cancelled auction and
tampered amount. Repeat prepare/confirm cannot double-charge. Lost confirm or
cancel responses reconcile. Forged webhook cannot mark paid. Concurrent delayed
bid cannot change the frozen winner. Browser mobile and desktop remain usable.
Keys and production migration/deployment are separate manual release steps.

