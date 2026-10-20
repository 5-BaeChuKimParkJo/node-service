# Dependency Security Audit

Date: 2026-10-20. Baseline: `442bac2`. Package manager: npm, with
`package-lock.json` used by CI and the Docker build. Counts below are vulnerable
package entries reported by npm, not unique CVEs or the GitHub alert count.

| Scope      | State  | Low | Moderate | High | Critical | Total |
| ---------- | ------ | --: | -------: | ---: | -------: | ----: |
| Full       | Before |   6 |       43 |   41 |        8 |    98 |
| Full       | After  |   2 |       16 |   22 |        2 |    42 |
| Production | Before |   1 |       27 |   18 |        4 |    50 |
| Production | After  |   0 |        0 |    3 |        0 |     3 |

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

The production audit still reports three high package entries: @fastify/static
8.2.0, @nestjs/platform-fastify 11.1.3, and its nested Fastify 5.3.3. A newer
direct Fastify does not replace the adapter's pinned copy; `npm ls` must inspect
both paths. Do not interpret the direct version as proof that the adapter is fixed.

The latest Nest 11 Fastify adapter requires @fastify/static 10.1.2 or newer.
The [static maintainer advisory](https://github.com/fastify/fastify-static/security/advisories/GHSA-8pvw-jcv7-9cmj)
has no fixed version in major 8. Upgrading that library from 8 to 10 and then
updating the Nest adapter remains pending explicit approval and Swagger/HTTP
regression validation. No force or legacy-peer-deps install is used.

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

Both audit commands intentionally still return exit code 1 for the documented
remaining entries. This is a dependency audit, not a container OS/global-tool
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

The existing guarded PostgreSQL suite must run on an isolated CI database, not
production or Tailscale database addresses. CI/deployment evidence is recorded
in the associated commit's workflow runs.
