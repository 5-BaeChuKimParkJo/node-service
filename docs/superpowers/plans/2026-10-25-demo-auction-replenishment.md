# Demo Auction Replenishment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Replenish one managed active demo when none is available, without resetting existing data.

**Architecture:** Extend the existing demo creation path with internal provenance and an atomic PostgreSQL decision/insert/outbox transaction. Add one existing-process Nest scheduler, disabled by default and enabled only through homelab GitOps after CI and migration checks.

**Tech Stack:** Existing Nest 11, Prisma 6, PostgreSQL, Nest Schedule, Vitest and GitOps. No new dependency or runtime service.

**Spec:** `docs/superpowers/specs/2026-10-25-demo-auction-replenishment-design.md`

## Global Constraints

- Work in `C:/01.Coding/BaeChuKimParkJo/node-service` and the existing sibling `cncn_private`; no new worktree.
- One scheduled check every five minutes; no startup catch-up or immediate retry loop.
- `DEMO_AUCTION_AUTO_ENABLED` defaults to false; only explicit string `true` enables it.
- Retain the existing trusted template setting, 1,000 KRW minimum and whole-hour 24-hour duration.
- Manual creation remains an explicit override; surplus demos are never automatically removed.
- Preserve existing auctions, bids, payments, public JSON, Kafka identities and ordinary creation behavior.
- Keep Prisma and transport types out of domain/application ports. Never accept browser-controlled provenance.
- Run database integration tests only with guarded disposable `TEST_DATABASE_URL`; never production or Tailscale databases.
- No frontend/BFF changes, artificial traffic/bids, payment-provider calls or destructive rollback.

## Review Focus

1. Source hidden/deleted while preflight runs: revalidate under the write transaction before inserting.
2. Another Pod or manual request owns the lock: skip automatic work promptly and reject manual contention without retry.
3. Transaction failure or response loss: no orphan outbox/auction, and no duplicate on the next automatic tick.
4. Extra public creation fields: ignore/reject provenance input; ordinary auctions remain unmarked.
5. Legacy data and configuration: count only trusted source/marked children, retain unmarked history and keep non-`true` values disabled.

---

## Task 1: Atomic Managed Demo Creation

**Files** (relative to `node-service`):
- Modify: `apps/auction-service/src/prisma/schema/schema.prisma`.
- Create: `apps/auction-service/src/prisma/schema/migrations/20261025010000_demo_auction_provenance/migration.sql`.
- Create: `apps/auction-service/src/auction/application/model/demo-auction-creation.command.ts` and `demo-auction-creation.result.ts`.
- Modify: `apps/auction-service/src/auction/application/port/in/create-auction.use-case.ts`.
- Modify: `apps/auction-service/src/auction/application/port/out/auction-repository.port.ts` and `auction-repository.port.type.ts`.
- Modify: `apps/auction-service/src/auction/application/service/create-auction.service.ts` and `demo-auction.service.ts`.
- Modify: `apps/auction-service/src/auction/adapter/out/postgresql/auction-prisma.adapter.ts`.
- Test: `apps/auction-service/src/auction/application/service/demo-auction.service.spec.ts` and new `create-auction.service.spec.ts`.
- Test: new `apps/auction-service/src/auction/adapter/out/postgresql/demo-auction-prisma.integration.spec.ts`.
- Test: existing `apps/auction-service/src/auction/adapter/in/web/demo-auction.controller.spec.ts` and new `apps/auction-service/src/auction/adapter/in/web/mapper/create-auction-web.mapper.spec.ts`.
- Modify: `scripts/run-payment-integration.mjs` to include the guarded new PostgreSQL suite.

**Interfaces:**
- `DemoAuctionCreationCommand = { templateUuid: string; mode: 'manual' | 'automatic'; now: Date }`.
- `DemoAuctionCreationResult = { status: 'created'; auction: CreateAuctionResult } | { status: 'skipped-active' | 'skipped-busy' }`.
- `CreateAuctionUseCase.executeDemo(command: CreateAuctionCommand, user: User, context: DemoAuctionCreationCommand): Promise<DemoAuctionCreationResult>`; retain `execute(command, user)` unchanged.
- `AuctionRepositoryPort.createDemoAuction(auction: NewAuction, context: DemoAuctionCreationCommand): Promise<DemoAuctionWriteResult>`.
- `DemoAuctionWriteResult` has the same discriminants but its created `auction` is the owned domain `Auction`, not a Prisma row.
- `DemoAuctionService.create(now?)` retains its existing response and turns busy contention into HTTP 409.
- `DemoAuctionService.ensureActive(now?): Promise<DemoAuctionCreationResult>` is the new scheduler-facing method.

- [ ] **Step 1: Write failing application/HTTP tests and run them.**
  Assert shared taxonomy/image/domain checks precede the repository write;
  failed checks never insert. Assert manual creation passes trusted provenance,
  automatic mode forwards skip outcomes, contention does not retry and existing
  manual response fields/auth rules remain unchanged. A public mapper test passes
  a forged `demoTemplateUuid` and proves it is absent from the owned command.
  Run targeted Vitest files above; expect missing new behavior to fail.

- [ ] **Step 2: Add the additive migration and implement the application interfaces.**
  Add nullable `demoTemplateUuid String? @db.Uuid` and an index on
  `[demoTemplateUuid, endAt]`; leave existing rows null. Keep provenance outside
  public DTOs and domain snapshots/event payloads. Share existing preflight and
  response mapping between ordinary and demo creation; keep public responses stable.
  Preserve the existing template validation and command construction in
  `DemoAuctionService`, sharing them between `create` and `ensureActive`.
  Generate the owned Prisma client with `npm run prisma:auction-service:generate`.

- [ ] **Step 3: Write and run failing guarded PostgreSQL tests.**
  Use random fixture UUIDs and the existing `_test`/loopback guard. Assert:
  zero candidates creates one marked row and one `AuctionCreated` outbox entry;
  active source or marked child skips; expired-at-now, future, hidden, deleted,
  sold and checkout-locked rows do not count; unmarked lookalikes do not count.
  For concurrency, release two independent clients together and assert:
  ```ts
  expect(results.filter(result => result.status === 'created')).toHaveLength(1);
  expect(await database.auctions.count({ where: { demoTemplateUuid: templateUuid } })).toBe(1);
  expect(await database.outbox.count({ where: { aggregateId: createdUuid, eventType: 'AuctionCreated' } })).toBe(1);
  ```
  Also hold the same advisory lock from another client to prove prompt busy
  results for both modes. Simulate outbox insertion failure using a test-only
  transaction-client wrapper and assert real PostgreSQL rolls back the row.
  Retry after successful commit and expect `skipped-active`. Serialize a manual
  creation followed by automatic work and expect one committed child; after an
  automatic creation a later deliberate manual request may add a second child.
  Recheck a source hidden after preflight and expect no insert. Preserve original
  fixture financial fields and clean only UUID-scoped fixtures/outbox records.
  Run `npm run test:payment:integration`; require actual PostgreSQL execution in CI,
  not a local skipped-suite result.

- [ ] **Step 4: Implement the single transaction in the existing Prisma adapter.**
  Use a transaction-scoped, nonblocking advisory lock keyed by the configured
  template namespace (`chalnak:demo:<UUID>`); parameterize the SQL. Both modes
  use the same key. On contention return `skipped-busy`. Inside that transaction,
  lock/read the template row, revalidate its demo label, visibility and deletion,
  and then check automatic candidates with these exact predicates:
  ```text
  (auctionUuid = templateUuid OR demoTemplateUuid = templateUuid)
  AND status = visible AND deletedAt IS NULL AND soldAt IS NULL
  AND checkoutLockedAt IS NULL AND startAt <= now AND endAt > now
  ```
  Automatic work with a candidate returns `skipped-active`. Otherwise insert
  the new row with provenance and the existing outbox entry in the same transaction.
  Extract `private insertAuction(auction: NewAuction, tx: Prisma.TransactionClient, demoTemplateUuid?: string): Promise<Auction>` from `createAuction` for both paths;
  do not nest an independent transaction or duplicate outbox construction.
  External image checks finish before entering this transaction.

- [ ] **Step 5: Verify and commit the atomic creation deliverable.**
  Run `npm run test:checks`, `npm run check:naming`, `npm run check:architecture`,
  `npm run check:format`, `npm run test:unit` and `npm run build:all`.
  Require zero failures; separately record whether guarded PostgreSQL tests ran.
  Commit only this task: `feat(auction): make managed demo creation atomic`.

## Task 2: Scheduled Replenishment and Homelab Release

**Files:**
- Create: `node-service/apps/auction-service/src/auction/adapter/in/scheduling/demo-auction-scheduler.ts` and `.spec.ts`.
- Modify: `node-service/apps/auction-service/src/auction/auction.module.ts` and `docs/demo-auctions.md`.
- Modify: `cncn_private/envs/homelab/applications/chalnak/auction-service.yaml`.
- Modify: `cncn_private/.conventions/service-identities.json` and `docs/runbooks/demo-auction-seed.md`.
- Deployment only: `cncn_private/envs/homelab/applications/chalnak/kustomization.yaml` when verified image tags are available.

**Interfaces:**
- Consumes Task 1's `DemoAuctionService.ensureActive(now?)` and discriminated result.
- `DemoAuctionScheduler` injects `DemoAuctionService` and the existing `ConfigService`.
- `replenish(): Promise<void>` uses `@Cron('0 */5 * * * *', { waitForCompletion: true })`.

- [ ] **Step 1: Write failing scheduler tests, then implement it and module wiring.**
  Missing, `false`, `1`, `TRUE` and boolean true never call the service; only
  string `true` calls it once per tick. Assert created results log one UUID,
  skipped results do not create or retry, rejected work is warned and contained,
  and a later tick can succeed. Add the provider without a startup invocation.
  Run the scheduler tests plus Task 1 tests; expect green before the full suite.

- [ ] **Step 2: Update the existing docs and run every repository gate.**
  Document tracked provenance, legacy unmarked behavior, manual override, schedule,
  disabling/rollback and the no-financial-cleanup rule. Run the Node gates from
  Task 1, plus the isolated PostgreSQL suite in Linux CI. Obtain one independent
  whole-change review before publication; fix correctness/security findings.
  Commit scheduler/docs: `feat(auction): replenish active portfolio demos`.

- [ ] **Step 3: Publish the backend and confirm migration before enabling.**
  Push only the reviewed Node commits to `origin HEAD:main`. Wait for quality,
  native Kafka loading, guarded PostgreSQL tests and image publication to succeed.
  Deploy the new immutable SHA with the flag absent/false, confirm the additive
  migration and ready Pod, and verify the manual API/auth contract remains intact.

- [ ] **Step 4: Enable only homelab and verify two real scheduled ticks.**
  Add `DEMO_AUCTION_AUTO_ENABLED: 'true'` as a container environment entry and
  the matching service-identity contract entry. Run GitOps service-identity tests;
  commit `feat(gitops): enable portfolio demo replenishment`, push and refresh Argo.
  Observe a normal scheduled creation when empty, then a subsequent skip without
  manually invoking the job or altering existing auctions to force the scenario.
  If a legitimate active candidate already exists, verify skip first and report
  creation coverage from isolated tests rather than destroying live state.
  Confirm one persisted creation/outbox, search projection, unchanged original
  history and `Synced / Healthy`. Never place bids or invoke Toss during verification.
