# Bid Consumer Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan inline. One final independent review; no per-task agents.

**Goal:** Preserve recovery paths across bid processing, DLQ and offset failures.
**Architecture:** Separate processing/quarantine from acknowledgement in the existing
consumer; contain optional notification errors after the transaction commits.
**Tech Stack:** NestJS, TypeScript, KafkaJS 2.2.4, Vitest, Prisma/PostgreSQL.
**Spec:** `docs/superpowers/specs/2026-10-26-bid-consumer-recovery-design.md`.

## Global Constraints

Canonical checkout, no worktree. No dependency/schema/wire identity changes.
No production test traffic or local Docker startup. Database tests require guarded
loopback `_test` PostgreSQL. Keep batch-wide metadata-only DLQ behavior explicit.

## Review Focus

1. Producer failure must leave both committed and resolved offsets unchanged.
2. Broker acknowledgement loss must not be classified as business failure.
3. Successful DB commit plus failed notification must stay a successful write.
4. Replayed work must preserve accepted bid and Outbox counts; avoid exactly-once claims.
5. Recovery errors must remain retriable by the installed KafkaJS runner without leaking causes.

## Task 1: Recoverable bid batch processing and release

**Files:**
- Modify `apps/auction-service/src/auction-etc/auction-service-bidder-created.consumer.ts`.
- Modify `apps/auction-service/src/auction-etc/auction-etc.service.ts`.
- Create consumer `.spec.ts` and `bid-recovery.integration.spec.ts` in that directory.
- Modify `scripts/run-payment-integration.mjs` to include the guarded suite.
- Create `docs/bid-consumer-recovery.md` and update the public architecture's obsolete failure-order description after verification.

**Interfaces:** Existing consumer lifecycle, `bidAuctionBatch(input): Promise<void>`,
Kafka producer and commit contracts remain unchanged.

- [ ] Write failing callback tests: success; parse/DB quarantine order; failed DLQ
  with later redelivery; successful work plus failed commit; quarantined work plus
  failed commit; large offsets; retriable sanitized errors; normal shutdown.
- [ ] Run targeted Vitest and observe behavior failures, then implement boundary
  separation and notification error containment. Require targeted green.
- [ ] Add real PostgreSQL cases: successful batch redelivery; outbox failure rolls
  back bid and current price; post-commit notification failure; consumer commit
  failure followed by redelivery using the actual bid service. Clean fixture UUIDs only.
- [ ] Run `test:checks`, naming, architecture, format, full unit and four builds.
  Require isolated PostgreSQL execution in Linux CI, never a local skipped pass.
- [ ] Commit `fix(auction): preserve bid batches across recovery failures`;
  obtain one independent review, address important findings with RED/GREEN tests.
- [ ] Push reviewed main, require Linux quality/native binding/DB and GHCR success,
  let Image Updater/Argo roll out, verify the new image, readiness, consumer group
  subscription and no crash loop without live test bids. Update the outdated
  portfolio failure description with a documentation-only commit.
