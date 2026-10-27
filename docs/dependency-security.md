# Test dependency security update · 2026-10-28

Vitest 3.2.7 resolves tinypool 1.1.1. The prototype-pollution advisories
[GHSA-5gmw-xhrv-c9v3](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3) and
[GHSA-85c8-ppgw-ccpr](https://github.com/advisories/GHSA-85c8-ppgw-ccpr) require
at least 2.1.2 for both fixes. A scoped npm override pins only Vitest's tinypool
to 2.1.2. CI uses Node 22, supported by that version. Node 18 is no longer supported
by this overridden test runner. Application dependencies and wire formats are unchanged.

The baseline npm audit reported 2 critical, 9 high, 17 moderate and 2 low findings.
After installation it reports 0 critical, 9 high, 18 moderate and 2 low findings;
tinypool is absent from the advisory graph. Audit also counts affected parents,
so totals differ from GitHub alert counts. Other vulnerabilities remain outside
this targeted patch. Reproduce with `npm ci`, `npm explain tinypool`, `npm audit --json`
and the existing Node Quality workflow, including real Kafka/PostgreSQL tests.
