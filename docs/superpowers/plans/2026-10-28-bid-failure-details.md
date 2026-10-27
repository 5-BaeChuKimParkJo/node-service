# Bid Failure Details Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline with TDD and one final independent review.

**Goal:** Trace the most recent bid failure without message access or new storage.
**Architecture:** Existing process observation -> status endpoint -> Spring records -> expandable React details.
**Tech Stack:** NestJS, KafkaJS batch metadata, Spring/JDK17, React/Vite.
**Spec:** docs/superpowers/specs/2026-10-28-bid-failure-details.md

## Global Constraints

No worktree, local Docker, runtime dependency/schema change, production bids or broker mutation.
Context is nullable and additive; exact digit strings; fixed topic; partition0..2147483647;
offset0..9223372036854775807; first <= last. Invalid metadata never replaces recovery errors.
Process-local history and safe fixed guidance; no raw errors/messages/identifiers.

## Review Focus

1. Diagnostics cannot throw during an existing processing/DLQ/commit failure.
2. Context input/output mutation must not corrupt captured history.
3. Supplied malformed/overflowed context must never display rounded or unsafe data.
4. Rolling upgrades with missing/null context remain usable.
5. Commit failure guidance must not assert a failed DB write or encourage duplicate bids.

## Task 1: Capture safe batch context

**Files:** bid-monitoring/application/model/bid-processing-status.result.ts;
application/service/bid-processing-state.service.ts and tests; auction-etc consumer and tests;
bid-kafka.integration.spec.ts; docs/bid-processing-status.md.
**Interface:** recordError(code: BidErrorCode, context?: BidFailureContext) stores nullable context;
status lastError adds context without changing existing fields or event wire messages.
- [ ] RED tests: exact large offsets, validation drops invalid context, deep snapshot/input copy;
  consumer stage context and defensive failed metadata reads preserve retry/commit trace.
- [ ] Implement small pure validation/state extension and safe consumer metadata capture.
- [ ] Add actual Kafka context assertion; all Node checks/unit/builds, expected GREEN.

## Task 2: BFF and failure details UI

**Files in ../chalnak-admin:** bidstatus model/response/test records; admin-web/src/lib
types/api validator/tests, dashboard/BidFailureDetails.tsx/tests, BidProcessingStatus.tsx,
styles/global.css, test fixtures and e2e/admin-dashboard.spec.ts.
**Interface:** nullable LastErrorContext is forwarded with exact offset strings. Browser
context is optional for the rolling-upgrade contract; UI uses fixed stage guidance.
- [ ] RED tests for BFF mapping; legacy null/missing context; malformed values; expand/no-error
  states, exact metadata and commit guidance. Then implement and expect GREEN.
- [ ] Extend existing desktop/mobile dashboard E2E with expansion and failure fixture;
  run full Java check/build, web tests/checks/type/build and all22 browser cases.
- [ ] Commit two repos; one independent review of exact ranges, fix important findings.
- [ ] Push main, inspect real Kafka/PostgreSQL CI and all web E2E, image publication and
  actual rollout. Verify normal admin login/read and anonymous refusal, no business writes.
- [ ] Record evidence and limitations; final smoke and clean synced repositories.
