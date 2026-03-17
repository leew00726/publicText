# Summary Text Input And Agent Guidance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let the document summary module accept either uploaded files or pasted text, and add an agent-guidance input area so users can specify the summary format they want DeepSeek to follow.

**Architecture:** Extend the existing summary endpoint instead of adding a parallel API so the UI can keep one generation flow. Keep the DeepSeek summarization request model simple by passing a normalized source text plus one aggregated instruction string built from the guidance UI. Preserve the current summary result and export workflow.

**Tech Stack:** FastAPI, Python service helpers, React, TypeScript, existing `PageHeader`/workspace card styles, Vitest, Python unittest.

---

### Task 1: Summary API Input Contract

**Files:**
- Modify: `backend/app/routers/ai.py`
- Modify: `backend/app/services/document_summary.py`
- Test: `backend/tests/test_ai_agent.py`

**Step 1: Write the failing test**

Add tests that prove:
- The summary endpoint accepts `sourceText` without a file.
- `extraInstruction` is forwarded to `summarize_document_with_deepseek`.
- Empty requests still fail with a clear 400.

**Step 2: Run test to verify it fails**

Run: `python -m unittest backend.tests.test_ai_agent.AiDocumentSummaryEndpointTests`

Expected: FAIL because the endpoint currently requires `file`.

**Step 3: Write minimal implementation**

- Make `file` optional.
- Add `sourceText` as an alternative `Form` field.
- Normalize and truncate pasted text through a helper in `document_summary.py`.
- Reuse the existing response shape so the frontend does not need a second result type.

**Step 4: Run test to verify it passes**

Run: `python -m unittest backend.tests.test_ai_agent.AiDocumentSummaryEndpointTests`

Expected: PASS.

### Task 2: Summary Page UI

**Files:**
- Modify: `frontend/src/pages/DocumentSummaryPage.tsx`
- Modify: `frontend/src/styles/pages.css`
- Test: `frontend/src/pages/DocumentSummaryPage.test.tsx`

**Step 1: Write the failing test**

Add a UI test that expects:
- A pasted-text textarea.
- An agent-guidance area.
- Copy that explains users can upload files or paste text.

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/pages/DocumentSummaryPage.test.tsx`

Expected: FAIL because the page currently only renders file upload controls.

**Step 3: Write minimal implementation**

- Add a text source textarea alongside the upload area.
- Add a chat-style guidance panel with instruction history, input, add/clear actions, and clear affordances.
- Allow summarize when either a file or pasted text exists.
- Send aggregated instructions as `extraInstruction`.

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/pages/DocumentSummaryPage.test.tsx`

Expected: PASS.

### Task 3: Verification

**Files:**
- Test: `backend/tests/test_ai_agent.py`
- Test: `frontend/src/pages/DocumentSummaryPage.test.tsx`
- Test: `frontend/tests/documentSummary.test.ts`

**Step 1: Run targeted backend tests**

Run: `python -m unittest backend.tests.test_ai_agent`

**Step 2: Run targeted frontend tests**

Run: `npm run test -- src/pages/DocumentSummaryPage.test.tsx tests/documentSummary.test.ts`

**Step 3: Run frontend build**

Run: `npm run build`

Expected: all targeted checks pass.
