# Employee Login + Module Hub Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an employee login page and a post-login module hub page with role-aware module access placeholders.

**Architecture:** Keep existing业务页面不改核心逻辑，在路由层新增登录入口与鉴权守卫。登录先使用前端本地会话占位（localStorage + 类型校验），模块页展示三个模块并根据角色决定可进入状态，为后续接后端权限接口预留扩展点。

**Tech Stack:** React 18, TypeScript, React Router 6, Vitest, existing global CSS

---

### Task 1: Add auth and module domain helpers (TDD first)

**Files:**
- Create: `frontend/tests/employeeAuth.test.ts`
- Create: `frontend/src/utils/employeeAuth.ts`

**Step 1: Write the failing test**
- Add tests for:
- `validateEmployeeLogin` rejects empty username/password and short password.
- `createEmployeeSession` + `parseEmployeeSession` roundtrip.
- `parseEmployeeSession` rejects malformed JSON and invalid role.
- `listModulesByRole` marks `management` inaccessible for `staff`, accessible for `admin`.

**Step 2: Run test to verify it fails**
- Run: `npm test`
- Expected: fail because `employeeAuth` helpers do not exist yet.

**Step 3: Write minimal implementation**
- Implement types, validators, safe parser, and role-based module list helpers.

**Step 4: Run test to verify it passes**
- Run: `npm test`
- Expected: all tests pass.

### Task 2: Implement login page and module hub page

**Files:**
- Create: `frontend/src/pages/LoginPage.tsx`
- Create: `frontend/src/pages/ModuleHubPage.tsx`
- Modify: `frontend/src/App.tsx`

**Step 1: Write failing test/update existing tests if needed**
- Existing helper tests already cover auth/module mapping behavior used by pages.

**Step 2: Implement minimal UI**
- Login page:
- username/password/role fields.
- inline validation feedback.
- successful submit stores session to localStorage and redirects.
- Module hub page:
- show employee info and role badge.
- render three modules: 公文总结 / 公文排版 / 公文管理.
- locked state for unauthorized module.
- logout button clears session and routes to login.
- Wire routes:
- `/` login
- `/workspace` module hub (guarded)
- existing业务路由改为 guard + keep old behavior.

**Step 3: Verify manually**
- login as `staff` sees management locked.
- login as `admin` can access all module cards.

### Task 3: Style polishing and responsive behavior

**Files:**
- Modify: `frontend/src/styles.css`

**Step 1: Add page-scoped styles**
- distinct visual hierarchy for login and module cards.
- responsive layout for mobile/desktop.
- clear focus states and hover states.

**Step 2: Verify accessibility basics**
- labels bound to form controls.
- focus outline visible.
- sufficient contrast for body text and buttons.

### Task 4: Final verification

**Files:**
- N/A

**Step 1: Run tests**
- Run: `npm test`
- Expected: all pass.

**Step 2: Run build**
- Run: `npm run build`
- Expected: build success.

**Step 3: Run app locally (Docker already running)**
- Check:
- `http://localhost:5174` opens login page.
- login success routes to module hub.
