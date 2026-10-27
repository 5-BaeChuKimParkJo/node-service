# Dependency security and bid processing visibility

Approved by the user: apply the recommended security update, run CI, then expose
bid processing backlog, DLQ retention and recent failures in the administrator UI.
Work in the canonical service checkouts without a worktree or local Docker.

Keep Vitest 3.2.7 and override its tinypool dependency to patched 2.1.2 (Node 22 CI).
Alternatives: a Vitest major migration broadens this patch; leaving alerts open
does not meet the request. Audit before/after and all existing suites prove it.

Add a read-only internal Auction Service endpoint, existing Spring BFF proxy and
Overview card. Reuse KafkaJS; no new broker, database, collector or dependency.
Application ports own plain result types; transport adapters own Kafka/HTTP.
Use the existing internal token and administrator session boundaries.

Metrics: source group state, retained source lag (bigint strings), DLQ high-low
offset span and retention-gap flag. DLQ span is an estimate of retained records,
not unresolved failures. Missing broker/topic/group or invalid offsets produces
unavailable, never zero. Uncommitted offset -1 starts at low because the consumer
uses fromBeginning. A committed offset below low marks a retention gap.
Never reset offsets, consume DLQ, publish messages or change broker configuration.

One coalesced query with a five-second cache bounds refresh load. Broker requests
use 1.5-second timeouts without retries; close clients even after failures.
Consumer state records last successful acknowledgement and last error category /
timestamp in this process only. Raw errors, messages, user IDs and credentials
must never enter the diagnostic response. Restart loses this history, clearly
labelled in the UI. Do not change processing, DLQ or acknowledgement order.

Administrator UI: loading, unavailable, metrics, error category/time and manual
refresh. No automatic replay or offset mutation. Existing business summary and
tools still work when diagnostics fail. Build/test both repos; publish through
normal main CI and verify the resulting rollout read-only.
