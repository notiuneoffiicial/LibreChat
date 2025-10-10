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
- **Goal (1–2 lines):** 
- **Scope:** In / Out 
- **Status:** Not started · In progress · Blocked · Complete
- **Key Paths (repo):**
  - Server routes:
  - Services/clients:
  - Data (Mongo/pgvector):
- **Assumptions/Constraints:**
- **Dependencies:**
- **Open Questions:**
- **Decisions (dated):**
- **Related PRs/Issues:**
- **Commit Digest (summaries):**
- **User Steps(things the user needs to do if any that codex does not have access to):**
- **Notes:**

### Epic E2 — Web Search (MCP Off, Using Agents)
- **Goal:** 
- **Scope:** 
- **Status:** 
- **Key Paths:**
- **Assumptions/Constraints:**
- **Dependencies:**
- **Open Questions:**
- **Decisions:**
- **Related PRs/Issues:**
- **User Steps(things the user needs to do if any that codex does not have access to):**
- **Commit Digest:**
- **Notes:**

### Epic E3 — Conversation Summarizer + Context Refresher
- **Goal:** 
- **Scope:** 
- **Status:** 
- **Key Paths:**
- **Assumptions/Constraints:**
- **Dependencies:**
- **Open Questions:**
- **Decisions:**
- **Related PRs/Issues:**
- **User Steps(things the user needs to do if any that codex does not have access to):**
- **Commit Digest:**
- **Notes:**

### Epic E4 — Multi‑Model Usage (Router + Thinking + Deep Research Toggle)
- **Goal:** 
- **Scope:** 
- **Status:** 
- **Key Paths:**
- **Assumptions/Constraints:**
- **Dependencies:**
- **Open Questions:**
- **Decisions:**
- **Related PRs/Issues:**
- **User Steps(things the user needs to do if any that codex does not have access to):**
- **Commit Digest:**
- **Notes:**

### Epic E5 — Output Moderation / Jargon Lint
- **Goal:** 
- **Scope:** 
- **Status:** 
- **Key Paths:**
- **Assumptions/Constraints:**
- **Dependencies:**
- **Open Questions:**
- **Decisions:**
- **Related PRs/Issues:**
- **User Steps(things the user needs to do if any that codex does not have access to):**
- **Commit Digest:**
- **Notes:**

### Epic E6 — Voice Mode (Prototype)
- **Goal:** 
- **Scope:** 
- **Status:** 
- **Key Paths:**
- **Assumptions/Constraints:**
- **Dependencies:**
- **Open Questions:**
- **Decisions:**
- **Related PRs/Issues:**
- **User Steps(things the user needs to do if any that codex does not have access to):**
- **Commit Digest:**
- **Notes:**

###

> Add more epics as needed. For postponed ideas, create **Backlog Epics** at the end of this file.

---

## 2) Global Decision Log
> Record directional choices here. Keep entries short and dated.

| Date (YYYY‑MM‑DD) | Decision | Rationale | Links |
|---|---|---|---|
|  |  |  |  |

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

