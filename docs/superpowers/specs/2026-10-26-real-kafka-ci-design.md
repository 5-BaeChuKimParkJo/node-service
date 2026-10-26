# Real Kafka Bid Recovery CI

Approved goal: run an isolated Kafka/PostgreSQL CI integration test of publication,
real consumption, persistence, consumer restart/redelivery and DLQ/offset behavior.
Use inline implementation and one final independent review in the canonical checkout.

## Boundaries

No runtime implementation, schema, dependency or production infrastructure changes.
Do not start Docker locally or connect tests to Tailscale/production endpoints.
Require an explicit loopback `TEST_KAFKA_BROKER` on port 9092, the existing guarded
loopback `_test` PostgreSQL URL and a matching fixed CI Kafka cluster ID before
creating topics or database fixtures. Refuse existing application topics/groups.

Use real KafkaService native producers, AuctionKafkaAdapter, production consumer,
AuctionEtcService/Repository and PostgreSQL. A dedicated KafkaJS consumer observes
DLQ records. Only pure image URL/taxonomy-name dependencies are fixture values.
Do not mock producer, consumer, broker acknowledgement or database writes.

## Scenarios

1. Publish a valid bid through AuctionKafkaAdapter. Assert real accepted bid,
   current price, one Outbox record and source committed offset `record offset + 1`.
2. After a successful commit, stop the actual consumer, rewind only this isolated
   test group's offset, create a fresh production consumer, and assert actual
   redelivery, committed offset recovery, unchanged accepted bid/Outbox counts.
3. Publish a valid wire envelope with an invalid bidder UUID to cause a real DB
   transaction error. Assert rollback, an observed real DLQ record and source ack.
4. Restrict the DLQ topic's `max.message.bytes` so the broker rejects quarantine.
   Publish malformed JSON, observe retriable consumer crash and an unchanged
   source offset. Restore the topic limit and assert automatic restart, real
   quarantine delivery and source progress. Reset topic configuration in cleanup.

All waits have deadlines; cleanup owns only fixture UUIDs and the topics/groups
created by this suite. The broker is a fresh Kafka 4.3.1 KRaft GitHub service;
PostgreSQL uses the existing CI service. Sequential cases share isolated topics
with monotonically advancing offsets; no arbitrary production group resets.

## Publication

Add a guarded runner and an explicit Node Quality step. Test/CI-only commits use
`[skip ci]` and explicitly dispatch the same Node Quality workflow on main, avoiding
an unnecessary unchanged application image/production rollout. Any runtime change
would require normal image CI instead. Report real tests separately from skipped
local cases. Update the existing verification documentation only after actual CI.

This proves single-broker consumer/protocol scenarios, not whole-cluster outage,
power loss, performance or end-to-end exactly-once delivery.
