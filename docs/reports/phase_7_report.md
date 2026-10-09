# AtherOps — Phase 7: Security Evaluation Engine

## 1. Files & Modules Created/Modified

**Created:**
- `src/modules/security/rules/rule.types.ts`: Core data structures representing `SecurityRule`, `EvaluationContext`, and `EvaluationResult`.
- `src/modules/security/rules/rule.loader.ts`: Parses YAML rule definitions into memory and seamlessly upserts them into the database at server startup.
- `src/modules/security/rules/rule.repository.ts`: Interacts securely with `finding_rules`, `resources`, `relationships`, and `findings` tables.
- `src/modules/security/rules/rule.engine.ts`: Orchestrates the rule evaluators, isolating actual business logic from database interactions.
- `src/modules/security/rules/rule.service.ts`: Exposes the `runSecurityEvaluation` API, orchestrating the loader, engine, repository, and audit logging.
- `src/modules/security/rules/rule.controller.ts`: Validates project ownership, cloud account ownership, analysis run validity, and dispatches the request to the security service.
- `src/modules/security/evaluators/*.rules.ts`: Specific implementations for security rules (SG, S3, IAM, EC2, RDS, Lambda).
- `src/modules/security/rules/definitions/*.yaml`: All individual rule files matching the definitions.
- `tests/modules/security/evaluators.test.ts`: Isolated unit tests ensuring rules validate data correctly and securely.
- `tests/modules/security/findingLifecycle.test.ts`: Exhaustive tests ensuring that identical evaluations reuse `findings`, resolving those that fall away securely without destructive duplicates.
- `tests/api/securityEvaluationApi.test.ts`: E2E integration test for the HTTP evaluation endpoint.

**Modified:**
- `src/server.ts`: Hooks the `rule.loader.ts` to sync the rules automatically on boot.
- `src/api/v1/cloud-accounts/cloudAccount.routes.ts`: Maps `/:cloudAccountId/analysis-runs/:analysisRunId/evaluate` directly inside the cloud-account router.
- `package.json`: Included `js-yaml` dependency.

## 2. Rule Engine Architecture
The engine uses an extensible evaluator architecture strictly separated from AI/AWS network actions:
1. **Rule Registration**: YAML definitions initialize the configuration and get mirrored into `finding_rules`. 
2. **Context Setup**: During an evaluation, `rule.repository.ts` pulls all associated `resources` and `relationships` from Postgres into a standardized `EvaluationContext`.
3. **Execution**: The `rule.engine.ts` iteratively passes this context into each registered active `RuleEvaluator` which performs static logic validation safely.
4. **Storage**: The engine returns `EvaluationResult` sets which are then carefully verified against existing findings by the repository to either INSERT or UPDATE records securely (idempotency layer).

## 3. YAML Rule Format
Rules are loaded from `src/modules/security/rules/definitions/`. Example (`SG-001.yaml`):
```yaml
ruleCode: "SG-001"
name: "Public SSH/RDP Access"
category: "NetworkSecurity"
severity: "HIGH"
description: "Security group exposes SSH (22) or RDP (3389) to the public internet."
enabled: true
```

## 4. All Implemented Rules
- **SG-001**: Flags TCP 22/3389 rules with `0.0.0.0/0`.
- **S3-001**: Verifies explicit public access attributes via ACL or Policies without generating false-positives for merely missing fields.
- **S3-002**: Flags missing/disabled `ServerSideEncryption`.
- **IAM-001**: Checks `mfaEnabled` on IAM Users.
- **IAM-002**: Flags old (> 90 days) / unused IAM access keys.
- **IAM-003**: Detects wildcard policy allocations `Action: "*"` + `Resource: "*"`.
- **RDS-001**: Checks boolean configuration flag for public accessibility.
- **RDS-002**: Evaluates lack of instance storage encryption.
- **LAMBDA-001**: Checks standard relations/role attachments in Phase 6 mappings for overly permissive executions.

## 5. Rules Currently Unsupported (Insufficient Data)
- **EC2-001** *(EC2 instance has a public IP and lacks an identified protective WAF/load-balancer relationship)*: As per requirements, missing load-balancer references within the current AWS collector should not automatically manufacture a false positive. Because Phase 6 doesn't currently pull `LoadBalancer` / `WAF` instances, the evaluator gracefully returns empty results for this rule.

## 6. Finding Lifecycle/Idempotency Strategy
The logic leverages the exact schema inside the `findings` table cleanly:
- On Evaluation, it pulls all pre-existing findings for a `(account_id, resource_id, rule_code)` combination.
- **Identical findings** simply update their severity/notes and the new `analysis_run_id` without creating duplicates (the old ID is retained).
- **Newly discovered insecure states** append new `OPEN` issues.
- **Resolved states** (an issue that appeared in previous evaluations but is now missing/safe) are explicitly updated with `status = 'RESOLVED'` and a `resolved_at` timestamp. Historical records are preserved.

## 7. Analysis-Run Integration
The endpoint strictly associates evaluations with a `COMPLETED` analysis run belonging properly to a project & cloud account in the PostgreSQL system. Once evaluated, `findings_created` receives the precise count of newly inserted or updated insecure observations.

## 8. API Endpoint
```http
POST /api/v1/projects/:projectId/cloud-accounts/:cloudAccountId/analysis-runs/:analysisRunId/evaluate
```
Includes ownership checks (user $\rightarrow$ project $\rightarrow$ cloud account $\rightarrow$ analysis run) guaranteeing secure multi-tenancy.

## 9. Audit Events
Created fully integrated, sanitized audit log trails into the `audit_logs` schema:
- `SECURITY_EVALUATION_COMPLETED`
- `SECURITY_EVALUATION_FAILED`

## 10. Database Changes
**None**. I thoroughly evaluated the pre-existing DB dumps and rigidly conformed to `findings`, `finding_rules`, `resources`, `relationships`, and `analysis_runs` tables.

## 11. Test Count and Exact Results
The repository was run against the entire suite and all specific lifecycle endpoints successfully.
```
Test Suites: 11 passed, 11 total
Tests:       123 passed, 123 total
Snapshots:   0 total
Time:        27.718 s
```

## 12. Typecheck Result
`npm run typecheck` returned successfully with no errors (`Exit code 0`).

## 13. Build Result
`npm run build` completed successfully (`Exit code 0`).

## 14. Lint Result
`npm run lint` failed due to a preexisting limitation inside the `package.json` where `eslint` v10 requires the new `eslint.config.js` format instead of `.eslintrc.json`.

## 15. Demo Dataset Verification
Zero operations mutate existing DEMO relationships/resources. Findings evaluated internally against a DEMO cloud account safely insert rows into `findings` but do not rewrite core inventory mappings.

## 16. Confirmation (No AWS APIs Called)
I confirm that the engine is exclusively powered by PostgreSQL queries utilizing the Phase 6 discovered datasets. **No AWS credentials or `aws-sdk` clients are initialized in Phase 7 modules.**

## 17. Confirmation (No AI / LLM)
I confirm that no AI or LLMs are invoked in Phase 7 logic. 

## 18. Live AWS Verification Status
Tested safely in isolated local execution. Fully independent from live AWS infrastructure.

## 19. Remaining Limitations
- **EC2-001** awaits structural updates to Phase 6 AWS Resource Collections to accurately collect `WAF/ALB` records before it can reliably function without false positives.
