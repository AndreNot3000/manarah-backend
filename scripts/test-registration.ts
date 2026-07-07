/**
 * BE-041 Integration Tests — Competition registration
 * Run: npm run test:registration
 */

import { CompetitionStatus, CompetitionType } from "@prisma/client";
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

async function seedCompetition(overrides: Partial<{
  title: string;
  fee: number;
  deadline: Date;
  status: CompetitionStatus;
}> = {}) {
  const competition = await prisma.competition.create({
    data: {
      title: overrides.title ?? "Test Competition",
      description: "A test competition",
      fee: overrides.fee ?? 0,
      deadline: overrides.deadline ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      category: "General",
      type: CompetitionType.QURAN_RECITATION,
      status: overrides.status ?? CompetitionStatus.OPEN,
    },
  });
  cleanupCompetitionIds.push(competition.id);
  return competition;
}

async function registerUser(role: "student" | "tutor") {
  const ts = Date.now();
  const endpoint = role === "student" ? "/api/auth/register/student" : "/api/auth/register/tutor";
  const res = await request("POST", endpoint, {
    body: { email: `be041.${role}.${ts}@test.com`, password: "TestPass123", name: `Test ${role}` },
  });
  const userId = b(b(res.body).user).id as string;
  cleanupUserIds.push(userId);
  return { token: b(res.body).token as string, userId };
}

async function run() {
  console.log(`\nBE-041 Test Suite — ${BASE}\n${"=".repeat(50)}\n`);

  const health = await request("GET", "/api/health");
  if (health.status !== 200) {
    console.log("Server not reachable. Start with: npm run dev\n");
    process.exit(1);
  }

  // Fixtures
  const student = await registerUser("student");
  const student2 = await registerUser("student");
  const tutor = await registerUser("tutor");

  const openFree = await seedCompetition({ title: "Open Free Comp", fee: 0 });
  const openPaid = await seedCompetition({ title: "Open Paid Comp", fee: 100 });
  const closedComp = await seedCompetition({ title: "Closed Comp", status: CompetitionStatus.CLOSED });
  const pastDeadline = await seedCompetition({
    title: "Past Deadline",
    deadline: new Date(Date.now() - 1000),
  });

  // -----------------------------------------------------------------------
  // 41.1 — Successful registration (free competition)
  // -----------------------------------------------------------------------
  const regFree = await request("POST", `/api/competitions/${openFree.id}/register`, {
    token: student.token,
  });
  const regFreeBody = b(b(regFree.body).registration);
  record(
    "41.1",
    "Register for free competition → paymentStatus CONFIRMED",
    regFree.status === 201 &&
      regFreeBody.competitionId === openFree.id &&
      regFreeBody.paymentStatus === "CONFIRMED" &&
      regFreeBody.status === "PENDING",
    "201, paymentStatus=CONFIRMED",
    `${regFree.status} paymentStatus=${regFreeBody.paymentStatus}`
  );

  // -----------------------------------------------------------------------
  // 41.2 — Successful registration (paid competition)
  // -----------------------------------------------------------------------
  const regPaid = await request("POST", `/api/competitions/${openPaid.id}/register`, {
    token: student.token,
  });
  const regPaidBody = b(b(regPaid.body).registration);
  record(
    "41.2",
    "Register for paid competition → paymentStatus PENDING",
    regPaid.status === 201 &&
      regPaidBody.competitionId === openPaid.id &&
      regPaidBody.paymentStatus === "PENDING",
    "201, paymentStatus=PENDING",
    `${regPaid.status} paymentStatus=${regPaidBody.paymentStatus}`
  );

  // -----------------------------------------------------------------------
  // 41.3 — Notification sent after registration
  // -----------------------------------------------------------------------
  const notifs = await request("GET", "/api/notifications", { token: student.token });
  const notifList = b(notifs.body).notifications as Record<string, unknown>[];
  const hasRegNotif = notifList?.some((n) => n.title === "Competition Registration");
  record(
    "41.3",
    "Notification sent to user after registration",
    notifs.status === 200 && hasRegNotif,
    "notification with title 'Competition Registration'",
    `${notifs.status} hasNotif=${hasRegNotif}`
  );

  // -----------------------------------------------------------------------
  // 41.4 — Duplicate registration returns 409
  // -----------------------------------------------------------------------
  const duplicate = await request("POST", `/api/competitions/${openFree.id}/register`, {
    token: student.token,
  });
  record(
    "41.4",
    "Duplicate registration returns 409",
    duplicate.status === 409 && b(duplicate.body).code === "ALREADY_REGISTERED",
    "409 ALREADY_REGISTERED",
    `${duplicate.status} code=${b(duplicate.body).code}`
  );

  // -----------------------------------------------------------------------
  // 41.5 — Closed competition returns 400
  // -----------------------------------------------------------------------
  const regClosed = await request("POST", `/api/competitions/${closedComp.id}/register`, {
    token: student.token,
  });
  record(
    "41.5",
    "Registration on CLOSED competition returns 400",
    regClosed.status === 400 && b(regClosed.body).code === "COMPETITION_NOT_OPEN",
    "400 COMPETITION_NOT_OPEN",
    `${regClosed.status} code=${b(regClosed.body).code}`
  );

  // -----------------------------------------------------------------------
  // 41.6 — Past deadline returns 400
  // -----------------------------------------------------------------------
  const regPast = await request("POST", `/api/competitions/${pastDeadline.id}/register`, {
    token: student.token,
  });
  record(
    "41.6",
    "Registration past deadline returns 400",
    regPast.status === 400 && b(regPast.body).code === "DEADLINE_PASSED",
    "400 DEADLINE_PASSED",
    `${regPast.status} code=${b(regPast.body).code}`
  );

  // -----------------------------------------------------------------------
  // 41.7 — Unauthenticated returns 401
  // -----------------------------------------------------------------------
  const regUnauth = await request("POST", `/api/competitions/${openFree.id}/register`);
  record(
    "41.7",
    "Unauthenticated registration returns 401",
    regUnauth.status === 401,
    "401 Unauthorized",
    `${regUnauth.status}`
  );

  // -----------------------------------------------------------------------
  // 41.8 — Tutor can also register (any authenticated user can)
  // -----------------------------------------------------------------------
  const regTutor = await request("POST", `/api/competitions/${openFree.id}/register`, {
    token: tutor.token,
  });
  record(
    "41.8",
    "Tutor can register for competition",
    regTutor.status === 201,
    "201",
    `${regTutor.status}`
  );

  // -----------------------------------------------------------------------
  // 41.9 — Non-existent competition returns 404
  // -----------------------------------------------------------------------
  const regNotFound = await request("POST", "/api/competitions/nonexistent-xyz/register", {
    token: student.token,
  });
  record(
    "41.9",
    "Non-existent competition returns 404",
    regNotFound.status === 404 && b(regNotFound.body).code === "COMPETITION_NOT_FOUND",
    "404 COMPETITION_NOT_FOUND",
    `${regNotFound.status} code=${b(regNotFound.body).code}`
  );

  // -----------------------------------------------------------------------
  // 41.10 — Registration appears in /competitions/my
  // -----------------------------------------------------------------------
  const my = await request("GET", "/api/competitions/my", { token: student.token });
  const myRegs = b(my.body).registrations as Record<string, unknown>[];
  const hasReg = myRegs?.some((r) => b(r.competition as unknown).id === openFree.id);
  record(
    "41.10",
    "Registration appears in GET /competitions/my",
    my.status === 200 && hasReg,
    "registration in /my list",
    `${my.status} hasReg=${hasReg}`
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
  console.log("\nAll BE-041 tests passed.\n");
}

run().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
