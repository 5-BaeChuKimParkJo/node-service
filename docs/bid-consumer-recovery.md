# Bid batch recovery

The existing consumer group and topics are unchanged. A successful batch follows
`bid transaction -> broker offset acknowledgement -> local resolveOffset`.
A parsing or transaction failure follows `DLQ acknowledgement -> broker offset
acknowledgement -> local resolveOffset`. Quarantine is still batch-wide.

DLQ publication failure leaves both offsets unchanged. Offset acknowledgement
failure is outside the processing catch: it never relabels successful work as a
failed bid or publishes another DLQ record inside that delivery. Recovery throws
a sanitized retriable `KafkaJSError`; KafkaJS restarts from broker offsets with
the configured one-second initial retry time. The wrapper has no original cause
because the installed runner inspects the deepest cause's retriable property.

Result notification after the PostgreSQL transaction is best effort. Its failure
is warned but does not undo a stored bid or quarantine it as a failed transaction.
The customer continues to confirm bids using persisted history, not SSE delivery.

## Delivery limits

The database transaction and Kafka acknowledgement are separate. A crash or lost
acknowledgement may redeliver work, and DLQ/notification records can repeat.
Existing bid price/leader rules prevent another accepted bid and auction Outbox
write when the same already-applied batch is replayed; this is covered with real
PostgreSQL, not a new request-id inbox or a global exactly-once guarantee.

DLQ records retain the existing topic/partition/startOffset/lastOffset/error/time
format and stable range key. They do not contain full original messages. Operators
must investigate and retain source-topic data before any deliberate replay.
This fix adds no automatic DLQ replay or retention guarantee.

## Verification and release

Callback tests inject transport failures; the guarded integration suite uses the
actual bid service and PostgreSQL for rollback, replay and post-commit boundaries.
The mixed test also injects an offset acknowledgement failure around that service.
These are not live broker outage tests. Run `npm run test:payment:integration` only
with disposable loopback `_test` PostgreSQL via `TEST_DATABASE_URL`, never a live DB.

There are no schema, dependency or frontend changes. Require the normal Linux CI,
Kafka native-load check, database suite and immutable image publication. Verify
Image Updater/Argo rollout, Pod readiness and consumer group startup without test
bids, broker disruption, source offset resets or Toss calls in production.

Read-only logs on the cluster:

```bash
kubectl -n chalnak rollout status deployment/auction-service --timeout=180s
kubectl -n chalnak logs deployment/auction-service --since=15m | grep -E 'Consumer|Bid|quarantine|acknowledgement'
kubectl -n argocd get application chalnak-services
```

Kafka behavior: [KafkaJS consumer documentation](https://kafka.js.org/docs/consuming).
