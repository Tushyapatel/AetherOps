# Phase 11: AI Intelligence & Grounded Analysis — Implementation Report

The Phase 11 module has been successfully implemented and hardened. All 226 tests across 19 suites are passing, the TypeScript build succeeds without errors, and no new linting errors were introduced.

## 1. Architecture & Design

The module is built around a secure boundary that strictly isolates the AI from backend mutations and credential exposure. It follows the deterministic context builder pattern.

*   **`ai.types.ts` & `ai.schemas.ts`**: Defines the `AIProvider` interface, strict Zod validation schemas, and the exact Gemini JSON schema representation (`GEMINI_RESPONSE_SCHEMA`) to ensure type-safe structured output.
*   **`ai.prompts.ts`**: Centralises all prompts. Critically, it completely separates the `SYSTEM_INSTRUCTION` (which governs AI behaviour and constraints) from the user prompts (which only format the context data).
*   **`GeminiProvider` (`providers/gemini/gemini.provider.ts`)**: Implements the `AIProvider` using `@google/genai` (v2.x). It enforces structured JSON output, includes exponential backoff retries for transient errors, and maps Gemini-specific errors (timeouts, safety blocks, rate limits) to generic AtherOps `AIError`s.

## 2. Grounded Context Building

The `ai.context.ts` file acts as the secure data aggregation layer.

*   **No Invention**: Context builders execute strict SQL queries against the AtherOps database (findings, resources, attack paths, cloud accounts, billing). If data isn't in the DB, it isn't provided to the AI.
*   **Credential Stripping**: The context builder explicitly excludes sensitive fields from being serialized (e.g., `role_arn`, `external_id`, AWS keys).
*   **Sanitisation**: Resource `raw_data` is sanitised against an allowlist of safe attributes (e.g., region, vpc_id, instance_class).
*   **Data Labelling**: When context is serialized into text for the prompt, cloud metadata fields (resource identifiers, names, descriptions, notes) are explicitly labelled as `(UNTRUSTED DATA)` to mitigate prompt injection risks.
*   **Limitations Awareness**: The builder respects configurable limits (e.g., max 20 findings) and appends `contextLimitations` to the context so the AI is aware if data was truncated.

## 3. Operations Implemented

Four distinct analysis operations are exposed via `ai.service.ts` and `ai.controller.ts`:

1.  **Security Analysis** (`/api/v1/projects/:projectId/ai/security-analysis`)
2.  **Project Overview** (`/api/v1/projects/:projectId/ai/overview`)
3.  **Cost Analysis** (`/api/v1/projects/:projectId/ai/cost-analysis`)
4.  **Attack-Path Analysis** (`/api/v1/projects/:projectId/ai/attack-path-analysis`)

The AI Service orchestrates the flow:
1. Generate Context -> 2. Serialize -> 3. Build Prompt -> 4. Call Provider -> 5. Validate Source Refs -> 6. Emit Audit Event.

## 4. Security & Hardening

Comprehensive security measures were implemented and tested:

*   **Prompt Injection Defense**: Cloud metadata (which could be attacker-controlled) is clearly separated from instructions. Tests confirm that injecting instructions into resource names or finding notes does not alter the system behavior.
*   **Source Reference Grounding**: The AI Service runs a `validateSourceRefs` check on the AI's output. Any `sourceRef` (e.g., `FINDING:123`) returned by the AI *must* correspond to an ID that was actually provided in the context. If the AI hallucinates an ID, it is stripped out.
*   **Read-Only Guarantee**: Tests verify that AI requests never mutate the database (`findings` or `resources` tables).
*   **Secret Protection**: Tests explicitly assert that API keys (`GEMINI_API_KEY`), IAM roles (`role_arn`), and the raw system prompt text are never leaked in API responses, even when the provider fails.
*   **Semantic Differentiation**: Context specifically distinguishes between "ACTUAL AWS BILLING (Phase 9)" and "ESTIMATED CATALOG PRICING (Phase 10)" to ensure the AI doesn't conflate actual spend with hypothetical pricing.

## 5. Verification

A dedicated test suite (`tests/api/aiAnalysis.test.ts`) with 52 tests was written to verify this module.

```text
Test Suites: 19 passed, 19 total
Tests:       226 passed, 226 total (52 for AI Module)
Build:       Success (0 TypeScript errors)
Lint:        0 Errors
```

The AI Intelligence layer is now complete, secure, and ready for review.
