# Dependency Security Audit

Date: 2026-10-20. Baseline: `442bac2`. Package manager: npm, with
`package-lock.json` used by CI and the Docker build. Counts below are vulnerable
package entries reported by npm, not unique CVEs or the GitHub alert count.
Generate the lock with npm 10.9.4, matching the CI toolchain. npm 11 produced a
peer placement that passed its own clean-install check but omitted a nested
Webpack entry required by npm 10. The CI-equivalent dry-run reproduced the failure;
regenerating with npm 10 added that entry without changing dependency versions.

```powershell
npx --yes npm@10.9.4 install --package-lock-only --ignore-scripts --no-audit
npx --yes npm@10.9.4 ci --ignore-scripts --dry-run --no-audit
```

| Scope      | State                        | Low | Moderate | High | Critical | Total |
| ---------- | ---------------------------- | --: | -------: | ---: | -------: | ----: |
| Full       | Before                       |   6 |       43 |   41 |        8 |    98 |
| Full       | Compatible patches           |   2 |       16 |   22 |        2 |    42 |
| Full       | After approved major upgrade |   2 |       16 |   19 |        2 |    39 |
| Production | Before                       |   1 |       27 |   18 |        4 |    50 |
| Production | Compatible patches           |   0 |        0 |    3 |        0 |     3 |
| Production | After approved major upgrade |   0 |        0 |    0 |        0 |     0 |

## Compatible Patches

- Updated AWS S3 packages within major 3, Axios within major 1, the Confluent
  Kafka client within major 1, and UUID within major 11. Prisma versions and
  database schema are unchanged.
- Updated Nest common/core/microservices/testing within major 11, Swagger
  within major 11, config within major 4, and the direct Fastify dependency
  within major 5. Updated the Nest CLI within major 11 and Vitest within major 3.
- Refreshed compatible transitive versions including form-data 4.0.6, tar
  7.5.22, jws 3.2.3, piscina 4.9.4 and decompress 10.2.2.
- Scoped the Nest adapter's Middie dependency to 9.3.4, still major 9. The
  [maintainer advisory](https://github.com/fastify/middie/security/advisories/GHSA-72c6-fx6q-fr5w)
  describes child-plugin middleware authentication bypass. The application uses
  Nest guards and signed-token verification rather than middleware-only access
  control, but the affected dependency is removed regardless.
- Overrode path-to-regexp to 8.4.2; all installed branches use major 8. Scoped
  Swagger's js-yaml to 5.5.0, preserving its existing major. Reassess these
  overrides when upstream dependency pins catch up.

## Remaining Exposure

The approved follow-up upgrades @fastify/static from 8.2.0 to 10.1.6 and the
Nest Fastify adapter from 11.1.3 to 11.2.7, retaining Nest major 11. The latter
requires @fastify/static 10.1.2 or newer and still pins Fastify 5.11.3. A scoped
`@nestjs/platform-fastify > fastify: $fastify` override applies the same major-5
patched range as the direct dependency. `npm ls --omit=dev` confirms both paths
deduplicate to Fastify 5.12.7, with no invalid packages. A direct version alone
would not fix the adapter's nested copy.

The [static maintainer advisory](https://github.com/fastify/fastify-static/security/advisories/GHSA-8pvw-jcv7-9cmj)
has no fixed version in major 8. The production audit now reports zero findings;
the real Swagger HTTP/HTML/CSS compatibility test covers the major upgrade.
No force or legacy-peer-deps install is used. No database or API contract changes
are needed. The production container already uses Node 22, as required by the
new static library's transitive content-disposition dependency.

The full audit also retains two critical entries, Vitest and Tinypool, absent
from the production graph. Vitest 3's remaining findings require a test-runner
major upgrade. Development warnings are not dismissed as harmless: test workers
and build tools process repository code and should not be exposed to untrusted
inputs or network clients. Other development warnings remain recorded by the
full audit rather than hidden with an allowlist.

## Validation and Reproduction

```powershell
npm ci
npm run prisma:auction-service:generate
npm run prisma:notification-consumer-service:generate
npm audit --json
npm audit --omit=dev --json
npm ls --omit=dev fastify @fastify/middie @fastify/static
npm run test:checks
npm run check:naming
npm run check:architecture
npm run check:format
npm run test:unit
npm run build:all
```

The production audit returns exit code 0; the full audit still returns exit code
1 for the documented development entries. This is a dependency audit, not a container OS/global-tool
scan or a penetration test; it does not certify the entire system as secure.

Local Node is 25.8.2 on Windows. The Kafka client has no matching prebuilt binary
there and local C++ build tools are absent. Local installation used
`npm install --ignore-scripts` for unit/type/build validation, not a successful
Kafka connection test. CI and Docker use Linux/Node 22 and must run their normal
installation scripts before publishing. Never weaken that gate to match the
local workaround. MinIO compatibility tests sign a constrained POST with fixture
credentials and verify proxy URLs without contacting any storage service.
CI now explicitly loads the Kafka native binding on Linux after `npm ci`; the
production Docker stage repeats the load after pruning development packages.
Neither check connects to a broker. A separate Fastify HTTP test verifies the
generated Swagger document, UI HTML and real CSS asset remain available.
Follow-up local validation: 268 unit tests, 18 checker tests, architecture/naming/
format checks and all four Nest application builds passed. The 29 guarded
PostgreSQL tests are skipped locally and must pass against the isolated CI
database before publication.

The existing guarded PostgreSQL suite must run on an isolated CI database, not
production or Tailscale database addresses. CI/deployment evidence is recorded
in the associated commit's workflow runs.
