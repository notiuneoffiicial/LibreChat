# AGENTS.md — Codebase Interaction Guide (for OpenAI Codex & similar agents)

> **Purpose:** This document strictly guides how Codex interacts with the **current codebase**. Keep product philosophy out of here; include only what helps read, modify, test, and submit changes safely.

> **Current stack (reference only):** **LibreChat** (UI/orchestrator) · **MongoDB** (primary app store) · **pgvector** (RAG) · **Fast RAG API** (service) · **OpenRouter endpoint** (multiple models incl. **DeepSeek**). See LibreChat docs and the upstream repo for platform details, deployed all on the railway platform

---

## 0) Scope
- Tell Codex **where to look**, **how to make changes**, and **what gates to pass**.
- Leave explicit placeholders for Codex to record its **understanding of this repo** after scanning (no guessing).
- Do **not** spec unbuilt agents or product behavior here; link such work to `PLANS.md`.
- This is a reference docmument, if codex finds reason to bypass anything said here it may, any such interactions where bypassing occurs must be recorded in sufficent detail inside the changelog (see below)

---

## 1) Repository Navigation (Template — fill with actual paths)
> Codex: scan the repo and replace placeholders with real paths.

```
/ (root)
  README.md                     # project intro (confirm)
  librechat.yaml                # model presets/endpoints (confirm)
  .env.example                  # env template (confirm)

  /server                       # server code (confirm)
    /routes                     # API routes (e.g., rag, router, moderate)
    /services                   # external clients (OpenRouter, RAG)
    /models                     # Mongo schemas
    /utils                      # helpers

  /client                       # UI (confirm)
    /components                 # chat components
    /hooks                      # state & effects
    /styles                     # Tailwind/CSS

  /kb                           # KB seeding/ingestion scripts
  /scripts                      # maintenance & migrations
  /tests                        # unit/integration tests
```

**Write here (Codex):**
- Root entrypoints I found:
  - `api/server/index.js` → Express bootstrap, DB connect, route wiring.
  - `client/src/main.jsx` → React/Vite mount point for the web UI.
  - `packages/api/src/index.ts` → Exposes shared server utilities (checks, services) for workspace.
  - `packages/client/src/index.ts` → Reusable client package entry (exports shared UI pieces).
- Custom API routes (path → brief purpose):
  - `api/server/routes/convos.js` → Conversation CRUD, sharing, pagination.
  - `api/server/routes/messages.js` → Message lifecycle (create, feedback, attachments).
  - `api/server/routes/assistants/index.js` & `assistants/v2.js` → Assistant runtime & OpenAI Assistants bridge.
  - `api/server/routes/files/index.js` → Upload/storage dispatch across local, Firebase, vector DB.
  - `api/server/routes/agents/index.js` → Agent listing, execution, metadata.
  - `api/server/routes/presets.js` → Model preset management for users/teams.
  - `api/server/routes/search.js` → Meilisearch-backed query endpoints.
  - `api/server/routes/keys.js` → API key management and token usage stats.
  - `api/server/routes/models.js` → Surface configured model lists per provider.
  - `api/server/routes/oauth.js` → OAuth login flows & callbacks.
- Mongo collections (names):
  - Core: `convos`, `messages`, `agents`, `assistants`, `actions`, `toolcalls`, `files`, `prompts`, `promptgroups`,
    `presets`, `projects`, `transactions`, `balances`.
  - Access control: `users`, `sessions`, `aclentries`, `groups`, `accessroles`, `roles`.
  - Aux: `banners`, `categories`, `keys`, `memories`, `sharedlinks`, `tokenconfigs`.
- pgvector tables (names):
  - Managed by external RAG API; API contract references `/embed` & `/documents` endpoints with logical stores `kb_global`
    and `kb_user` (confirm via RAG service when available).
- Where model calls are made:
  - `api/server/services/ModelService.js` for provider model catalog fetch & caching.
  - `api/server/services/AssistantService.js` & `AssistantService` controllers for chat completions.
  - `api/server/routes/messages.js` delegates to `@librechat/agents` (LangChain pipeline) via `packages/api` flow.
  - `packages/api/src/endpoints/chat` & `packages/api/src/flow` orchestrate multi-model routing (OpenAI, Anthropic, Ollama).
- Build/dev scripts in `package.json`:
  - Dev servers: `npm run backend:dev`, `npm run frontend:dev`.
  - Builds: `npm run build:api`, `npm run build:client`, `npm run build:packages`.
  - Tests: `npm run test:api`, `npm run test:client`, `npm run e2e` variants.
  - Tooling: `npm run lint`, `npm run lint:fix`, `npm run format`.

---

## 2) Reading Order (Before Editing)
1. Root: `README`, `librechat.yaml`, `.env.example`.
2. Server: routes → services → models → utils.
3. Client: components → hooks → state management.
4. Data: Mongo indexes, pgvector integration.
5. Tests: existing test helpers & golden conversations (if any).
6. `PLANS.md`: check active epics/acceptance criteria.

---

## 3) Safe Editing Rules
- Prefer **small, reversible PRs**. One concern per change.
- **TypeScript** for all new code (server & client). If editing JS, keep style consistent; avoid large refactors.
- **No hard‑coded secrets** or model IDs; read from env and config.
- Backward‑compatible changes unless coordinated (feature flags recommended).
- Log errors with context; never swallow exceptions.
- Validate inputs in server routes; sanitize external params.

---

## 4) Coding Conventions
- **Language:** TypeScript (strict). Add minimal types for existing JS surfaces when practical.
- **Style:** Match existing ESLint/Prettier config; run format before commit.
- **Naming:** PascalCase for React components; camelCase elsewhere; meaningful names.
- **Functions:** small & pure where possible; JSDoc for non‑trivial public functions.
- **Errors:** return typed results or throw; include actionable messages.

---

## 5) Data Layer Conventions
- **MongoDB:** keep schema definitions and indexes alongside models; avoid unindexed queries on hot paths.
- **pgvector:** two scopes expected — `kb_global` and `kb_user` (confirm names). Embed with same model family used by retriever.
- **Env:** document any new variables in `.env.example` and README; never log secrets.

**Write here (Codex):** actual collection names, pgvector table names, and where embeddings are created.
- Collections: see Section 1 list; schemas defined under `packages/data-schemas/src/models/*`.
- pgvector: RAG API abstracts storage; expected logical scopes `kb_global`, `kb_user`; concrete table discovery pending
  (requires inspecting external `librechat-rag-api`).
- Embeddings created via `api/server/services/Files/VectorDB/crud.js` (uploads) and `packages/api/src/memory` pipelines.

---

## 6) API / Service Conventions
- Add new routes under `/server/routes/…` with clear handlers and input validation.
- Type all request/response shapes; keep handlers thin and push logic to services.
- External calls (OpenRouter, RAG, search) live in `/server/services/…` behind interfaces.
- Use config labels for model names; do not couple business logic to provider IDs.

**Write here (Codex):** route files touched/added and their request/response contracts.
- Baseline reference before changes:
  - `routes/convos.js` → REST (GET/POST/PATCH/DELETE) returning conversation documents with pagination metadata.
  - `routes/messages.js` → POST for completions/streaming; expects message payload, responds with SSE or JSON status.
  - `routes/files/index.js` → multipart upload, responds with stored file metadata & embedding flags.
  - Update this log when modifying/adding routes.

---

## 7) Testing & Programmatic Checks
Provide or update the following scripts in `package.json` (fill actual names):

```bash
# Lint
npm run lint
# Type check
npm run type-check
# Unit/integration tests
npm test
# Build
npm run build
```

- Add/update tests for routes/services you change.
- Maintain **golden conversation** tests if present (ensure no regressions).

**Write here (Codex):** actual commands and test locations.
- Lint: `npm run lint` (root) → ESLint across workspaces.
- Type check: `cd client && npm run typecheck`; shared packages rely on `npm run build:packages` (tsc via rollup/tsup).
- Unit/integration tests: `npm run test:api`, `npm run test:client`, Playwright suites under `e2e/` (`npm run e2e`).
- Build: `npm run build:packages` for shared libs, `npm run build:client`, `npm run build:api` for deployment.
- Test locations: API Jest specs in `api/server/**/__tests__` & `api/models/*.spec.js`; client tests in `client/src/**/__tests__`;
  Playwright configs in `e2e/`.

---

## 8) Pull Request Guidelines
1. **Description:** what changed & why; link to `PLANS.md` epic/task.
2. **Scope:** single concern, minimal diff.
3. **Checks:** lint, type‑check, tests, build — all green.
4. **Screenshots/Clips:** include for UI changes.
5. **Migrations/Config:** call out env or schema changes and provide steps/rollback.

**Commit style:** Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:`). Include short WHY when non‑obvious.

---

## 9) Security & Privacy Baselines
- Do not store sensitive personal data without explicit consent and documented TTL/delete path.
- Guard external APIs with timeouts/retries; handle provider errors gracefully.
- Log sufficiently for debugging without leaking PII.

---

## 10) Open Slots for Codex Understanding (fill after scan)
- Codebase map (finalized tree with notes):
  - Root workspace with npm workspaces (`api`, `client`, `packages/*`). Express backend under `api/server`, React frontend under
    `client/src`, shared TypeScript libs in `packages/`.
- Where model invocation occurs:
  - Service layer (`api/server/services/AssistantService.js`, `ModelService.js`) delegates to `@librechat/agents` & provider
    SDKs.
- Where RAG is invoked:
  - File embedding/upload path via `api/server/services/Files/VectorDB`, requests proxied to external `RAG_API_URL` service.
- Where summaries/memory are handled:
  - Memory stores and summarization utilities inside `packages/api/src/memory` and `api/server/routes/memories.js`.
- Known gaps relative to `PLANS.md` epics:
  - Epics E1–E6 currently placeholders; need status, goals, and paths filled before implementation work begins.

---

## 11) References
- LibreChat docs and upstream repo (treat as ground truth for platform behavior).
- `PLANS.md` for roadmap/acceptance criteria.

---

## 12) Change Log (for this file)
- 2025‑10‑10: Initial codebase‑interaction‑only version; removed product/prompt details.
