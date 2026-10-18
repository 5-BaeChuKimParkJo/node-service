# Contributing

Use `type(scope): imperative subject`, no gitmoji, maximum 100 characters.
Install the shared hook: `python scripts/install_git_hooks.py` (Python 3.10+).
Test it: `python -m unittest discover -s scripts -p test_check_conventions.py`.
The authoritative rule set and fixtures are in `.conventions/`; GitOps holds
the full engineering guide in `docs/engineering/conventions.md`.

This checkout publishes auction-service; retained notification/catalog apps are
not automatically deployed. Backend TypeScript filenames use kebab-case role
suffixes, classes PascalCase and methods camelCase. Features use inward-only
domain/application/adapter dependencies. Ports must not expose Prisma/SDK types.
Keep Kafka wire identities and transaction/idempotency semantics unchanged.
Run tests and affected Nest app builds before release. Never commit credentials
or generated Prisma/build output.
