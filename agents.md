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
- Custom API routes (path → brief purpose):
- Mongo collections (names):
- pgvector tables (names):
- Where model calls are made:
- Build/dev scripts in `package.json`:

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

---

## 6) API / Service Conventions
- Add new routes under `/server/routes/…` with clear handlers and input validation.
- Type all request/response shapes; keep handlers thin and push logic to services.
- External calls (OpenRouter, RAG, search) live in `/server/services/…` behind interfaces.
- Use config labels for model names; do not couple business logic to provider IDs.

**Write here (Codex):** route files touched/added and their request/response contracts.

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
- Where model invocation occurs:
- Where RAG is invoked:
- Where summaries/memory are handled:
- Known gaps relative to `PLANS.md` epics:

---

## 11) References
- LibreChat docs and upstream repo (treat as ground truth for platform behavior).
- `PLANS.md` for roadmap/acceptance criteria.

---

## 12) Change Log (for this file)
- 2025‑10‑10: Initial codebase‑interaction‑only version; removed product/prompt details.
