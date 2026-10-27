# Bid processing status

`GET /api/v1/internal/admin/bid-processing-status` requires the existing internal
admin token. The administrator BFF exposes `GET /admin-api/v1/bid-processing-status`
only to an ADMIN session. Responses prohibit shared caching. No new secret is needed.

The adapter reads only the fixed bid topic/group and its DLQ. It does not create
topics, consume records, alter offsets/configuration or replay failures. KafkaJS
connect/request timeouts are 1500ms with no retries. Concurrent refreshes share one
query and its result is cached five seconds per process. The dedicated BFF client
has two-second connect / ten-second read timeouts; the browser aborts after twelve seconds.

Counters are decimal strings. Source lag sums `high - max(committed, low)` per
partition; uncommitted `-1` uses low, matching fromBeginning. Committed offsets
below low flag `retentionGap`, while offsets above high or missing partitions fail
the snapshot. Missing topics/group, unknown group state and broker errors return
`broker: unavailable` and null counters, never an invented zero.

`dlqRetained` is the sum of DLQ high-low offset spans. Retention, compaction and
offset gaps mean it is not an exact record count or unresolved failure count.
Kafka snapshots are not transactional with bid writes or each other.

`startedAt`, `lastAcknowledgedAt` and `lastError` are process-local observations.
Successful broker acknowledgement updates the timestamp; processing, DLQ publication
and commit failures set fixed categories without storing raw errors or payloads.
Recovery retains the most recent historical error. Restart clears history; multiple
replicas would each have their own observations. No history means unobserved, not
proof of no errors. Current deployment uses one Auction replica.

The status UI is on administrator Overview. Reuse Kafka UI for detailed broker
investigation, and the bid recovery runbook for deliberate replay. This endpoint
is not an alerting, durable audit or automated recovery system.
