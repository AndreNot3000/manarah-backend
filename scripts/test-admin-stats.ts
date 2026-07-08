/**
 * BE-050 Integration Tests — Admin stats endpoint
 * Run: npm run test:admin-stats
 */

import { CompetitionStatus, CompetitionType, TutorStatus } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

const BASE = process.env.API_URL ?? "http://localhost:4000";

interface TestResult {
  id: string;
  name: string;
  pass: boolean;
  expected: string;
  actual: string;
}

const results: TestResult[] = [];
const cleanupCompetitionIds: string[] = [];
const cleanupUserIds: string[] = [];

function record(id: string, name: string, pass: boolean, expected: string, actual: string) {
  results.push({ id, name, pass, expected, actual });
  console.log(`[${pass ? "PASS" : "FAIL"}] ${id} ${name}`);
  if (!pass) {
    console.log(`       Expected: ${expected}`);
    console.log(`       Actual:   ${actual}`);
  }
}

async function request(
  method: string,
  urlPath: string,
  options: { token?: string; body?: unknown } = {}
): Promise<{ status: number; body: unknown }> {
  const headers: Record<string, string> = {};
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE}${urlPath}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  let parsed: unknown = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  return { status: res.status, body: parsed };
}

function b(value: unknown): Record<string, unknown> {
  return (value ?? {}) as Record<string, unknown>;
}

async function registerUser(role: "student" | "tutor" | "admin") {
  const ts = Date.now() + Math.random();
  let res;

  if (role === "admin") {
    // Create admin user directly via DB
    const user = await prisma.user.create({
      data: {
        email: `be050.admin.${ts}@test.com`,
        passwordHash: await import("../src/utils/password").then((m) =>
          m.hashPassword("TestPass123")
        ),
        role: "ADMIN",
      },
    });
    cleanupUserIds.push(user.id);

    const loginRes = await request("POST", "/api/auth/login", {
      body: { email: user.email, password: "TestPass123" },
    });

    return { token: b(loginRes.body).token as string, userId: user.id };
  }

  const endpoint = role === "student" ? "/api/auth/register/student" : "/api/auth/register/tutor";
  res = await request("POST", endpoint, {
    body: { email: `be050.${role}.${ts}@test.com`, password: "TestPass123", name: `BE050 ${role}` },
  });

  const userId = b(b(res.body).user).id as string;
  cleanupUserIds.push(userId);
  return { token: b(res.body).token as string, userId };
}

async function seedCompetition() {
  const comp = await prisma.competition.create({
    data: {
      title: "BE050 Test Competition",
      description: "Stats test",
      fee: 0,
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      category: "General",
      type: CompetitionType.QURAN_RECITATION,
      status: CompetitionStatus.OPEN,
    },
  });
  cleanupCompetitionIds.push(comp.id);
  return comp;
}

async function run() {
  console.log(`\nBE-050 Test Suite — ${BASE}\n${"=".repeat(50)}\n`);

  const health = await request("GET", "/api/health");
  if (health.status !== 200) {
    console.log("Server not reachable. Start with: npm run dev\n");
    process.exit(1);
  }

  // Baseline — count existing data before creating fixtures
  const baselineCountsRes = await prisma.$transaction([
    prisma.user.count(),
    prisma.user.count({ where: { role: "STUDENT" } }),
    prisma.user.count({ where: { role: "TUTOR" } }),
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.competition.count(),
    prisma.competitionRegistration.count(),
    prisma.tutorProfile.count({ where: { status: TutorStatus.PENDING } }),
    prisma.payment.count({ where: { status: "PENDING" } }),
  ]);

  const [
    baselineUsers,
    baselineStudents,
    baselineTutors,
    baselineAdmins,
    baselineComps,
    baselineRegs,
    baselinePendingTutors,
    baselinePendingPayments,
  ] = baselineCountsRes;

  // Create fixtures
  const admin = await registerUser("admin");
  const student = await registerUser("student");
  const tutor = await registerUser("tutor");
  const comp = await seedCompetition();

  // Register student for competition
  await request("POST", `/api/competitions/${comp.id}/register`, { token: student.token });

  // Create a pending payment
  await prisma.payment.create({
    data: {
      userId: student.userId,
      competitionId: comp.id,
      amount: 50,
      status: "PENDING",
    },
  });

  // -----------------------------------------------------------------------
  // 50.1 — Non-admin cannot access
  // -----------------------------------------------------------------------
  const studentStats = await request("GET", "/api/admin/stats", { token: student.token });
  record(
    "50.1",
    "Non-admin (student) cannot access",
    studentStats.status === 403,
    "403 Forbidden",
    `${studentStats.status}`
  );

  // -----------------------------------------------------------------------
  // 50.2 — Tutor cannot access
  // -----------------------------------------------------------------------
  const tutorStats = await request("GET", "/api/admin/stats", { token: tutor.token });
  record(
    "50.2",
    "Non-admin (tutor) cannot access",
    tutorStats.status === 403,
    "403 Forbidden",
    `${tutorStats.status}`
  );

  // -----------------------------------------------------------------------
  // 50.3 — Unauthenticated cannot access
  // -----------------------------------------------------------------------
  const unauthStats = await request("GET", "/api/admin/stats");
  record(
    "50.3",
    "Unauthenticated cannot access",
    unauthStats.status === 401,
    "401 Unauthorized",
    `${unauthStats.status}`
  );

  // -----------------------------------------------------------------------
  // 50.4 — Admin can access and gets stats
  // -----------------------------------------------------------------------
  const adminStatsRes = await request("GET", "/api/admin/stats", { token: admin.token });
  const stats = b(b(adminStatsRes.body).stats);
  record(
    "50.4",
    "Admin receives stats with correct shape",
    adminStatsRes.status === 200 &&
      typeof stats.totalUsers === "number" &&
      typeof stats.students === "number" &&
      typeof stats.tutors === "number" &&
      typeof stats.admins === "number" &&
      typeof stats.competitions === "number" &&
      typeof stats.registrations === "number" &&
      typeof stats.pendingTutors === "number" &&
      typeof stats.pendingPayments === "number",
    "200 with all stat fields",
    `${adminStatsRes.status} keys=${JSON.stringify(Object.keys(stats))}`
  );

  // -----------------------------------------------------------------------
  // 50.5 — Stats reflect actual counts
  // -----------------------------------------------------------------------
  const expectedUsers = baselineUsers + 3; // admin, student, tutor
  const expectedStudents = baselineStudents + 1;
  const expectedTutors = baselineTutors + 1;
  const expectedAdmins = baselineAdmins + 1;
  const expectedComps = baselineComps + 1;
  const expectedRegs = baselineRegs + 1;
  const expectedPendingTutors = baselinePendingTutors + 1; // new tutor is PENDING by default
  const expectedPendingPayments = baselinePendingPayments + 1;

  const countsMatch =
    stats.totalUsers === expectedUsers &&
    stats.students === expectedStudents &&
    stats.tutors === expectedTutors &&
    stats.admins === expectedAdmins &&
    stats.competitions === expectedComps &&
    stats.registrations === expectedRegs &&
    stats.pendingTutors === expectedPendingTutors &&
    stats.pendingPayments === expectedPendingPayments;

  record(
    "50.5",
    "Stats reflect actual database counts",
    countsMatch,
    `users=${expectedUsers}, students=${expectedStudents}, tutors=${expectedTutors}, admins=${expectedAdmins}, comps=${expectedComps}, regs=${expectedRegs}, pendingTutors=${expectedPendingTutors}, pendingPayments=${expectedPendingPayments}`,
    `users=${stats.totalUsers}, students=${stats.students}, tutors=${stats.tutors}, admins=${stats.admins}, comps=${stats.competitions}, regs=${stats.registrations}, pendingTutors=${stats.pendingTutors}, pendingPayments=${stats.pendingPayments}`
  );

  // -----------------------------------------------------------------------
  // Summary & cleanup
  // -----------------------------------------------------------------------
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;

  console.log(`\n${"=".repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed, ${results.length} total`);

  await prisma.competition.deleteMany({ where: { id: { in: cleanupCompetitionIds } } });
  await prisma.user.deleteMany({ where: { id: { in: cleanupUserIds } } });
  await prisma.$disconnect();

  if (failed > 0) process.exit(1);
  console.log("\nAll BE-050 tests passed.\n");
}

run().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
