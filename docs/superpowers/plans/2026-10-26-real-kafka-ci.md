# Real Kafka CI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline; one final independent review.

**Goal:** Verify production bid messaging against real isolated Kafka/PostgreSQL.
**Architecture:** A dedicated guarded runner drives one sequential suite through
real production classes, Kafka instrumentation/admin queries and database reads.
**Tech Stack:** Kafka 4.3.1 KRaft, KafkaJS/native producers, Vitest, Prisma, GitHub Actions.
**Spec:** `docs/superpowers/specs/2026-10-26-real-kafka-ci-design.md`.

## Global Constraints

No worktree, local Docker startup, runtime/schema/dependency change or live traffic.
Require loopback port 9092, fixed CI cluster identity and guarded `_test` DB.
Refuse pre-existing owned topics/groups; clean only created resources and fixture UUIDs.

## Review Focus

1. Misconfigured broker/database/cluster must fail before any destructive operation.
2. Offset observations must refer to the actual record and group, not elapsed time.
3. Restart tests must prove redelivery, not merely observe an already committed offset.
4. Failed setup/shutdown must not broaden deletion or leave background consumers.
5. Broker DLQ rejection must precede recovery assertions and topic configuration restoration.

## Task 1: Isolated real broker suite and CI evidence

**Files:** Create `scripts/test-kafka.mjs`, `.test.mjs`,
`scripts/run-kafka-integration.mjs`,
`apps/auction-service/src/auction-etc/bid-kafka.integration.spec.ts`;
modify `package.json`, `.github/workflows/quality.yml`, `docs/bid-consumer-recovery.md`.

**Interfaces:** Guard functions validate broker and actual cluster ID. New
`npm run test:kafka:integration` requires both explicit test connection variables.

- [ ] Write failing broker/cluster guard tests; run RED, implement guards, run GREEN.
- [ ] Add bounded sequential real-client scenarios from the spec. Keep native imports
  inside guarded setup so Windows unit runs skip without native Kafka loading.
- [ ] Add the fixed-ID Kafka service and runner step to Node Quality; use no new dependency.
- [ ] Run checker tests, naming, architecture, format, full unit and all four builds.
  Verify missing/unsafe runner inputs fail closed without launching tests.
- [ ] Obtain one independent review; address important findings with focused tests.
- [ ] Commit test/CI-only changes and push main with `[skip ci]`; dispatch Node Quality,
  inspect actual broker/database test evidence and fix only observed failures.
- [ ] Update the verification record, confirm clean synced repos and no runtime rollout.
