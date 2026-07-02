/**
 * BE-020 & BE-021 Integration Tests
 * Run: npm run test:profile
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

function body(value: unknown): Record<string, unknown> {
  return (value ?? {}) as Record<string, unknown>;
}

async function run() {
  console.log(`\nBE-020 & BE-021 Test Suite — ${BASE}\n${"=".repeat(50)}\n`);

  const health = await request("GET", "/api/health");
  if (health.status !== 200) {
    console.log("Server not reachable. Start with: npm run dev\n");
    process.exit(1);
  }

  const studentEmail = `be020.student.${Date.now()}@test.com`;
  const tutorEmail = `be020.tutor.${Date.now()}@test.com`;

  const studentReg = await request("POST", "/api/auth/register/student", {
    body: {
      email: studentEmail,
      password: "TestPass123",
      name: "Profile Student",
      phone: "08010001000",
    },
  });
  const studentToken = String(body(studentReg.body).token ?? "");
  const studentId = String(body(body(studentReg.body).user).id ?? "");

  const tutorReg = await request("POST", "/api/auth/register/tutor", {
    body: { email: tutorEmail, password: "TestPass123", name: "Profile Tutor" },
  });
  const tutorToken = String(body(tutorReg.body).token ?? "");
  const tutorId = String(body(body(tutorReg.body).user).id ?? "");

  const adminLogin = await request("POST", "/api/auth/login", {
    body: { email: "admin@manarah.com", password: "Admin@123" },
  });
  const adminToken = String(body(adminLogin.body).token ?? "");

  // BE-020: Profile
  const noToken = await request("GET", "/api/users/me");
  record(
    "20.1",
    "GET profile without token",
    noToken.status === 401,
    "401",
    `${noToken.status}`
  );

  const studentProfile = await request("GET", "/api/users/me", { token: studentToken });
  const sp = body(studentProfile.body);
  const spProfile = body(sp.profile);
  record(
    "20.2",
    "Student profile shape",
    studentProfile.status === 200 &&
      sp.role === "STUDENT" &&
      spProfile.name === "Profile Student" &&
      spProfile.phone === "08010001000",
    "200 STUDENT with name + phone",
    `${studentProfile.status} role=${sp.role} name=${spProfile.name}`
  );

  const tutorProfile = await request("GET", "/api/users/me", { token: tutorToken });
  const tp = body(tutorProfile.body);
  const tpProfile = body(tp.profile);
  record(
    "20.3",
    "Tutor profile shape",
    tutorProfile.status === 200 &&
      tp.role === "TUTOR" &&
      tpProfile.name === "Profile Tutor" &&
      tpProfile.status === "PENDING",
    "200 TUTOR with PENDING status",
    `${tutorProfile.status} role=${tp.role} status=${tpProfile.status}`
  );

  const adminProfile = await request("GET", "/api/users/me", { token: adminToken });
  const ap = body(adminProfile.body);
  record(
    "20.4",
    "Admin profile has null profile",
    adminProfile.status === 200 && ap.role === "ADMIN" && ap.profile === null,
    "200 ADMIN profile=null",
    `${adminProfile.status} role=${ap.role} profile=${ap.profile}`
  );

  const patchStudent = await request("PATCH", "/api/users/me", {
    token: studentToken,
    body: { name: "Updated Student", phone: "08020002000" },
  });
  const ps = body(patchStudent.body);
  const psProfile = body(ps.profile);
  record(
    "20.5",
    "PATCH student name & phone",
    patchStudent.status === 200 &&
      psProfile.name === "Updated Student" &&
      psProfile.phone === "08020002000",
    "200 updated fields",
    `${patchStudent.status} name=${psProfile.name} phone=${psProfile.phone}`
  );

  const persist = await request("GET", "/api/users/me", { token: studentToken });
  const persistProfile = body(body(persist.body).profile);
  record(
    "20.6",
    "Profile changes persist",
    persist.status === 200 &&
      persistProfile.name === "Updated Student" &&
      persistProfile.phone === "08020002000",
    "persisted after GET",
    `name=${persistProfile.name}`
  );

  const patchTutor = await request("PATCH", "/api/users/me", {
    token: tutorToken,
    body: { name: "Updated Tutor" },
  });
  record(
    "20.7",
    "PATCH tutor name",
    patchTutor.status === 200 && body(body(patchTutor.body).profile).name === "Updated Tutor",
    "200 updated tutor name",
    `${patchTutor.status} name=${body(body(patchTutor.body).profile).name}`
  );

  const adminPatch = await request("PATCH", "/api/users/me", {
    token: adminToken,
    body: { name: "Should Fail" },
  });
  record(
    "20.8",
    "Admin cannot PATCH profile",
    adminPatch.status === 400 && body(adminPatch.body).code === "ADMIN_PROFILE",
    "400 ADMIN_PROFILE",
    `${adminPatch.status} ${JSON.stringify(adminPatch.body)}`
  );

  const pngPath = path.join(process.cwd(), "test-avatar-be020.png");
  fs.writeFileSync(
    pngPath,
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    )
  );
  const form = new FormData();
  form.append("avatar", new Blob([fs.readFileSync(pngPath)], { type: "image/png" }), "avatar.png");

  const avatarRes = await fetch(`${BASE}/api/users/me`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${studentToken}` },
    body: form,
  });
  const avatarBody = await avatarRes.json();
  const avatarUrl = String(body(body(avatarBody).profile).avatarUrl ?? "");
  record(
    "20.9",
    "Avatar upload returns URL",
    avatarRes.status === 200 && avatarUrl.includes("/uploads/avatars/"),
    "200 with uploads URL",
    `${avatarRes.status} url=${avatarUrl}`
  );
  fs.unlinkSync(pngPath);

  // BE-021: Saved tutors
  const tutorListForbidden = await request("GET", "/api/students/saved-tutors", {
    token: tutorToken,
  });
  record(
    "21.1",
    "Tutor blocked from saved tutors",
    tutorListForbidden.status === 403,
    "403",
    `${tutorListForbidden.status}`
  );

  const adminListForbidden = await request("GET", "/api/students/saved-tutors", {
    token: adminToken,
  });
  record(
    "21.2",
    "Admin blocked from saved tutors",
    adminListForbidden.status === 403,
    "403",
    `${adminListForbidden.status}`
  );

  const emptyList = await request("GET", "/api/students/saved-tutors", {
    token: studentToken,
  });
  record(
    "21.3",
    "Empty saved tutors list",
    emptyList.status === 200 && Array.isArray(body(emptyList.body).tutors) &&
      (body(emptyList.body).tutors as unknown[]).length === 0,
    "200 empty tutors array",
    `${emptyList.status} count=${(body(emptyList.body).tutors as unknown[])?.length}`
  );

  const save = await request("POST", `/api/students/saved-tutors/${tutorId}`, {
    token: studentToken,
  });
  const savedTutor = body(body(save.body).tutor);
  record(
    "21.4",
    "Student saves tutor",
    save.status === 201 && savedTutor.tutorId === tutorId,
    "201 with tutorId",
    `${save.status} tutorId=${savedTutor.tutorId}`
  );

  const saveAgain = await request("POST", `/api/students/saved-tutors/${tutorId}`, {
    token: studentToken,
  });
  record(
    "21.5",
    "Idempotent save",
    saveAgain.status === 201 && body(body(saveAgain.body).tutor).tutorId === tutorId,
    "201 no error on duplicate",
    `${saveAgain.status}`
  );

  const list = await request("GET", "/api/students/saved-tutors", { token: studentToken });
  record(
    "21.6",
    "List contains one saved tutor",
    list.status === 200 && (body(list.body).tutors as unknown[]).length === 1,
    "200 count=1",
    `${list.status} count=${(body(list.body).tutors as unknown[]).length}`
  );

  const badTutor = await request("POST", "/api/students/saved-tutors/nonexistent-id", {
    token: studentToken,
  });
  record(
    "21.7",
    "Save non-existent tutor",
    badTutor.status === 404 && body(badTutor.body).code === "TUTOR_NOT_FOUND",
    "404 TUTOR_NOT_FOUND",
    `${badTutor.status} ${JSON.stringify(badTutor.body)}`
  );

  const selfSave = await request("POST", `/api/students/saved-tutors/${studentId}`, {
    token: studentToken,
  });
  record(
    "21.8",
    "Cannot save yourself",
    selfSave.status === 400 && body(selfSave.body).code === "INVALID_TUTOR",
    "400 INVALID_TUTOR",
    `${selfSave.status} ${JSON.stringify(selfSave.body)}`
  );

  const unsave = await request("DELETE", `/api/students/saved-tutors/${tutorId}`, {
    token: studentToken,
  });
  record(
    "21.9",
    "Unsave tutor",
    unsave.status === 204,
    "204",
    `${unsave.status}`
  );

  const unsaveAgain = await request("DELETE", `/api/students/saved-tutors/${tutorId}`, {
    token: studentToken,
  });
  record(
    "21.10",
    "Unsave missing tutor",
    unsaveAgain.status === 404 && body(unsaveAgain.body).code === "SAVED_TUTOR_NOT_FOUND",
    "404 SAVED_TUTOR_NOT_FOUND",
    `${unsaveAgain.status} ${JSON.stringify(unsaveAgain.body)}`
  );

  const listAfter = await request("GET", "/api/students/saved-tutors", {
    token: studentToken,
  });
  record(
    "21.11",
    "List empty after unsave",
    listAfter.status === 200 && (body(listAfter.body).tutors as unknown[]).length === 0,
    "200 count=0",
    `${listAfter.status} count=${(body(listAfter.body).tutors as unknown[]).length}`
  );

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;

  console.log(`\n${"=".repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed, ${results.length} total`);

  if (failed > 0) {
    console.log("\nFailed:");
    results.filter((r) => !r.pass).forEach((r) => console.log(`  - ${r.id} ${r.name}`));
    process.exit(1);
  }

  console.log("\nAll BE-020 & BE-021 tests passed.\n");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
