# Module Hologram Logo Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current CSS particle `H` hero on the workspace hub with a futuristic interactive holographic projection that uses GPU-driven particles and preserves the module entry cards below.

**Architecture:** Move the hero rendering into a dedicated client-only React component backed by `three` and a custom `ShaderMaterial`. Keep the page-level test focused on the hero shell and module cards, then implement the canvas scene with higher-density particles, a ghost layer, scanlines, row/column instability, and mouse repulsion managed in the animation loop.

**Tech Stack:** React, TypeScript, Three.js, Vitest, CSS

---

### Task 1: Lock the new hologram hero contract

**Files:**
- Modify: `frontend/src/pages/ModuleHubPage.test.tsx`
- Modify: `frontend/src/pages/ModuleHubPage.tsx`

**Step 1: Write the failing test**

Update the page render test so it expects:
- a hologram hero container
- a dedicated mount point for the WebGL scene
- a scanline overlay element
- the old duplicated workspace copy to remain absent
- module cards to remain visible

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/pages/ModuleHubPage.test.tsx`

Expected: FAIL because the page still renders the old CSS-only particle grid and does not include the hologram-specific structure.

### Task 2: Implement the GPU hologram logo

**Files:**
- Create: `frontend/src/components/HologramLogo.tsx`
- Modify: `frontend/src/pages/ModuleHubPage.tsx`
- Modify: `frontend/src/styles/pages.css`
- Modify: `frontend/package.json`

**Step 1: Add the dependency**

Install `three` into the frontend workspace so the hero can use `ShaderMaterial`, `Points`, and an orthographic camera.

**Step 2: Build the component**

Create a reusable `HologramLogo` component that:
- uses the same `H` grid silhouette
- generates at least 3x more particles than the current hero
- renders a main particle cloud plus a larger blurred ghost layer behind it
- uses a custom shader for gradient, flicker, and particle softness
- updates row/column instability and mouse-repulsion state in the animation loop

**Step 3: Wire the page**

Replace the old inline hero markup in `ModuleHubPage.tsx` with the new component and keep the module grid unchanged.

**Step 4: Run the page test to verify it passes**

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
