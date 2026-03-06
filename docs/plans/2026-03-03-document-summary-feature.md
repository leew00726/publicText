# Document Summary Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a document-summary page that supports drag-and-drop upload, DeepSeek-based summary generation, and DOCX export of summary results.

**Architecture:** Add two backend AI endpoints: one for document summarization (`multipart` upload + DeepSeek call), one for exporting a summary as DOCX. Keep it stateless (no DB write) for fast iteration. In frontend, add a dedicated summary page wired from the module hub with drag-and-drop upload, summary preview/edit, and export action.

**Tech Stack:** FastAPI, python-docx, pypdf, React 18 + TypeScript, React Router, Axios, Vitest, unittest

---

### Task 1: Backend summary service (TDD)

**Files:**
- Create: `backend/tests/test_document_summary.py`
- Create: `backend/app/services/document_summary.py`

**Step 1: Write failing tests**
- `extract_text_from_uploaded_file` supports `.txt`, rejects unsupported extension, trims/normalizes content.
- `build_summary_docx` exports a valid DOCX containing title + summary body.

**Step 2: Run tests to verify failure**
- Run: `python -m unittest tests.test_document_summary`
- Expected: FAIL because service module does not exist.

**Step 3: Implement minimal service**
- Add text extraction helpers for `.docx/.pdf/.txt`.
- Add summary DOCX builder.

**Step 4: Run tests to verify pass**
- Run: `python -m unittest tests.test_document_summary`
- Expected: PASS.

### Task 2: Backend AI endpoints (TDD)

**Files:**
- Modify: `backend/tests/test_ai_agent.py`
- Modify: `backend/app/services/ai_agent.py`
- Modify: `backend/app/routers/ai.py`

**Step 1: Write failing tests**
- Add endpoint tests for:
- `/api/ai/summarize-document` returns summary payload (mock DeepSeek + extraction).
- `/api/ai/export-summary-docx` returns streaming docx bytes.

**Step 2: Run tests to verify failure**
- Run: `python -m unittest tests.test_ai_agent`
- Expected: FAIL due missing endpoint/functions.

**Step 3: Implement minimal backend logic**
- Add `summarize_document_with_deepseek` in `ai_agent.py`.
- Add request/response handling in `ai.py`.
- Convert errors to `503/502/400` consistently.

**Step 4: Run tests to verify pass**
- Run: `python -m unittest tests.test_ai_agent tests.test_document_summary`
- Expected: PASS.

### Task 3: Frontend summary page + module navigation (TDD)

**Files:**
- Create: `frontend/tests/documentSummary.test.ts`
- Create: `frontend/src/utils/documentSummary.ts`
- Create: `frontend/src/pages/DocumentSummaryPage.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/utils/employeeAuth.ts`
- Modify: `frontend/src/styles.css`

**Step 1: Write failing tests**
- Add utility tests for supported filename check and export filename suggestion.

**Step 2: Run tests to verify failure**
- Run: `npm test`
- Expected: FAIL because utility module does not exist.

**Step 3: Implement frontend**
- Utility functions for file validation and filename composition.
- Summary page with drag/drop + file picker + summarize + editable result + DOCX export.
- Add route `/summary` and module-card entry mapping to this route.
- Add scoped styles and responsive behavior.

**Step 4: Run tests to verify pass**
- Run: `npm test`
- Expected: PASS.

### Task 4: End-to-end verification

**Files:**
- N/A

**Step 1: Build frontend**
- Run: `npm run build`
- Expected: PASS.

**Step 2: Smoke test via Docker**
- Run: `docker compose up -d --build backend frontend`
- Validate:
- `http://localhost:5174/summary` can upload doc and generate summary.
- export button downloads `.docx`.
