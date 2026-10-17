# Winner Payments Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for local tasks and dispatching-parallel-agents for independent slices.

**Goal:** Test-mode final winning-bid payment with Toss and admin payment visibility.
**Architecture:** Add a module inside auction service; keep deployment count unchanged. Freeze the auction before charging, use provider reconciliation for uncertain responses.
**Tech Stack:** NestJS/Prisma/PostgreSQL, Next 15/React, Spring Boot 3.4/React/Vite.
**Spec:** ../specs/2026-10-17-winner-payments.md

## Global Constraints
Test keys only; disabled by default; preserve current admin-detail changes.
No production schema mutation or deployment in this implementation.
Decimal-string amounts; ISO dates; JWT ownership; secrets server-only.

## Review Focus
- Delayed Kafka bids cannot alter a frozen purchase.
- An ambiguous confirmation cannot open a second payment attempt.
- Forged success URLs/webhooks never mark an order paid.
- Cancel retry cannot result in two cancellations or stale DONE regression.
- Browser reload/double effects cannot charge twice.

## Task 1: Auction payment module
Files: apps/auction-service/src/payment/*; prisma schema/migration; app.module.ts; common/env-schema.ts.
- [x] Write unit/HTTP tests for ownership, amounts, repeat calls, provider errors, webhook and cancel.
- [x] Run tests red; implement spec HTTP contract and persistent state machine.
- [x] Generate Prisma client; run focused tests and Nest build.
- [x] Document test key/migration/webhook setup. Leave commits for coordinated integration.

## Task 2: Bid finalization guards
Files: auction-prisma.repository.ts and focused spec.
- [x] Test ended/hidden/deleted/frozen auctions cannot receive bid updates.
- [x] Add guarded commit-time updates in both bid write paths.
- [x] Run repository and existing auction tests.

## Task 3: Customer checkout
Files: FE actions/payment helpers; checkout routes/components; ended detail entry.
- [x] Test state/amount and redirect parsing, including missing/forged parameters.
- [x] Implement server actions and widgets per spec, with pending recovery.
- [x] Run focused tests, typecheck/build and desktop/mobile UI verification.

## Task 4: Admin integration
Files: Spring auction controller/client/payment DTOs; React payment panel/api/types.
- [x] Test payment proxy ownership boundaries, encoded URL, cancellation validation.
- [x] Implement payment tab with loading/error/empty/pending states and cancel confirmation.
- [x] Run Spring tests/build and React tests/typecheck/build.

## Release Checks
- [x] Review integrated changes for state races and API mismatches.
- [x] List known pre-existing Kafka native-binding test failures separately.
- [x] Report keys required, local verification, and deployment not performed.

## Verification (2026-10-18)
Node: 138 tests passed, excluding the two documented pre-existing Windows Kafka
native-binding suites. Nest build passed. Customer: 33 unit tests, typecheck,
lint and Next production build passed. Admin: 48 Spring tests, 32 UI tests,
Spring/React builds and 6 browser cases passed. Customer browser cases cover
mobile/desktop with a fake SDK/provider: all 11 passed against the production
build. See winner-payments.md for limitations.

Review fixes: reject confirmation recovery for deleted/hidden auctions; fix
shared Button Slot single-child rendering; use deterministic numeric KST labels
instead of locale-dependent AM/PM text to prevent hydration mismatches.

Real Toss test keys, staging PostgreSQL concurrency/migration smoke checks and
production deployment remain release prerequisites, not completed work.

