# Company Bound Auth Permissions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Bind employee login sessions to their backend company record and expose role-derived permissions so frontend routes and actions can enforce company and role boundaries.

**Architecture:** Keep the existing local frontend session model, but make the backend auth response authoritative for company and permissions. Employee directory sync creates or updates company records, preserves existing passwords, accepts optional `role`, and login returns the live `Unit` name rather than stale employee text. Frontend route guards continue to use role checks and add own-company checks for layout company routes.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic, React 18, TypeScript, React Router 6, Vitest, unittest/TestClient

---

### Task 1: Backend Permission Payload

**Files:**
- Modify: `backend/tests/test_auth_api.py`
- Create: `backend/app/services/auth_permissions.py`
- Modify: `backend/app/schemas.py`
- Modify: `backend/app/routers/auth.py`

**Step 1: Write failing tests**

Add tests proving:
- Login returns `permissions`.
- Employees from different `companyName` rows get different `companyId` values.
- Optional directory `role` is honored.
- Login returns the live `Unit.name` after a company rename.

**Step 2: Run test to verify failure**

Run: `python -m pytest backend/tests/test_auth_api.py -q`
Expected: fail because permissions and role handling are missing.

**Step 3: Implement minimal backend code**

Add a role permission map, include `permissions` in `AuthLoginResponse`, normalize directory roles, and use the joined company record in login.

**Step 4: Verify**

Run: `python -m pytest backend/tests/test_auth_api.py -q`
Expected: pass.

### Task 2: Frontend Session Permissions

**Files:**
- Modify: `frontend/tests/employeeAuth.test.ts`
- Modify: `frontend/tests/pagePermissions.test.ts`
- Modify: `frontend/src/api/types.ts`
- Modify: `frontend/src/utils/employeeAuth.ts`
- Modify: `frontend/src/utils/pagePermissions.ts`

**Step 1: Write failing tests**

Add tests proving:
- A created session stores backend permissions.
- Old sessions without permissions derive permissions from role.
- `canAccessCompany` allows the employee's own company and rejects other company IDs.
- Page/action checks can use explicit session permissions.

**Step 2: Run test to verify failure**

Run: `npm test -- employeeAuth.test.ts pagePermissions.test.ts`
Expected: fail because permission arrays and company-scope helpers are missing.

**Step 3: Implement minimal frontend helpers**

Extend `EmployeeSession`, `createEmployeeSession`, and `parseEmployeeSession`; add permission helpers while preserving existing role-based call sites.

**Step 4: Verify**

Run: `npm test -- employeeAuth.test.ts pagePermissions.test.ts`
Expected: pass.

### Task 3: Company-Scoped Routing

**Files:**
- Modify: `frontend/tests/loginFlowRoute.test.ts`
- Modify: `frontend/src/App.tsx`

**Step 1: Write failing source-level route tests**

Add tests proving:
- `/layout/company-home` uses the bound session company instead of creating a default company.
- `/layout/companies/:companyId/topics` has an own-company guard.

**Step 2: Run test to verify failure**

Run: `npm test -- loginFlowRoute.test.ts`
Expected: fail because the old `ensureEmployeeCompany` flow is still present.

**Step 3: Implement route changes**

Remove `ensureEmployeeCompany` from `App.tsx`, redirect company-home directly from the session, and add `companyScope="own"` for layout company routes.

**Step 4: Verify**

Run: `npm test -- loginFlowRoute.test.ts`
Expected: pass.

### Task 4: Full Verification

**Files:** N/A

**Step 1: Backend targeted tests**

Run: `python -m pytest backend/tests/test_auth_api.py -q`
Expected: pass.

**Step 2: Frontend targeted tests**

Run: `npm test -- employeeAuth.test.ts pagePermissions.test.ts loginFlowRoute.test.ts`
Expected: pass.

**Step 3: Full frontend build**

Run: `npm run build`
Expected: pass.
