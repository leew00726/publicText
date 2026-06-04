# DeepSeek Template Inference Upgrade Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade template training so DeepSeek performs richer paragraph role recognition while local code still extracts real DOCX styles and exports deterministic DOCX output.

**Architecture:** Keep `topic_inference.py` and `docx_export.py` as deterministic style extraction and export engines. Enhance `template_ai_inference.py` so DeepSeek can return semantic roles for title, body, headings, leading/trailing fixed blocks, recipients, attachments, signature, and references, then merge those roles into the existing rule JSON with AI provenance metadata.

**Tech Stack:** FastAPI, Python, DeepSeek OpenAI-compatible chat API, pytest

---

### Task 1: Add AI Role Metadata Tests

**Files:**
- Modify: `backend/tests/test_template_ai_inference.py`

**Step 1: Write failing tests**

Add tests proving DeepSeek role output can add semantic metadata:
- `recipientsIndexes` creates `contentRoles.recipients`.
- `attachmentIndexes` creates `contentRoles.attachments`.
- `signatureIndexes` creates `contentRoles.signature`.
- `referenceIndexes` creates `contentRoles.references`.
- existing style values still come from local parsed paragraph samples, not AI guesses.

**Step 2: Run test to verify it fails**

Run: `python -m pytest backend/tests/test_template_ai_inference.py -q`
Expected: fail because `contentRoles` is not populated yet.

### Task 2: Enhance DeepSeek Prompt and Merger

**Files:**
- Modify: `backend/app/services/template_ai_inference.py`

**Step 1: Implement minimal code**

Update prompt schema to ask for:
- title/body/headings/leading/trailing
- recipients/attachments/signature/references
- optional confidence and notes

Merge these indexes into `contentRoles` by copying local paragraph nodes and text.

**Step 2: Run targeted tests**

Run: `python -m pytest backend/tests/test_template_ai_inference.py -q`
Expected: pass.

### Task 3: Runtime Configuration

**Files:** no secret-bearing file changes

**Step 1: Restart local backend**

Set runtime environment only:
- `DEEPSEEK_API_KEY`
- `TEMPLATE_INFERENCE_ENGINE=hybrid`

**Step 2: Verify**

Run: `Invoke-RestMethod http://localhost:8000/api/health`
Expected: `{"status":"ok"}`.
