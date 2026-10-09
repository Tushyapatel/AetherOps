# AtherOps V1

**Cloud Security and Operations Analysis Platform**

AtherOps is a comprehensive, production-ready cloud security and operations analysis platform. It provides automated AWS resource discovery, multi-vector security risk assessment, graph-based attack path analysis, AWS Cost Explorer integration, cross-cloud comparison modeling, platform administration, and Gemini AI-powered operational insights.

---

## Table of Contents

- [Overview & Capabilities](#overview--capabilities)
- [Architecture & Tech Stack](#architecture--tech-stack)
- [Repository Organization](#repository-organization)
- [Prerequisites](#prerequisites)
- [Environment Configuration](#environment-configuration)
- [Installation & Running Locally](#installation--running-locally)
- [API Architecture & Endpoints](#api-architecture--endpoints)
- [Testing & Validation](#testing--validation)
- [Code Quality & Linting](#code-quality--linting)
- [Database & Migrations](#database--migrations)
- [Cloud & AI Integrations](#cloud--ai-integrations)
- [Documentation & Reports](#documentation--reports)

---

## Overview & Capabilities

1. **Authentication & Multi-Tenant Isolation:** Secure cookie-based JWT sessions, bcrypt password hashing, tenant isolation by `project_id`, customer self-registration, and dedicated platform administration.
2. **Seamless Onboarding:** 8-stage interactive guided setup with real AWS AssumeRole, automated External ID generation, policy generator, and live connection verification.
3. **AWS Discovery Engine:** Read-only ingestion of AWS resources (EC2, S3, RDS, IAM, Lambda) via AWS SDK v3.
4. **Security Evaluation Engine:** Rule-based scanner evaluating critical security configurations, bucket exposure, permissive security groups, and excessive IAM privileges.
5. **Attack Path Analysis:** Directed graph analysis identifying composite lateral movement and privilege escalation paths from exposed perimeter assets to sensitive crown jewels.
6. **Risk Scoring & Trends:** Dynamic multi-factor risk score calculation with historical trend tracking.
7. **Cost Intelligence & Billing:** Actual AWS monthly billing ingested via AWS Cost Explorer SDK; multi-cloud pricing comparison (AWS, GCP, Azure) utilizing modeled catalog estimators.
8. **Resilient Gemini AI Engine:** Native integration with Google Gemini (`@google/genai`) featuring 4-slot automated API key failover, backoff, and strictly validated Zod output schemas.
9. **Platform Administration:** Administrative metrics, customer account management, status toggling (ACTIVE / BLOCKED), customer deletion with cascade cleanup, and tamper-resistant audit logging.

---

## Architecture & Tech Stack

### Frontend
- **Framework:** React 19 + TypeScript
- **Build Tool:** Vite 8
- **Styling:** Tailwind CSS + Lucide Icons
- **Routing:** React Router v7
- **Testing:** Vitest + React Testing Library + JSDOM
- **Linter:** Oxlint

### Backend
- **Framework:** Express.js v5 on Node.js (>= 20)
- **Language:** TypeScript 5.8 (Strict Mode)
- **Database Client:** PostgreSQL via `pg` (node-postgres) with connection pooling
- **Validation:** Zod schemas
- **Security:** Helmet, CORS, Express Rate Limit, Cookie Parser
- **Cloud SDK:** AWS SDK v3 (STS, EC2, S3, RDS, IAM, Lambda, Cost Explorer, Pricing)
- **AI Integration:** Google Gemini via `@google/genai`
- **Testing:** Jest + ts-jest + Supertest (100% Mocked Provider/DB Suites)
- **Linter & Formatter:** ESLint + Prettier

---

## Repository Organization

```
AtherOps/
├── .env                              # Protected local environment variables (gitignored)
├── .env.example                      # Template with placeholder configuration
├── .eslintrc.json                    # Backend ESLint configuration
├── .gitignore                        # Project-wide ignore rules
├── .prettierrc                       # Code formatting rules
├── README.md                         # Main repository guide
├── eslint.config.mjs                 # Flat ESLint configuration
├── jest.config.json                  # Backend Jest test runner configuration
├── package.json                      # Backend & root workspace dependencies
├── package-lock.json                 # Backend lockfile
├── tsconfig.json                     # Backend TypeScript compiler configuration
├── tsconfig.eslint.json              # TypeScript ESLint project configuration
│
├── dist/                             # Compiled backend output (gitignored)
│
├── docs/                             # Project documentation & academic materials
│   ├── btech/                        # Official BTech mentor & module reports
│   │   ├── AetherOps_Cloud_Module_Document.pdf
│   │   └── AetherOps_Mentor_Progress_Report.pdf
│   └── reports/                      # Stage, hardening, and verification reports
│       ├── final_phase_17_report.md
│       ├── gemini_compatibility_audit_report.md
│       ├── phase_22_stage_4_e2e_validation_report.md
│       ├── phase_23_stage_5_security_audit_report.md
│       ├── phase_24_stage_6_system_analysis_report.md
│       └── [Additional Phase Reports]
│
├── migrations/                       # Production PostgreSQL database migrations
│   ├── 001_add_analysis_run_id_to_attack_paths.sql
│   └── 002_update_costs_schema.sql
│
├── scripts/                          # Utility & maintenance automation
│   ├── database/                     # Migration & database maintenance tools
│   ├── diagnostics/                  # Verification, IDOR, & API test scripts
│   ├── demo_finalize.ts              # Demo environment builder
│   ├── demo_rebuild.ts               # Database state resets
│   └── reset_admin_password.ts       # Platform admin recovery
│
├── src/                              # Backend application source code
│   ├── api/v1/                       # Versioned REST controllers, routes, repositories
│   │   ├── admin/                    # Platform administration & user controls
│   │   ├── auth/                     # JWT authentication & session endpoints
│   │   ├── cloud-accounts/           # AWS account linkage & AssumeRole setup
│   │   ├── dashboard/                # Aggregated metrics & risk scoring
│   │   ├── findings/                 # Security findings & rule evaluations
│   │   ├── projects/                 # Project management & customer isolation
│   │   ├── reports/                  # Assessment PDF generation
│   │   └── resources/                # Discovered infrastructure inventory
│   ├── config/                       # Strongly-typed environment configuration
│   ├── database/                     # Pool connection lifecycle & health monitoring
│   ├── errors/                       # Standardized AppError hierarchy
│   ├── infrastructure/aws/           # AWS SDK STS, collectors, & Cost Explorer clients
│   ├── logger/                       # Winston structured logger with secret scrubbing
│   ├── middleware/                   # Auth, rate limiting, logging, & error handling
│   ├── modules/                      # Business logic domain services
│   │   ├── ai/                       # Gemini provider, multi-key failover, chat
│   │   ├── attack-path/              # Attack graph evaluation & lateral traversal
│   │   ├── billing/                  # Cost Explorer ingestion & cost calculations
│   │   ├── pricing/                  # Cross-cloud pricing comparison models
│   │   └── security/                 # Rule engine & compliance evaluators
│   ├── app.ts                        # Express application factory (createApp)
│   └── server.ts                     # HTTP listener & graceful shutdown
│
├── tests/                            # Comprehensive backend test suite (26 suites)
│   ├── api/                          # End-to-end endpoint tests
│   ├── infrastructure/               # AWS client mock verification
│   ├── modules/                      # Attack path, security, pricing unit tests
│   └── setup.ts                      # Jest global setup & mock initializers
│
└── frontend/                         # React 19 + Vite frontend application
    ├── public/                       # Static web assets & official A-symbol favicon
    │   ├── favicon.png
    │   ├── favicon.svg
    │   └── images/
    ├── src/
    │   ├── assets/                   # Master AtherOps brand assets
    │   ├── components/               # UI components, layout shells, modals
    │   ├── contexts/                 # React Context (AuthContext)
    │   ├── hooks/                    # Custom hooks (e.g., usePageTitle)
    │   ├── lib/                      # API client with credentials support
    │   ├── pages/                    # Application views (Dashboard, Findings, Costs, etc.)
    │   ├── test/                     # Vitest test suites (App, Onboarding, Projects)
    │   ├── App.tsx                   # Route definitions & application shell
    │   ├── main.tsx                  # Application bootstrap
    │   └── index.css                 # Design tokens & styling
    ├── package.json                  # Frontend dependencies & scripts
    ├── vite.config.ts                # Vite proxy & Vitest configuration
    └── tsconfig.json                 # Frontend TypeScript configuration
```

---

## Prerequisites

- **Node.js** >= 20.0.0
- **npm** >= 10.0.0
- **PostgreSQL** >= 14
- Access to an AWS account (for live AssumeRole onboarding) or demo credentials

---

## Environment Configuration

1. Copy `.env.example` to `.env` in the root directory:
   ```bash
   cp .env.example .env
   ```
2. Populate the required environment variables:
   - `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
   - `JWT_SECRET`
   - `GEMINI_API_KEY` (and optionally `GEMINI_API_KEY_2`, `GEMINI_API_KEY_3`, `GEMINI_API_KEY_4`)
   - `ATHEROPS_SERVICE_PRINCIPAL_ARN` (the AWS IAM Role/User ARN AtherOps assumes roles with)

*Note: Real secrets should never be committed to source control. The `.env` file is strictly gitignored.*

---

## Installation & Running Locally

### 1. Install Dependencies
```bash
# Backend dependencies (root)
npm install

# Frontend dependencies
cd frontend && npm install && cd ..
```

### 2. Run Locally in Development Mode
To run both backend and frontend concurrently:
```bash
npm run dev:all
```

Or run them individually:
```bash
# Terminal 1: Backend (starts on http://localhost:3001)
npm run dev

# Terminal 2: Frontend (starts on http://localhost:5173, proxies /api to :3001)
npm run dev --prefix frontend
```

---

## Testing & Validation

### Backend Tests (Jest)
All backend tests execute completely using isolated mocks. No live AWS or database connections are needed:
```bash
# Run all 26 backend test suites (289 tests)
npm test

# Generate coverage
npm run test:coverage
```

### Frontend Tests (Vitest)
```bash
# Run all frontend suites (41 tests)
npm test --prefix frontend
```

---

## Code Quality & Linting

### Backend
```bash
# Type check without emitting
npm run typecheck

# Lint TypeScript code
npm run lint

# Auto-fix lint issues
npm run lint:fix

# Check formatting
npm run format:check

# Compile production bundle
npm run build
```

### Frontend
```bash
# Lint frontend
npm run lint --prefix frontend

# Build frontend production bundle
npm run build --prefix frontend
```

---

## Database & Migrations

AtherOps utilizes PostgreSQL. Migrations are managed under `migrations/`:
- `001_add_analysis_run_id_to_attack_paths.sql`: Attaches analysis run tracking to attack path entries.
- `002_update_costs_schema.sql`: Normalizes period dates and cost granularity for AWS Cost Explorer alignment.

To inspect or verify counts and schemas:
```bash
npx ts-node -r dotenv/config scripts/database/verify_counts.ts
```

---

## Cloud & AI Integrations

### AWS Cost Explorer vs. Cross-Cloud Pricing
- **Real AWS Billing:** Ingests unblended, blended, and usage cost data directly from AWS Cost Explorer via AssumeRole. Requires the `ce:GetCostAndUsage` permission on the customer's IAM role.
- **Cross-Cloud Pricing Engine:** Calculates estimated cost projections for AWS, Azure, and GCP workloads based on standardized compute and storage catalog models.

### Gemini AI Resiliency
- AtherOps uses Google Gemini via the official `@google/genai` SDK.
- Configured with a 4-key slot rotation architecture: if a key encounters rate limiting (HTTP 429) or quota depletion, it seamlessly rotates to subsequent keys before safely falling back.
- All AI responses are validated against strict Zod schemas ensuring clean, reliable JSON outputs for the frontend.

---

## Documentation & Reports

- **BTech Mentor Progress & Cloud Module PDFs:** Located in [`docs/btech/`](docs/btech/).
- **Audit & Hardening Phase Reports:** Located in [`docs/reports/`](docs/reports/).
