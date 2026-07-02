/**
 * BE-031 Integration Tests
 * Run: npm run test:tutor-profile
 */

import fs from "fs";
import path from "path";

const BASE = process.env.API_URL ?? "http://localhost:4000";

interface TestResult {
  id: string;
  name: string;
  pass: boolean;
  expected: string;
  actual: string;
}

const results: TestResult[] = [];

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
  options: {
    token?: string;
    body?: unknown;
    formData?: FormData;
  } = {}
): Promise<{ status: number; body: unknown }> {
  const headers: Record<string, string> = {};
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  let body: BodyInit | undefined;
  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  const res = await fetch(`${BASE}${urlPath}`, { method, headers, body });
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

async function run() {
  console.log(`\nBE-031 Test Suite — ${BASE}\n${"=".repeat(50)}\n`);

  const health = await request("GET", "/api/health");
  if (health.status !== 200) {
    console.log("Server not reachable. Start with: npm run dev\n");
    process.exit(1);
  }

  const tutorEmail = `be031.tutor.${Date.now()}@test.com`;
  const studentEmail = `be031.student.${Date.now()}@test.com`;

  const tutorReg = await request("POST", "/api/auth/register/tutor", {
    body: {
      email: tutorEmail,
      password: "TestPass123",
      name: "Tutor Self Service",
    },
  });

  const studentReg = await request("POST", "/api/auth/register/student", {
    body: {
      email: studentEmail,
      password: "TestPass123",
      name: "Student Blocked",
    },
  });

  const tutorToken = b(tutorReg.body).token as string;
  const studentToken = b(studentReg.body).token as string;

  record(
    "31.1",
    "Tutor registration succeeds",
    tutorReg.status === 201 && typeof tutorToken === "string",
    "201 with token",
    `${tutorReg.status}`
  );

  const studentGet = await request("GET", "/api/tutors/me", { token: studentToken });
  record(
    "31.2",
    "Student cannot access GET /api/tutors/me",
    studentGet.status === 403,
    "403 Forbidden",
    `${studentGet.status}`
  );

  const ownProfile = await request("GET", "/api/tutors/me", { token: tutorToken });
  const tutor = b(ownProfile.body).tutor as Record<string, unknown>;
  record(
    "31.3",
    "Tutor can fetch own profile",
    ownProfile.status === 200 && tutor.name === "Tutor Self Service",
    "200 with tutor profile",
    `${ownProfile.status}`
  );

  const jsonPatch = await request("PATCH", "/api/tutors/me", {
    token: tutorToken,
    body: {
      bio: "Experienced Quran teacher",
      pricing: "60.50",
      experience: "8 years",
      availability: "Weekday evenings",
      subjects: ["QURAN", "TAJWEED"],
    },
  });
  const updated = b(jsonPatch.body).tutor as Record<string, unknown>;
  record(
    "31.4",
    "PATCH JSON fields and replace subjects",
    jsonPatch.status === 200 &&
      updated.bio === "Experienced Quran teacher" &&
      updated.pricing === "60.5" &&
      (updated.subjects as string[]).includes("QURAN"),
    "200 with updated fields",
    `${jsonPatch.status} pricing=${updated.pricing}`
  );

  const fixtureDir = path.join(process.cwd(), "scripts", "fixtures");
  fs.mkdirSync(fixtureDir, { recursive: true });
  const photoPath = path.join(fixtureDir, "tutor-photo.png");
  const qualPath = path.join(fixtureDir, "qualification.pdf");

  const pngHeader = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
    0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f,
    0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00,
    0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
  const pdfContent = Buffer.from("%PDF-1.4\n% minimal test pdf\n");

  fs.writeFileSync(photoPath, pngHeader);
  fs.writeFileSync(qualPath, pdfContent);

  const form = new FormData();
  form.append("bio", "Updated via multipart");
  form.append("photo", new Blob([pngHeader], { type: "image/png" }), "photo.png");
  form.append("qualifications", new Blob([pdfContent], { type: "application/pdf" }), "ijazah.pdf");
  form.append("qualificationTitles", JSON.stringify(["Ijazah in Hafs"]));

  const multipartPatch = await request("PATCH", "/api/tutors/me", {
    token: tutorToken,
    formData: form,
  });
  const multipartTutor = b(multipartPatch.body).tutor as Record<string, unknown>;
  const qualifications = multipartTutor.qualifications as Record<string, unknown>[];
  record(
    "31.5",
    "PATCH photo and qualification upload",
    multipartPatch.status === 200 &&
      typeof multipartTutor.photoUrl === "string" &&
      qualifications.length >= 1 &&
      qualifications.some((q) => q.title === "Ijazah in Hafs" && typeof q.fileUrl === "string"),
    "photo + qualification persisted",
    `${multipartPatch.status} quals=${qualifications?.length}`
  );

  const qualId = qualifications[0]?.id as string;
  const removePatch = await request("PATCH", "/api/tutors/me", {
    token: tutorToken,
    body: {
      subjects: ["HIFZ"],
      removeQualificationIds: [qualId],
    },
  });
  const afterRemove = b(removePatch.body).tutor as Record<string, unknown>;
  record(
    "31.6",
    "Replace subjects and remove qualification",
    removePatch.status === 200 &&
      (afterRemove.subjects as string[]).includes("HIFZ") &&
      !(afterRemove.qualifications as unknown[]).some((q) => b(q).id === qualId),
    "subjects replaced, qualification removed",
    `${removePatch.status}`
  );

  const studentPatch = await request("PATCH", "/api/tutors/me", {
    token: studentToken,
    body: { bio: "blocked" },
  });
  record(
    "31.7",
    "Student cannot PATCH /api/tutors/me",
    studentPatch.status === 403,
    "403 Forbidden",
    `${studentPatch.status}`
  );

  const emptyPatch = await request("PATCH", "/api/tutors/me", {
    token: tutorToken,
    body: {},
  });
  record(
    "31.8",
    "Empty PATCH rejected",
    emptyPatch.status === 400 && b(emptyPatch.body).code === "NO_CHANGES",
    "400 NO_CHANGES",
    `${emptyPatch.status}`
  );

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;

  console.log(`\n${"=".repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed, ${results.length} total`);

  if (failed > 0) process.exit(1);
  console.log("\nAll BE-031 tests passed.\n");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
