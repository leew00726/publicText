# China Huaneng Hologram Text Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current hologram `H` hero on the workspace hub with the text `中国华能`, while keeping the same futuristic particle projection behavior and the module cards below.

**Architecture:** Keep the existing WebGL-driven hologram container, but change the particle source from a fixed `H` grid to a text-derived particle field generated from a canvas text mask. Update the SSR test first so the accessible label and fallback text reflect `中国华能`, then implement the particle source and adjust styles only where needed.

**Tech Stack:** React, TypeScript, Three.js, Vitest, CSS

---

### Task 1: Lock the new text hero contract

**Files:**
- Modify: `frontend/src/pages/ModuleHubPage.test.tsx`
- Modify: `frontend/src/components/HologramLogo.tsx`

**Step 1: Write the failing test**

Update the module hub render test to expect:
- the hero aria label references `中国华能`
- the fallback text is `中国华能`
- the old `全息 H 投影主视觉` label is gone

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/pages/ModuleHubPage.test.tsx`

Expected: FAIL because the current hero still renders the `H` label and fallback mark.

### Task 2: Replace the particle source with text geometry

**Files:**
- Modify: `frontend/src/components/HologramLogo.tsx`
- Modify: `frontend/src/styles/pages.css`

**Step 1: Generate particle seeds from text**

Use an offscreen 2D canvas to draw `中国华能`, sample opaque pixels on a grid, and convert them into particle seeds with row and column metadata for the existing shader instability behavior.

**Step 2: Keep the hologram behavior**

Retain:
- gradient data flow from blue base to red top
- ghost layer
- scanlines
- row/column flicker
- mouse repulsion and spring-back

**Step 3: Update fallback and accessibility copy**

Switch the fallback mark and `aria-label` to `中国华能`.

**Step 4: Run the module hub test to verify it passes**

Run: `npm run test -- src/pages/ModuleHubPage.test.tsx`

Expected: PASS

### Task 3: Broader verification

**Files:**
- Modify: `frontend/src/components/HologramLogo.tsx` only if verification exposes defects

**Step 1: Run targeted frontend tests**

Run: `npm run test -- src/pages/ModuleHubPage.test.tsx src/components/AppShell.test.tsx src/pages/TopicDetailPage.test.tsx`

Expected: PASS

**Step 2: Run the frontend build**

Run: `npm run build`

Expected: exit code 0

**Step 3: Rebuild and verify runtime**

Run: `docker compose up -d --build frontend`

Then verify:
- `http://localhost:5174` returns `200`
- `http://localhost:8000/api/health` returns `{"status":"ok"}`
