# Phase 21 — Real Customer Onboarding + AWS Connection
## Pre-Implementation Architecture Audit

> [!IMPORTANT]
> This is a READ-ONLY audit. No code was modified. All findings are based on direct inspection of the existing implementation.

---

## Part 1 — Authentication Audit

### Existing Routes
| Route | Method | Protected | Controller |
|---|---|---|---|
| `/api/v1/auth/register` | POST | No (rate-limited) | `registerController` |
| `/api/v1/auth/login` | POST | No (rate-limited) | `loginController` |
| `/api/v1/auth/logout` | POST | No | `logoutController` |
| `/api/v1/auth/me` | GET | Yes (`requireAuth`) | `meController` |

### Cookie Security
- `httpOnly: true` — JS cannot access token ✅
- `sameSite: 'strict'` — CSRF protection ✅
- `secure: true` in production ✅
- `maxAge` matches JWT expiry ✅

### Findings

**A. Can a brand-new customer register?**
YES. `POST /api/v1/auth/register` accepts `{ email, password }`. Password requires 8+ chars, uppercase, lowercase, digit. Returns 201 with user data (no password_hash) and sets auth cookie.

**B. After registration, what happens?**
Backend sets auth cookie and returns user data. **Frontend has NO post-registration redirect.** The `Login.tsx` page only handles login — there is no Register/SignUp page in the frontend. After backend registration, the client would receive the JWT cookie but there's no frontend flow to drive the user forward.

**C. Does frontend know the authenticated user?**
PARTIALLY. `ProjectRedirect` calls `/api/v1/auth/me` to check authentication and detect `PLATFORM_ADMIN` role. But there is **no auth context/provider** exposing user state globally across components. Each component/page that needs auth must call `/me` itself or rely on HTTP 401 responses.

**D. Can frontend distinguish states?**
- Unauthenticated → redirected to `/login` via `ProjectRedirect` ✅
- Authenticated + has projects → redirected to first project ✅
- Authenticated + NO projects → stays on `/` with loading spinner, warning logged, **no onboarding UI** ❌
- Authenticated + PLATFORM_ADMIN → `/admin` ✅

**E. Existing onboarding state?**
NONE. There is no `ONBOARDING` state, no onboarding step tracking, no wizard, no "welcome" flow.

**F. Redirect rules?**
- `/` → `ProjectRedirect` (checks `/me` then `/projects`)
- `/login` → Login form (no signup link)
- Unauthenticated → `/login`
- Authenticated admin → `/admin`
- Authenticated user with projects → `/projects/:id`
- Authenticated user with NO projects → **stuck at `/` spinner** ❌

**G. Is project selection already supported?**
YES. `AppShell` has a `<select>` dropdown in the header that loads all projects and navigates to `/projects/:id` on change.

---

## Part 2 — Project Creation Audit

### Existing Endpoints
| Route | Method | Auth | Notes |
|---|---|---|---|
| `GET /api/v1/projects` | GET | Yes | List projects for user |
| `POST /api/v1/projects` | POST | Yes | Create project |
| `GET /api/v1/projects/:id` | GET | Yes | Get single project |
| `PATCH /api/v1/projects/:id` | PATCH | Yes | Update |
| `DELETE /api/v1/projects/:id` | DELETE | Yes | Delete |

### Create Payload
```json
{ "name": "string (1-150 chars)", "description": "string|null (max 1000)" }
```

**A. Can a newly registered user create their first project?**
YES — backend is fully capable. `POST /api/v1/projects` with valid JWT cookie creates a project tied to `req.user.id`.

**B. Required fields?** `name` only. `description` is optional.

**C. Can project creation happen immediately after registration?**
YES — same cookie is valid. No email verification or waiting period.

**D. Is there a project creation modal/page/form?**
NO. No frontend component exists to create a project. There is a project dropdown selector in `AppShell` but no "New Project" button or form anywhere.

**E. Can the frontend redirect into a project after creation?**
It could via `navigate('/projects/:id')` since the router supports that path. But no component currently does this programmatically after project creation.

**F. Does project ownership enforcement work?**
YES. All project routes use `requireAuth` + ownership checked via `WHERE user_id = $X` in SQL queries. Cross-user access returns 404 (not 403, which is a standard security practice to not leak existence).

---

## Part 3 — Cloud Account Connection Audit

### Existing Endpoints (nested under `/api/v1/projects/:projectId/cloud-accounts`)
| Route | Method | Auth | Notes |
|---|---|---|---|
| `GET /` | GET | Yes | List cloud accounts for project |
| `POST /` | POST | Yes | Create cloud account |
| `GET /:id` | GET | Yes | Get single account |
| `GET /:id/setup` | GET | Yes | Get External ID + setup instructions |
| `PATCH /:id` | PATCH | Yes | Update (inc. role_arn) |
| `DELETE /:id` | DELETE | Yes | Disconnect |
| `POST /:id/connection-test` | POST | Yes | Verify AWS connection |
| `POST /:id/discover` | POST | Yes | Run live AWS discovery |

**A. Can a customer create a LIVE AWS cloud account connection?**
YES — backend fully implemented. `createCloudAccount` service → repository creates account with `gen_random_uuid()` external_id.

**B. Exact create payload:**
```json
{
  "provider": "AWS",
  "account_id": "123456789012",     // 12-digit AWS account ID
  "account_name": "My AWS Account",
  "region": "us-east-1",            // validated regex
  "mode": "LIVE",                   // default
  "environment": "production",      // optional enum
  "description": "...",             // optional
  "role_arn": "arn:aws:iam::123456789012:role/AtherOpsRole" // optional at create time
}
```

**C. How is External ID generated?**
`gen_random_uuid()` — PostgreSQL generates a UUID v4 at INSERT time. Stored in `cloud_accounts.external_id`. Never regenerated after creation.

**D. Is External ID returned safely to frontend?**
YES — `GET /:id/setup` returns `{ accountId, provider, roleArn, externalId, setupInstructions }`. The setup endpoint is auth-protected and ownership-verified.

**E. Is Role ARN validated?**
YES — Zod regex: `^arn:aws(-us-gov|-cn)?:iam::\d{12}:role\/.+$`. Also validated in `connection.service.ts` at test time with account ID cross-check.

**F. Multiple LIVE connections per project?**
MULTIPLE ALLOWED. The service checks `checkAccountInProject` which prevents the **same AWS account ID** being added twice to the same project, but different AWS account IDs can be added. One project can have multiple LIVE cloud accounts.

**G. What happens when a connection is created?**
1. Ownership verified
2. Duplicate AWS account in same project checked
3. Record inserted with `gen_random_uuid()` external_id
4. `CLOUD_ACCOUNT_CREATED` audit log written
5. Returns created account (without external_id in the public type — see gap below)

**H. Is there an existing "setup" endpoint?**
YES — `GET /:cloudAccountId/setup` returns `externalId` and setup instructions text.

**I. Is there existing AWS connection UI?**
NO. No frontend page or component exists for connecting an AWS account, entering a Role ARN, viewing setup instructions, or testing the connection.

> [!WARNING]
> **GAP FOUND:** `CloudAccount` public type does NOT include `externalId`. The `setup` endpoint exposes it separately, which is correct. But the list/get account responses omit `externalId` — the customer cannot see their External ID without explicitly calling the `/setup` endpoint.

---

## Part 4 — AWS IAM Setup Audit

**A. What AWS principal must the customer trust?**
The AtherOps backend uses `new STSClient({})` — it relies on the **ambient IAM credentials of the server** (EC2 instance profile, ECS task role, or environment variables `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`). The trust policy principal must be the **IAM identity that the AtherOps server runs as** at deployment time. This is NOT hardcoded in the codebase. There is no `ATHEROPS_AWS_PRINCIPAL` or equivalent configuration. **The AtherOps AWS principal ARN is not specified anywhere in the implementation** — this is a gap that must be documented in the IAM setup instructions.

**B. What External ID must the customer use?**
The `external_id` stored in `cloud_accounts` table, generated by PostgreSQL `gen_random_uuid()`. Returned via `GET /:id/setup`.

**C. What permissions does the collector actually require?**

Based on direct inspection of `aws-discovery.ts`, the following AWS API calls are made:

| Service | API Call | Required Permission |
|---|---|---|
| EC2 | `DescribeVpcs` | `ec2:DescribeVpcs` |
| EC2 | `DescribeSubnets` | `ec2:DescribeSubnets` |
| EC2 | `DescribeSecurityGroups` | `ec2:DescribeSecurityGroups` |
| EC2 | `DescribeInstances` | `ec2:DescribeInstances` |
| S3 | `ListBuckets` | `s3:ListAllMyBuckets` |
| S3 | `GetBucketLocation` | `s3:GetBucketLocation` |
| IAM | `ListRoles` | `iam:ListRoles` |
| RDS | `DescribeDBInstances` | `rds:DescribeDBInstances` |
| Lambda | `ListFunctions` | `lambda:ListFunctions` |

**D. Existing read-only IAM policy definition?**
NO. There is no pre-built IAM policy JSON in the codebase. No `iam-policy.json`, no CloudFormation template, no Terraform module. **This must be created for Phase 21.**

**E. Does backend validate assumed AWS identity?**
YES — `verifyAwsConnection` calls `AssumeRole` then `GetCallerIdentity` and validates `actualAccountId === expectedAccountId`.

**F. Does it verify trust policy (ExternalId enforcement)?**
YES — performs a **negative test**: attempts AssumeRole with a random UUID. If it succeeds, marks `trustPolicyVerified: false`.

**G. Verification response fields:**
```json
{
  "provider": "AWS",
  "account_id": "123456789012",
  "connected": true,
  "role_verified": true,
  "identity_verified": true,
  "trust_policy_verified": true,
  "error": null
}
```

---

## Part 5 — AWS Connection Verification Audit

**Complete flow trace:**
```
Frontend (none yet)
  ↓
POST /api/v1/projects/:projectId/cloud-accounts/:cloudAccountId/connection-test
  ↓
testAwsConnectionController
  ↓
testAwsConnection() [connection.service.ts]
  ↓ 1. findCloudAccountById() — ownership enforced
  ↓ 2. ARN format validation
  ↓ 3. ARN account ID vs stored account_id check
  ↓ 4. Audit log: AWS_CONNECTION_TEST_STARTED
  ↓
verifyAwsConnection() [aws.sts.ts]
  ↓ 1. AssumeRole (with external_id)
  ↓ 2. GetCallerIdentity
  ↓ 3. Account ID match verification
  ↓ 4. Negative test: AssumeRole with wrong ExternalId
  ↓
Audit log: AWS_CONNECTION_VERIFIED | AWS_TRUST_POLICY_INSECURE | AWS_CONNECTION_FAILED
  ↓
{ connected, role_verified, identity_verified, trust_policy_verified, error }
  ↓
Frontend (not implemented)
```

**A. Can this be executed by a real customer today?**
YES — the backend endpoint is fully functional. A customer with a valid cloud account ID and a Role ARN can call it via API.

**B. Verification endpoint exposed?**
YES — `POST /:cloudAccountId/connection-test` is registered in `cloudAccountsNestedRouter`.

**C. Does it accept Role ARN + External ID correctly?**
YES — reads `role_arn` and `external_id` from the stored cloud account (customer does NOT need to re-submit them at test time).

**D. Error differentiation:**
| Failure Case | Backend Handling |
|---|---|
| Invalid Role ARN format | `ValidationError` before AWS call |
| ARN account ID mismatch | `ValidationError` before AWS call |
| AccessDenied (wrong External ID) | `safeErrorMessage = 'Access Denied: ...'` |
| Wrong AWS account | `identityVerified: false, error: 'AWS Account ID mismatch'` |
| Trust policy insecure | `trustPolicyVerified: false, connected: false` |
| AWS unavailable | Generic `safeErrorMessage = 'AWS Error: ...'` |

**E. Are errors safe for users?**
YES — raw AWS SDK error messages are never returned. `error.name` (not `error.message`) is used in the generic case.

**F. Are credentials stored?**
NO — temporary STS credentials exist only in memory during the request.

---

## Part 6 — Discovery Readiness Audit

**A. Can a LIVE account be discovered after successful AssumeRole?**
YES — `POST /:cloudAccountId/discover` calls `runAwsCollection`. Full flow: ownership check → DEMO guard → AssumeRole → discovery → upsert resources → upsert relationships → analysis run record.

**B. Required cloud account fields:**
- `mode = 'LIVE'` (DEMO is blocked)
- `role_arn` not null (throws `ValidationError` otherwise)
- `external_id` (always set at creation)

**C. Uses project's cloud account connection?**
YES — `findCloudAccountById(cloudAccountId, projectId, userId)` ensures ownership, then reads `role_arn` and `external_id`.

**D. Uses temporary STS credentials?**
YES — `getTemporaryCredentials(role_arn, external_id)` → temporary credentials used for discovery, never stored.

**E. Resources stored against correct cloud_account?**
YES — `upsertResource(client, { accountId: cloudAccountId, ... })`.

**F. Relationships stored correctly?**
YES — `upsertRelationship(client, { accountId: cloudAccountId, ... })`.

**G. Is discovery idempotent?**
YES — both resource and relationship upserts use `ON CONFLICT DO UPDATE` / `ON CONFLICT DO NOTHING`.

**H. What happens if discovery is run twice?**
Resources are upserted (updated if changed). Relationships are upserted. A new `analysis_run` record is created (historical — by design, as established in Phase 20.1).

**I. Can discovery operate on DEMO accounts?**
NO — hard guard: `if (cloudAccount.mode === 'DEMO') return { status: 'CANCELLED', ... }`.

**J. Onboarding discovery endpoint:**
`POST /api/v1/projects/:projectId/cloud-accounts/:cloudAccountId/discover`

---

## Part 7 — First Analysis Readiness Audit

**A. Can onboarding trigger analysis immediately after discovery?**
YES — but it requires TWO separate sequential calls:
1. `POST /:cloudAccountId/analysis-runs/:analysisRunId/evaluate` → security findings
2. `POST /:cloudAccountId/analysis-runs/:analysisRunId/attack-paths/analyze` → attack paths

The `analysisRunId` is returned in the discovery response as `data.analysisRunId`.

**B. Endpoints:**
- Security evaluation: `POST /api/v1/projects/:projectId/cloud-accounts/:cloudAccountId/analysis-runs/:analysisRunId/evaluate`
- Attack paths: `POST /api/v1/projects/:projectId/cloud-accounts/:cloudAccountId/analysis-runs/:analysisRunId/attack-paths/analyze`
- Risk scoring: No explicit trigger endpoint — risk scores appear to be written by the security evaluation step

**C. Prerequisites:**
- Completed analysis run (status = 'COMPLETED')
- Cloud account must belong to project

**D. Synchronous or asynchronous?**
SYNCHRONOUS (blocking HTTP call). For large AWS environments, this could be slow. No background job queue exists.

**E. Frontend result:**
Security evaluation returns `{ evaluatedRules, findingsCreated, findingsUpdated, findingsResolved }`.

**F. Discovery succeeds, analysis fails?**
The analysis run record exists with status COMPLETED. The evaluate controller will check status and allow re-evaluation. Safe to retry.

**G. Is retry safe?**
YES — findings use upsert semantics (UPDATE existing, INSERT new).

**H. Dashboard uses latest completed analysis?**
YES — fixed in Phase 20.1: `getProjectAttackPaths` uses `MAX(id)` CTE to show latest run's paths.

---

## Part 8 — Frontend Onboarding Audit

### Existing Routes
| Frontend Route | Component | Notes |
|---|---|---|
| `/` | `ProjectRedirect` | Auth check + redirect |
| `/login` | `Login` | Login only — no signup |
| `/admin` | `AdminDashboard` | Platform admin |
| `/projects/:projectId` | `AppShell > Dashboard` | Main dashboard |
| `/projects/:projectId/security` | `SecurityFindings` | |
| `/projects/:projectId/attack-paths` | `AttackPaths` | |
| `/projects/:projectId/resources` | `Resources` | |
| `/projects/:projectId/costs` | `Costs` | |
| `/projects/:projectId/pricing` | `Pricing` | |
| `/projects/:projectId/ai` | `AIAssistant` | |
| `/projects/:projectId/reports` | `Reports` | |

### Missing Frontend Routes for Phase 21
| Needed Route | Status | Notes |
|---|---|---|
| `/signup` | ❌ MISSING | No register page exists |
| `/onboarding` | ❌ MISSING | No onboarding flow |
| `/onboarding/project` | ❌ MISSING | No project creation form |
| `/onboarding/aws` | ❌ MISSING | No AWS connection form |
| `/onboarding/aws/verify` | ❌ MISSING | No verification step |
| `/projects` | ❌ MISSING | No project selector page |

### Existing Frontend Capabilities
- `fetchApi<T>` — generic authenticated API client ✅
- `useApi<T>` — React hook for data fetching ✅
- `useProject()` — project ID from URL params + localStorage ✅
- Project selector dropdown in `AppShell` header ✅
- Login form ✅
- Error state rendering ✅

### Missing Frontend Capabilities
- No auth context/provider (user data not globally shared) ❌
- No signup page ❌
- No project creation form/modal ❌
- No AWS connection wizard ❌
- No IAM setup instructions display ❌
- No connection-test feedback UI ❌
- No "no projects" empty state with CTA ❌

---

## Part 9 — Project Selector Audit

**Current behavior:**
- `ProjectRedirect` at `/` → fetches `/projects` → redirects to `projects[0].id`
- For 0 projects: stays at `/` with spinner — **stuck state** ❌
- For 1 project: auto-redirects → correct ✅
- For N projects: auto-redirects to first one, selector in header allows switching ✅

**Missing for Phase 21:**
- No dedicated `/projects` page with a visual project card grid
- No "Create your first project" CTA when no projects exist
- No "New Project" button anywhere

---

## Part 10 — Data Model Audit

### Schema Inspection

```
users           → id, email, password_hash, role, status, created_at
projects        → id, user_id, name, description, created_at
cloud_accounts  → id, user_id, project_id, provider, account_id, account_name,
                  environment, region, mode, description, role_arn, external_id,
                  created_at, last_scanned_at
analysis_runs   → id, project_id, account_id, status, started_at, completed_at,
                  resources_scanned, findings_created
```

**Is the schema sufficient for Phase 21?**

YES — no schema changes required. Every field needed for the onboarding flow already exists:
- `cloud_accounts.external_id` — stores the pre-generated External ID ✅
- `cloud_accounts.role_arn` — stores Role ARN (nullable, set by customer) ✅
- `cloud_accounts.mode` — LIVE/DEMO guard ✅
- `projects.user_id` — ownership chain ✅
- `cloud_accounts.project_id` — project scoping ✅

**Onboarding state can be derived (no new table needed):**

| State | Derived From |
|---|---|
| NO_PROJECT | `SELECT COUNT(*) FROM projects WHERE user_id = $1` = 0 |
| PROJECT_CREATED | project exists |
| AWS_SETUP | cloud_account exists with mode=LIVE |
| ROLE_ARN_ENTERED | cloud_account.role_arn IS NOT NULL |
| AWS_VERIFIED | audit_logs has AWS_CONNECTION_VERIFIED for this account |
| DISCOVERY_COMPLETE | analysis_runs exists with status=COMPLETED for this account |
| ANALYSIS_COMPLETE | findings exist for this analysis_run |

> [!TIP]
> No new database table is required for Phase 21 onboarding state. All state can be derived from existing tables.

---

## Part 11 — Security Audit

### Customer A accessing Customer B's cloud account?
**BLOCKED** — `findCloudAccountById` joins through `projects` table:
```sql
WHERE ca.id = $1 AND ca.project_id = $2 AND p.user_id = $3
```
All three must match. Changing account ID in URL returns 404 (not the actual account).

### Can Customer A trigger discovery/analysis against Customer B's account?
**BLOCKED** — `runAwsCollection` calls `findCloudAccountById(cloudAccountId, projectId, userId)`. All IDs are cross-checked. No customer can reach another's account.

### Project ID swap?
**BLOCKED** — `checkProjectOwnership` verifies `WHERE id = $1 AND user_id = $2`. Cross-project attack requires knowing another user's project ID AND JWT.

### Cloud account connected to wrong project?
**BLOCKED** — `createCloudAccount` verifies project ownership before creation. Account is scoped to the creating user's project.

### Role ARN — stored safely?
YES — stored in `cloud_accounts.role_arn`. Never logged. Never returned in error responses. No AWS secret keys accepted or stored (only ARN + External ID from the customer).

### External ID protection?
YES — not exposed in list/get responses (only in `/setup` endpoint). Never logged.

### Audit logging?
YES — `CLOUD_ACCOUNT_CREATED`, `CLOUD_ACCOUNT_UPDATED`, `CLOUD_ACCOUNT_DISCONNECTED`, `AWS_CONNECTION_TEST_STARTED`, `AWS_CONNECTION_VERIFIED`, `AWS_CONNECTION_FAILED`, `AWS_DISCOVERY_STARTED`, `AWS_DISCOVERY_COMPLETED`.

### JWT security?
YES — `httpOnly`, `sameSite: strict`, `secure` in production.

---

## Part 12 — Real AWS Readiness Matrix

| Capability | Existing? | Backend Ready? | Frontend Ready? | Missing Work | Risk |
|---|---|---|---|---|---|
| Registration | ✅ | ✅ | ❌ | Signup page | Low |
| Login | ✅ | ✅ | ✅ | None | None |
| Project creation | ✅ | ✅ | ❌ | Creation form/modal | Low |
| Project selection | ✅ | ✅ | ⚠️ Partial | Full selector page | Low |
| AWS connection creation | ✅ | ✅ | ❌ | Connection form | Medium |
| External ID generation | ✅ | ✅ | ❌ | Display to customer | Low |
| IAM setup instructions | ⚠️ Partial | ⚠️ Text only | ❌ | Policy JSON, CloudFormation/Terraform template | Medium |
| Role ARN input | ✅ | ✅ (via PATCH) | ❌ | Role ARN input UI | Low |
| AssumeRole | ✅ | ✅ | N/A | None | None |
| GetCallerIdentity | ✅ | ✅ | N/A | None | None |
| AWS account verification | ✅ | ✅ | ❌ | Verification result UI | Low |
| Trust verification | ✅ | ✅ | ❌ | Trust result UI | Low |
| Live discovery | ✅ | ✅ | ❌ | Discovery trigger UI | Medium |
| First analysis | ✅ | ✅ | ❌ | Analysis trigger UI | Medium |
| Dashboard redirect | ✅ | N/A | ✅ | None | None |
| Error recovery | ✅ | ✅ | ❌ | Error/retry UI | Medium |
| Retry | ✅ | ✅ | ❌ | Retry button UI | Low |
| Multiple projects | ✅ | ✅ | ⚠️ Partial | Project selector page | Low |
| Project isolation | ✅ | ✅ | ✅ | None | None |
| Audit logging | ✅ | ✅ | N/A | None | None |
| AtherOps AWS principal documented | ❌ | ❌ | ❌ | Must document which IAM identity runs AtherOps | **HIGH** |
| Read-only IAM policy JSON | ❌ | N/A | ❌ | Must create policy JSON for customers | Medium |

---

## Part 13 — Onboarding State Machine

All states can be **derived** from existing data. No new table needed.

```
NEW_USER (not registered)
  ↓ POST /auth/register
AUTHENTICATED (user exists, no projects)
  ↓ POST /projects
PROJECT_CREATED (project exists)
  ↓ POST /projects/:id/cloud-accounts { mode: LIVE }
AWS_SETUP (cloud_account exists, role_arn = null)
  ↓ PATCH /projects/:id/cloud-accounts/:id { role_arn: "..." }
ROLE_ARN_ENTERED (cloud_account.role_arn IS NOT NULL)
  ↓ POST /projects/:id/cloud-accounts/:id/connection-test
AWS_VERIFIED (connected: true, trust_policy_verified: true)
  ↓ POST /projects/:id/cloud-accounts/:id/discover
DISCOVERY_RUNNING → DISCOVERY_COMPLETE (analysis_run status=COMPLETED)
  ↓ POST /projects/:id/cloud-accounts/:id/analysis-runs/:runId/evaluate
  ↓ POST /projects/:id/cloud-accounts/:id/analysis-runs/:runId/attack-paths/analyze
ANALYSIS_COMPLETE
  ↓ navigate to /projects/:id
READY
```

**Failure states:**
```
AWS_VERIFICATION_FAILED  → { connected: false, error: "..." } → allow retry/re-enter ARN
DISCOVERY_FAILED         → analysis_run status=FAILED → allow retry
ANALYSIS_FAILED          → findings evaluation error → allow retry
```

**State derivation queries (no new tables):**
1. User has project? → `SELECT id FROM projects WHERE user_id = $1 LIMIT 1`
2. Project has cloud account? → `SELECT id, role_arn FROM cloud_accounts WHERE project_id = $1 AND mode = 'LIVE'`
3. Connection tested? → `SELECT action FROM audit_logs WHERE entity_id = $1 AND action = 'AWS_CONNECTION_VERIFIED' LIMIT 1`
4. Discovery done? → `SELECT id FROM analysis_runs WHERE account_id = $1 AND status = 'COMPLETED' LIMIT 1`

---

## Part 14 — Demo Compatibility Audit

| Item | Status |
|---|---|
| DEMO accounts remain usable | ✅ `mode = 'DEMO'` data untouched |
| DEMO discovery hard-blocked | ✅ Early return in `runAwsCollection` |
| Demo findings remain | ✅ No Phase 21 impact on findings table |
| Demo attack paths remain | ✅ No Phase 21 impact |
| Demo billing simulated | ✅ `billing_source = SIMULATED_DEMO` preserved |
| Cloud Comparison | ✅ Unchanged |
| Gemini | ✅ Unchanged |
| Platform Admin | ✅ Unchanged |
| Customer personas | ✅ Unchanged |
| New LIVE accounts coexist | ✅ Different `mode` column |

Phase 21 must introduce LIVE accounts alongside existing DEMO ones — no conflicts exist in the schema or service layer.

---

## Part 15 — Regression Audit

| Check | Result |
|---|---|
| Backend Tests | ✅ 268/268 PASS (from Phase 20.1) |
| Frontend Tests | ✅ 17/17 PASS (Vitest) |
| Typecheck | ✅ PASS |
| Build | ✅ PASS |
| Lint | ✅ 0 errors |

No regressions introduced by audit inspection (read-only).

---

## Part 16 — Final Recommendation

### A. CURRENT STATE

AtherOps has a **fully functional backend** for the complete real customer onboarding flow. All the critical backend infrastructure — registration, project creation, cloud account connection, External ID generation, Role ARN validation, AssumeRole, GetCallerIdentity, trust policy verification, live discovery, and security analysis — **already exists and works correctly**.

The **frontend is severely behind the backend.** The only customer-facing page is a Login form. There is no signup page, no project creation UI, no AWS connection wizard, and no onboarding flow at all. When a new customer registers via API and has no projects, they are stuck on a loading spinner with no guidance.

### B. WHAT CAN BE REUSED

| Component | Reusable As-Is |
|---|---|
| `POST /auth/register` | ✅ 100% |
| `POST /auth/login` | ✅ 100% |
| `GET /auth/me` | ✅ 100% |
| `POST /projects` | ✅ 100% |
| `GET /projects` | ✅ 100% |
| `POST /projects/:id/cloud-accounts` | ✅ 100% |
| `GET /projects/:id/cloud-accounts/:id/setup` | ✅ 100% |
| `PATCH /projects/:id/cloud-accounts/:id` | ✅ 100% (role_arn update) |
| `POST /:id/connection-test` | ✅ 100% |
| `POST /:id/discover` | ✅ 100% |
| `POST /:id/analysis-runs/:id/evaluate` | ✅ 100% |
| `POST /:id/analysis-runs/:id/attack-paths/analyze` | ✅ 100% |
| AWS STS / AssumeRole / GetCallerIdentity | ✅ 100% |
| External ID generation | ✅ 100% |
| `fetchApi` / `useApi` | ✅ 100% |
| `AppShell` project selector | ✅ 100% |
| `ProjectRedirect` | ✅ Reusable with minor additions |

### C. WHAT IS MISSING

1. **Frontend Signup page** (`/signup` route + `Register.tsx`)
2. **Frontend Project creation form/modal** (in onboarding or as dialog)
3. **Frontend Onboarding wizard** — multi-step: Project → AWS Connect → Role ARN → Verify → Discovery → Analysis → Done
4. **Frontend IAM setup instructions display** — show External ID, show required IAM permissions, optionally show IAM policy JSON
5. **Frontend connection-test result display** — show `connected`, `role_verified`, `identity_verified`, `trust_policy_verified`
6. **Frontend discovery/analysis progress** — polling or async feedback
7. **Frontend "no projects" empty state** with "Get Started" CTA
8. **Frontend auth context/provider** — expose `user` globally without each component calling `/me`
9. **AtherOps AWS principal ARN** — must document which IAM entity (EC2 role, user, etc.) the customer must trust
10. **Read-only IAM policy JSON** — a ready-to-use IAM policy for customers to copy-paste
11. **Frontend test script entry** — `"test": "vitest run"` in `frontend/package.json`

### D. REQUIRED PHASE 21 CHANGES

1. **New frontend pages:** `Signup.tsx`, `Onboarding.tsx` (wizard), `ProjectSelector.tsx`
2. **New frontend routes:** `/signup`, `/onboarding`, `/onboarding/project`, `/onboarding/aws`, `/onboarding/aws/verify`
3. **Auth context provider** — React context exposing current user + loading state
4. **`ProjectRedirect` update** — redirect to `/onboarding` when no projects found (instead of stuck spinner)
5. **`Login.tsx` update** — add "Don't have an account? Sign up" link
6. **IAM policy document** — define and expose the required read-only IAM policy in setup instructions
7. **Document AtherOps AWS principal ARN** — required for customers to configure trust relationship
8. **Add `"test": "vitest run"` to `frontend/package.json`**

### E. OPTIONAL CHANGES

1. Background job queue for long-running discovery (currently synchronous — acceptable for MVP, risk for large AWS environments)
2. `/projects` page with visual project card grid instead of auto-redirect
3. Progress indicator during discovery/analysis (WebSocket or polling)
4. Email verification on registration
5. Onboarding progress persistence in DB (currently derivable — DB state is sufficient for MVP)

### F. DATABASE CHANGES REQUIRED

**NONE.** The existing schema is fully sufficient for Phase 21. All onboarding state can be derived from existing tables. No new tables, columns, or indexes are required.

### G. SECURITY RISKS

| Risk | Severity | Notes |
|---|---|---|
| AtherOps AWS principal not documented | **HIGH** | Customer cannot create correct trust policy without knowing AtherOps' IAM principal |
| No signup form = API-only registration | Medium | Customers must know the API to register — but this is handled by building the signup page |
| `role_arn` accepted as null at create time | Low | Valid design: create first, add ARN second. No security issue. |
| External ID not in list response | Low | Intentional — exposed only via `/setup`. No security issue. |
| Synchronous discovery blocks HTTP thread | Low | Risk of timeouts on large accounts. Not a security issue. |

### H. REGRESSION RISKS

| Risk | Severity | Mitigation |
|---|---|---|
| New frontend routes conflict with existing | Low | React Router `Routes` is isolated |
| Auth context changes break existing pages | Medium | Wrap at `App` level, fallback to 401 behavior |
| Adding signup page exposes registration endpoint to UI | Low | Endpoint already exists — UI doesn't add risk |
| DEMO accounts affected | None | `mode` field isolates DEMO completely |

### I. RECOMMENDED IMPLEMENTATION ORDER

```
1. Add "test" script to frontend/package.json                    [5 min]
2. Create AuthContext provider (React context for current user)  [30 min]
3. Create Signup page (/signup route + Register.tsx)             [45 min]
4. Update Login.tsx to add signup link                           [5 min]
5. Update ProjectRedirect to redirect to /onboarding if no projects [10 min]
6. Create Onboarding wizard — Step 1: Project creation           [1 hr]
7. Create Onboarding wizard — Step 2: AWS connection form        [1 hr]
8. Create Onboarding wizard — Step 3: IAM setup instructions     [1 hr]
9. Create Onboarding wizard — Step 4: Role ARN input + verify    [1 hr]
10. Create Onboarding wizard — Step 5: Discovery + analysis      [1 hr]
11. Create Onboarding wizard — Step 6: Done + dashboard redirect [30 min]
12. Document AtherOps AWS principal ARN in setup instructions    [30 min]
13. Create IAM policy JSON template                              [30 min]
14. Create ProjectSelector page (optional enhancement)           [1 hr]
15. Full regression: backend 268 tests, frontend 17 tests        [15 min]
```

**Total estimated frontend work: ~8-10 hours**
**Backend work: ZERO** (all backend is ready)

### J. FINAL STATUS

> **READY FOR PHASE 21 IMPLEMENTATION**

The backend is production-grade and complete. All APIs required for real customer onboarding exist, are secured, and are tested (268/268 pass). The Phase 21 implementation work is **entirely frontend** — building the UI that drives customers through the existing backend flows.

The one critical documentation gap (AtherOps AWS principal ARN) must be resolved at the start of Phase 21 before IAM setup instructions can be shown to customers.
