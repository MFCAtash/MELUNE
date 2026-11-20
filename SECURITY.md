# Security policy

MELUNE treats security reports seriously. Please help us handle them responsibly.

## Supported versions

| Branch / tag | Status |
| --- | --- |
| `main` | Supported — fixes land here first |
| Release tags | Supported until the next tag |
| Older commits | Not supported |

There is no stable release train yet; `main` is the reference line.

## Reporting a vulnerability

**Do not open a public issue for security reports.** Public issues, discussions
and pull requests are visible to everyone and can be indexed by search engines.

Instead:

1. Email the maintainers at **security@melune.app** (or open a private GitHub
   security advisory via *Security → Report a vulnerability* on the repository),
2. Include: affected component, versions, reproduction steps, impact assessment
   and, if possible, a proof of concept that does not require real user data,
3. Do **not** include credentials, session tokens, customer data or dumps.

We aim to acknowledge within **72 hours** and to triage within **7 days**. You will
receive updates as we work, and credit in the fix release unless you prefer to
stay anonymous.

Out of scope: automated scanner noise without a demonstrated impact, findings
that require physical access to a device already in an attacker's control, and
third-party dependencies (report those upstream as well, but tell us so we can
upgrade).

## How this codebase is hardened

The design decisions below are deliberate — please preserve them in contributions.

- **Secrets at boot:** `apps/api/src/config/env.validation.ts` fails fast on
  missing or malformed configuration, including half-set credential pairs.
- **Password storage:** bcrypt hashing; passwords are never logged or serialised.
- **Sessions/tokens:** short-lived JWT access token plus a rotating refresh cookie;
  `HttpOnly`, `Secure`, `SameSite=Lax` in production.
- **Transport:** TLS terminated at the edge; `HSTS`, `X-Frame-Options`,
  `X-Content-Type-Options`, `Referrer-Policy` and `Permissions-Policy` headers are
  set centrally in [infra/caddy/site.caddy](infra/caddy/site.caddy).
- **Input validation:** every write endpoint validates with DTOs; queries are
  parameterised through Prisma.
- **Rate limiting:** the API applies throttlers, with per-route exemptions only
  where traffic patterns demand it.
- **File uploads:** content-type and size rules enforced; object keys are UUIDs;
  media is served public-read but immutable-cached.
- **Dependency hygiene:** Dependabot keeps dependencies current
  ([.github/dependabot.yml](.github/dependabot.yml)).
- **Least privilege in containers:** application containers run as a non-root
  user; only Caddy publishes ports.
- **Backups:** database dumps are gitignored and stored outside the repository
  ([docs/database.md](docs/database.md)).

## Known operational caveats

These are not vulnerabilities but they matter for a production deployment:

- `MailService` is currently a stub that logs messages. Password reset is
  unusable until a real provider is connected.
- Demo accounts (`admin@codexmusic.dev` / `demo@codexmusic.dev`) must be removed
  before the service is opened to the public.
- Cloudflare Free limits request bodies to 100 MB; the upload rule matches that
  ceiling exactly.
- Media currently lives in S3-compatible storage (MinIO locally). Any host must
  treat that bucket as containing licensed-only content.
