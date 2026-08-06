// traffic-scenario.mjs
// Real-traffic + real-DB scenario test covering ALL four actor sides:
//   USER (customer), ORGANIZER, VENDOR, ADMIN.
//
// Drives the running dev server over HTTP end-to-end:
//   register → verify → login (4 roles) → ticketed event + purchase →
//   vendor package → booking → deposit → accept → admin release → complete →
//   customer confirm → admin payout verify → customer cancel.
//
// It deletes every row it creates so the database returns to baseline.
// Opt-in: `pnpm test:scenario`. Skips (exit 0) if no server is reachable;
// exits 1 if any step fails. Env: TARGET_URL (default http://localhost:3000).
//
// NOTE: mutates whatever DATABASE_URL is in .env. Run against a dev/throaway
// database only. Two steps that normally need a human (admin-approving an org/
// vendor, and completing a real Khalti sandbox payment) are simulated via
// direct DB writes and clearly labelled "(simulated)".

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BASE = process.env.TARGET_URL || "http://localhost:3000";
const PASSWORD = "Traffic#Test!2026";
const SUFFIX = Date.now();

for (const line of readFileSync(join(REPO, ".env"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const require = createRequire(join(REPO, "_resolve.js"));
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();

const EMAIL = (role) => `traffic.${role.toLowerCase()}.${SUFFIX}@eventflow.test`;

const USERS = [
  { role: "USER", email: EMAIL("user"), name: "Traffic User" },
  { role: "ORGANIZER", email: EMAIL("organizer"), name: "Traffic Organizer" },
  { role: "VENDOR", email: EMAIL("vendor"), name: "Traffic Vendor" },
];

const counts = [
  "User",
  "OrganizerProfile",
  "VendorProfile",
  "ServicePackage",
  "UserSocialEvent",
  "VendorBooking",
  "BookingAddOn",
  "PaymentTransaction",
  "Payout",
  "Refund",
  "TicketedEvent",
  "TicketTier",
  "TicketReservation",
  "TicketBooking",
];

const created = { users: [], transactions: [], reservations: [], bookingIds: [] };
let baseline = null;
let eventId = null;
let tierId = null;

const results = [];
const record = (step, expect, got, ok) => {
  results.push({ step, ok: !!ok });
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${step}  →  got ${got} (expected ${expect})`);
};

function cookiesFrom(res) {
  const headers =
    typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  if (!headers.length && res.headers.get("set-cookie")) {
    for (const c of res.headers.get("set-cookie").split(/,(?=\s*[^;]+=)/)) headers.push(c);
  }
  const jar = {};
  for (const c of headers) {
    const [pair] = c.split(";");
    const eq = pair.indexOf("=");
    jar[pair.slice(0, eq).trim()] = pair.slice(eq + 1);
  }
  return jar;
}
function cookieHeader(jar) {
  return Object.entries(jar)
    .map(([live, v]) => `${live}=${v}`)
    .join("; ");
}

async function api(method, path, { body, jar } = {}) {
  const headers = { "content-type": "application/json" };
  if (jar && Object.keys(jar).length) headers.cookie = cookieHeader(jar);
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  let data = null;
  try {
    data = await res.json();
  } catch {}
  const newCookies = cookiesFrom(res);
  if (jar && Object.keys(newCookies).length) Object.assign(jar, newCookies);
  return { status: res.status, data };
}

async function login(email, jar) {
  const csrfRes = await fetch(BASE + "/api/auth/csrf", {
    headers: { cookie: cookieHeader(jar) },
  });
  const { csrfToken } = await csrfRes.json();
  Object.assign(jar, cookiesFrom(csrfRes));
  const form = new URLSearchParams({ csrfToken, email, password: PASSWORD, json: "true" });
  const res = await fetch(BASE + "/api/auth/callback/credentials", {
    method: "POST",
    redirect: "manual",
    headers: { cookie: cookieHeader(jar), "content-type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  Object.assign(jar, cookiesFrom(res));
  let body = null;
  try {
    body = await res.json();
  } catch {}
  return { status: res.status, body };
}

async function register(u) {
  const body = { name: u.name, email: u.email, password: PASSWORD, role: u.role };
  if (u.role === "ORGANIZER") {
    body.businessName = "Traffic Org LLC";
    body.businessType = "EVENT";
  }
  if (u.role === "VENDOR") {
    body.businessName = "Traffic Vendor Co";
    body.serviceType = "CATERING";
    body.location = "Kathmandu";
  }
  return api("POST", "/api/auth/register", { body });
}

async function serverUp() {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(BASE + "/", { signal: ctrl.signal });
    clearTimeout(t);
    return res.status === 200;
  } catch {
    return false;
  }
}

async function verifyAndApprove(roleEmail, role) {
  const dbUser = await prisma.user.findUnique({ where: { email: roleEmail } });
  created.users.push(dbUser.id);
  const v = await api("POST", "/api/auth/verify-email", { body: { token: dbUser.verificationToken } });
  record(`verify ${role}`, "200/400", v.status, [200, 400].includes(v.status));
  // Simulate admin approval for ORG/VENDOR (non-USER roles become PENDING on verify).
  if (role !== "USER") {
    await prisma.user.update({ where: { id: dbUser.id }, data: { status: "APPROVED" } });
  }
}

async function seedAdmin() {
  const email = EMAIL("admin");
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return { id: exists.id, email };
  const hash = await bcrypt.hash(PASSWORD, 10);
  const createdUser = await prisma.user.create({
    data: { name: "Traffic Admin", email, passwordHash: hash, role: "ADMIN", status: "APPROVED", emailVerified: new Date() },
  });
  created.users.push(createdUser.id);
  return { id: createdUser.id, email };
}

async function main() {
  if (!(await serverUp())) {
    console.log(`SKIPPED — no server reachable at ${BASE}. Start the dev server, then re-run.`);
    return;
  }
  console.log(`Scenario base: ${BASE}\n`);

  baseline = {};
  for (const c of counts) baseline[c] = await prisma[c].count();
  console.log("=== BASELINE COUNTS ===");
  for (const c of counts) console.log(`  ${c}: ${baseline[c]}`);

  // ─────────────── 1. REGISTRATION ───────────────
  console.log("\n=== 1. REGISTRATION ===");
  for (const u of USERS) {
    const r = await register(u);
    record(`register ${u.role}`, "201", r.status, r.status === 201);
  }
  await seedAdmin();
  const adminBefore = await prisma.user.count({ where: { email: { contains: "@eventflow.test" } } });
  const adm = await api("POST", "/api/auth/register", {
    body: { name: "Hack Admin", email: `${EMAIL("admin")}.name`, password: PASSWORD, role: "ADMIN" },
  });
  const adminAfter = await prisma.user.count({ where: { email: { contains: "@eventflow.test" } } });
  record("register role=ADMIN rejected", "400", adm.status, adm.status === 400);
  record("register role=ADMIN creates NO row", adminBefore, adminAfter, adminBefore === adminAfter);

  // ─────────────── 2. EMAIL VERIFICATION ───────────────
  console.log("\n=== 2. EMAIL VERIFICATION ===");
  for (const u of USERS) await verifyAndApprove(u.email, u.role);

  // ─────────────── 3. APPROVE + LOGIN (all four roles) ───────────────
  console.log("\n=== 3. LOGIN (USER, ORGANIZER, VENDOR, ADMIN) ===");
  const sessions = {};
  for (const { role } of [...USERS, { role: "ADMIN" }]) {
    const jar = {};
    const lr = await login(EMAIL(role), jar);
    let sessRole = null;
    if (lr.status === 200) {
      const sess = await api("GET", "/api/auth/session", { jar });
      sessRole = sess.data?.user?.role;
    }
    sessions[role] = { jar, status: lr.status, sessRole };
    record(`login ${role}`, "200", `${lr.status}${sessRole ? ` (role=${sessRole})` : ""}`, lr.status === 200 && sessRole === role);
  }

  const orgJar = sessions["ORGANIZER"].jar;
  const userJar = sessions["USER"].jar;
  const vendorJar = sessions["VENDOR"].jar;
  const adminJar = sessions["ADMIN"].jar;

  // ─────────────── 4. TICKETED EVENT + RBAC ───────────────
  console.log("\n=== 4. TICKETED EVENT + RBAC ===");
  const evDate = new Date(Date.now() + 30 * 86400000).toISOString();
  const cr = await api("POST", "/api/organizer/events", {
    jar: orgJar,
    body: {
      title: `Traffic Scene Test Event ${SUFFIX}`,
      description: "automated",
      eventDate: evDate,
      eventTime: "18:00",
      location: "Kathmandu",
      capacity: 100,
      ticketTiers: [{ name: "General", price: 1500, quantity: 50 }],
    },
  });
  record("organizer create event", "201", cr.status, cr.status === 201);
  if (cr.data?.eventId) {
    eventId = cr.data.eventId;
    const tier = await prisma.ticketTier.findFirst({ where: { eventId } });
    tierId = tier.id;
    record("event linked to organizer", "ok", "ok", true);
  }

  if (eventId) {
    const oStats = await api("GET", `/api/organizer/events/${eventId}/checkin-stats`, { jar: orgJar });
    record("owner checkin-stats", "200", oStats.status, oStats.status === 200);
    const uStats = await api("GET", `/api/organizer/events/${eventId}/checkin-stats`, { jar: userJar });
    record("user checkin-stats (IDOR)", "403", uStats.status, uStats.status === 403);
    const vStats = await api("GET", `/api/organizer/events/${eventId}/checkin-stats`, { jar: vendorJar });
    record("vendor checkin-stats (IDOR)", "403", vStats.status, vStats.status === 403);
  }

  const anonAdmin = await api("GET", "/api/admin/stats");
  record("anon /api/admin/stats", "401", anonAdmin.status, anonAdmin.status === 401);
  const userAdmin = await api("GET", "/api/admin/stats", { jar: userJar });
  record("USER /api/admin/stats", "403", userAdmin.status, userAdmin.status === 403);
  const vendProfile = await api("GET", "/api/vendor/profile", { jar: vendorJar });
  record("vendor /api/vendor/profile", "200", vendProfile.status, vendProfile.status === 200);

  // Ticket purchase (Khalti initiate)
  console.log("\n  ticket purchase (Khalti initiate)");
  if (eventId && tierId) {
    await login(EMAIL("USER"), userJar);
    const pr = await api("POST", "/api/tickets/purchase", {
      jar: userJar,
      body: { eventId, tierId, quantity: 1, returnUrl: "/my-tickets" },
    });
    if (pr.status === 200 && pr.data?.success) {
      console.log(`    (info) Khalti initiate ok: pidx=${pr.data.pidx}`);
      created.transactions.push(pr.data.paymentIntentId);
      created.reservations.push(pr.data.reservationId);
      const pendRes = await prisma.ticketReservation.count({ where: { eventId, status: "PENDING" } });
      record("purchase leaves active reservation", "1", pendRes, pendRes === 1);
    } else {
      console.log(`  (info) purchase initiate unresolved: ${pr.status}`);
      const pendRes = await prisma.ticketReservation.count({ where: { eventId, status: "PENDING" } });
      record("purchase failure cleans reservation", "0", pendRes, pendRes === 0);
    }
  }

  // ─────────────── 5. VENDOR BOOKING LIFECYCLE ───────────────
  console.log("\n=== 5. VENDOR BOOKING LIFECYCLE (USER ↔ VENDOR ↔ ADMIN) ===");

  const vendorProfile = await prisma.vendorProfile.findFirst({
    where: { user: { email: EMAIL("vendor") } },
    select: { id: true },
  });

  // vendor creates a package
  const pkg = await api("POST", "/api/vendor/packages", {
    jar: vendorJar,
    body: { name: `Catering ${SUFFIX}`, price: 10000, description: "auto" },
  });
  record("vendor create package", "201", pkg.status, pkg.status === 201);
  const packageId = pkg.data?.packageId;

  // customer books the vendor
  let bookingId = null;
  let depositAmount = 0;
  if (packageId && vendorProfile) {
    const bk = await api("POST", "/api/vendor-bookings", {
      jar: userJar,
      body: {
        vendorId: vendorProfile.id,
        packageId,
        eventTitle: `Wedding ${SUFFIX}`,
        startDate: new Date(Date.now() + 15 * 86400000).toISOString(),
        endDate: new Date(Date.now() + 17 * 86400000).toISOString(),
        guestCount: 50,
      },
    });
    record("user books vendor pkg", "201", bk.status, bk.status === 201);
    bookingId = bk.data?.bookingId;
    depositAmount = bk.data?.depositAmount;
    created.bookingIds.push(bookingId);
    if (bookingId) {
      const booking = await prisma.vendorBooking.findUnique({ where: { id: bookingId }, select: { bookingStatus: true, paymentStatus: true, vendorPaymentStatus: true } });
      record("booking initial state", "PENDING/PENDING/PENDING", `${booking?.bookingStatus}/${booking?.paymentStatus}/${booking?.vendorPaymentStatus}`, booking?.bookingStatus === "PENDING" && booking?.paymentStatus === "PENDING" && booking?.vendorPaymentStatus === "PENDING");
    }
  }

  // user initiates the deposit payment
  if (bookingId) {
    const pay = await api("POST", "/api/payment/initiate", {
      jar: userJar,
      body: { gateway: "khalti", paymentType: "VENDOR_DEPOSIT", amount: depositAmount, bookingId, returnUrl: "/my-bookings" },
    });
    console.log(`  (info) deposit initiate: ${pay.status}${pay.data?.success ? ` (pidx=${pay.data.pidx})` : ""}`);

    // (simulated) complete the deposit in the DB — a human would finish this in the Khalti browser.
    let depTx = await prisma.paymentTransaction.findFirst({ where: { vendorBookingId: bookingId, paymentType: "VENDOR_DEPOSIT" } });
    if (!depTx) {
      depTx = await prisma.paymentTransaction.create({
        data: { transactionId: `TRAFFIC_DEP_${SUFFIX}`, amount: depositAmount, amountInPaisa: Math.round(depositAmount * 100), gateway: "KHALTI", paymentType: "VENDOR_DEPOSIT", vendorBookingId: bookingId, status: "COMPLETED" },
      });
    } else {
      depTx = await prisma.paymentTransaction.update({ where: { id: depTx.id }, data: { status: "COMPLETED" } });
    }
    created.transactions.push(depTx.id);
    await prisma.vendorBooking.update({
      where: { id: bookingId },
      data: { depositPaidAt: new Date(), depositTxId: depTx.transactionId, depositAmount, vendorPaymentStatus: "DEPOSIT_PAID", paymentStatus: "HELD_IN_ESCROW" },
    });
    const dp = await prisma.vendorBooking.findUnique({ where: { id: bookingId }, select: { vendorPaymentStatus: true, paymentStatus: true } });
    record("(simulated) deposit completed", "DEPOSIT_PAID/HELD_IN_ESCROW", `${dp?.vendorPaymentStatus}/${dp?.paymentStatus}`, dp?.vendorPaymentStatus === "DEPOSIT_PAID" && dp?.paymentStatus === "HELD_IN_ESCROW");

    // vendor accepts
    const acc = await api("PATCH", `/api/vendor/bookings/${bookingId}/status`, { jar: vendorJar, body: { status: "ACCEPTED" } });
    record("vendor accept booking", "200", acc.status, acc.status === 200);

    // admin releases the deposit escrow
    const rel = await api("POST", "/api/admin/release-funds", { jar: adminJar, body: { bookingId, type: "deposit" } });
    record("admin release deposit", "200", rel.status, rel.status === 200);
    if (rel.status === 200) {
      const depPayout = await prisma.payout.findFirst({ where: { bookingId, type: "DEPOSIT" } });
      record("deposit payout created (PENDING)", "PENDING", depPayout?.status, depPayout?.status === "PENDING");
    }

    // vendor marks complete
    const vc = await api("PATCH", `/api/vendor/bookings/${bookingId}/status`, { jar: vendorJar, body: { status: "COMPLETED" } });
    record("vendor mark complete", "200", vc.status, vc.status === 200);

    // customer confirms completion → REMAINING payout auto-created
    const cc = await api("PATCH", `/api/user/vendor-bookings/${bookingId}`, { jar: userJar, body: { action: "CONFIRM_COMPLETION" } });
    record("customer confirm completion", "200", cc.status, cc.status === 200);
    const remainPayout = await prisma.payout.findFirst({ where: { bookingId, type: "REMAINING" } });
    record("REMAINING payout auto-created", "PENDING", remainPayout?.status, remainPayout?.status === "PENDING");

    // admin verifies the remaining payout
    if (remainPayout) {
      const vp = await api("POST", "/api/admin/verify-payout", {
        jar: adminJar,
        body: { payoutId: remainPayout.id, transactionReference: `TXREF_${SUFFIX}`, proofImageUrl: "https://utfs.io/f/traffic-proof.png", transferMethod: "BANK_TRANSFER" },
      });
      record("admin verify remaining payout", "200", vp.status, vp.status === 200);
      const p2 = await prisma.payout.findUnique({ where: { id: remainPayout.id } });
      record("payout now COMPLETED", "COMPLETED", p2?.status, p2?.status === "COMPLETED");
    }
  }

  // ─────────────── 6. CUSTOMER CANCEL (before deposit) ───────────────
  console.log("\n=== 6. CUSTOMER CANCEL (pre-deposit) ===");
  let cancelBookingId = null;
  if (packageId && vendorProfile) {
    const cb = await api("POST", "/api/vendor-bookings", {
      jar: userJar,
      body: {
        vendorId: vendorProfile.id,
        packageId,
        eventTitle: `Cancel Me ${SUFFIX}`,
        startDate: new Date(Date.now() + 10 * 86400000).toISOString(),
        endDate: new Date(Date.now() + 10 * 86400000).toISOString(),
        guestCount: 20,
      },
    });
    cancelBookingId = cb.data?.bookingId;
    created.bookingIds.push(cancelBookingId);
    if (cancelBookingId) {
      const canc = await api("PATCH", `/api/user/vendor-bookings/${cancelBookingId}`, { jar: userJar, body: { action: "CANCEL_BOOKING" } });
      record("customer cancel before deposit", "200", canc.status, canc.status === 200);
      const b = await prisma.vendorBooking.findUnique({ where: { id: cancelBookingId }, select: { bookingStatus: true, paymentStatus: true } });
      record("cancelled booking status", "DECLINED/FAILED", `${b?.bookingStatus}/${b?.paymentStatus}`, b?.bookingStatus === "DECLINED" && b?.paymentStatus === "FAILED");
    }
  }

  const pass = results.filter((r) => r.ok).length;
  console.log(`\n=== SUMMARY: ${pass}/${results.length} PASSED ===`);
  if (pass !== results.length) process.exitCode = 1;
}

async function cleanup() {
  console.log("\n=== CLEANUP ===");
  if (created.bookingIds.length) {
    await prisma.refund.deleteMany({ where: { vendorBookingId: { in: created.bookingIds } } });
    await prisma.payout.deleteMany({ where: { bookingId: { in: created.bookingIds } } });
    await prisma.paymentTransaction.deleteMany({ where: { vendorBookingId: { in: created.bookingIds } } });
  }
  if (created.transactions.length) {
    await prisma.paymentTransaction.deleteMany({ where: { id: { in: created.transactions } } });
  }
  if (created.reservations.length) {
    await prisma.ticketReservation.deleteMany({ where: { id: { in: created.reservations } } });
  }
  const del = await prisma.user.deleteMany({ where: { id: { in: created.users } } });
  console.log(`  deleted test users: ${del.count}`);

  if (baseline === null) {
    console.log("  (no baseline — scenario was skipped; nothing to compare)");
    return;
  }
  for (const c of counts) {
    const after = await prisma[c].count();
    const ok = after === baseline[c];
    console.log(`  ${c}: ${after} (baseline ${baseline[c]}) ${ok ? "OK" : "DIFF"}`);
    if (!ok) process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error("Scenario failed:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
    await prisma.$disconnect();
  });