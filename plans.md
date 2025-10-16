# PLANS.md — Living Development Reference (for Codex & maintainers)

> **Purpose:** This file is a **reference log** of development as it happens. It **does not prescribe how to implement**. Codex (and humans) should **record what was done, where, and why**, so future work has context.
>
> **Stack (reference only):** LibreChat · MongoDB · pgvector · Fast RAG API · OpenRouter (incl. DeepSeek). For interaction rules, navigation, and conventions, see **AGENTS.md**.

---

## 0) How to use this file
- Append entries as you work. Keep edits concise and dated.
- Link to files/PRs/commits. Avoid step‑by‑step instructions.
- If an epic changes direction, add a dated **Decision** entry — do not rewrite history.

---

## 1) Active Epics (catalog)
> Add/remove epics as needed. Keep each epic to a single section and update status.

### Epic E1 — Global & User Knowledge Bases (RAG)
- **Goal (1–2 lines):** Expand the RAG surfaces to support dual-scope knowledge bases (global + per-user) and ensure chat flows can retrieve from both.
- **Scope:** In: Fast RAG API schema updates, LibreChat server/client wiring, ingestion workflows, opt-in user KB storage. Out: authoring new constitution content, upstream RAG service deployment automation.
- **Status:** In progress (implementation — retrieval wiring active)
- **Key Paths (repo):**
  - Server routes: `api/server/routes/agents/index.js`, `api/server/routes/messages.js`, `api/server/routes/memories.js`
  - Services/clients: `packages/api/src/rag`, `packages/api/src/memory`, `api/server/services/Files/VectorDB`
  - Data (Mongo/pgvector): `packages/data-schemas/src/models/memories.ts`, new pgvector stores `kb_global`, `kb_user`
- **Assumptions/Constraints:** Constitution/global docs will be seeded manually once storage exists; Fast RAG API must expose fan-out queries; maintain backward compatibility for existing memory summaries.
- **Dependencies:** Coordination with Fast RAG API repo for table creation & API contract; user consent toggle from E3 to write summaries into user KB.
- **Open Questions:** How to represent provenance metadata from dual-scope fetches in chat UI; need to confirm pgvector index sizing for expected corpus.
- **Decisions (dated):**
  - 2025-10-10 — Global doc seeding to remain manual uploads by operators post-table creation.
- **Related PRs/Issues:** _TBD_
- **Commit Digest (summaries):**
  - 2025-10-10 — Added dual-scope knowledge base query helper and integrated it into prompt context creation; introduced env toggles for scope labels and top-k controls.
- **User Steps(things the user needs to do if any that codex does not have access to):** Upload constitution/global documents into `kb_global` via admin tooling once tables are provisioned; configure `RAG_KB_*` environment variables and provision pgvector stores (`kb_global`, `kb_user`) on Railway deployment.
- **Notes:** Extend `packages/api` retrieval helpers so Prompt Composer can draw from both scopes without additional orchestration in UI.

### Epic E2 — Web Search (MCP Off, Using Agents)
- **Goal:** Replace MCP-backed search with a native agent-driven search toggle routed through models capable of tool-calling web search.
- **Scope:** In: Disable MCP route, introduce feature flag/config for search toggle, integrate auto-router logging, add search-capable model config. Out: building a bespoke crawler or search index.
- **Status:** In progress (design)
- **Key Paths:** `api/server/routes/mcp.js`, `librechat.yaml` model presets, `packages/api/src/flow/routers`, client settings UI for toggles.
- **Assumptions/Constraints:** Search capability must be exposed via provider API function-calling; ensure fallbacks when provider quota exhausted.
- **Dependencies:** Auto-router instrumentation from E4; provider credentials for search-enabled model.
- **Open Questions:** Need final decision on preferred provider/model for native search and latency budget for query bursts.
- **Decisions:**
  - 2025-10-10 — MCP endpoints will be fully disabled; rely on agent auto-router once implemented.
- **Related PRs/Issues:** _TBD_
- **User Steps(things the user needs to do if any that codex does not have access to):** Provide API keys for chosen search-capable model.
- **Commit Digest:** _None yet_
- **Notes:** Introduce telemetry to show when search toggles dispatch function calls for observability.

### Epic E3 — Conversation Summarizer + Context Refresher
- **Goal:** Implement rolling conversation summaries with opt-in storage to user KBs while providing on-demand context refresh.
- **Scope:** In: Background summarization pipeline, settings toggle in account UI, memory write integration, refresher invocation in chat flow. Out: rewriting existing memory algorithms.
- **Status:** In progress (design & coordination)
- **Key Paths:** `api/server/routes/memories.js`, `packages/api/src/memory`, `client/src/features/settings/account`, `packages/api/src/agents/memory`.
- **Assumptions/Constraints:** Existing memory layer remains authoritative; summaries should minimize token usage and respect privacy opt-outs.
- **Dependencies:** E1 dual-scope KB availability for optional user KB writes; UI components from client design system for settings entry.
- **Open Questions:** Determine cadence for automatic summarization (per N messages vs. time-based) and retention window for stored summaries.
- **Decisions:**
  - 2025-10-10 — User KB writes are opt-in via account setting; default remains off.
- **Related PRs/Issues:** _TBD_
- **User Steps(things the user needs to do if any that codex does not have access to):** Users choose whether to enable summary storage within account settings once feature ships.
- **Commit Digest:** _None yet_
- **Notes:** Coordinate with Prompt Composer to ensure summaries are accessible when generating reframed prompts.

### Epic E4 — Multi‑Model Usage (Router + Thinking + Deep Research Toggle)
- **Goal:** Build an intent-sensitive auto-router that orchestrates multiple specialized models and honors user-driven Thinking/Deep Research toggles.
- **Scope:** In: Router gauge logic, model catalog definition (12–15 specialized presets), backend logging of routing choices, client toggles for mode selection. Out: training new models, auto-provisioning provider accounts.
- **Status:** In progress (design & instrumentation)
- **Key Paths:** `packages/api/src/flow/routers`, `api/server/routes/messages.js`, `packages/api/src/endpoints/chat`, `client/src/features/chat/controls`.
- **Assumptions/Constraints:** Must prevent mode downgrades while toggles are active; routing signals include keywords, conversation intent, and upcoming UI toggles.
- **Dependencies:** Telemetry/log storage (likely Mongo `toolcalls` or new collection); E2 search toggle; provider configuration updates in `librechat.yaml`.
- **Open Questions:** Need schema for routing log (fields, retention) and strategy for avoiding oscillation when gauge hovers near thresholds.
- **Decisions:**
  - 2025-10-10 — Router must expose detailed logs each time routing decision executes (model, signals, outcome).
- **Related PRs/Issues:** _TBD_
- **User Steps(things the user needs to do if any that codex does not have access to):** Supply credentials for all specialized provider endpoints.
- **Commit Digest:** _None yet_
- **Notes:** Evaluate reuse of existing notable-threshold mechanism for gauge implementation to minimize new infra.

### Epic E5 — Output Moderation / Jargon Lint
- **Goal:** Introduce a two-stage response pipeline where a moderation agent evaluates draft outputs and can approve, nudge, or block messages to maintain human-like yet guided tone.
- **Scope:** In: Draft response review agent, tolerance configuration, UI feedback for interventions. Out: multi-pass iterative generation loops beyond two-stage pipeline unless later justified.
- **Status:** In progress (design)
- **Key Paths:** `packages/api/src/agents`, `api/server/routes/messages.js`, `packages/api/src/flow/postprocessors`, moderation config in `config/`.
- **Assumptions/Constraints:** Target minimal latency overhead; moderation agent leverages existing Libre agents framework; guardrails favor gentle rewrites over hard failures unless content risks policy.
- **Dependencies:** Multi-model router (E4) to allocate lightweight classifier vs. primary model; logging/telemetry for review outcomes.
- **Open Questions:** Need concrete thresholds for tone exploration vs. intervention and UX messaging when moderation alters output.
- **Decisions:**
  - 2025-10-10 — Adopt two-stage pipeline (primary response then moderation agent) over iterative regeneration for initial implementation.
- **Related PRs/Issues:** _TBD_
- **User Steps(things the user needs to do if any that codex does not have access to):** Provide policy guidelines and classifier tuning inputs once framework ready.
- **Commit Digest:** _None yet_
- **Notes:** Explore reusing existing prompt reframing hooks so moderation adjustments remain aligned with companion persona.

### Epic E6 — Voice Mode (Prototype)
- **Goal:** Deliver a GPT-style voice mode overlay with animated orb feedback, real-time STT/TTS, and voice control UX integrated into the chat input.
- **Scope:** In: UI overlay with `/voice/animated-orb.tsx`, input bar icon integration, streaming STT/TTS wiring (e.g., Whisper vs. GPT audio), state management for speaking/listening, overlay controls. Out: building proprietary speech models.
- **Status:** In progress (design & research)
- **Key Paths:** `client/src/components/chat/Input`, `/voice/animated-orb.tsx`, `/voice/icon.png`, `/voice/reference.png`, server realtime endpoints (`packages/api/src/endpoints/realtime` if reused).
- **Assumptions/Constraints:** Prefer most responsive + cost-effective hosted STT/TTS (evaluation pending); overlay animation should react to live audio levels instead of hover events.
- **Dependencies:** Provider selection (e.g., ElevenLabs TTS, Whisper or GPT Audio STT); coordination with auto-router to lock reasoning model during voice sessions.
- **Open Questions:** Finalize STT/TTS provider choice and whether to leverage streaming WebRTC vs. SSE for audio transport.
- **Decisions:**
  - 2025-10-10 — Overlay will reuse animated orb visuals with behavior keyed to speech activity rather than hover state; include microphone toggle and exit controls mirroring GPT reference.
- **Related PRs/Issues:** _TBD_
- **User Steps(things the user needs to do if any that codex does not have access to):** Provision credentials for chosen STT/TTS services and supply branding guidance for overlay animation.
- **Commit Digest:** _None yet_
- **Notes:** Investigate LibreChat's existing conversation mode implementation to identify reusable audio pipeline components before introducing new services.

###

> Add more epics as needed. For postponed ideas, create **Backlog Epics** at the end of this file.

---

## 2) Global Decision Log
> Record directional choices here. Keep entries short and dated.

| Date (YYYY‑MM‑DD) | Decision | Rationale | Links |
|---|---|---|---|
| 2025-10-10 | Logged baseline repo orientation in `AGENTS.md` | Capture current structure before kicking off epics | this change |

---

## 3) Environment & Config Registry
> Track configuration changes that affect development or deployment. Do not store secrets.

- **Model presets:** `librechat.yaml` → labels/models updated (date, PR)
- **Env vars added/changed:** name, purpose, date, PR
- **Feature flags:** name, default, date, PR
- **Indexes/migrations:** collection/table, change, date, PR

---

## 4) Release Notes (running)
> Summarize meaningful increments. Keep entries terse and link to PRs.

### v0.1.0 — (date)
- Highlights:
- PRs:
- Breaking changes:
- Migrations/Config:

### v0.0.x — (date)
- 

---

## 5) Weekly Commit Digest (optional)
> Copy summaries from PRs or generate brief bullets. This is for quick onboarding/context reloads.

**Week YYYY‑WW**
- E1: 
- E2: 
- E3: 
- E4: 
- E5: 
- E6: 

---

## 6) Test Artifacts Index
> List where tests live and any golden conversations used for QA.

- **Unit tests:** path(s)
- **Integration tests:** path(s)
- **Golden conversations:** path(s)
- **Load/latency tests (if any):** path(s)

---

## 7) Backlog Epics (not active)
> Park ideas here without implementation guidance.

- Epic: 
  - Brief: 
  - Links/notes:

---

## 8) Links
- **AGENTS.md** — how to interact with this repo
- LibreChat docs · upstream repo
- Provider docs (OpenRouter, DeepSeek)

---

## 9) Change Log (for this file)
- 2025‑10‑10: Converted PLANS.md into a **non‑prescriptive, living reference** aligned with AGENTS.md; added catalog templates and logs; removed implementation guidance.

