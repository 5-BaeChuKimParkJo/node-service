# Bid Consumer Recovery

Approved scope: DLQ before offset commit, separate processing and acknowledgement
failures, and verify database errors, DLQ failures and redelivery. Execute inline
in the canonical checkout, with one final independent review.

## Behavior

- Keep group, input/DLQ topics, keys and wire payloads unchanged.
- Parse and execute the existing bid transaction. On processing failure, publish
  the existing range-metadata DLQ record and await acknowledgement before committing.
- A DLQ failure must neither commit nor resolve the batch. Surface a sanitized,
  retriable KafkaJS error so the installed runner can restart from broker offsets.
- Commit a successful or quarantined batch once, outside the processing catch.
  Resolve its local offset only after the broker acknowledgement. A commit failure
  must not route an already processed bid into DLQ or call the business handler
  again inside that delivery.
- KafkaJS inspects the deepest error cause for retriability. Recovery wrappers
  deliberately carry no original cause/payload; log only stage and offset context.
  Use its existing restart mechanism with a one-second initial retry time.
- A failed optional notification after a committed bid is logged, not reported
  as a transaction failure. Customer success continues to use stored bid history.
- Redelivery may occur after response loss. Verify existing monotonic bid rules
  against real isolated PostgreSQL: no extra accepted bid or auction Outbox row
  for the same already-applied batch. This is not a request-id inbox or a global
  exactly-once guarantee; optional notifications and DLQ records may repeat.

## Constraints and boundaries

No dependency, schema, public API, frontend behavior, topic or infra additions.
No local Docker startup, production test bids, broker disruption, offset reset,
DLQ replay tool or live payment calls. Keep existing batch-wide quarantine policy:
the DLQ stores source ranges, not complete original messages; original-topic
retention is still required for manual investigation/replay.

Use transport fault injection around the real consumer callback and real database
tests in the existing guarded CI runner. Do not claim real broker outage testing.
Deploy only after full checks, review and Linux CI; verify rollout and consumer
subscription without injecting traffic into live auctions.

## Approach

Use small boundary changes in the existing consumer and post-commit notification
handling. Kafka transactions cannot atomically include PostgreSQL. A persistent
inbox would be a larger idempotency project; neither is introduced in this fix.

Reference: [KafkaJS consuming/offset behavior](https://kafka.js.org/docs/consuming)
and the installed KafkaJS 2.2.4 runner/onCrash implementation.
