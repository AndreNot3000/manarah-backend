/**
 * BE-040 Integration Tests — Competition public endpoints
 * Run: npm run test:competitions
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
  description: string;
  fee: number;
  deadline: Date;
  category: string;
  type: CompetitionType;
  status: CompetitionStatus;
}> = {}) {
  const competition = await prisma.competition.create({
    data: {
      title: overrides.title ?? "Test Competition",
      description: overrides.description ?? "A test competition",
      fee: overrides.fee ?? 0,
      deadline: overrides.deadline ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      category: overrides.category ?? "General",
      type: overrides.type ?? CompetitionType.QURAN_RECITATION,
      status: overrides.status ?? CompetitionStatus.OPEN,
    },
  });
  cleanupCompetitionIds.push(competition.id);
  return competition;
}

async function run() {
  console.log(`\nBE-040 Test Suite — ${BASE}\n${"=".repeat(50)}\n`);

  const health = await request("GET", "/api/health");
  if (health.status !== 200) {
    console.log("Server not reachable. Start with: npm run dev\n");
    process.exit(1);
  }

  // Seed competitions
  const openComp = await seedCompetition({
    title: "Quran Recitation Open",
    type: CompetitionType.QURAN_RECITATION,
    status: CompetitionStatus.OPEN,
    fee: 50,
  });
  const hifzComp = await seedCompetition({
    title: "Hifz Championship",
    type: CompetitionType.HIFZ,
    status: CompetitionStatus.OPEN,
    fee: 0,
  });
  const closedComp = await seedCompetition({
    title: "Closed Arabic",
    type: CompetitionType.ARABIC_COMPETITION,
    status: CompetitionStatus.CLOSED,
  });

  // Register a student
  const studentReg = await request("POST", "/api/auth/register/student", {
    body: { email: `be040.student.${Date.now()}@test.com`, password: "TestPass123", name: "Test Student" },
  });
  const studentToken = b(studentReg.body).token as string;
  const studentId = b(b(studentReg.body).user).id as string;
  cleanupUserIds.push(studentId);

  // Register student for openComp directly via DB
  await prisma.competitionRegistration.create({
    data: { competitionId: openComp.id, userId: studentId },
  });

  // -----------------------------------------------------------------------
  // 40.1 — Public listing (no auth)
  // -----------------------------------------------------------------------
  const list = await request("GET", "/api/competitions");
  const competitions = b(list.body).competitions as Record<string, unknown>[];
  const meta = b(list.body).meta as Record<string, unknown>;
  record(
    "40.1",
    "Public listing returns competitions",
    list.status === 200 && Array.isArray(competitions) && typeof meta.total === "number",
    "200 with competitions array and meta",
    `${list.status} count=${competitions?.length}`
  );

  // -----------------------------------------------------------------------
  // 40.2 — Filter by type
  // -----------------------------------------------------------------------
  const byType = await request("GET", `/api/competitions?type=${CompetitionType.HIFZ}`);
  const byTypeList = b(byType.body).competitions as Record<string, unknown>[];
  const allHifz = byTypeList?.every((c) => c.type === CompetitionType.HIFZ);
  const hasHifzComp = byTypeList?.some((c) => c.id === hifzComp.id);
  record(
    "40.2",
    "Filter by type works",
    byType.status === 200 && allHifz && hasHifzComp,
    `all type=HIFZ, includes hifzComp`,
    `${byType.status} allHifz=${allHifz} hasHifzComp=${hasHifzComp}`
  );

  // -----------------------------------------------------------------------
  // 40.3 — Filter by status
  // -----------------------------------------------------------------------
  const byStatus = await request("GET", `/api/competitions?status=${CompetitionStatus.CLOSED}`);
  const byStatusList = b(byStatus.body).competitions as Record<string, unknown>[];
  const allClosed = byStatusList?.every((c) => c.status === CompetitionStatus.CLOSED);
  const hasClosedComp = byStatusList?.some((c) => c.id === closedComp.id);
  record(
    "40.3",
    "Filter by status works",
    byStatus.status === 200 && allClosed && hasClosedComp,
    "all status=CLOSED, includes closedComp",
    `${byStatus.status} allClosed=${allClosed} hasClosedComp=${hasClosedComp}`
  );

  // -----------------------------------------------------------------------
  // 40.4 — Response shape includes fee as string, deadline as ISO date
  // -----------------------------------------------------------------------
  const openItem = competitions?.find((c) => c.id === openComp.id);
  record(
    "40.4",
    "fee returned as string, deadline as ISO date",
    !!openItem &&
      typeof openItem.fee === "string" &&
      typeof openItem.deadline === "string" &&
      !isNaN(Date.parse(openItem.deadline as string)),
    "fee=string, deadline=ISO string",
    `fee=${typeof openItem?.fee} deadline=${openItem?.deadline}`
  );

  // -----------------------------------------------------------------------
  // 40.5 — GET /competitions/:id (no auth) returns detail
  // -----------------------------------------------------------------------
  const detail = await request("GET", `/api/competitions/${openComp.id}`);
  const comp = b(b(detail.body).competition);
  record(
    "40.5",
    "Public detail endpoint returns competition",
    detail.status === 200 &&
      comp.id === openComp.id &&
      typeof comp.registrationCount === "number",
    "200 with competition detail",
    `${detail.status} id=${comp.id}`
  );

  // -----------------------------------------------------------------------
  // 40.6 — GET /competitions/:id (with auth) includes userRegistration
  // -----------------------------------------------------------------------
  const detailAuth = await request("GET", `/api/competitions/${openComp.id}`, {
    token: studentToken,
  });
  const compAuth = b(b(detailAuth.body).competition);
  const userReg = b(compAuth.userRegistration);
  record(
    "40.6",
    "Authenticated detail includes userRegistration",
    detailAuth.status === 200 && typeof userReg.id === "string",
    "userRegistration present",
    `${detailAuth.status} userReg.id=${userReg.id}`
  );

  // -----------------------------------------------------------------------
  // 40.7 — GET /competitions/:id (with auth) no registration = no userRegistration
  // -----------------------------------------------------------------------
  const detailNoReg = await request("GET", `/api/competitions/${hifzComp.id}`, {
    token: studentToken,
  });
  const compNoReg = b(b(detailNoReg.body).competition);
  record(
    "40.7",
    "No registration = userRegistration absent",
    detailNoReg.status === 200 && compNoReg.userRegistration === undefined,
    "userRegistration=undefined",
    `${detailNoReg.status} userReg=${JSON.stringify(compNoReg.userRegistration)}`
  );

  // -----------------------------------------------------------------------
  // 40.8 — GET /competitions/:id for non-existent returns 404
  // -----------------------------------------------------------------------
  const notFound = await request("GET", "/api/competitions/nonexistent-id-xyz");
  record(
    "40.8",
    "Non-existent competition returns 404",
    notFound.status === 404 && b(notFound.body).code === "COMPETITION_NOT_FOUND",
    "404 COMPETITION_NOT_FOUND",
    `${notFound.status}`
  );

  // -----------------------------------------------------------------------
  // 40.9 — GET /competitions/my returns student registrations
  // -----------------------------------------------------------------------
  const my = await request("GET", "/api/competitions/my", { token: studentToken });
  const myRegs = b(my.body).registrations as Record<string, unknown>[];
  const myMeta = b(my.body).meta;
  record(
    "40.9",
    "GET /competitions/my returns registrations",
    my.status === 200 &&
      Array.isArray(myRegs) &&
      myRegs.some((r) => b(r.competition as unknown).id === openComp.id) &&
      !!myMeta,
    "200 with registrations including openComp",
    `${my.status} count=${myRegs?.length}`
  );

  // -----------------------------------------------------------------------
  // 40.10 — GET /competitions/my requires auth
  // -----------------------------------------------------------------------
  const myUnauth = await request("GET", "/api/competitions/my");
  record(
    "40.10",
    "GET /competitions/my requires auth",
    myUnauth.status === 401,
    "401 Unauthorized",
    `${myUnauth.status}`
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
  console.log("\nAll BE-040 tests passed.\n");
}

run().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
