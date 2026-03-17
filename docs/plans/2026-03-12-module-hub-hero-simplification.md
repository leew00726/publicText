# Module Hub Hero Simplification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove the redundant hero and summary cards from the workspace module hub and replace them with a single blue pixel-particle `H` visual while keeping module entry cards intact.

**Architecture:** Keep the change isolated to the module hub page and shared page styles. Add a focused rendering test for the page so the removed copy and the new visual marker are both locked down. Implement the new hero as lightweight DOM plus CSS animation instead of an image asset so it stays responsive and easy to maintain.

**Tech Stack:** React, TypeScript, Vitest, CSS

---

### Task 1: Lock the new module hub behavior with a rendering test

**Files:**
- Create: `frontend/src/pages/ModuleHubPage.test.tsx`
- Modify: `frontend/src/pages/ModuleHubPage.tsx`

**Step 1: Write the failing test**

Create a server-render test that:
- mocks the employee session and module list
- renders `ModuleHubPage`
- asserts the old duplicate copy is gone
- asserts the new `H` visual marker exists
- asserts module cards still render

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/pages/ModuleHubPage.test.tsx`

Expected: FAIL because the page still renders the old `PageHeader` and summary cards and has no `H` visual marker.

### Task 2: Replace the old cards with a single hero visual

**Files:**
- Modify: `frontend/src/pages/ModuleHubPage.tsx`
- Modify: `frontend/src/styles/pages.css`

**Step 1: Write minimal implementation**

- Remove the duplicate `PageHeader`
- Remove the `workspace-summary-grid` section
- Add a single hero section with:
  - a hidden or explicit accessible label for the visual
  - a generated pixel grid that forms the `H`
  - small floating particles around it

**Step 2: Add minimal styling**

- Add layout and card styles for the new hero
- Create the pixel grid and particle motion with CSS
- Respect reduced-motion preferences
- Keep the hero responsive so the `H` remains centered on mobile and desktop

**Step 3: Run test to verify it passes**

Run: `npm run test -- src/pages/ModuleHubPage.test.tsx`

Expected: PASS

### Task 3: Run broader verification

**Files:**
- Modify: `frontend/src/pages/ModuleHubPage.test.tsx` if any assertions need cleanup

**Step 1: Run targeted frontend suite**

Run: `npm run test -- src/pages/ModuleHubPage.test.tsx src/components/AppShell.test.tsx src/pages/TopicDetailPage.test.tsx`

Expected: PASS

**Step 2: Run frontend build**

Run: `npm run build`

Expected: exit code 0

**Step 3: Rebuild and verify runtime**

Run: `docker compose up -d --build frontend`

Then verify:
- `http://localhost:5174` returns `200`
- workspace page renders with the new hero
