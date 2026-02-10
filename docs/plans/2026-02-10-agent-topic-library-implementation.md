# Agent Topic Library Zero-Retention Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver a company-based, user-defined topic library where users upload confidential DOCX samples, the system infers formatting rules, supports agent-guided revision, and confirms effective templates without retaining source files.

**Architecture:** Extend FastAPI + SQLAlchemy with topic/draft/template/audit models and a new topics router. Implement in-memory DOCX feature extraction + rule inference service (no object storage writes). Add frontend pages for company selection, topic list, and topic detail (upload/analyze/revise/confirm). Keep existing doc editor routes available.

**Tech Stack:** FastAPI, SQLAlchemy, python-docx, React, TypeScript, Vite

---

### Task 1: Add backend models and schemas for topic workflow

**Files:**
- Modify: `backend/app/models.py`
- Modify: `backend/app/schemas.py`
- Test: `backend/tests/test_topic_models.py`

**Step 1: Write failing tests**

Create model/schema tests for:
- Topic create + unique `(company_id, code)` behavior
- Draft/template/audit model fields existence
- Topic status defaults to active

**Step 2: Run tests to verify failure**

Run: `.\backend\.venv\Scripts\python.exe -m unittest backend.tests.test_topic_models -v`
Expected: FAIL due to missing models/schemas

**Step 3: Implement minimal backend model/schema changes**

Add:
- `Topic`, `TopicTemplateDraft`, `TopicTemplate`, `DeletionAuditEvent` models
- Required Pydantic schemas for API IO

**Step 4: Run tests to verify pass**

Run: `.\backend\.venv\Scripts\python.exe -m unittest backend.tests.test_topic_models -v`
Expected: PASS

### Task 2: Build zero-retention style extraction and rule inference service

**Files:**
- Create: `backend/app/services/topic_inference.py`
- Test: `backend/tests/test_topic_inference.py`

**Step 1: Write failing tests**

Cover:
- Parse DOCX bytes from memory only
- Infer body + heading style rules and confidence
- Reject empty upload list

**Step 2: Run tests to verify failure**

Run: `.\backend\.venv\Scripts\python.exe -m unittest backend.tests.test_topic_inference -v`
Expected: FAIL due to missing service

**Step 3: Implement minimal service**

Add in-memory helper functions:
- `extract_docx_features(data: bytes)`
- `infer_topic_rules(features_list: list[dict])`

**Step 4: Run tests to verify pass**

Run: `.\backend\.venv\Scripts\python.exe -m unittest backend.tests.test_topic_inference -v`
Expected: PASS

### Task 3: Add topics API endpoints (CRUD + analyze + revise + confirm)

**Files:**
- Create: `backend/app/routers/topics.py`
- Modify: `backend/app/main.py`
- Modify: `backend/app/routers/__init__.py`
- Test: `backend/tests/test_topics_api.py`

**Step 1: Write failing API tests**

Cover:
- `GET /api/companies` lists units
- `POST /api/topics` creates active topic
- `GET /api/topics?companyId=` returns topic list
- `POST /api/topics/{id}/analyze` creates draft + audit without file persistence
- `POST /api/topics/{id}/agent/revise` updates draft rules
- `POST /api/topics/{id}/confirm-template` creates effective template

**Step 2: Run tests to verify failure**

Run: `.\backend\.venv\Scripts\python.exe -m unittest backend.tests.test_topics_api -v`
Expected: FAIL due to missing endpoints

**Step 3: Implement minimal router + wiring**

Implement endpoints and zero-retention logic:
- No writes to storage service for training uploads
- Audit metadata only (count/bytes/status/time)

**Step 4: Run tests to verify pass**

Run: `.\backend\.venv\Scripts\python.exe -m unittest backend.tests.test_topics_api -v`
Expected: PASS

### Task 4: Integrate frontend for company/topic flow

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/api/types.ts`
- Create: `frontend/src/pages/CompanySelectPage.tsx`
- Create: `frontend/src/pages/TopicListPage.tsx`
- Create: `frontend/src/pages/TopicDetailPage.tsx`

**Step 1: Write minimal frontend behavior checks**

Use existing TypeScript compile/build as verification for route/type integration.

**Step 2: Implement pages and API calls**

Add UX flow:
- choose company -> topic list (empty state) -> create topic -> upload/analyze -> revise -> confirm

**Step 3: Run frontend build**

Run: `npm run build` (in `frontend`)
Expected: PASS

### Task 5: End-to-end verification

**Files:**
- Modify: `README.md` (append concise usage section)

**Step 1: Run backend tests**

Run: `.\backend\.venv\Scripts\python.exe -m unittest discover -s backend/tests -v`
Expected: all pass

**Step 2: Run backend compile check**

Run: `.\backend\.venv\Scripts\python.exe -m compileall backend/app`
Expected: PASS

**Step 3: Run frontend build check**

Run: `npm run build` (in `frontend`)
Expected: PASS

**Step 4: Smoke run API**

Run backend and request `/api/health`, `/api/companies`, topic endpoints
Expected: 200 responses

