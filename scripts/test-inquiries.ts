/**
 * BE-032 Integration Tests
 * Run: npm run test:inquiries
 */

import { TutorStatus } from "@prisma/client";
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

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${BASE}${urlPath}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed };
}

function b(value: unknown): Record<string, unknown> {
  return (value ?? {}) as Record<string, unknown>;
}

async function registerTutor(name: string, status: TutorStatus = TutorStatus.PENDING) {
  const email = `be032.${name.replace(/\s+/g, ".").toLowerCase()}.${Date.now()}@test.com`;
  const reg = await request("POST", "/api/auth/register/tutor", {
    body: {
      email,
      password: "TestPass123",
      name,
    },
  });

  const user = b(reg.body).user as Record<string, unknown>;
  const tutorId = user.id as string;
  cleanupUserIds.push(tutorId);

  if (status !== TutorStatus.PENDING) {
    await prisma.tutorProfile.update({
      where: { userId: tutorId },
      data: { status },
    });
  }

  return {
    status: reg.status,
    token: b(reg.body).token as string,
    tutorId,
    email,
  };
}

async function run() {
  console.log(`\nBE-032 Test Suite — ${BASE}\n${"=".repeat(50)}\n`);

  const health = await request("GET", "/api/health");
  if (health.status !== 200) {
    console.log("Server not reachable. Start with: npm run dev\n");
    process.exit(1);
  }

  const verifiedTutor = await registerTutor("Verified Tutor", TutorStatus.VERIFIED);
  const pendingTutor = await registerTutor("Pending Tutor", TutorStatus.PENDING);
  const blockedTutor = await registerTutor("Blocked Tutor");

  const studentReg = await request("POST", "/api/auth/register/student", {
    body: {
      email: `be032.student.${Date.now()}@test.com`,
      password: "TestPass123",
      name: "Inquiry Student",
    },
  });
  const studentToken = b(studentReg.body).token as string;
  const studentId = b(b(studentReg.body).user).id as string;
  cleanupUserIds.push(studentId);

  record(
    "32.0",
    "Fixtures registered",
    verifiedTutor.status === 201 && studentReg.status === 201,
    "tutor + student created",
    `tutor=${verifiedTutor.status} student=${studentReg.status}`
  );

  const create = await request("POST", "/api/tutors/inquiries", {
    token: studentToken,
    body: {
      tutorId: verifiedTutor.tutorId,
      message: "Assalamu alaikum, I would like Quran lessons on weekends.",
    },
  });
  const inquiry = b(create.body).inquiry as Record<string, unknown>;
  record(
    "32.1",
    "Student can create inquiry",
    create.status === 201 &&
      inquiry.tutorId === verifiedTutor.tutorId &&
      inquiry.status === "PENDING" &&
      typeof inquiry.id === "string",
    "201 with inquiry",
    `${create.status}`
  );

  const tutorInbox = await request("GET", "/api/tutors/me/inquiries", {
    token: verifiedTutor.token,
  });
  const tutorInquiries = b(tutorInbox.body).inquiries as Record<string, unknown>[];
  const inboxItem = tutorInquiries.find((item) => item.id === inquiry.id);
  record(
    "32.2",
    "Tutor can list own inquiries",
    tutorInbox.status === 200 &&
      !!inboxItem &&
      b(inboxItem.student).name === "Inquiry Student",
    "inquiry visible in tutor inbox",
    `${tutorInbox.status} count=${tutorInquiries.length}`
  );

  const tutorNotifications = await request("GET", "/api/notifications", {
    token: verifiedTutor.token,
  });
  const notifs = b(tutorNotifications.body).notifications as Record<string, unknown>[];
  record(
    "32.3",
    "Tutor receives notification on inquiry",
    tutorNotifications.status === 200 &&
      notifs.some(
        (n) => n.title === "New student inquiry" && String(n.body).includes("Inquiry Student")
      ),
    "notification created for tutor",
    `status=${tutorNotifications.status} count=${notifs.length}`
  );

  const pendingInquiry = await request("POST", "/api/tutors/inquiries", {
    token: studentToken,
    body: {
      tutorId: pendingTutor.tutorId,
      message: "Can you teach me?",
    },
  });
  record(
    "32.4",
    "Cannot inquire PENDING tutor",
    pendingInquiry.status === 404 && b(pendingInquiry.body).code === "TUTOR_NOT_FOUND",
    "404 TUTOR_NOT_FOUND",
    `${pendingInquiry.status}`
  );

  const selfInquiry = await request("POST", "/api/tutors/inquiries", {
    token: studentToken,
    body: {
      tutorId: studentId,
      message: "Self inquiry",
    },
  });
  record(
    "32.5",
    "Student cannot inquire self",
    selfInquiry.status === 400 && b(selfInquiry.body).code === "INVALID_INQUIRY",
    "400 INVALID_INQUIRY",
    `${selfInquiry.status}`
  );

  const tutorCreate = await request("POST", "/api/tutors/inquiries", {
    token: blockedTutor.token,
    body: {
      tutorId: verifiedTutor.tutorId,
      message: "Tutor should not send",
    },
  });
  record(
    "32.6",
    "Tutor cannot create inquiry",
    tutorCreate.status === 403,
    "403 Forbidden",
    `${tutorCreate.status}`
  );

  const studentInbox = await request("GET", "/api/tutors/me/inquiries", { token: studentToken });
  record(
    "32.7",
    "Student cannot access tutor inbox",
    studentInbox.status === 403,
    "403 Forbidden",
    `${studentInbox.status}`
  );

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;

  console.log(`\n${"=".repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed, ${results.length} total`);

  await prisma.user.deleteMany({ where: { id: { in: cleanupUserIds } } });
  await prisma.$disconnect();

  if (failed > 0) process.exit(1);
  console.log("\nAll BE-032 tests passed.\n");
}

run().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
