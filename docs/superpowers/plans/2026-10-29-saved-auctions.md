# Saved Auctions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline. Steps use checkbox syntax for tracking.

**Goal:** Let authenticated users save auctions across devices and manage them.
**Architecture:** Existing JWT web boundary → application service/port → PostgreSQL;
Next server actions → detail toggle and private cursor page, no financial coupling.
**Tech Stack:** Existing Nest/Fastify/Prisma/PostgreSQL and Next/React; no dependencies.
**Spec:** docs/superpowers/specs/2026-10-29-saved-auctions.md

## Global Constraints

- JWT owner only, additive schema, idempotent PUT/DELETE; no financial/event changes.
- 20 rows/page with owner+visibility filtering; decimal money/cursor precision intact.
- Existing checkouts, no local Docker, integration only guarded loopback _test DB.
- Backend migration/ready precedes frontend; no credentials/private hosts in docs.

## Review Focus

- Anonymous/forged/refreshed tokens and spoofed member fields cannot access another list.
- Duplicate/concurrent saves preserve one row/time; remove affects only its owner.
- Hidden/deleted/cancelled data never leaks, including pagination and state lookups.
- Cursor overflow/malformed/precision and >20-row ordering do not skip/repeat stable rows.
- UI unknown/error/loading states, reload persistence, money precision and navigation work on mobile.

### Task 1: Backend contract and persistence

Files: application/model/saved-auction.result.ts, port/out/saved-auction-repository.port.ts,
service/saved-auction.service.ts, adapter/in/web/saved-auctions.controller.ts,
adapter/out/postgresql/saved-auction-prisma.adapter.ts, AuctionModule,
Prisma schema/new migration, controller spec + real PostgreSQL integration spec,
scripts/run-payment-integration.mjs inclusion.

- [x] Write real HTTP JWT/ownership/idempotency/validation tests; observe RED.
- [x] Implement controller/service/port and additive persistence/migration.
- [x] Add guarded DB tests for concurrency, isolation, visibility, cursor and price fidelity.
- [x] Run all backend checks/unit/builds; integration runs in existing full CI.

### Task 2: Customer experience

Files in ../FE-Service: saved auction types/actions+tests, detail control/toggle,
private saved-auctions page/cards/paging/error/refresh, mypage menu, detail route,
fixture browser spec, feature/release docs.

- [x] Write auth/response/decimal/cursor tests; observe RED then implement actions.
- [x] Implement saved state control and private list with recoverable states.
- [x] Run frontend unit/checks/type/lint/build and real Next+fixture desktop/mobile browser tests.
- [x] Inspect screenshots; one independent whole-feature review; fix material findings.

### Task 3: Publish and verify

- [x] Commit/push backend; verify full CI including new real PostgreSQL cases and existing Kafka.
- [x] Verify migration/new auction image/Argo health, then push/release frontend.
- [x] Verify frontend CI/image/rollout and real demo identity bookmark save/list/remove,
  restoring prior saved state; no live bids/payments.
- [x] Document proof/limits, sync GitOps, clean only this plan's scratch and checkouts.
