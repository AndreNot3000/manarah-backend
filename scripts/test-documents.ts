/**
 * BE-042 Integration Tests — Competition document upload
 * Run: npm run test:documents
 */

import { CompetitionStatus, CompetitionType } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import FormData from "form-data";

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

async function multipartRequest(
  urlPath: string,
  token: string,
  files: { fieldname: string; filename: string; content: Buffer; mimetype: string }[]
): Promise<{ status: number; body: unknown }> {
  const form = new FormData();
  for (const f of files) {
    form.append(f.fieldname, f.content, {
      filename: f.filename,
      contentType: f.mimetype,
    });
  }

  return new Promise((resolve) => {
    const formBuffer = form.getBuffer();
    const headers = {
      Authorization: `Bearer ${token}`,
      ...form.getHeaders(),
      "Content-Length": String(formBuffer.length),
    };

    const url = new URL(`${BASE}${urlPath}`);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: "POST",
      headers,
    };

    const http = require("http") as typeof import("http");
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
      res.on("end", () => {
        let parsed: unknown = null;
        try { parsed = data ? JSON.parse(data) : null; } catch { parsed = data; }
        resolve({ status: res.statusCode ?? 0, body: parsed });
      });
    });

    req.on("error", (err: Error) => {
      resolve({ status: 0, body: { error: err.message } });
    });

    req.write(formBuffer);
    req.end();
  });
}

function b(value: unknown): Record<string, unknown> {
  return (value ?? {}) as Record<string, unknown>;
}

// Create a minimal valid PDF buffer for testing
function makePdfBuffer(): Buffer {
  return Buffer.from(
    "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj " +
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj " +
    "3 0 obj<</Type/Page/MediaBox[0 0 612 792]>>endobj\n" +
    "xref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n" +
    "0000000058 00000 n\n0000000115 00000 n\n" +
    "trailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF"
  );
}

function makePngBuffer(): Buffer {
  // Minimal 1x1 PNG (137 bytes)
  return Buffer.from(
    "89504e470d0a1a0a0000000d49484452000000010000000108020000009001" +
    "2e000000000c4944415408d76360f8cfc00000000200016dd204560000000049454e44ae426082",
    "hex"
  );
}

async function seedCompetition(status = CompetitionStatus.OPEN) {
  const comp = await prisma.competition.create({
    data: {
      title: "Doc Upload Test Comp",
      description: "Testing document uploads",
      fee: 0,
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      category: "General",
      type: CompetitionType.QURAN_RECITATION,
      status,
    },
  });
  cleanupCompetitionIds.push(comp.id);
  return comp;
}

async function registerUser(role: "student" | "tutor") {
  const ts = Date.now() + Math.random();
  const endpoint = role === "student" ? "/api/auth/register/student" : "/api/auth/register/tutor";
  const res = await request("POST", endpoint, {
    body: { email: `be042.${role}.${ts}@test.com`, password: "TestPass123", name: `BE042 ${role}` },
  });
  const userId = b(b(res.body).user).id as string;
  cleanupUserIds.push(userId);
  return { token: b(res.body).token as string, userId };
}

async function run() {
  console.log(`\nBE-042 Test Suite — ${BASE}\n${"=".repeat(50)}\n`);

  const health = await request("GET", "/api/health");
  if (health.status !== 200) {
    console.log("Server not reachable. Start with: npm run dev\n");
    process.exit(1);
  }

  const student = await registerUser("student");
  const student2 = await registerUser("student");
  const comp = await seedCompetition();

  // Register student for competition
  await request("POST", `/api/competitions/${comp.id}/register`, { token: student.token });

  const pdfBuf = makePdfBuffer();
  const pngBuf = makePngBuffer();

  // -----------------------------------------------------------------------
  // 42.1 — Upload a PDF document
  // -----------------------------------------------------------------------
  const upload1 = await multipartRequest(
    `/api/competitions/${comp.id}/documents`,
    student.token,
    [{ fieldname: "documents", filename: "test.pdf", content: pdfBuf, mimetype: "application/pdf" }]
  );
  const docs1 = b(upload1.body).documents as Record<string, unknown>[];
  record(
    "42.1",
    "Upload PDF document → 201 with document list",
    upload1.status === 201 &&
      Array.isArray(docs1) &&
      docs1.length >= 1 &&
      docs1.some((d) => (d.fileName as string).endsWith(".pdf") || d.fileName === "test.pdf"),
    "201 with documents array",
    `${upload1.status} count=${docs1?.length}`
  );

  // -----------------------------------------------------------------------
  // 42.2 — Upload a PNG document
  // -----------------------------------------------------------------------
  const upload2 = await multipartRequest(
    `/api/competitions/${comp.id}/documents`,
    student.token,
    [{ fieldname: "documents", filename: "photo.png", content: pngBuf, mimetype: "image/png" }]
  );
  const docs2 = b(upload2.body).documents as Record<string, unknown>[];
  record(
    "42.2",
    "Upload PNG document → 201",
    upload2.status === 201 && Array.isArray(docs2) && docs2.length >= 2,
    "201, docs array grows",
    `${upload2.status} count=${docs2?.length}`
  );

  // -----------------------------------------------------------------------
  // 42.3 — Response includes registrationId, fileName, fileUrl, uploadedAt
  // -----------------------------------------------------------------------
  const latestDoc = docs2?.[0];
  record(
    "42.3",
    "Document response has correct shape",
    !!latestDoc &&
      typeof latestDoc.id === "string" &&
      typeof latestDoc.registrationId === "string" &&
      typeof latestDoc.fileName === "string" &&
      typeof latestDoc.fileUrl === "string" &&
      typeof latestDoc.uploadedAt === "string" &&
      !isNaN(Date.parse(latestDoc.uploadedAt as string)),
    "id, registrationId, fileName, fileUrl, uploadedAt all present",
    JSON.stringify(Object.keys(latestDoc ?? {}))
  );

  // -----------------------------------------------------------------------
  // 42.4 — Upload multiple files in one request
  // -----------------------------------------------------------------------
  const multiUpload = await multipartRequest(
    `/api/competitions/${comp.id}/documents`,
    student.token,
    [
      { fieldname: "documents", filename: "file1.pdf", content: pdfBuf, mimetype: "application/pdf" },
      { fieldname: "documents", filename: "file2.pdf", content: pdfBuf, mimetype: "application/pdf" },
    ]
  );
  const multiDocs = b(multiUpload.body).documents as Record<string, unknown>[];
  record(
    "42.4",
    "Upload multiple files in one request",
    multiUpload.status === 201 && multiDocs.length >= 4, // 2 before + 2 new
    "201, 4+ documents total",
    `${multiUpload.status} total=${multiDocs?.length}`
  );

  // -----------------------------------------------------------------------
  // 42.5 — GET /competitions/:id/documents lists all uploaded documents
  // -----------------------------------------------------------------------
  const list = await request("GET", `/api/competitions/${comp.id}/documents`, {
    token: student.token,
  });
  const listDocs = b(list.body).documents as Record<string, unknown>[];
  record(
    "42.5",
    "GET /documents lists all documents for user",
    list.status === 200 && Array.isArray(listDocs) && listDocs.length >= 4,
    "200 with all uploaded documents",
    `${list.status} count=${listDocs?.length}`
  );

  // -----------------------------------------------------------------------
  // 42.6 — Unregistered user cannot upload
  // -----------------------------------------------------------------------
  const unregUpload = await multipartRequest(
    `/api/competitions/${comp.id}/documents`,
    student2.token,
    [{ fieldname: "documents", filename: "test.pdf", content: pdfBuf, mimetype: "application/pdf" }]
  );
  record(
    "42.6",
    "Unregistered user upload returns 403",
    unregUpload.status === 403 && b(unregUpload.body).code === "NOT_REGISTERED",
    "403 NOT_REGISTERED",
    `${unregUpload.status} code=${b(unregUpload.body).code}`
  );

  // -----------------------------------------------------------------------
  // 42.7 — Unregistered user cannot list documents
  // -----------------------------------------------------------------------
  const unregList = await request("GET", `/api/competitions/${comp.id}/documents`, {
    token: student2.token,
  });
  record(
    "42.7",
    "Unregistered user list returns 403",
    unregList.status === 403 && b(unregList.body).code === "NOT_REGISTERED",
    "403 NOT_REGISTERED",
    `${unregList.status} code=${b(unregList.body).code}`
  );

  // -----------------------------------------------------------------------
  // 42.8 — Unauthenticated upload returns 401
  // -----------------------------------------------------------------------
  const unauthUpload = await multipartRequest(
    `/api/competitions/${comp.id}/documents`,
    "bad-token",
    [{ fieldname: "documents", filename: "test.pdf", content: pdfBuf, mimetype: "application/pdf" }]
  );
  record(
    "42.8",
    "Unauthenticated upload returns 401",
    unauthUpload.status === 401,
    "401 Unauthorized",
    `${unauthUpload.status}`
  );

  // -----------------------------------------------------------------------
  // 42.9 — Wrong file type is rejected
  // -----------------------------------------------------------------------
  const badTypeUpload = await multipartRequest(
    `/api/competitions/${comp.id}/documents`,
    student.token,
    [{ fieldname: "documents", filename: "script.js", content: Buffer.from("alert(1)"), mimetype: "application/javascript" }]
  );
  record(
    "42.9",
    "Invalid file type (JS) is rejected",
    badTypeUpload.status === 400,
    "400 bad file type",
    `${badTypeUpload.status}`
  );

  // -----------------------------------------------------------------------
  // 42.10 — Non-existent competition returns 404
  // -----------------------------------------------------------------------
  const notFoundUpload = await multipartRequest(
    "/api/competitions/nonexistent-xyz/documents",
    student.token,
    [{ fieldname: "documents", filename: "test.pdf", content: pdfBuf, mimetype: "application/pdf" }]
  );
  record(
    "42.10",
    "Non-existent competition returns 404",
    notFoundUpload.status === 404 && b(notFoundUpload.body).code === "COMPETITION_NOT_FOUND",
    "404 COMPETITION_NOT_FOUND",
    `${notFoundUpload.status} code=${b(notFoundUpload.body).code}`
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
  console.log("\nAll BE-042 tests passed.\n");
}

run().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
