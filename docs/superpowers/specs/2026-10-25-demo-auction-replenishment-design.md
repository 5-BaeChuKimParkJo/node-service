# Demo Auction Replenishment

Date: 2026-10-25 (Asia/Seoul).
Status: Design approved on 2026-10-25; implementation awaits plan review.

## Intent and Agreed Scope

Keep the portfolio usable without an operator repeatedly creating demo auctions.
The user selected the existing auction-service scheduler: inspect every five
minutes and create one auction only when no managed, active demo is available.
Preserve all existing auctions, bids, payments and ended-auction history.

## Approaches

- Selected: reuse the existing Nest scheduling infrastructure and demo creation
  validations. No additional service, Kubernetes Job or external scheduler.
- Alternative: a Kubernetes CronJob provides independent scheduling but adds a
  caller, credentials and deployment resources for this small application.
- Retaining manual-only creation remains possible by disabling replenishment,
  but does not meet the unattended availability goal.

## Policy

- The target is one available managed demo, not a hard global auction limit.
  If several already exist, skip; never delete, reset or force-end the surplus.
- An active candidate is visible, not deleted, not sold or checkout-locked,
  and satisfies `startAt <= now < endAt`. Existing bids do not disqualify it.
  This is auction availability, not a guarantee that a shared demo account can
  repeatedly outbid itself; existing bidding restrictions remain unchanged.
- Count the explicitly configured template itself if eligible, and new auctions
  recorded as children of that template. Never infer provenance from a title.
  Historical unmarked copies are retained without automatic backfill or revival.
- Manual creation remains a deliberate override: each accepted click may add a
  new auction even when one is active. Manual and automatic writes participate
  in the same database locking protocol; intentional manual additions are not
  treated as automatic-duplication failures.
- Keep the existing 1,000 KRW minimum, labelled demo title, no-real-delivery
  description, trusted seller/images and whole-hour 24-hour schedule. There are
  23 to 24 hours remaining when a new auction is created.

## Changes and Transaction Boundary

- Add a nullable, internal UUID provenance field, `demoTemplateUuid`, to
  `Auctions`, plus an appropriate lookup index. Existing rows remain null.
  No public request may set this field; the authenticated demo path supplies it.
- Keep domain/application code independent of Prisma and transport types.
  Reuse the existing taxonomy, image ownership/existence checks and domain rules.
- After external checks, use one PostgreSQL transaction for the demo decision
  and write: acquire a transaction-scoped advisory lock, recheck availability,
  then insert the auction, provenance and existing creation outbox entry.
  Do not hold a transaction while calling MinIO or open a nested independent
  creation transaction. Share the existing insert/outbox implementation.
- A busy automatic run skips rather than queues. Bounded manual contention may
  return a conflict, with no automatic client retry. The lock must work across
  multiple Pods, not only within one scheduler instance.
- A failure rolls back both the auction and outbox. After a successful commit
  with a lost response, the next automatic run observes the active row and skips.

## Scheduling and Operation

- Add an auction-service scheduling adapter using the existing five-minute cron
  pattern and per-instance overlap prevention, backed by the database lock.
- `DEMO_AUCTION_AUTO_ENABLED` defaults to false; only explicit `true` enables it.
  Continue using `DEMO_AUCTION_TEMPLATE_UUID`. ON/OFF is a GitOps environment
  setting in this iteration, not a new administrator screen or public endpoint.
- Run on scheduled ticks only, without startup catch-up or historical replay.
  The availability gap can be up to five minutes after expiry or a restart.
- Missing/invalid templates or unavailable storage/database cause a logged failure
  and no insert. Retry only on a later tick; never create a burst of backfill.
- Keep normal logs restrained: creation at info, failures at warning, routine
  skips at debug. Never log credentials. Do not fabricate views, bids or ranking.

## Verification and Release

- Unit tests: disabled flag, active candidate, expiry boundary, hidden/deleted/
  sold/checkout-locked exclusion, invalid template and failed external checks.
- Isolated PostgreSQL tests: simultaneous runs create one managed auction and
  one outbox entry; lock contention; transaction rollback; post-commit retry;
  manual/automatic coordination; spoofed public provenance is not persisted.
- Preserve manual creation/authentication regression coverage and existing payment
  tests. Use only disposable local/CI databases, never the production database.
- Use an additive migration before enabling the scheduler. Run existing quality,
  build and Linux CI gates, then enable only the homelab GitOps environment.
  Verify one real scheduled creation, a subsequent skip, unchanged source history
  and search projection. Do not place test bids or invoke payment providers.
- Rollback: set the flag to false or revert the image. Retain the additive column
  and created records; no destructive rollback or cleanup of financial history.
