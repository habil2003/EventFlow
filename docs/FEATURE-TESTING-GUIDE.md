# EventFlow — Feature List & Step-by-Step Test Guide

Status: **ALL TESTS PASSING** (verified 2026-08-06)

This document is the plain-language, step-by-step companion to the automated
test suite. It lists **every feature covered**, the **exact commands to run**,
what each feature's tests verify, and the **verified results** of the latest run.

---

## 1. Feature List (what is covered)

### 1.1 Authentication & Accounts (`AUTH`)
| # | Feature | Key checks |
|---|---------|-----------|
| 1 | Register as USER / ORGANIZER / VENDOR | 201 created, role persisted |
| 2 | Registration security | `role=ADMIN` rejected (no row), unknown roles rejected, malformed email rejected, duplicate email rejected |
| 3 | Organizer/Vendor profile requirements | business details required; account rolled back if missing |
| 4 | Email verification | token required/invalid/expired handling; verified-only login |
| 5 | Role → status mapping on verify | USER → APPROVED; ORGANIZER/VENDOR → PENDING (admin approval gate) |
| 6 | Login (credentials) | valid login, wrong password, unverified, BLOCKED, PENDING, unknown user |
| 7 | Session role refresh (SEC-4) | role/status re-read from DB each request; safe fallback if user gone |

### 1.2 Payments — Khalti (`PAY` / `TXN`)
| # | Feature | Key checks |
|---|---------|-----------|
| 8 | `initiateKhaltiPayment` | correct paisa amount, auth header, failure surfacing |
| 9 | `verifyKhaltiPayment` | parses Completed + amount, failure handling |
| 10 | Payment verify route (SEC-2) | only COMPLETED when gateway lookup confirms; amount must match; idempotent |
| 11 | Payment callback (SEC-2) | tickets minted **only** on verified Completed + matching amount; tampered status ignored |
| 12 | Ticket purchase | reservation + transaction created; stock/date/completed guards; failure cleans up |

### 1.3 Escrow & Payouts (`ESC` / `PAYOUT`)
| # | Feature | Key checks |
|---|---------|-----------|
| 13 | Deposit release | amount taken from DB, **client amount ignored** (SEC-3) |
| 14 | Remaining / full release | DB-derived amounts; guards for not-paid / not-complete / not-confirmed |
| 15 | Release guards | active refund blocks, already-released blocks, double-release blocks, pending-payout blocks |
| 16 | Ticket payout release | TICKET_SALES pending payout; blocked until event completed |
| 17 | Admin-only | non-admin → 401 |

### 1.4 Refunds & Disputes (`REF` / `DISP`)
| # | Feature | Key checks |
|---|---------|-----------|
| 18 | Refund policy math | 100% / 50% / 0% by days-to-event; exact amounts, fee handling |
| 19 | Cancel vendor booking | 100% refund (minus fee); no deposit → no refund; **blocked after funds released** (SEC-6) |
| 20 | Cancel ticket | refund + tier stock decrement; past event blocked; checked-in blocked |
| 21 | Dispute read | admin-only; 404 unknown |
| 22 | Dispute resolve (SEC-7) | refund created only when funds held + deposit found by `COMPLETED`; no auto-refund when released |
| 23 | Dispute reject | booking restored to ACCEPTED; resolve-once enforced |

### 1.5 Tickets & Events (`TIX` / `EVT`)
| # | Feature | Key checks |
|---|---------|-----------|
| 24 | Event creation (organizer) | event + tiers persisted; owner linked |
| 25 | Event RBAC | non-organizer → 403; missing fields → 400 |
| 26 | Check-in stats (SEC-5) | owner/admin only — USER/VENDOR → 403 (IDOR fixed) |

### 1.6 Vendor Booking Lifecycle (`BK`)
| # | Feature | Key checks |
|---|---------|-----------|
| 27 | Vendor accept | only PENDING→ACCEPTED, only after deposit paid |
| 28 | Vendor decline | auto full refund (PROCESSED); no refund if unpaid |
| 29 | Vendor complete | waits for customer confirmation, or auto-creates REMAINING payout if confirmed |
| 30 | State transitions | invalid transitions rejected |

### 1.7 Real-Database Scenario (`SCN`)
| # | Feature | Key checks |
|---|---------|-----------|
| 31 | Full end-to-end, 4-role journey | real register → verify → login (**USER / ORGANIZER / VENDOR / ADMIN**) → event create → RBAC/IDOR → ticket purchase (Khalti sandbox) |
| 32 | Vendor booking lifecycle | package create → customer book → deposit (real initiate + DB-simulated complete) → vendor accept → admin deposit release (escrow) → vendor complete → customer confirm (REMAINING payout auto-created) → admin verify payout (COMPLETED) |
| 33 | Customer cancel (pre-deposit) | second booking cancelled → `DECLINED`/`FAILED`, no refund due |
| 34 | Database hygiene | every created row deleted; **14 tables** returned to baseline |

### 1.8 Browser E2E (`E2E`)
| # | Feature | Key checks |
|---|---------|-----------|
| 35 | Sign up (real UI) | fill the signup form as USER → "Check Your Email" success screen |
| 36 | Email verify (link click) | verification token applied → `emailVerified` set |
| 37 | Sign in (real UI) | submit login form → redirected to signed-in home page |

### 1.9 CI / Automation
| # | Item | What it does |
|---|------|-------------|
| 38 | `.github/workflows/ci.yml` | runs lint + typecheck + tests on every push/PR automatically |

---

## 2. Step-by-Step: How to Run

### Step 0 — Prerequisites
- Node 20+ and pnpm 11+ installed
- For the scenario only: the dev server running on `http://localhost:3000` and a dev/throwaway database in `.env`

### Step 1 — Run the unit + API tests
```bash
pnpm test
```
> Expect: `Test Files 15 passed · Tests 114 passed`

### Step 2 — Run the type check
```bash
npx tsc --noEmit
```
> Expect: no output (0 errors)

### Step 3 — Run the linter
```bash
pnpm lint
```
> Expect: `0 errors` (pre-existing warnings are acceptable)

### Step 4 — Run the real-DB scenario (optional, needs server)
```bash
pnpm test:scenario
```
> Expect: `SUMMARY: 35/35 PASSED`, then every table prints `OK (baseline N)`.
> Skips cleanly (exit 0) if no server is reachable.

### Step 5 — Run the browser E2E (optional, needs server)
```bash
pnpm test:e2e
```
> Expect: `1 passed` (signup → verify → signin). Playwright auto-starts/reuses the
> dev server (`playwright.config.ts` `webServer`). Needs a dev/throaway DB.

### Step 6 — CI (automatic)
Push to GitHub → `.github/workflows/ci.yml` runs Steps 1–3 automatically.

---

## 3. Step-by-Step: What Each Test File Verifies

| File | Cases | What it proves |
|------|------:|----------------|
| `tests/unit/payment.khalti.test.ts` | 6 | Khalti initiate/verify: paisa conversion, auth header, failure modes |
| `tests/unit/payment.refund.test.ts` | 5 | Full/partial refunds, paisa body, already-refunded guard, manual fallback |
| `tests/unit/refund-calculators.test.ts` | 6 | 100/50/0% refund policy + exact math |
| `tests/unit/auth.login.test.ts` | 9 | Login rules (feature 6) + session role refresh (feature 7) |
| `tests/api/auth.register.test.ts` | 8 | Registration + role whitelist (features 1–3) |
| `tests/api/auth.verify-email.test.ts` | 6 | Verification + role→status mapping (features 4–5) |
| `tests/api/payment.verify.test.ts` | 6 | Server-side verify + amount reconcile (feature 10) |
| `tests/api/tickets.payment-callback.test.ts` | 6 | Minting only on verified Completed (feature 11) |
| `tests/api/tickets.purchase.test.ts` | 8 | Purchase + guards + cleanup (feature 12) |
| `tests/api/admin.release-funds.test.ts` | 14 | Escrow release + guards + ticket payout (features 13–17) |
| `tests/api/admin.disputes.test.ts` | 10 | Dispute read/resolve/reject + SEC-7 guards (features 21–23) |
| `tests/api/user.cancel-booking.test.ts` | 8 | Vendor + ticket cancellation (features 19–20) |
| `tests/api/organizer.events.test.ts` | 4 | Event creation + RBAC (features 24–25) |
| `tests/api/organizer.checkin-stats.test.ts` | 6 | IDOR fix — owner/admin only (feature 26) |
| `tests/api/vendor.bookings.status.test.ts` | 12 | Booking lifecycle (features 27–30) |
| `tests/scenarios/traffic-scenario.mjs` | 35 | Full real-DB 4-role journey + hygiene (features 31–34) |
| `tests/e2e/auth-flow.spec.ts` | 1 | Browser signup → verify → signin (features 35–37) |

---

## 4. Verified Results (run on 2026-08-06)

| Gate | Command | Result |
|------|---------|--------|
| Unit/API tests | `pnpm test` | **114/114 passed** (15 files) |
| Type check | `npx tsc --noEmit` | **0 errors** |
| Lint | `pnpm lint` | **0 errors** (210 pre-existing warnings) |
| Real-DB scenario | `pnpm test:scenario` | **35/35 passed**; all 14 tables restored to baseline |
| Browser E2E | `pnpm test:e2e` | **1/1 passed** (signup→verify→signin) |
| CI | GitHub Actions | configured; runs lint + tsc + tests on push/PR |

---

## 5. Known Gaps (optional, not blocking)

- **Component (React) tests** — not installed; covers admin payout image, escrow
  bulk actions, refund badges.
- **Browser E2E breadth** — currently the auth smoke only; the money flows
  (buy ticket, vendor deposit/remaining/full payout) are covered by the real-DB
  scenario instead of the browser.
- Both are additive; the security-critical and money-moving logic is fully
  covered by the suite above.
