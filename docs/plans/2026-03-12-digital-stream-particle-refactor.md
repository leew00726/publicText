# Digital Stream Particle Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the `中国华能` particle hero into a sharper, darker, high-end digital stream effect with per-particle glow and an animated energy wave.

**Architecture:** Keep the hero as a client-only Three.js scene but replace the current blob-heavy shell and softer glow treatment with a structured node grid, darker navy stage, per-particle brightness variation, and a scanline wave encoded in the shader/update loop. Lock the new renderer contract in the page SSR test before touching the WebGL implementation.

**Tech Stack:** React, TypeScript, Three.js, EffectComposer, Vitest, CSS

---

### Task 1: Lock the new digital-stream contract

**Files:**
- Modify: `frontend/src/pages/ModuleHubPage.test.tsx`
- Modify: `frontend/src/components/HologramLogo.tsx`

**Step 1: Write the failing test**

Update the page render test so it expects:
- the canvas host reports `digital-stream`
- glow mode is `per-particle`
- wave mode is `energy-scanline`
- node layout is `structured-grid`

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/pages/ModuleHubPage.test.tsx`

Expected: FAIL because the current markup does not expose the new digital-stream contract yet.

### Task 2: Rebuild the renderer and shell

**Files:**
- Modify: `frontend/src/components/HologramLogo.tsx`
- Modify: `frontend/src/styles/pages.css`

**Step 1: Remove the background blob**

Delete the oversized ambient circle behind the text and keep the stage clean and dark.

**Step 2: Make the particles feel like light-nodes**

Use a more structured text-derived grid, varied per-particle sizes, and shader-driven twinkle so the glyph reads as organized digital nodes instead of fuzzy noise.

**Step 3: Add the energy wave**

Create a slow vertical wave that brightens particles toward white/cyan and enlarges them slightly as it passes.

**Step 4: Run the page test to verify it passes**

Run: `npm run test -- src/pages/ModuleHubPage.test.tsx`

Expected: PASS

### Task 3: Broader verification

**Files:**
- Modify: `frontend/src/components/HologramLogo.tsx` only if verification exposes defects

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
