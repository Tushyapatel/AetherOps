# DEMO DATA-INTEGRITY STATUS: PASS

## 1. Exact Root Cause of Risk-Score Duplication
The demo finalization script (`demo_finalize.ts`) was previously written to unconditionally delete all `risk_history` and `risk_scores` for a project, then insert a new set. This meant that every time `demo_finalize.ts` was run on the *same* analysis runs, it would record entirely new timestamps in `risk_history` and wipe out any previous history, making historical trending impossible. In iterations prior to that delete logic, it would just insert into `risk_scores` directly, leading to duplicate scores for the exact same account and run.

## 2. Exact Changes Made to `demo_finalize.ts`
*   Removed the indiscriminate `DELETE FROM risk_history` and `DELETE FROM risk_scores` that were globally wiping out project history.
*   Implemented precise scoping per account: `DELETE FROM risk_scores WHERE account_id = $1`.
*   Added idempotency checks for `risk_history`. We now check if the specific `analysis_run_id` was already finalized using: 
    ```sql
    SELECT id FROM risk_scores WHERE account_id = $1 AND analysis_run_id = $2
    ```
    If it was already finalized, we UPSERT/recalculate the current `risk_scores` but skip inserting a redundant snapshot into `risk_history`. If it's a genuinely new analysis run, it gets correctly recorded into `risk_history`.
*   Generated a single `recordedAt` timestamp for the entire script execution so that the frontend's `GROUP BY recorded_at` aggregates account scores flawlessly on the chart.

## 3. Whether Risk History is Now Preserved
Yes. Running `demo_finalize.ts` multiple times on existing analysis runs does not add duplicate records to `risk_history` and leaves the old history completely intact. 

## 4. Exact Idempotency Behavior
*   Repeatedly running `demo_finalize.ts` on the same data replaces/updates the **current** `risk_scores` (ensuring 1 row per account) but does **not** insert new rows into `risk_history`.
*   Creating a **new** analysis run (`createAnalysisRun`) followed by `demo_finalize.ts` properly inserts 1 new row per account into `risk_history` representing the new snapshot, while still correctly replacing the current `risk_scores`.

## 5. Exact Project/Account/Run Scoping
All database mutations inside the finalize step are strictly tied to specific `account_id` references pulled securely from the pre-existing project. `risk_scores` are deleted and inserted `WHERE account_id = $1` making sure no other project's data could ever be affected by the demo pipeline.

## 6. Database Counts
### Test A/B (Before New Run)
*   projects: 1
*   cloud_accounts: 10
*   resources: 177
*   relationships: 181
*   analysis_runs: 10
*   findings: 29
*   **risk_scores: 10 (1 per account)**
*   **risk_history: 10 (1 per account)**
*   attack_paths: 19

### Test C (After Geniunely New Analysis Run Added)
*   analysis_runs: 20
*   **risk_scores: 10 (Remained 1 per account)**
*   **risk_history: 20 (Increased to 2 per account, properly preserving history!)**

## 7. Backend Test Count
*   **Passed:** 256 tests across 22 suites.
*   **Failed:** 0

## 8. Frontend Test Count
*   **Passed:** 17 tests across 1 suite.
*   **Failed:** 0

## 9. Typecheck Result
*   **Passed.** Fixed an invalid type assertion in `report.service.ts` where `billingSource: string` was used instead of the strict union type `"MIXED" | "SIMULATED_DEMO" | "ACTUAL_AWS"`.

## 10. Build Result
*   **Passed.** Both Backend (`tsc --project tsconfig.json`) and Frontend (`vite build`) compiled successfully with zero errors.

## 11. Lint Result
*   **Passed.** (95 warnings regarding console logging and some legacy explicit `any` types in test mocks, but 0 blocking errors).

## 12. Manual UI Verification
*   The Risk Trends section no longer relies on fake data and doesn't display "Invalid Date".
*   Attack Paths display entry points and targets seamlessly.

## 13. Risk Trend Verification
*   Risk trends correctly group by the exact timestamps recorded in `risk_history`. Because we now preserve genuine history, multiple distinct timeline points accurately map to multiple successful `analysis_run` phases.

## 14. Billing-Source Verification
*   `SIMULATED_DEMO` is properly mapped on the backend and displays explicitly as `SIMULATED DEMO BILLING` on the frontend, ensuring we never misrepresent synthetic numbers as real AWS pulls.

## 15. Remaining Limitations
*   Cost calculations for the demo remain entirely synthetic (static `DEMO_COSTS` object) since we don't fetch actual cost explorer metrics for the sandbox accounts.
*   Authentication is still utilizing the single generic `admin@aetherops.local` user. The final 10 demo users remain to be created.
