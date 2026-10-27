# Recent bid failure details

The user asked to continue development immediately. Following the already shipped
summary, the proposed default is recent failure details; an optional scope question
was offered. Scope is the author's bounded continuation, not a new user-specified
durable incident tracker. Canonical checkouts, no worktree or local Docker.

Use the existing process-local lastError and authenticated status endpoint. Add
nullable context {topic, partition, firstOffset, lastOffset}. Capture only fixed
bid topic, a nonnegative signed32 partition and unsigned signed64-range offsets;
first <= last. Validation failure drops context while retaining code/time. Recording
or reading must not expose writable nested references or change recovery behavior.
Capture batch metadata defensively so missing metadata cannot interrupt DLQ/commit.
No raw errors, payloads, request IDs, member identifiers, new Kafka reads or mutations.

Alternatives: persistent incident storage changes schema/lifecycle; DLQ browsing
adds consumers and replay/retention complexity. Recent contextual observation reuses
the existing boundaries and is sufficient for one operator. History resets on restart.

Spring forwards the additive nullable context through owned records. Browser accepts
older responses without context, validates supplied values without Number rounding,
and shows an expandable recent-failure section even when no failure was observed.
Three fixed stage descriptions explain what to inspect; commit failure must not be
presented as proof that the bid failed. A batch range is not an individual bid ID.
No automatic replay or retry controls. Keep existing status metrics and auth intact.

Tests: nested mutation isolation, invalid/large context, exact consumer failure-stage
capture and unchanged trace, actual Kafka invalid bid context; BFF null/large mapping
and authenticated forwarding; UI collapsed/expanded/absent context, fixed guidance,
legacy response and malformed context. Full existing suites and desktop/mobile E2E.
