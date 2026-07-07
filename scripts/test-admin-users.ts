/**
 * BE-051 Integration Tests — Admin user & tutor management
 * Run: npm run test:admin-users
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

  if (role === "admin") {
    const user = await prisma.user.create({
      data: {
        email: `be051.admin.${ts}@test.com`,
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
    return { token: b(loginRes.body).token as string, userId: user.id, email: user.email };
  }

  const endpoint = role === "student" ? "/api/auth/register/student" : "/api/auth/register/tutor";
  const res = await request("POST", endpoint, {
    body: {
      email: `be051.${role}.${ts}@test.com`,
      password: "TestPass123",
      name: `BE051 ${role}`,
    },
  });
  const userId = b(b(res.body).user).id as string;
  cleanupUserIds.push(userId);
  return { token: b(res.body).token as string, userId, email: `be051.${role}.${ts}@test.com` };
}

async function run() {
  console.log(`\nBE-051 Test Suite — ${BASE}\n${"=".repeat(50)}\n`);

  const health = await request("GET", "/api/health");
  if (health.status !== 200) {
    console.log("Server not reachable. Start with: npm run dev\n");
    process.exit(1);
  }

  const admin = await registerUser("admin");
  const student = await registerUser("student");
  const tutor = await registerUser("tutor");

  // -----------------------------------------------------------------------
  // 51.1 — GET /admin/users returns paginated user list
  // -----------------------------------------------------------------------
  const listRes = await request("GET", "/api/admin/users", { token: admin.token });
  const users = b(listRes.body).users as Record<string, unknown>[];
  const meta = b(b(listRes.body).meta);
  record(
    "51.1",
    "Admin GET /users returns paginated list",
    listRes.status === 200 &&
      Array.isArray(users) &&
      typeof meta.total === "number" &&
      typeof meta.page === "number" &&
      typeof meta.limit === "number",
    "200 with users array and meta",
    `${listRes.status} count=${users?.length} total=${meta.total}`
  );

  // -----------------------------------------------------------------------
  // 51.2 — Response includes id, email, role, name, createdAt
  // -----------------------------------------------------------------------
  const testUser = users?.find((u) => u.id === student.userId);
  record(
    "51.2",
    "User list item has correct shape",
    !!testUser &&
      typeof testUser.id === "string" &&
      typeof testUser.email === "string" &&
      typeof testUser.role === "string" &&
      typeof testUser.name === "string" &&
      typeof testUser.createdAt === "string",
    "id, email, role, name, createdAt present",
    JSON.stringify(Object.keys(testUser ?? {}))
  );

  // -----------------------------------------------------------------------
  // 51.3 — Filter by role=STUDENT returns only students
  // -----------------------------------------------------------------------
  const studentList = await request("GET", "/api/admin/users?role=STUDENT", {
    token: admin.token,
  });
  const studentUsers = b(studentList.body).users as Record<string, unknown>[];
  const allStudents = studentUsers?.every((u) => u.role === "STUDENT");
  record(
    "51.3",
    "Filter by role=STUDENT returns only students",
    studentList.status === 200 && allStudents,
    "all role=STUDENT",
    `${studentList.status} allStudents=${allStudents} count=${studentUsers?.length}`
  );

  // -----------------------------------------------------------------------
  // 51.4 — Filter by role=TUTOR returns only tutors (includes status field)
  // -----------------------------------------------------------------------
  const tutorList = await request("GET", "/api/admin/users?role=TUTOR", {
    token: admin.token,
  });
  const tutorUsers = b(tutorList.body).users as Record<string, unknown>[];
  const allTutors = tutorUsers?.every((u) => u.role === "TUTOR");
  const tutorItem = tutorUsers?.find((u) => u.id === tutor.userId);
  record(
    "51.4",
    "Filter by role=TUTOR returns only tutors with status",
    tutorList.status === 200 && allTutors && tutorItem?.status === "PENDING",
    "all role=TUTOR, status=PENDING for new tutor",
    `${tutorList.status} allTutors=${allTutors} tutorStatus=${tutorItem?.status}`
  );

  // -----------------------------------------------------------------------
  // 51.5 — Pagination works (limit=1)
  // -----------------------------------------------------------------------
  const pageRes = await request("GET", "/api/admin/users?page=1&limit=1", {
    token: admin.token,
  });
  const pageUsers = b(pageRes.body).users as Record<string, unknown>[];
  const pageMeta = b(b(pageRes.body).meta);
  record(
    "51.5",
    "Pagination limit=1 returns 1 user",
    pageRes.status === 200 && pageUsers?.length === 1 && pageMeta.limit === 1,
    "1 user returned",
    `${pageRes.status} count=${pageUsers?.length} limit=${pageMeta.limit}`
  );

  // -----------------------------------------------------------------------
  // 51.6 — Non-admin cannot list users
  // -----------------------------------------------------------------------
  const studentListAttempt = await request("GET", "/api/admin/users", {
    token: student.token,
  });
  record(
    "51.6",
    "Non-admin cannot list users",
    studentListAttempt.status === 403,
    "403 Forbidden",
    `${studentListAttempt.status}`
  );

  // -----------------------------------------------------------------------
  // 51.7 — PATCH /admin/tutors/:id/verify with status=VERIFIED
  // -----------------------------------------------------------------------
  const verifyRes = await request("PATCH", `/api/admin/tutors/${tutor.userId}/verify`, {
    token: admin.token,
    body: { status: "VERIFIED" },
  });
  const verifiedTutor = b(b(verifyRes.body).tutor);
  record(
    "51.7",
    "Admin can verify a tutor",
    verifyRes.status === 200 &&
      verifiedTutor.id === tutor.userId &&
      verifiedTutor.status === "VERIFIED",
    "200 tutor.status=VERIFIED",
    `${verifyRes.status} status=${verifiedTutor.status}`
  );

  // -----------------------------------------------------------------------
  // 51.8 — Verified tutor now shows in public tutor listing
  // -----------------------------------------------------------------------
  const publicList = await request("GET", "/api/tutors");
  const publicTutors = b(publicList.body).tutors as Record<string, unknown>[];
  const tutorPublic = publicTutors?.some((t) => t.id === tutor.userId);
  record(
    "51.8",
    "Verified tutor appears in public listing",
    publicList.status === 200 && tutorPublic,
    "tutor visible in public listing",
    `${publicList.status} tutorFound=${tutorPublic}`
  );

  // -----------------------------------------------------------------------
  // 51.9 — Verified tutor received notification
  // -----------------------------------------------------------------------
  const notifs = await request("GET", "/api/notifications", { token: tutor.token });
  const notifList = b(notifs.body).notifications as Record<string, unknown>[];
  const hasVerifNotif = notifList?.some(
    (n) => n.title === "Profile Status Update" && String(n.body).includes("verified")
  );
  record(
    "51.9",
    "Tutor receives verification notification",
    notifs.status === 200 && hasVerifNotif,
    "notification with 'verified' in body",
    `${notifs.status} hasNotif=${hasVerifNotif}`
  );

  // -----------------------------------------------------------------------
  // 51.10 — PATCH /admin/tutors/:id/verify with status=REJECTED
  // -----------------------------------------------------------------------
  const rejectRes = await request("PATCH", `/api/admin/tutors/${tutor.userId}/verify`, {
    token: admin.token,
    body: { status: "REJECTED" },
  });
  const rejectedTutor = b(b(rejectRes.body).tutor);
  record(
    "51.10",
    "Admin can reject a tutor",
    rejectRes.status === 200 && rejectedTutor.status === "REJECTED",
    "200 tutor.status=REJECTED",
    `${rejectRes.status} status=${rejectedTutor.status}`
  );

  // -----------------------------------------------------------------------
  // 51.11 — Invalid status body returns 400
  // -----------------------------------------------------------------------
  const badStatus = await request("PATCH", `/api/admin/tutors/${tutor.userId}/verify`, {
    token: admin.token,
    body: { status: "PREMIUM" },
  });
  record(
    "51.11",
    "Invalid status returns 400",
    badStatus.status === 400,
    "400",
    `${badStatus.status}`
  );

  // -----------------------------------------------------------------------
  // 51.12 — Non-existent tutor returns 404
  // -----------------------------------------------------------------------
  const notFoundRes = await request("PATCH", "/api/admin/tutors/nonexistent-xyz/verify", {
    token: admin.token,
    body: { status: "VERIFIED" },
  });
  record(
    "51.12",
    "Non-existent tutor returns 404",
    notFoundRes.status === 404 && b(notFoundRes.body).code === "TUTOR_NOT_FOUND",
    "404 TUTOR_NOT_FOUND",
    `${notFoundRes.status} code=${b(notFoundRes.body).code}`
  );

  // -----------------------------------------------------------------------
  // Summary & cleanup
  // -----------------------------------------------------------------------
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;

  console.log(`\n${"=".repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed, ${results.length} total`);

  await prisma.user.deleteMany({ where: { id: { in: cleanupUserIds } } });
  await prisma.$disconnect();

  if (failed > 0) process.exit(1);
  console.log("\nAll BE-051 tests passed.\n");
}

run().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
