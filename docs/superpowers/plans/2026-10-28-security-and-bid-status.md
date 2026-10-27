# Security and Bid Status Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline, TDD and one final independent review.

**Goal:** Patch the critical test dependency and show real bid processing health to administrators.
**Architecture:** Auction application result/port/state plus Kafka adapter; Spring BFF port/HTTP adapter; React Overview card.
**Tech Stack:** npm/Vitest 3, NestJS/KafkaJS, Spring Boot 17, React/Vite.
**Spec:** docs/superpowers/specs/2026-10-28-security-and-bid-status.md

## Global Constraints

No worktree, local Docker, live test bids or broker mutations. Canonical node-service
and chalnak-admin checkouts only. Existing authentication and inward dependencies.
Five-second coalesced cache; Kafka request/connection timeout 1500ms, zero retries.
Counters are decimal strings; unknown is null. Process-local history is explicit.

## Review Focus

1. Missing group/topic or invalid offsets must not look healthy or cause creation/reset.
2. Retention gaps and large offsets must not silently produce wrong zero/small counts.
3. Failures/repeated refresh must release connections and coalesce requests.
4. Authentication and browser output must not leak raw broker errors or credentials.
5. Diagnostics must not change bid acknowledgement/quarantine behavior.

## Task 1: Patch test runner dependency

**Files:** package.json, package-lock.json; docs/dependency-security.md.
**Interfaces:** Vitest 3 with tinypool override 2.1.2; no runtime dependency change.
- [ ] Record audit baseline (two tinypool advisories), apply scoped override and npm10 lock.
- [ ] Run audit, checker/unit suites and builds. Expected: tinypool advisories absent, existing suites pass.
- [ ] Commit with the shared convention. Document remaining unrelated audit findings.

## Task 2: Internal bid status endpoint

**Files:** apps/auction-service/src/bid-monitoring/{application,adapter}, bid-monitoring.module.ts;
auction-etc consumer/module and tests; app.module.ts; docs/bid-processing-status.md.
**Interfaces:** GET /api/v1/internal/admin/bid-processing-status returns asOf, broker,
groupState, lag, dlqRetained, retentionGap, startedAt, lastAcknowledgedAt, lastError.
Port BidBrokerPort.snapshot(): Promise<BidBrokerSnapshot>; state records fixed error codes.
- [ ] Tests first: bigint offsets, -1 / below-low / above-high / missing partition;
  unavailable broker, cache/coalescing/release, guard; state and consumer success/error observations.
  Run focused Vitest: expected RED, then implement and expect GREEN.
- [ ] Wire one state singleton into the consumer and diagnostics. Preserve existing wire/commit flow.
- [ ] Extend the guarded real Kafka suite to assert status against actual group offsets/DLQ.
- [ ] Run all checker/unit/build commands, commit and obtain actual Linux Kafka/PostgreSQL CI.

## Task 3: Administrator BFF and Overview card

**Files in ../chalnak-admin:** new bidstatus feature application model/port/service,
HTTP adapter/web controller; admin-web/src/dashboard/BidProcessingStatus.tsx and tests;
lib/api.ts, lib/types.ts, DashboardPage.tsx, styles; docs/operations.md.
**Interfaces:** GET /api/v1/bid-processing-status proxies only the fixed internal endpoint.
Browser uses /admin-api/v1/bid-processing-status with existing credentials.
- [ ] Write tests for authenticated forwarding, unauthenticated refusal, unavailable/large-count
  mapping and sanitized failures. Expected RED; implement using existing boundaries, expect GREEN.
- [ ] UI tests: loading, available, unavailable, fixed error labels, refresh and process-history notice.
  Expected RED; implement then GREEN. Add desktop/mobile browser assertions.
- [ ] Run Gradle check/bootJar, frontend conventions/tests/typecheck/build and relevant browser E2E.
- [ ] One independent review of both repositories; fix important findings. Push main, inspect CI,
  verify image rollout and authenticated read-only endpoint. Record precise evidence and limitations.
