# EventFlow — Test Plan & Strategy

Version: 1.0
Scope owner: Engineering / QA
Last updated: 2026-08-06

---

## 1. Purpose

This document defines a systematic, layered testing strategy for the EventFlow
platform (Next.js 16 / React 19 / Prisma / NextAuth / Khalti payments). It
provides:

1. A **test pyramid** and the types of testing performed at each layer.
2. The **recommended tooling** (with a proposed setup, since no test runner is
   currently installed).
3. **Environment, data, and security-testing conventions**.
4. A **traceable test-case inventory** (Unit / API / Integration / E2E /
   Security) organized by module, each with a unique ID, steps, and expected
   results.
5. **Regression cases** for the security & financial fixes recently applied.
6. A **requirements traceability matrix** and **definition of readiness**.

---

## 2. Test Pyramid & Testing Types

```
            /  E2E  /         Playwright  (critical happy + top flows)
          | SEO / PERF |      next build, Lighthouse, Load (k6 optional)
       |  SECURITY  |        automated: injection, authz, payment tampering
     |    INTEGRATION     |  API routes + DB (supertest, seeded Prisma)
   |         UNIT / COMPONENT    |      Vitest + React Testing Library
========================================

```

### 2.1 Unit Testing (Vitest / Jest)
- Pure logic, helpers, controllers, calculators.
- Current candidates (all pure functions we touched/audited):
  - `lib/payment/khalti.ts` — `initiateKhaltiPayment`, `verifyKhaltiPayment`.
  - `lib/payment/refund.ts` — `processKhaltiRefund`, `lookupTransaction`, `initiateRefund`.
  - `app/api/user/cancel-booking/route.ts` — `calculateRefundPercentage`, `calculateRefundAmount` (math fixtures).
  - `app/api/auth/register/route.ts` — role whitelist logic.
  - Payout/commission math in `release-funds`.
- **Recommended runner:** Vitest (zero-config for TS, works alongside Next 16).

### 2.2 Component Testing (React Testing Library)
- UI contracts for critical components: admin `escrow`, `payouts/[id]`,
  `refunds`, payment return/status pages.
- Mock `next/image`, `next-auth`, and providers.

### 2.3 API / Integration Testing (supertest + Prisma test DB)
- Every `app/api/**/route.ts` handler is tested against an isolated Postgres
  test database (`DATABASE_URL_TEST`) seeded via `prisma/seed.ts`.
- Third-party calls (Khalti, nodemailer) are **stubbed** via fetch mocks.

### 2.4 Security Testing
- Automated: privilege escalation, IDOR, tampered status, client-side amount,
  stale roles (covers the loopholes in §4.6). Plus a manual pass for OWASP
  Top-10 basics (injection, XSS, CSRF in the admin console).

### 2.5 End-to-End (Playwright)
- Full user journeys: register → verify → buy ticket → Khalti (sandbox) →
  escrow → admin release → payout. Vendor booking deposit/remaining/release.

### 2.6 Performance & Smoke
- `next build` must compile.
- `next start` smoke boot; key GET routes return 200 under load (optional `k6`/`heapt`).
- Lighthouse for login/purchase.

---

## 3. Recommended Tooling Setup

> **STATUS: INSTALLED.** Vitest 4.1.10 + `@vitest/coverage-v8` and
> `@playwright/test` 1.62.1 are installed (via pnpm — this is a pnpm workspace).
> `vitest.config.ts`, `tests/setup.ts`, `tests/helpers/`, `playwright.config.ts`,
> and `tests/e2e/` exist. Run with `pnpm test` / `pnpm test:watch` /
> `pnpm test:coverage` / `pnpm test:e2e`.

```bash
# Unit / integration
pnpm add -D vitest @vitest/coverage-v8
# E2E (follow-up)
pnpm add -D @playwright/test
pnpm exec playwright install chromium
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/unit/**/*.test.ts', 'tests/api/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
  },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
});
```

Suggested `package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest",
"test:e2e": "playwright test",
"test:security": "vitest run test/security",
"test:smoke": "next build && node scripts/smoke.mjs"
```

---

## 3.1 Implementation & Current Results

### 3.1.1 Automated suite (Vitest) — PASSING 114/114
Test inventory implemented so far (see §5 for full case details):

| File | Cases | Coverage |
|------|------:|----------|
| `tests/unit/payment.khalti.test.ts` | 6 | initiate/verify: paisa conversion, auth header, failure modes |
| `tests/unit/payment.refund.test.ts` | 5 | full/partial refund, paisa body, already-refunded, manual fallback |
| `tests/unit/refund-calculators.test.ts` | 6 | 100/50/0% policy + refund-amount math |
| `tests/api/auth.register.test.ts` | 8 | role whitelist (ADMIN rejected), duplicate email, organizer cleanup |
| `tests/api/payment.verify.test.ts` | 6 | gateway-verify gating, amount reconciliation, idempotency |
| `tests/api/tickets.payment-callback.test.ts` | 6 | ticket minting only on verified Completed + matching amount |
| `tests/api/admin.release-funds.test.ts` | 6 | DB-derived amounts (ignores tampered body), guards, RBAC |
| `tests/api/user.cancel-booking.test.ts` | 4 | refund-after-release guard, refund math |
| `tests/api/organizer.checkin-stats.test.ts` | 6 | owner/admin-only (IDOR), 401/403/404 |
| `tests/api/auth.verify-email.test.ts` | 6 | role→status mapping (USER→APPROVED, ORG→PENDING), token/expiry branches |
| `tests/api/organizer.events.test.ts` | 4 | event create (EVT-001), RBAC 401/403, tier persistence |
| `tests/api/tickets.purchase.test.ts` | 8 | reserve + transaction + Khalti initiate (TIX-001), stock/date guards, failure cleanup |
| `tests/api/admin.disputes.test.ts` | 10 | DISP-001..004 (read, resolve-once, invalid), SEC-7 refund guards (REFUND-011/012), REJECTED restore |
| `tests/api/admin.release-funds.test.ts` | 14 | escrow guards: ESC-005 active refund, ESC-006 released, ESC-008 remaining gating, ESC-010 full gating, ESC-012 double-release, ticket TICKET_SALES payout |
| `tests/api/user.cancel-booking.test.ts` | 8 | vendor + ticket cancel; REFUND-006 past-event, REFUND-007 stock decrement, unknown type |
| `tests/unit/auth.login.test.ts` | 9 | authorize: valid/wrong-password/unverified/BLOCKED/PENDING/unknown/missing; session role-refresh (SEC-4) + token fallback |
| `tests/api/vendor.bookings.status.test.ts` | 12 | BK-001 accept (deposit gate), BK-002 decline auto-refund, BK-003 complete→remaining payout, RBAC, transitions |

- **Gate status:** `pnpm test` → 15 files / 114 tests pass · `npx tsc --noEmit` → 0 errors · `npx eslint tests` → 0 problems.
- **Design note:** API handlers are invoked as functions with mocked `@/lib/prisma`, `next-auth`, and `@/lib/payment/khalti` (via `vi.hoisted`). No external services or real DB writes are involved — fully deterministic.

### 3.1.2 Real-traffic smoke pass (live server + real DB)
Executed against the running dev server (`http://localhost:3000`, real Postgres
`eventflow` DB). **No test rows were inserted** — only read endpoints and
rejected requests were used.

| Check | Method/Path | Result |
|-------|-------------|--------|
| Homepage | `GET /` | 200 (~2.6s first hit) |
| Public stats | `GET /api/public/stats` | 200 (584ms) |
| Public events | `GET /api/events` | 200 (380ms) |
| Public vendors | `GET /api/vendors` | 200 (346ms) |
| Privilege escalation (live) | `POST /api/auth/register` `role=ADMIN` | **400** — rejected, no row created |
| RBAC (live) | `GET /api/admin/stats` unauthenticated | **401** |
| Malformed payload | `POST /api/auth/register` empty fields | 400 |

Concurrency burst (Node loader hitting real endpoints):

| Concurrency | Endpoint | Result |
|-------------|----------|--------|
| 50 parallel | `GET /api/events` | 50× HTTP 200, 887ms wall |
| 200 parallel | `GET /api/events` | 200× HTTP 200, 2988ms wall |

Loader script: `C:\Users\User\Temp\opencode\eventflow-load.mjs` (env-tunable).

### 3.1.3 DB-seeded scenario suite (committed, opt-in)

> **STATUS: COMMITTED.** The real-traffic, real-DB scenario previously run ad hoc
> is now a repeatable script in the repo: `tests/scenarios/traffic-scenario.mjs`,
> run with `pnpm test:scenario`. It requires the dev server on `TARGET_URL`
> (default `http://localhost:3000`) and mutates whatever `DATABASE_URL` is in
> `.env`, then **deletes every row it created** so the DB returns to baseline.

What it drives end-to-end over real HTTP + the real DB (covers all four actor
sides — customer USER, ORGANIZER, VENDOR, ADMIN):

1. Register USER / ORGANIZER / VENDOR (201) + `role=ADMIN` escalation rejected, no row created.
2. Email verification for all roles (DB tokens read and POSTed); ORG/VENDOR admin
   approval simulated via a direct DB write (labelled "(simulated)").
3. Login (next-auth credentials) for all four roles (ADMIN seeded); session carries correct role.
4. Event creation as organizer; check-in stats owner 200 vs USER/VENDOR **403** (IDOR).
5. `admin/stats` 401 anon / 403 authenticated non-admin; vendor profile 200.
6. Ticket purchase → real Khalti sandbox initiate (pidx returned); reservation held.
7. **Vendor lifecycle:** vendor creates a package (201) → customer books it (201) →
   deposit initiated (real Khalti initiate) then the completed payment **simulated in
   DB** → vendor accept → admin release deposit (PENDING payout verified) →
   vendor mark complete → customer confirm completion (REMAINING payout
   auto-created, PENDING) → admin verify remaining payout (→ **COMPLETED**).
8. **Customer cancel (pre-deposit):** second booking cancelled → `DECLINED`/`FAILED`,
   no refund due.

Housekeeping: prints baseline/after counts for 14 tables and asserts they match;
exits non-zero on any FAIL. Skips with exit 0 when no server is reachable.

Last run (2026-08-06, live dev server + real Postgres): **35/35 PASSED**, all
14 table counts restored to baseline. If Khalti initiation fails (no/invalid
secret), the purchase step still asserts the server cleans up the reservation
and the run stays green; the deposit lifecycle is intentionally DB-simulated
because a Khalti checkout needs a human in the browser.

### 3.1.4 Browser E2E smoke (Playwright, committed)

> **STATUS: INSTALLED.** `@playwright/test` + Chromium are installed and wired as
> `pnpm test:e2e`. Config at `playwright.config.ts` (testDir `tests/e2e`,
> `webServer` reuses the running dev server via `TARGET_URL`, default
> `http://localhost:3000`). Requires a dev server and a dev/throaway
> `DATABASE_URL` in `.env` (the spec cleans up its test user).

`tests/e2e/auth-flow.spec.ts` drives the **real UI** in a headless browser:
sign up (USER) → read the verification token from the DB and call
`verify-email` (mimics clicking the emailed link) → sign in through the login
form → asserts the signed-in home page. Last run (2026-08-06): **1/1 passed**
(10.3s). This covers E2E-006 (role gate) indirectly and lays the harness for
E2E-001..E2E-005.

---

## 4. Environment, Data & Security Conventions

- **Test DB:** separate Postgres schema; set `DATABASE_URL` before running.
  ```bash
  # .env.test
  DATABASE_URL=postgres://...eventflow_test
  KHALTI_ENVIRONMENT=sandbox
  NEXTAUTH_SECRET=test-secret
  ```
- **Gateways:** intercept `fetch` at the `khalti.ts` boundary so no real money
  is moved. Provide canned `lookup`/`initiate`/`refund` responses in fixtures.
- **Auth/session:** helpers that forge a session object instead of exercising
  the full password flow for handlers that only read `getServerSession`.
- **Randomness/time:** `fakeTimers` for refund-eligibility windows (7d/3d).
- **Isolation:** reset DB between tests (`TRUNCATE ... CASCADE`).
- **Secret hygiene:** non-committed keys; `.env.test` ignored by git.

### Security regression contract (captures the recent fixes)
| # | Rule enforced | Where |
|---|---|---|
| SEC-1 | Registration cannot set `role=ADMIN` (whitelist) | `auth/register` |
| SEC-2 | Payment only COMPLETED on a successful Khalti `/lookup`, amount reconciled | `payment/verify`, `tickets/payment-callback` |
| SEC-3 | Release/payout amounts derive from DB, not request body | `admin/release-funds` |
| SEC-4 | JWT `role`/`status` re-fetched from DB per request | `lib/auth.ts` `session` callback |
| SEC-5 | Check-in stats require event owner / admin | `organizer/events/[id]/checkin-stats` |
| SEC-6 | No refund after funds released | `user/cancel-booking` |
| SEC-7 | Dispute refund only when funds held; uses `COMPLETED` status | `admin/disputes/[id]` |

---

## 5. Test-Case Inventory

Legend: **ID** = module prefix; **L** = level (U=unit, A=API, E=E2E, S=security,
C=component); **P** = priority (H/M/L); **Type** = POS/NEG/EDGE/BND.

---

### 5.1 Authentication & Authorization (`AUTH`)
| ID | L | P | Type | Title / Steps | Expected |
|----|---|----|-----|---------------|----------|
| AUTH-001 | A | H | POS | Valid USER login returns session with role=USER | 200, token carries role USER |
| AUTH-002 | A | H | NEG | Wrong password | 401 "Invalid email or password" |
| AUTH-003 | A | H | NEG | Unverified email login | Rejected with "verify your email" |
| AUTH-004 | A | H | NEG | BLOCKED user login | "account has been suspended" |
| AUTH-005 | A | H | NEG | PENDING user login | "pending admin approval" |
| AUTH-006 | A | H | POS | Register USER with all fields | 201, account created PENDING/active per role |
| AUTH-007 | A | H | NEG | Register with `role="ADMIN"` | 400 "Invalid role" (SEC-1) |
| AUTH-008 | A | H | NEG | Register with unknown `role` value | 400, not created |
| AUTH-009 | A | H | NEG | Register missing field | 400 Missing required fields |
| AUTH-010 | A | H | NEG | Duplicate email | Conflict (no duplicate user) |
| AUTH-011 | A | H | POS | Verify email ORGANIZER/VENDOR → PENDING | status=PENDING |
| AUTH-012 | A | H | NEG | Verify email for non-permitted role reaches APPROVED | role mapping respected (SEC-1) |
| AUTH-013 | A | H | POS | Admin demoted while token alive; next request reflects new role | Session returns reduced role (SEC-4) |
| AUTH-014 | A | H | EDGE | Session refresh when user no longer in DB | Graceful fallback to token |
| AUTH-015 | A | M | POS | Forgot/reset password flow | Valid link resets; invalid expires |

### 5.2 Payment — Khalti (`PAY`)
| ID | L | P | Type | Test / Steps | Expected |
|----|---|----|------|--------------|----------|
| PAY-001 | U | H | POS | `initiateKhaltiPayment` builds request (amount→paisa, auth header) | payload correct; returns pidx |
| PAY-002 | U | H | NEG | initiate fails from gateway | success:false, error surfaced |
| PAY-003 | U | H | POS | `verifyKhaltiPayment` parses `Completed` + total_amount | success:true,status,amount |
| PAY-004 | U | H | NEG | lookup returns non-2xx | success:false |
| PAY-005 | A | H | NEG | `payment/verify` with `status=Completed` but lookup PENDING | NOT COMPLETED; booking unchanged (SEC-2) |
| PAY-006 | A | H | NEG | `payment/verify` amount mismatch vs DB | NOT completed (SEC-2) |
| PAY-007 | A | H | POS | verify Completed + matching lookup/money | Booking/tx COMPLETED |
| PAY-008 | A | H | NEG | verify without stored pidx and claims Completed | Failed; no state change |
| PAY-009 | A | H | NEG | `tickets/payment-callback` tampered `status=Completed` | No tickets minted (SEC-2) |
| PAY-010 | A | H | POS | callback verified Completed + amount matches | Tickets minted, stock decremented |
| PAY-011 | A | POST | EDGE | Repeated callback (idempotency) | Second call marked already-processed; no duplicates |
| PAY-012 | A | M | POS | `payment/initiate` needs authenticate session | 401 unauthenticated |

### 5.3 Payment verification / status accounting (`TXN`)
| ID | L | P | Type | Steps | Expected |
|----|----|-----|------|-------|----------|
| TXN-001 | A | H | POS | Verify marks tx `COMPLETED` once | status persists |
| TXN-002 | A | H | EDGE Duplicate webhook processed once | idempotent |
| TXN-003 | A | M | POS amount reconciliation equal | complete |
| TXN-004 | A | H | NEG amount mismatch | rejected, stays PENDING/failed |

### 5.4 Escrow & Payout (`ESC` / `PAYOUT`)
| ID | L | P | Type | Steps | Expected |
|----|----|-----|------|-------|----------|
| ESC-001 | A | M | POS list pending escrow (admin) | returns grouped bookings |
| ESC-002 | A | H | POS release `deposit` | payout amount = `depositAmount` from DB (SEC-3) |
| ESC-003 | A | H | NEG release with tampered `amount` body | ignored; DB-derived amount used (SEC-3) |
| ESC-004 | A | H | NEG release deposit without depositPaidAt | 400 |
| ESC-005 | A | H | NEG release while active refund | 400 |
| ESC-006 | A | H | NEG deposit payout already PENDING/COMPLETED | 400 |
| ESC-007 | A | H | POS release `remaining` when fully paid | amount = `remainingAmount` (SEC-3) |
| ESC-008 | A | H | NEG remaining before deposit released | 400 |
| ESC-009 | A | H | POS release `all` (fully paid, confirmed, vendor syn) | DB `totalAmount` (SEC-3) |
| ESC-010 | A | H | NEG release full without FULLY_PAID/customer confirm | 400 |
| ESC-011 | A | M | POS ticket release | payout=total minus commission (DB total) |
| ESC-012 | A | H | NEG double release | "already released" |
| PAYOUT-01 | A | H | NEG non-admin cannot release | 401 |
| PAYOUT-02 | A | M | verify payout (manual) | transitions PENDING→COMPLETED |
| PAYOUT-03 | A | M | verify payout bulk | each booking flips |

### 5.5 Refunds & Cancellation (`REF`)
| ID | L | P | Type | Steps | Expected |
|----|----|-----|------|-------|----------|
| REFUND-001 | U | H | POS | `calculateRefundPercentage` ≥7d → 100, ≥3d→50, else 0 | correct mapping |
| REFUND-002 | U | H | POS | `calculateRefundAmount`: 100% = paid-fee; 50% = half; 0% = none | math exact |
| REFUND-003 | U | H | BND | 100% leaves only fee | refund=paid-fee |
| REFUND-004 | A | H | POS | Customer cancels vendor booking (deposit paid, ≥7d) | 100% refund created; booking DECLINED |
| REFUND-005 | A | H | NEG | Cancel after funds released (`amountReleasedAt` set) | blocked (SEC-6) |
| REFUND-006 | A | H | NEG | Cancel past event ticket | 400 |
| REFUND-007 | A | H | POS | Ticket cancel refunds, decrements soldCount | correct refund + tiers |
| REFUND-008 | A | H | NEG | Refund amount exceeds amount paid | impossible/by design capped |
| REFUND-009 | A | M | POS | Admin processes Khalti refund full | gateway request valid, tx PROCESSED |
| REFUND-010 | A | M | POS | Admin processes Khalti partial (paisa) | body amount in paisa |
| REFUND-011 | A | H | NEG | Dispute RESOLVED uses wrong status | now looks up `COMPLETED` and creates refund (SEC-7) |
| REFUND-012 | A | H | NEG | Dispute RESOLVED when funds already released | no auto-refund created (SEC-7) |
| REFUND-013 | A | H | EDGE | Refund duplicate (already refunded) | Khalti `refunded=true` → no double |

### 5.6 Disputes (`DISP`)
| ID | L | P | Type | Steps | Expected |
|----|----|-----|------|-------|----------|
| DISP-001 | A | M | POS | list/read dispute (admin) | data + booking |
| DISP-002 | A | H | POS resolve → refund row created | refund PENDING_ADMIN |
| DISP-003 | A | H | NEG resolve twice | "already resolved" |
| DISP-004 | A | M | NEG status invalid | 400 |

### 5.7 Tickets & Events (`TIX` / `EVT`)
| ID | L | P | Type | Steps | Expected |
|----|----|-----|------|-------|----------|
| TIX-001 | A | H | POS purchase reserves quantity | ticket + reservation |
| TIX-002 | A | H | NEG purchase exceeds capacity | blocked, decrement guard |
| TIX-003 | A | M | POS checkin (QR) | flags checkedIn, timestamp |
| TIX-004 | A | M | POS manual checkin | same |
| TIX-005 | A | M | EDGE double-scanned token | already checked in, no dup |
| EVT-001 | A | M | POS organizer creates event | persisted, owner linked |
| EVT-002 | A | H | NEG non-owner update/delete | 403 |
| EVT-003 | A | M | POS mark completed | releases blocked until completed & completed then release ok |
| EVT-004 | A | H | NEG owner leakage | check-in stats (owner only) (SEC-5) |
| EVT-005 | A | M | POS ratings read | aggregate correct |

### 5.8 Admin & RBAC (`ADM`)
| ID | L | P | Type | Steps | Expected |
|----|----|-----|------|-------|----------|
| ADM-001 | A | H | NEG vendor/organizer call admin endpoints | 401/403 |
| ADM-002 | A | H | POS admin list users/payouts/refunds | scoped |
| ADM-003 | A | M | NEG admin role removed mid-session | next request 403 (SEC-4) |
| ADM-004 | A | M | POS settings read/set | only ADMIN |

### 5.9 Booking lifecycle (`BK`)
| ID | L | P | Type | Steps | Expected |
|----|----|-----|------|-------|----------|
| BK-001 | A | H | POS vendor accepts → ACCEPTED | state |
| BK-002 | A | H | NEG vendor declines → 100% | refund of deposit |
| BK-003 | A | M | POS customer confirm / vendor complete → | release-eligible flags |

### 5.10 E2E (`E2E`)
| ID | Flow |
|----|------|
| E2E-001 | Register USER → verify → login → buy ticket (Khalti sandbox) → see ticket |
| E2E-002 | Organizer/register → login → event create → mark complete → admin releases |
| E2E-003 | Vendor deposit → remaining → full payout lifecycle |
| E2E-004 | Cancel booking → refund visible; admin processes |
| E2E-005 | Check-in via camera scanner happy path |
| E2E-006 | Privilege escalation attempt (register as ADMIN) rejected |

### 5.11 UI / Component (`C`)
| ID | Component | Expect |
|----|-----------|--------|
| C-001 | `payouts/[id]` proof `<Image>` renders (hostname allowlisted) | no Invalid src error |
| C-002 | `escrow` bulk actions | gating |
| C-003 | refund status badges | correct states |
| C-004 | Next config: external hostnames (`utfs.io` …) | render-only, `next/image` OK |

---

## 6. Security Regression Cases — Linked to Recent Fixes

| Test ID | Requirement (fix) | File(s) |
|---------|-------------------|---------|
| AUTH-007/008 | Registration role whitelist | `app/api/auth/register/route.ts` |
| AUTH-012/013 | Role→status mapping + per-request refresh | `app/api/auth/verify-email/route.ts`, `lib/auth.ts` |
| PAY-005..008, PAY-009/010 | Server-side gateway verification + amount reconciliation | `app/api/payment/verify/route.ts`, `app/api/tickets/payment-callback/route.ts` |
| ESC-002/003/007/009 | Amounts derived from DB, client `amount` ignored | `app/api/admin/release-funds/route.ts` |
| EVT-004 | Check-in stats owner-only | `app/api/organizer/events/[id]/checkin-stats/route.ts` |
| REFUND-005 | Block cancel after release | `app/api/user/cancel-booking/route.ts` |
| REFUND-011/012 | Dispute status `COMPLETED` + released-funds guard | `app/api/admin/disputes/[id]/route.ts` |

---

## 7. Requirements Traceability Matrix
> Map functional modules → families of tests; every high-priority behaviour that a
> release gates on must have at least one PASS test.

| Requirement | Unit | API | Security | E2E |
|-------------|------|-----|----------|-----|
| Auth/Credentials + role enforcement | AUTH-009 | AUTH-001→015 | AUTH-007, SEC-1, SEC-4 | E2E-006 |
| Khalti payment verification | PAY-001→004 | PAY-005→012, TXN | PAY-006 | E2E-001 |
| Escrow/release payout | ESC- | PAYOUT-01/03 | ESC-003, SEC-003 | E2E-002/003 |
| Refund & cancellation policy | REFUND-01/02 | REFUND-01→13 | REFUND-05/11/12 | E2E-05 |
| Tickets + check-in | – | TIX-001.. | EVT-004, SEC-005 | E2E-05 |
| Admin RBAC | – | ADM-001.. | ADM-003 | – |

---

## 8. Definition of Done / Readiness Gate

Blocking (must all pass before release):
- `npm run lint` — 0 errors.
- `npx tsc --noEmit` — 0 errors.
- `npm run build` — successfully compiled.
- Security suite: **no High/Critical** failures.
- New/regressed HIGH behaviours covered with ≥1 automated test.

Non-blocking:
- Coverage ≥ 80% on `lib/**` pure functions; warnings accepted if documented.

---

## 9. What is NOT Yet Covered (Gaps)

- No automated component tests yet (React Testing Library) — `.test` present
  only for unit/API layers.
- Browser E2E covers the auth smoke only; the money flows (E2E-001..005) are
  covered by the real-DB scenario (§3.1.3) rather than the browser.
- Manual UAT test cases need stakeholder sign-off (added to a backlog).
- Performance load profile not yet defined.

---

## 10. Next Steps

1. ✅ **DONE** — DB-seeded scenario tests driving the full flow (register→verify→buy→escrow)
   are committed as `tests/scenarios/traffic-scenario.mjs`, run with `pnpm test:scenario`.
2. Implement `tests/api` for remaining modules (tickets/purchase, events, admin
   escrow, disputes refund path, refunds processing) with an isolated test DB.
3. ✅ **DONE** — CI job (GitHub Actions) at `.github/workflows/ci.yml` runs on every
   push/PR: `pnpm install --frozen-lockfile` + `pnpm lint` + `npx tsc --noEmit` +
   `pnpm test`. (The real-traffic scenario is intentionally NOT in CI — it needs a
   live server + DB; run it manually via `pnpm test:scenario`.)
4. ✅ **DONE** — Playwright installed and wired (`pnpm test:e2e`); initial smoke
   `tests/e2e/auth-flow.spec.ts` (signup→verify→signin) is green. Browser E2E
   intentionally NOT in CI yet (needs a live server + DB; run locally).
5. Set up a permanent `tests/security` spec that also runs the tampered/missed
   cases in §5.10 and §6; wire into CI.

_Gap noted: the current automated API tests mock the DB and gateway; the
real-traffic pass above confirms server/routes/DB are healthy but intentionally
writes no data._

---

_Generated for the EventFlow development workflow; update the matrix whenever a module
changes or a security test is added._