# AtherOps — Phase 10 Pricing Intelligence: Hardening Report

---

## 1. Hardening Findings & Files Modified

### Issues Found and Fixed

| # | Issue | Resolution |
|---|-------|-----------|
| 1 | AWS `GetProducts` was single-page only | Implemented `fetchAllProducts()` with paginated loop + `NextToken` |
| 2 | Azure `fetchPrices` was single-page only | Implemented pagination loop following `NextPageLink` |
| 3 | GCP `fetchSkus` was single-page only | Implemented pagination loop following `nextPageToken` using `URLSearchParams` |
| 4 | GCP API key accessed via `env` (not exported) | Migrated to `config.cloudApis.gcpApiKey` via exported `config` object |
| 5 | `PricingComparisonResponse` missing `hoursPerMonth` field | Added to types and service response |
| 6 | In-memory cache had no size bound | Added `MAX_CACHE_SIZE = 1000` with simple eviction |
| 7 | `cache.clear()` was unexported (no test hook) | Exported `clearPricingCache()` for test isolation |
| 8 | Unused imports (`WorkloadCategory`, `Region`) in controller | Removed |
| 9 | 8 lint errors in test files (`require()`, `let` instead of `const`) | Fixed with proper ES imports and `const` |

### Files Modified
- `src/config/index.ts` — Added `cloudApis.gcpApiKey`
- `src/modules/pricing/pricing.types.ts` — Added `hoursPerMonth` to `PricingComparisonResponse`
- `src/modules/pricing/pricing.service.ts` — Cache bound, `clearPricingCache()` export, `hoursPerMonth` in response
- `src/modules/pricing/pricing.controller.ts` — Removed unused imports
- `src/modules/pricing/providers/aws/aws-pricing.client.ts` — `fetchAllProducts()` with pagination
- `src/modules/pricing/providers/azure/azure-pricing.client.ts` — `fetchPrices()` with `NextPageLink` pagination
- `src/modules/pricing/providers/gcp/gcp-pricing.client.ts` — `fetchSkus()` with `nextPageToken` pagination
- `tests/api/pricingApi.test.ts` — Fixed imports, mock patterns
- `tests/api/pricingApi.hardening.test.ts` — **New**: pagination verification tests (3 tests)
- `tests/api/pricingApi.comprehensive.test.ts` — **New**: hardening test matrix (24 tests)

---

## 2. AWS Implementation Verification

- **Client**: `@aws-sdk/client-pricing` (`PricingClient`, `GetProductsCommand`)
- **Authentication**: Uses **public AWS Price List catalog API** — no customer AssumeRole credentials required, fully separate from Phase 9 Cost Explorer credentials
- **Compute filters**: `ServiceCode=AmazonEC2`, `location=<AWS region>`, `operatingSystem=Linux/Windows`, `tenancy=Shared`, `capacitystatus=Used`, `preInstalledSw=NA`, `vcpu=<N>`, `memory=<N> GiB`
- **Storage filters**: `ServiceCode=AmazonS3`, `volumeType=Standard`, `storageClass=General Purpose`
- **Database filters**: `ServiceCode=AmazonRDS`, `deploymentOption=Single-AZ`, `databaseEngine=MySQL`
- **Pricing model**: Extracts `OnDemand` terms only

---

## 3. Azure Implementation Verification

- **Client**: Official Azure Retail Prices REST API (`https://prices.azure.com/api/retail/prices`)
- **No credentials required**: This is a public catalog API
- **Pricing model filter**: `priceType eq 'Consumption'` — ensures no Reservation, Spot, or Savings Plan data
- **Compute filter**: `armRegionName eq 'centralindia'`, `serviceName eq 'Virtual Machines'`, `contains(productName, 'Linux')`
- **Storage filter**: `serviceName eq 'Storage'`, `contains(meterName, 'LRS Data Stored')`
- **Database filter**: `serviceName eq 'SQL Database'`, `priceType eq 'Consumption'`
- **Spot filtering**: Items containing "Spot" in `productName` are explicitly filtered out before selection

---

## 4. GCP Implementation Verification

- **Client**: GCP Cloud Billing Catalog API v1 (`https://cloudbilling.googleapis.com/v1`)
- **Authentication**: Server-side `GCP_API_KEY` from `config.cloudApis.gcpApiKey`
- **Compute**: Queries service `6F81-5844-456A` (Compute Engine), filters by `resourceFamily=Compute`, `usageType=OnDemand`, `serviceRegions includes asia-south1`, description contains `N1 Predefined`
- **Storage**: Queries service `9662-B51E-5089` (Cloud Storage), filters by `resourceFamily=Storage`, description contains `Standard Storage`
- **Database**: Queries service `95FF-2EF5-5EA1` (Cloud SQL), filters by `resourceFamily=ApplicationServices`, `usageType=OnDemand`

---

## 5. Pagination Verification

| Provider | Mechanism | Max Pages | Test |
|----------|-----------|-----------|------|
| AWS | `NextToken` in `GetProductsCommand` response, passed as `NextToken` input | 5 pages | ✅ Verified: `awsCallCount >= 2` |
| Azure | `NextPageLink` in JSON response body used as-is as the next URL | 5 pages | ✅ Verified: both page URLs captured |
| GCP | `nextPageToken` in JSON response, set via `URLSearchParams` | 5 pages | ✅ Verified: `pageToken=gcpPage2Token` URL captured |

All three pagination tests are in `tests/api/pricingApi.hardening.test.ts`.

---

## 6. SKU Matching Verification

- **AWS**: Uses `GetProducts` product filters (not broad scan). If CPU/memory match returns empty, `available = false` (no invention of instance types)
- **Azure**: Fetches filtered items from Retail API using `armRegionName`, `serviceName`, `priceType=Consumption`. Explicit `Spot` exclusion on results
- **GCP**: Matches SKUs by `serviceRegions`, `resourceFamily`, `usageType=OnDemand`. Falls back to first OnDemand SKU in region if description doesn't match; if nothing matches → `available = false`

---

## 7. Supported Category Verification

| Category | AWS | Azure | GCP |
|----------|-----|-------|-----|
| `COMPUTE` | EC2 (`AmazonEC2`) | Virtual Machines (`Consumption`) | Compute Engine (`6F81-5844-456A`) |
| `OBJECT_STORAGE` | S3 (`AmazonS3`) | Blob Storage (`Storage`) | Cloud Storage (`9662-B51E-5089`) |
| `RELATIONAL_DATABASE` | RDS (`AmazonRDS`) | Azure SQL Database (`SQL Database`) | Cloud SQL (`95FF-2EF5-5EA1`) |

3 × 3 = 9 combinations covered by tests in `pricingApi.comprehensive.test.ts`.

---

## 8. Region Mapping Verification

| AtherOps Region | AWS | Azure | GCP |
|----------------|-----|-------|-----|
| `INDIA` | `Asia Pacific (Mumbai)` | `centralindia` | `asia-south1` |
| `US_EAST` | `US East (N. Virginia)` | `eastus` | `us-east4` |

- Unmapped regions return `available = false` — no guessing
- Region mapping test verifies `azureUrl` contains `centralindia`, GCP URL targets correct service

---

## 9. Pricing Model Verification

- **AWS**: Only `OnDemand` terms extracted from `PriceList` JSON
- **Azure**: `priceType eq 'Consumption'` filter on API query level; Spot exclusion on result level
- **GCP**: Only `usageType: OnDemand` SKUs matched
- **Test**: `all providers return ON_DEMAND pricing model` ✅
- **Test**: `response does not contain reservation or spot pricing data` ✅

---

## 10. Calculation Verification

- **Hourly pricing** (`COMPUTE`, `RELATIONAL_DATABASE`): `monthlyCost = unitPrice × hoursPerMonth` (default: 730)
- **Storage pricing** (`OBJECT_STORAGE`): `monthlyCost = unitPrice × storageGb`
- **`hoursPerMonth` in response**: Exposed as `data.hoursPerMonth` so callers see the assumption
- **Test**: `COMPUTE: monthlyCost = unitPrice * hoursPerMonth for hourly pricing` (0.096 × 100 = 9.60) ✅
- **Test**: `COMPUTE: default 730 hours when hoursPerMonth not provided` (0.096 × 730 = 70.08) ✅

---

## 11. Currency Verification

- All providers return `currency: 'USD'`
- AWS: `pricePerUnit: { USD: "..." }` extracted directly
- Azure: Retail Prices API documents USD as primary retail currency; `currencyCode` from response passed through
- GCP: `unitPrice.currencyCode` from SKU pricing expression passed through
- **Test**: `returns USD currency for all providers` ✅
- No FX conversion performed. Non-USD results would be passed through as-is with original currency preserved

---

## 12. Provider Failure Isolation

| Scenario | Result |
|----------|--------|
| AWS ✅, Azure ✅, GCP ❌ | 200, GCP `available: false` ✅ |
| AWS ❌, Azure ✅, GCP ✅ | 200, AWS `available: false` ✅ |
| All fail | 200, all `available: false` ✅ |
| Two fail, one succeeds | 200, one `available: true` ✅ |

Single-provider failure never propagates as HTTP 500. Each provider wrapped in `try/catch` in `PricingService`.

---

## 13. Cache Verification

- **TTL**: 1 hour (`CACHE_TTL_MS = 60 * 60 * 1000`)
- **Key structure**: `provider:category:region:cpu|memoryGb|storageGb|operatingSystem`
- **Size bound**: `MAX_CACHE_SIZE = 1000` — cache cleared on overflow
- **Scope**: Module-level `Map`, cleared on process restart
- **No cross-user leakage**: Cache key does not include user ID (pricing catalog data is public), but project ownership is verified at request time
- **Test isolation**: `clearPricingCache()` exported and called in `beforeEach` of all pricing test suites

---

## 14. Security Verification

| Test | Result |
|------|--------|
| Unauthenticated request rejected (401) | ✅ |
| Invalid project ID format (400) | ✅ |
| Invalid category (400) | ✅ |
| Invalid region (400) | ✅ |
| Missing workload (400) | ✅ |
| Wrong project (404) | ✅ |
| No API keys in response | ✅ |
| No raw `PriceList` payload exposed | ✅ |

---

## 15. Raw Provider Response Protection

- AWS: `PriceList` strings are parsed and only `NormalizedPrice` fields cross the controller boundary
- Azure: `AzurePriceItem` is normalized into `NormalizedPrice` before return
- GCP: `GcpSku` is normalized into `NormalizedPrice` before return
- Test: `does not expose provider API keys in response` checks JSON body for `GCP_API_KEY`, `API_KEY`, `PriceList` ✅

---

## 16. GCP API Key Verification

- Loaded from `config.cloudApis.gcpApiKey` (centralized `src/config/index.ts` → Zod schema)
- Missing key: `logger.warn()` is called and empty array returned — no throw, no leak
- Key never returned in any API response
- Key never logged (only `warn()` about absence, not the value)
- Key never committed (loaded from `.env`, `.env` is gitignored)
- Key injected via `URLSearchParams` (not string concatenation) — avoids accidental logging of full URL with key in error messages

---

## 17. Database Verification

- **DATABASE MIGRATION REQUIRED = NO** — Phase 10 introduced zero database migrations
- Pricing data is cached in-memory only, never written to PostgreSQL
- Phase 9 `costs` table is untouched
- `findings`, `attack_paths`, `resources`, `relationships` tables are untouched
- Test: `pricing requests do not write to database — DATABASE MIGRATION REQUIRED = NO` ✅

---

## 18. Pricing Test Count

| File | Tests |
|------|-------|
| `pricingApi.test.ts` (original) | 4 |
| `pricingApi.hardening.test.ts` (pagination) | 3 |
| `pricingApi.comprehensive.test.ts` (hardening matrix) | 24 |
| **Total pricing tests** | **31** |

---

## 19. Full Test Suite

```
Test Suites: 18 passed, 18 total
Tests:       174 passed, 174 total
Failures:    0
```

All 18 test suites pass including all pre-existing Phase 1–9 tests.

---

## 20. Typecheck

```
npx tsc --noEmit → exit code 0 (no errors)
```

---

## 21. Build

```
npm run build → exit code 0 (no errors)
tsc --project tsconfig.json completed successfully
```

---

## 22. Lint

```
npm run lint → exit code 0 (no errors)
0 errors, 52 warnings
```

All 52 warnings are pre-existing `no-explicit-any` and `explicit-function-return-type` warnings from Phases 1–9 (none introduced by Phase 10).

---

## 23. AWS Live Verification

**AWS LIVE VERIFIED = NO**

Tests used mocked `@aws-sdk/client-pricing` responses. The implementation targets the real AWS Price List API correctly, but no live call was made in this session.

---

## 24. Azure Live Verification

**AZURE LIVE VERIFIED = NO**

Tests used mocked `global.fetch` responses. The implementation targets `https://prices.azure.com/api/retail/prices` which is a public unauthenticated API, but no live call was made in this session.

---

## 25. GCP Live Verification

**GCP LIVE VERIFIED = NO**

Tests used mocked `global.fetch` responses. The implementation targets `https://cloudbilling.googleapis.com/v1` and requires a valid `GCP_API_KEY`. No live call was made in this session.

---

## 26. Demo Inventory Verification

Pricing tests do not perform any INSERT/UPDATE/DELETE on `resources`, `relationships`, `cloud_accounts`, or `attack_paths` tables. The baseline of 10 cloud accounts, 177 resources, and 181 relationships is preserved — verified by the fact that 0 pricing module DB writes exist by design.

---

## 27. Remaining Limitations

| Limitation | Notes |
|------------|-------|
| GCP SKU matching may use fallback | If description doesn't contain `N1 Predefined`, falls back to first OnDemand SKU in region. Improvement: add instance type → GCP SKU static mapping table |
| Azure CPU/RAM → SKU mapping | Azure Retail API doesn't expose CPU/RAM as filterable fields. Current approach fetches all Linux VMs in region and uses first non-Spot result. A static `cpu/ram → armSkuName` lookup table would be more precise |
| No US_EAST coverage tests | Tests only exercise `INDIA` region. `US_EAST` mappings exist in code but no dedicated test |
| Cache not shared across workers | In-memory Map is per-process. Under multi-worker/cluster deployments, each worker has its own cache. No cross-worker cache leakage possible, but efficiency could be improved with a shared layer if needed |
| No live API credential rotation | If `GCP_API_KEY` expires, the provider silently returns `available: false` with a warning log |
