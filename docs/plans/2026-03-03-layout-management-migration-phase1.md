# Layout/Management Migration Phase 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Establish clear functional boundaries for `公文排版` and `公文管理`, then land phase-1 routing migration with backward compatibility.

**Architecture:** Keep existing business pages and APIs unchanged in phase 1, but add module shell routes (`/layout`, `/management`) and redirect module cards to new entry points. Old routes remain valid as compatibility aliases. Domain migration map is documented for phased API/frontend decoupling.

**Tech Stack:** React 18, TypeScript, React Router 6, Vitest, existing FastAPI backend

---

## Functional Scope Baseline

### 公文排版（Layout）
- Document processing workflow: import, summarize, edit, validate, export.
- Includes:
- `公文总结` page and AI summary flow.
- `正文编辑` (DOC editor), one-click layout, format checks, AI rewrite.
- `导入/导出 DOCX` operations.
- Excludes:
- company/topic master-data governance.
- template lifecycle governance decisions (effective/archive policy).

### 公文管理（Management）
- Governance workflow: entities, templates, and operational controls.
- Includes:
- company and topic management.
- template training/version lifecycle.
- doc repository governance and audit views.
- permission strategy and role policy evolution.
- Excludes:
- low-level editor formatting operations.
- summary generation logic.

## Route Migration Map (Phase 1)

| Domain | New Route (Phase 1) | Existing Page/API |
|---|---|---|
| Summary | `/summary` | `DocumentSummaryPage` |
| Layout home | `/layout` | new shell page |
| Management home | `/management` | new shell page |
| Compatibility | `/companies`, `/topics/*`, `/docs/*` | keep unchanged |

## API Domain Ownership (for next phases)

- Layout-owned APIs:
- `/api/ai/summarize-document`
- `/api/ai/export-summary-docx`
- `/api/docs/importDocx`
- `/api/docs/{doc_id}/check`
- `/api/docs/{doc_id}/exportDocx`
- `/api/ai/rewrite`
- Management-owned APIs:
- `/api/units*`
- `/api/topics*`
- topic template lifecycle endpoints
- audit event endpoints

---

### Task 1: Document migration baseline

**Files:**
- Create: `docs/plans/2026-03-03-layout-management-migration-phase1.md`

**Step 1: Finalize boundary + route map**
- Record domain boundaries, route map, and ownership split.

**Step 2: Verify docs presence**
- Run: `Get-ChildItem docs/plans`
- Expected: plan file exists.

### Task 2: TDD for module entry paths

**Files:**
- Modify: `frontend/tests/employeeAuth.test.ts`
- Modify: `frontend/src/utils/employeeAuth.ts`

**Step 1: Write failing test**
- Assert module entry paths:
- summary -> `/summary`
- layout -> `/layout`
- management -> `/management`

**Step 2: Run test to verify it fails**
- Run: `npm test`
- Expected: failure on old entry paths.

**Step 3: Implement minimal change**
- Update module definitions to new entry paths.

**Step 4: Run tests**
- Run: `npm test`
- Expected: pass.

### Task 3: Add phase-1 module shell pages

**Files:**
- Create: `frontend/src/pages/LayoutModulePage.tsx`
- Create: `frontend/src/pages/ManagementModulePage.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/styles.css`

**Step 1: Implement shell pages**
- Layout page: quick links into summary/editor workflow.
- Management page: quick links into company/topic/template governance workflow.

**Step 2: Wire routes**
- Add `/layout` and `/management` (auth-guarded).
- Keep existing routes untouched for compatibility.

**Step 3: Add scoped styles**
- Visual separation between module landing and business operation pages.

### Task 4: Verification

**Files:**
- N/A

**Step 1: Run frontend tests**
- Run: `npm test`
- Expected: all pass.

**Step 2: Build frontend**
- Run: `npm run build`
- Expected: success.

**Step 3: Rebuild containers**
- Run: `docker compose up -d --build frontend`
- Validate:
- `/workspace` shows new module entries.
- `/layout` and `/management` are reachable.
