# Security Architecture

## Security Mechanisms Present in Code

### Unified gateway

- login endpoint at `/api/v1/governance/auth/login`
- request auth gating before protected page/API access
- governance actor context attached to mutating operations
- approval-required decisions for sensitive publish/share/schedule and selected AI flows

### Governance engine

`packages/governance-engine` models:

- permission definitions
- role definitions and assignments
- policy rules and policy decisions
- approval workflows and approval records
- evidence records and attachments
- audit events and lineage edges
- security surface settings such as session policy and rate limits

### `apps/rasid-web`

- JWT cookie auth in `localAuth.ts`
- password hashing with `bcryptjs`
- cookie-based session retrieval
- upload route auth middleware
- optional OAuth callback flow in `_core/oauth.ts`

## Security Gaps and Risks

These are direct architectural observations from the code layout.

- the unified gateway keeps a large amount of auth, page rendering, and write-path routing in one file, which increases review surface and accidental bypass risk
- there is no single shared auth/tenant middleware reused across all standalone servers
- the main monorepo relies heavily on local filesystem persistence, which means file permissions and deployment isolation matter more than in a centrally managed DB design
- `apps/rasid-web` has its own auth and persistence model and is not yet a thin adapter over shared governance/runtime enforcement
- some login flows are simple compared with the modeled governance complexity

## Sensitive Surfaces

| Surface | Sensitivity reason |
| --- | --- |
| dashboard publish/share/schedule | public or tenant-visible output generation |
| governance role/policy endpoints | changes authorization behavior |
| AI job execution | may trigger downstream mutations |
| report/presentation publication | exposes public content |
| file upload and storage routes | ingest untrusted user input |

## Recommended Reading

For security-sensitive changes, inspect:

- `packages/governance-engine/src/index.ts`
- `apps/contracts-cli/src/dashboard-web.ts`
- `apps/contracts-cli/src/transcription-web.ts`
- `apps/rasid-web/server/localAuth.ts`
- `apps/rasid-web/server/uploadRoute.ts`

