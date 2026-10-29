# Fast Demo Auctions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Let portfolio visitors complete a short auction through winner-only test checkout.

**Architecture:** Extend the existing trusted demo creation path. Keep normal creation validation strict, read persisted minute timestamps, derive only a boolean demo marker from provenance, and reuse existing checkout authorization.

**Tech Stack:** Nest/Prisma/PostgreSQL, Spring BFF, React/Vite, Next.js.

**Spec:** docs/superpowers/specs/2026-10-29-fast-demo-auctions.md

## Global Constraints

- durationMinutes is JSON number 5, 30, or 1440. Omitted means legacy 24-hour schedule.
- No runtime dependencies, credentials in source, local Docker, or destructive reset.
- Existing service folders; no worktrees. Commit/push main and deployment already authorized.
- Automated integration uses disposable loopback _test DB only; CI supplies Linux Kafka bindings.
- No live test bids/payments. Persisted provenance UUID never leaves public HTTP or Outbox.

## Review Focus

- JSON fractions, strings, null and unknown options must fail before writes.
- Ordinary creation/update cannot use minute schedule via spoofed demo fields/title.
- Reading short auctions and publishing their normal Outbox must preserve minute timestamps.
- Expiry refresh must be bounded; client clock/UI cannot authorize payment.
- Keyboard focus must include the new select; repeated clicks cannot create duplicates.

### Task 1: Auction duration and trusted public marker

Files: demo-auction.service/controller, NewAuction, creation/update/read schemas, AuctionMapper/web mapper, demo integration specs.
Interfaces: create(now?, durationMinutes=1440); public detail isDemo boolean; internal body durationMinutes optional.

- [ ] Add failing tests for explicit 5/30 schedules, strict duration bodies and ordinary-path rejection.
- [ ] Run focused Vitest tests and observe the expected failures.
- [ ] Implement trusted schedule selection and read-model timestamp/provenance changes; explicitly strip provenance from Outbox.
- [ ] Add disposable DB coverage for short creation/read, Outbox, ending and winner checkout boundaries.
- [ ] Run unit/checks/builds; commit feat(auction).

### Task 2: Administrator duration selection

Files: Spring DemoAuctionRequest/Command, controller/service/port/HTTP adapter and tests; CreateDemoAuctionButton, API and UI/E2E tests.
Interfaces: browser/BFF/internal request durationMinutes numeric, optional default 1440; UI default 5.

- [ ] Add and run failing JSON validation/forwarding, period selection and keyboard focus tests.
- [ ] Implement strict raw JSON validation in inbound adapter plus owned application command.
- [ ] Implement select and trusted forwarding; include actual result dates/customer link.
- [ ] Run full Gradle check/build, admin web tests/checks/build and desktop/mobile E2E; commit feat(admin).

### Task 3: Customer guided demo flow

Files: auction detail wire/read types, DemoAuctionGuide, demo progress helper/tests, detail page and customer browser tests.
Interfaces: optional isDemo boolean from auction API; guide uses existing login and winner checkout.

- [ ] Add/run failing progress/rendering and expiry-refresh behavior tests.
- [ ] Add real demo badge/steps/shared-account copy; refresh once at expiration, explicit manual refresh fallback.
- [ ] Verify ordinary auctions omit demo guide and existing checkout stays winner-only.
- [ ] Run FE full unit/conventions/typecheck/lint/build, focused desktop/mobile browser fixtures; commit feat(web).

### Task 4: Review, publish, verify

- [ ] Review final cross-repository diff independently; fix material findings with regression tests.
- [ ] Push auction first, then administrator and customer; inspect actual CI results.
- [ ] Confirm image updater GitOps commits and all rollouts/Argo health.
- [ ] Run read-only live UI smoke and update docs with evidence and limitations.
