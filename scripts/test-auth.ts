/**
 * MANARAH Auth Integration Test Suite
 * Run: npx tsx scripts/test-auth.ts
 */

const BASE = process.env.API_URL ?? "http://localhost:4000";

interface TestResult {
  id: string;
  name: string;
  pass: boolean;
  expected: string;
  actual: string;
}

const results: TestResult[] = [];
let studentEmail = "";
let studentPassword = "TestPass123";
let studentToken = "";
let tutorToken = "";
let adminToken = "";
let resetToken = "";

function record(id: string, name: string, pass: boolean, expected: string, actual: string) {
  results.push({ id, name, pass, expected, actual });
  const icon = pass ? "PASS" : "FAIL";
  console.log(`[${icon}] ${id} ${name}`);
  if (!pass) console.log(`       Expected: ${expected}`);
  if (!pass) console.log(`       Actual:   ${actual}`);
}

async function request(
  method: string,
  path: string,
  options: {
    body?: unknown;
    token?: string;
    formData?: FormData;
  } = {}
): Promise<{ status: number; body: unknown }> {
  const headers: Record<string, string> = {};

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  let body: BodyInit | undefined;

  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  const res = await fetch(`${BASE}${path}`, { method, headers, body });
  let parsed: unknown = null;

  const text = await res.text();
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }

  return { status: res.status, body: parsed };
}

function getBody(body: unknown): Record<string, unknown> {
  return (body ?? {}) as Record<string, unknown>;
}

async function runTests() {
  console.log(`\nMANARAH Auth Test Suite — ${BASE}\n${"=".repeat(50)}\n`);

  // Health
  const health = await request("GET", "/api/health");
  record(
    "0.0",
    "Server health check",
    health.status === 200 && getBody(health.body).status === "ok",
    "200 { status: ok }",
    `${health.status} ${JSON.stringify(health.body)}`
  );

  if (health.status !== 200) {
    console.log("\nServer not reachable. Start with: npm run dev\n");
    process.exit(1);
  }

  studentEmail = `student.${Date.now()}@test.com`;

  // Validation tests first (before successful registrations)
  const weakPw = await request("POST", "/api/auth/register/student", {
    body: { email: `weak.${Date.now()}@test.com`, password: "short", name: "Weak" },
  });
  record(
    "1.4",
    "Weak password rejected",
    weakPw.status === 400,
    "400 validation error",
    `${weakPw.status}`
  );

  const badEmail = await request("POST", "/api/auth/register/student", {
    body: { email: "not-an-email", password: studentPassword, name: "Bad" },
  });
  record(
    "1.5",
    "Invalid email rejected",
    badEmail.status === 400,
    "400 validation error",
    `${badEmail.status}`
  );

  // 8.1 Deleted user — disposable registration
  const deleteEmail = `delete.${Date.now()}@test.com`;
  const delReg = await request("POST", "/api/auth/register/student", {
    body: { email: deleteEmail, password: studentPassword, name: "To Delete" },
  });
  const delToken = String(getBody(delReg.body).token ?? "");
  const { prisma } = await import("../src/lib/prisma");
  const delUser = await prisma.user.findUnique({ where: { email: deleteEmail } });
  if (delUser && delToken) {
    await prisma.user.delete({ where: { id: delUser.id } });
    const deleted = await request("GET", "/api/users/me", { token: delToken });
    record(
      "8.1",
      "Token invalid after user deleted",
      deleted.status === 401 && getBody(deleted.body).code === "USER_NOT_FOUND",
      "401 USER_NOT_FOUND",
      `${deleted.status} ${JSON.stringify(deleted.body)}`
    );
  } else {
    record(
      "8.1",
      "Token invalid after user deleted",
      false,
      "401 USER_NOT_FOUND",
      `setup failed reg=${delReg.status}`
    );
  }

  // 1. Registration
  const regStudent = await request("POST", "/api/auth/register/student", {
    body: {
      email: studentEmail,
      password: studentPassword,
      name: "Test Student",
      phone: "08011111111",
    },
  });
  const regStudentBody = getBody(regStudent.body);
  studentToken = String(regStudentBody.token ?? "");
  record(
    "1.1",
    "Student register",
    regStudent.status === 201 &&
      regStudentBody.user &&
      getBody(regStudentBody.user).role === "STUDENT" &&
      !!studentToken,
    "201 + token + role STUDENT",
    `${regStudent.status} role=${getBody(regStudentBody.user).role}`
  );

  const tutorEmail = `tutor.${Date.now()}@test.com`;
  const regTutor = await request("POST", "/api/auth/register/tutor", {
    body: { email: tutorEmail, password: studentPassword, name: "Test Tutor" },
  });
  const regTutorBody = getBody(regTutor.body);
  tutorToken = String(regTutorBody.token ?? "");
  record(
    "1.2",
    "Tutor register",
    regTutor.status === 201 && getBody(regTutorBody.user).role === "TUTOR" && !!tutorToken,
    "201 + role TUTOR",
    `${regTutor.status} role=${getBody(regTutorBody.user).role}`
  );

  const dup = await request("POST", "/api/auth/register/student", {
    body: { email: studentEmail, password: studentPassword, name: "Dup" },
  });
  record(
    "1.3",
    "Duplicate email",
    dup.status === 409 && getBody(dup.body).code === "EMAIL_EXISTS",
    "409 EMAIL_EXISTS",
    `${dup.status} ${JSON.stringify(dup.body)}`
  );

  // 2. Login
  const login = await request("POST", "/api/auth/login", {
    body: { email: studentEmail, password: studentPassword },
  });
  const loginBody = getBody(login.body);
  record(
    "2.1",
    "Valid login",
    login.status === 200 && !!loginBody.token && !!loginBody.user,
    "200 + token + user",
    `${login.status}`
  );

  const wrongPw = await request("POST", "/api/auth/login", {
    body: { email: studentEmail, password: "WrongPassword99" },
  });
  record(
    "2.2",
    "Wrong password",
    wrongPw.status === 401 && getBody(wrongPw.body).code === "INVALID_CREDENTIALS",
    "401 INVALID_CREDENTIALS",
    `${wrongPw.status} ${JSON.stringify(wrongPw.body)}`
  );

  const unknownEmail = await request("POST", "/api/auth/login", {
    body: { email: "nobody@nowhere.com", password: studentPassword },
  });
  record(
    "2.3",
    "Unknown email",
    unknownEmail.status === 401 && getBody(unknownEmail.body).code === "INVALID_CREDENTIALS",
    "401 INVALID_CREDENTIALS",
    `${unknownEmail.status}`
  );

  const adminLogin = await request("POST", "/api/auth/login", {
    body: { email: "admin@manarah.com", password: "Admin@123" },
  });
  const adminBody = getBody(adminLogin.body);
  adminToken = String(adminBody.token ?? "");
  record(
    "2.4",
    "Admin login",
    adminLogin.status === 200 && getBody(adminBody.user).role === "ADMIN" && !!adminToken,
    "200 role ADMIN",
    `${adminLogin.status} role=${getBody(adminBody.user).role}`
  );

  // 3. JWT & protected routes
  const noToken = await request("GET", "/api/users/me");
  record(
    "3.1",
    "No token rejected",
    noToken.status === 401 && getBody(noToken.body).code === "UNAUTHORIZED",
    "401 UNAUTHORIZED",
    `${noToken.status} ${JSON.stringify(noToken.body)}`
  );

  const badToken = await request("GET", "/api/users/me", { token: "invalid.token.here" });
  record(
    "3.2",
    "Invalid token rejected",
    badToken.status === 401 && getBody(badToken.body).code === "INVALID_TOKEN",
    "401 INVALID_TOKEN",
    `${badToken.status} ${JSON.stringify(badToken.body)}`
  );

  const profile = await request("GET", "/api/users/me", { token: studentToken });
  const profileBody = getBody(profile.body);
  record(
    "3.3",
    "Valid token — profile",
    profile.status === 200 &&
      profileBody.role === "STUDENT" &&
      !!getBody(profileBody.profile).name,
    "200 STUDENT profile with name",
    `${profile.status} role=${profileBody.role}`
  );

  const authMe = await request("GET", "/api/auth/me", { token: studentToken });
  const authMeBody = getBody(authMe.body);
  const authMeUser = getBody(authMeBody.user);
  record(
    "3.4",
    "Auth me endpoint",
    authMe.status === 200 && !!authMeUser.userId && authMeUser.role === "STUDENT",
    "200 user with userId + role",
    `${authMe.status} ${JSON.stringify(authMe.body)}`
  );

  // 4. RBAC
  const studentAdmin = await request("GET", "/api/auth/admin/check", { token: studentToken });
  record(
    "4.1",
    "Student blocked from admin",
    studentAdmin.status === 403,
    "403 Forbidden",
    `${studentAdmin.status}`
  );

  const adminCheck = await request("GET", "/api/auth/admin/check", { token: adminToken });
  record(
    "4.2",
    "Admin allowed",
    adminCheck.status === 200 && getBody(adminCheck.body).ok === true,
    "200 { ok: true }",
    `${adminCheck.status} ${JSON.stringify(adminCheck.body)}`
  );

  const tutorAdmin = await request("GET", "/api/auth/admin/check", { token: tutorToken });
  record(
    "4.3",
    "Tutor blocked from admin",
    tutorAdmin.status === 403,
    "403 Forbidden",
    `${tutorAdmin.status}`
  );

  // 5. Password reset
  const forgot = await request("POST", "/api/auth/forgot-password", {
    body: { email: studentEmail },
  });
  record(
    "5.1",
    "Forgot password",
    forgot.status === 200 && !!getBody(forgot.body).message,
    "200 success message",
    `${forgot.status}`
  );

  // Generate reset token directly for test (simulates dev console log)
  const { signPasswordResetToken } = await import("../src/utils/resetToken");
  const userForReset = await prisma.user.findUnique({ where: { email: studentEmail } });
  if (userForReset) {
    resetToken = signPasswordResetToken(userForReset.id);
  }

  const newPassword = "NewPass456!";
  const reset = await request("POST", "/api/auth/reset-password", {
    body: { token: resetToken, newPassword },
  });
  record(
    "5.3",
    "Reset password",
    reset.status === 200,
    "200 success",
    `${reset.status} ${JSON.stringify(reset.body)}`
  );

  const loginNewPw = await request("POST", "/api/auth/login", {
    body: { email: studentEmail, password: newPassword },
  });
  studentPassword = newPassword;
  studentToken = String(getBody(loginNewPw.body).token ?? "");
  record(
    "5.4",
    "Login with new password",
    loginNewPw.status === 200 && !!studentToken,
    "200 + token",
    `${loginNewPw.status}`
  );

  const badReset = await request("POST", "/api/auth/reset-password", {
    body: { token: "bad.token", newPassword: "AnotherPass99!" },
  });
  record(
    "5.5",
    "Invalid reset token",
    badReset.status === 400 && getBody(badReset.body).code === "INVALID_RESET_TOKEN",
    "400 INVALID_RESET_TOKEN",
    `${badReset.status} ${JSON.stringify(badReset.body)}`
  );

  // 6. Password encryption
  const dbUser = await prisma.user.findUnique({ where: { email: studentEmail } });
  const hash = dbUser?.passwordHash ?? "";
  record(
    "6.1",
    "Password stored as bcrypt hash",
    hash.startsWith("$2b$") || hash.startsWith("$2a$"),
    "bcrypt hash ($2b$...)",
    hash ? `${hash.slice(0, 7)}...` : "no hash"
  );

  record(
    "6.2",
    "Hash differs from plain password",
    hash !== newPassword && hash.length > 20,
    "hash != plain password",
    `hash length=${hash.length}`
  );

  // 7. Profile PATCH
  const patch = await request("PATCH", "/api/users/me", {
    token: studentToken,
    body: { name: "Updated Student", phone: "08099998888" },
  });
  const patchBody = getBody(patch.body);
  record(
    "7.2",
    "Profile PATCH name & phone",
    patch.status === 200 &&
      getBody(patchBody.profile).name === "Updated Student" &&
      getBody(patchBody.profile).phone === "08099998888",
    "200 updated profile",
    `${patch.status} name=${getBody(patchBody.profile).name}`
  );

  // 8. Stale token — role change
  if (dbUser) {
    const staleToken = studentToken;
    await prisma.user.update({
      where: { id: dbUser.id },
      data: { role: "TUTOR" },
    });

    const stale = await request("GET", "/api/users/me", { token: staleToken });
    record(
      "8.2",
      "Stale token after role change",
      stale.status === 401 && getBody(stale.body).code === "TOKEN_STALE",
      "401 TOKEN_STALE",
      `${stale.status} ${JSON.stringify(stale.body)}`
    );

    // Restore role for cleanup
    await prisma.user.update({
      where: { id: dbUser.id },
      data: { role: "STUDENT" },
    });
  }

  // 7. Rate limiting — run last
  let loginRateLimited = false;
  for (let i = 0; i < 12; i++) {
    const attempt = await request("POST", "/api/auth/login", {
      body: { email: `ratelimit${i}@test.com`, password: "wrong" },
    });
    if (attempt.status === 429) {
      loginRateLimited = true;
      break;
    }
  }
  record(
    "7.1",
    "Login rate limit triggers",
    loginRateLimited,
    "429 RATE_LIMITED after 11+ attempts",
    loginRateLimited ? "429 received" : "no 429"
  );

  await prisma.$disconnect();

  // Summary
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;

  console.log(`\n${"=".repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed, ${results.length} total`);

  if (failed > 0) {
    console.log("\nFailed tests:");
    results.filter((r) => !r.pass).forEach((r) => {
      console.log(`  - ${r.id} ${r.name}`);
    });
    process.exit(1);
  }

  console.log("\nAll auth tests passed.\n");
}

runTests().catch((err) => {
  console.error("Test suite error:", err);
  process.exit(1);
});
