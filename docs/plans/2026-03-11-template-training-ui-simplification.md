# Template Training UI Simplification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Simplify the template training page so text-only first-draft generation is the primary path, sample upload is optional, and redundant controls are removed without losing core template training capabilities.

**Architecture:** Keep the existing backend endpoints and the new text-only initial-draft flow, but restructure the frontend into a clear primary action area plus a secondary sample-analysis area. Move confirmation closer to draft review, remove redundant form fields, and hide empty or non-essential sections by default.

**Tech Stack:** React, TypeScript, Vite, FastAPI, unittest, Vitest

---

### Task 1: Lock the simplified training-page contract with tests

**Files:**
- Modify: `frontend/src/pages/TopicDetailPage.test.tsx`

**Step 1: Write the failing test**

Add assertions for:
- primary panel title emphasizing direct text generation
- absence of the extra body-font input
- absence of empty-state conversation reset button
- sample analysis shown as optional/secondary
- hidden empty audit section when no events exist

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/pages/TopicDetailPage.test.tsx`
Expected: FAIL because current page still renders the redundant controls and old copy.

**Step 3: Write minimal implementation**

Update `TopicDetailPage.tsx` and page styles to match the simplified structure.

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/pages/TopicDetailPage.test.tsx`
Expected: PASS

### Task 2: Simplify training-page interactions

**Files:**
- Modify: `frontend/src/pages/TopicDetailPage.tsx`
- Modify: `frontend/src/styles/pages.css`

**Step 1: Remove redundant controls**

- Delete the standalone body-font input
- Hide conversation controls until history exists
- Replace the reset button with a compact restart action shown only when there is history

**Step 2: Clarify button logic**

- No draft: primary button becomes `生成首版模板草稿`
- Existing draft + DeepSeek: primary button becomes `基于当前草稿继续修订`
- Existing draft + non-DeepSeek: primary button becomes `生成新的草稿版本`
- Move template confirmation action into the latest-draft review panel

**Step 3: Restructure the layout**

- Primary panel: text-driven draft generation
- Secondary panel: optional sample analysis
- Summary panel: latest draft + confidence + confirmation
- Keep template versions; hide deletion audit when empty

**Step 4: Run focused frontend verification**

Run: `npm run test -- src/pages/TopicDetailPage.test.tsx src/utils/topicNarrative.test.ts src/utils/apiError.test.ts src/api/client.test.ts src/utils/docUtils.test.ts src/components/AppShell.test.tsx`
Expected: PASS

### Task 3: Align copy on template-entry surfaces

**Files:**
- Modify: `frontend/src/pages/TopicComposePage.tsx`

**Step 1: Update empty-template guidance**

- Mention that templates can now be created by direct text instructions or sample upload

**Step 2: Verify no regressions**

Run the frontend test/build commands below
Expected: PASS

### Task 4: Full verification

**Files:**
- No code changes expected

**Step 1: Backend regression**

Run: `python -m unittest tests.test_topics_api tests.test_ai_agent`
Expected: PASS

**Step 2: Frontend build**

Run: `npm run build`
Expected: PASS

**Step 3: Runtime verification**

Run:
- `docker compose up -d --build backend frontend`
- Verify `http://localhost:5174`
- Verify `http://localhost:8000/api/health`

Expected:
- frontend responds `200`
- backend health responds `ok`
