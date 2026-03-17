# Huaneng Tech Blue Particle Hero Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the `中国华能` hologram hero into a dense, sharp, blue/cyan particle system with bloom, dark background contrast, and interactive motion.

**Architecture:** Keep the hero as a dedicated client-only Three.js component, but replace the current soft particle shader and light-page chrome with a dark tech-scene. Use a high-density text-derived particle field, GPU-friendly sharp point rendering, additive blending, brownian drift, mouse repulsion with spring-back, and an EffectComposer bloom pass. Lock the required contract in the page SSR test first, then implement the renderer and CSS shell.

**Tech Stack:** React, TypeScript, Three.js, EffectComposer, Vitest, CSS

---

### Task 1: Lock the new particle-system contract

**Files:**
- Modify: `frontend/src/pages/ModuleHubPage.test.tsx`
- Modify: `frontend/src/components/HologramLogo.tsx`

**Step 1: Write the failing test**

Update the module hub render test so it expects:
- the canvas host reports the `中国华能` particle shape
- the palette is `tech-blue-cyan`
- the minimum particle budget is `5000`
- the background mode is `deep-navy`

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/pages/ModuleHubPage.test.tsx`

Expected: FAIL because the current component still reflects the old softer hologram contract.

### Task 2: Rebuild the hero renderer

**Files:**
- Modify: `frontend/src/components/HologramLogo.tsx`
- Modify: `frontend/src/styles/pages.css`

**Step 1: Increase particle density**

Generate a much denser `中国华能` point field from a text mask so the live particle count is at least 5,000.

**Step 2: Switch to a crisp particle look**

Use sharp point rendering and additive blending with the new blue/cyan palette. Remove red and other dark warm accents from the particle materials.

**Step 3: Add motion and post-processing**

Add:
- subtle brownian vibration
- mouse repulsion with spring-back
- bloom pass via `EffectComposer`
- deep navy background and cooler ambient shell styling

**Step 4: Run the module hub test to verify it passes**

Run: `npm run test -- src/pages/ModuleHubPage.test.tsx`

Expected: PASS

### Task 3: Broader verification

**Files:**
- Modify: `frontend/src/components/HologramLogo.tsx` only if verification exposes issues

**Step 1: Run targeted frontend tests**

Run: `npm run test -- src/pages/ModuleHubPage.test.tsx src/components/AppShell.test.tsx src/pages/TopicDetailPage.test.tsx`

Expected: PASS

**Step 2: Run frontend build**

Run: `npm run build`

Expected: exit code 0

**Step 3: Rebuild and verify runtime**

Run: `docker compose up -d --build frontend`

Then verify:
- `http://localhost:5174` returns `200`
- `http://localhost:8000/api/health` returns `{"status":"ok"}`
