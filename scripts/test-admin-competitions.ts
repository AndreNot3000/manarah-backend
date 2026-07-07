/**
 * BE-052 Integration Tests — Admin competition CRUD
 * Run: npm run test:admin-competitions
 */

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
): Promise<{ status: number; body: unknown; text?: string }> {
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
  return { status: res.status, body: parsed, text };
}

function b(value: unknown): Record<string, unknown> {
  return (value ?? {}) as Record<string, unknown>;
}

async function createAdmin() {
  const ts = Date.now() + Math.random();
  const user = await prisma.user.create({
    data: {
      email: `be052.admin.${ts}@test.com`,
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

async function registerStudent() {
  const ts = Date.now() + Math.random();
  const res = await request("POST", "/api/auth/register/student", {
    body: { email: `be052.student.${ts}@test.com`, password: "TestPass123", name: "BE052 Student" },
  });
  const userId = b(b(res.body).user).id as string;
  cleanupUserIds.push(userId);
  return { token: b(res.body).token as string, userId };
}

const futureDeadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

async function run() {
  console.log(`\nBE-052 Test Suite — ${BASE}\n${"=".repeat(50)}\n`);

  const health = await request("GET", "/api/health");
  if (health.status !== 200) {
    console.log("Server not reachable. Start with: npm run dev\n");
    process.exit(1);
  }

  const admin = await createAdmin();
  const student = await registerStudent();
  const student2 = await registerStudent();

  // -----------------------------------------------------------------------
  // 52.1 — Create competition
  // -----------------------------------------------------------------------
  const createRes = await request("POST", "/api/admin/competitions", {
    token: admin.token,
    body: {
      title: "Quran Recitation Championship",
      description: "Annual Quran recitation competition for all ages",
      fee: 25,
      deadline: futureDeadline,
      category: "Quran",
      type: "QURAN_RECITATION",
      status: "OPEN",
    },
  });
  const comp = b(b(createRes.body).competition);
  const compId = comp.id as string;
  if (compId) cleanupCompetitionIds.push(compId);

  record(
    "52.1",
    "Admin creates competition",
    createRes.status === 201 &&
      comp.title === "Quran Recitation Championship" &&
      comp.fee === "25" &&
      comp.status === "OPEN" &&
      comp.type === "QURAN_RECITATION",
    "201 with competition object",
    `${createRes.status} title=${comp.title} status=${comp.status}`
  );

  // -----------------------------------------------------------------------
  // 52.2 — Non-admin cannot create competition
  // -----------------------------------------------------------------------
  const nonAdminCreate = await request("POST", "/api/admin/competitions", {
    token: student.token,
    body: { title: "Hack", description: "x", fee: 0, deadline: futureDeadline, category: "x", type: "HIFZ" },
  });
  record(
    "52.2",
    "Non-admin cannot create competition",
    nonAdminCreate.status === 403,
    "403 Forbidden",
    `${nonAdminCreate.status}`
  );

  // -----------------------------------------------------------------------
  // 52.3 — Validation rejects missing required fields
  // -----------------------------------------------------------------------
  const badCreate = await request("POST", "/api/admin/competitions", {
    token: admin.token,
    body: { title: "", fee: -1 },
  });
  record(
    "52.3",
    "Validation rejects bad input",
    badCreate.status === 400,
    "400 validation error",
    `${badCreate.status}`
  );

  // -----------------------------------------------------------------------
  // 52.4 — Update competition
  // -----------------------------------------------------------------------
  const updateRes = await request("PUT", `/api/admin/competitions/${compId}`, {
    token: admin.token,
    body: { title: "Updated Championship", status: "CLOSED" },
  });
  const updatedComp = b(b(updateRes.body).competition);
  record(
    "52.4",
    "Admin updates competition",
    updateRes.status === 200 &&
      updatedComp.title === "Updated Championship" &&
      updatedComp.status === "CLOSED",
    "200 title/status updated",
    `${updateRes.status} title=${updatedComp.title} status=${updatedComp.status}`
  );

  // -----------------------------------------------------------------------
  // 52.5 — Update non-existent competition returns 404
  // -----------------------------------------------------------------------
  const notFoundUpdate = await request("PUT", "/api/admin/competitions/nonexistent-xyz", {
    token: admin.token,
    body: { title: "Ghost" },
  });
  record(
    "52.5",
    "Update non-existent competition returns 404",
    notFoundUpdate.status === 404 && b(notFoundUpdate.body).code === "COMPETITION_NOT_FOUND",
    "404 COMPETITION_NOT_FOUND",
    `${notFoundUpdate.status} code=${b(notFoundUpdate.body).code}`
  );

  // Re-open the competition to allow registrations
  await request("PUT", `/api/admin/competitions/${compId}`, {
    token: admin.token,
    body: { status: "OPEN" },
  });

  // Register 2 students
  await request("POST", `/api/competitions/${compId}/register`, { token: student.token });
  await request("POST", `/api/competitions/${compId}/register`, { token: student2.token });

  // -----------------------------------------------------------------------
  // 52.6 — GET participants as JSON
  // -----------------------------------------------------------------------
  const participantsRes = await request("GET", `/api/admin/competitions/${compId}/participants`, {
    token: admin.token,
  });
  const participants = b(participantsRes.body).participants as Record<string, unknown>[];
  record(
    "52.6",
    "Admin gets participants as JSON",
    participantsRes.status === 200 &&
      Array.isArray(participants) &&
      participants.length === 2 &&
      typeof participants[0].name === "string" &&
      typeof participants[0].email === "string",
    "200 with 2 participants",
    `${participantsRes.status} count=${participants?.length}`
  );

  // -----------------------------------------------------------------------
  // 52.7 — GET participants as CSV
  // -----------------------------------------------------------------------
  const csvRes = await request(
    "GET",
    `/api/admin/competitions/${compId}/participants?format=csv`,
    { token: admin.token }
  );
  const csvText = csvRes.text ?? "";
  const csvLines = csvText.trim().split("\n");
  record(
    "52.7",
    "Admin exports participants as CSV",
    csvRes.status === 200 &&
      csvLines[0].includes("registrationId") &&
      csvLines[0].includes("email") &&
      csvLines.length === 3, // header + 2 rows
    "200 CSV with header + 2 rows",
    `${csvRes.status} lines=${csvLines.length} header=${csvLines[0]?.substring(0, 30)}`
  );

  // -----------------------------------------------------------------------
  // 52.8 — Publish results
  // -----------------------------------------------------------------------
  const publishRes = await request("POST", `/api/admin/competitions/${compId}/results`, {
    token: admin.token,
    body: {
      winners: [
        { userId: student.userId, placement: 1 },
        { userId: student2.userId, placement: 2 },
      ],
      published: true,
    },
  });
  const publishedComp = b(b(publishRes.body).competition);
  record(
    "52.8",
    "Admin publishes results",
    publishRes.status === 200 && publishedComp.status === "RESULTS_PUBLISHED",
    "200 status=RESULTS_PUBLISHED",
    `${publishRes.status} status=${publishedComp.status}`
  );

  // -----------------------------------------------------------------------
  // 52.9 — Participants receive notifications after publish
  // -----------------------------------------------------------------------
  const notifs1 = await request("GET", "/api/notifications", { token: student.token });
  const notifList1 = b(notifs1.body).notifications as Record<string, unknown>[];
  const hasWinnerNotif = notifList1?.some(
    (n) =>
      n.title === "Competition Results Published" &&
      String(n.body).includes("placed #1")
  );
  record(
    "52.9",
    "Winner receives placement notification",
    notifs1.status === 200 && hasWinnerNotif,
    "notification with placement #1",
    `${notifs1.status} hasWinnerNotif=${hasWinnerNotif}`
  );

  // -----------------------------------------------------------------------
  // 52.10 — Status visible on public competition detail after publish
  // -----------------------------------------------------------------------
  const publicDetail = await request("GET", `/api/competitions/${compId}`);
  const publicStatus = b(b(publicDetail.body).competition).status;
  record(
    "52.10",
    "Published status visible on public detail",
    publicDetail.status === 200 && publicStatus === "RESULTS_PUBLISHED",
    "status=RESULTS_PUBLISHED",
    `${publicDetail.status} status=${publicStatus}`
  );

  // -----------------------------------------------------------------------
  // 52.11 — Publish with invalid winner userId returns 400
  // -----------------------------------------------------------------------
  const badWinner = await request("POST", `/api/admin/competitions/${compId}/results`, {
    token: admin.token,
    body: {
      winners: [{ userId: "nonexistent-user-xyz", placement: 1 }],
      published: true,
    },
  });
  record(
    "52.11",
    "Publish with unregistered winner returns 400",
    badWinner.status === 400 && b(badWinner.body).code === "INVALID_WINNERS",
    "400 INVALID_WINNERS",
    `${badWinner.status} code=${b(badWinner.body).code}`
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
  console.log("\nAll BE-052 tests passed.\n");
}

run().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
