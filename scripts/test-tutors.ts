/**
 * BE-030 Integration Tests
 * Run: npm run test:tutors
 */

import { TutorStatus, TutorSubjectType } from "@prisma/client";
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

function record(id: string, name: string, pass: boolean, expected: string, actual: string) {
  results.push({ id, name, pass, expected, actual });
  console.log(`[${pass ? "PASS" : "FAIL"}] ${id} ${name}`);
  if (!pass) {
    console.log(`       Expected: ${expected}`);
    console.log(`       Actual:   ${actual}`);
  }
}

async function request(method: string, path: string, token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { method, headers });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

function b(value: unknown): Record<string, unknown> {
  return (value ?? {}) as Record<string, unknown>;
}

async function seedTutors() {
  const tutors = [
    {
      email: `tutor.quran.${Date.now()}@test.com`,
      name: "Aisha Quran",
      bio: "Expert in Quran recitation and Tajweed",
      status: TutorStatus.VERIFIED,
      subjects: [TutorSubjectType.QURAN, TutorSubjectType.TAJWEED],
      pricing: "50.00",
    },
    {
      email: `tutor.arabic.${Date.now()}@test.com`,
      name: "Omar Arabic",
      bio: "Arabic language and Islamic studies teacher",
      status: TutorStatus.PREMIUM,
      subjects: [TutorSubjectType.ARABIC, TutorSubjectType.ISLAMIC_STUDIES],
      pricing: "75.00",
    },
    {
      email: `tutor.hifz.${Date.now()}@test.com`,
      name: "Pending Hifz",
      bio: "Hifz memorization coach",
      status: TutorStatus.PENDING,
      subjects: [TutorSubjectType.HIFZ],
      pricing: "40.00",
    },
  ];

  const ids: string[] = [];

  for (const tutor of tutors) {
    const user = await prisma.user.create({
      data: {
        email: tutor.email,
        passwordHash: "$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012",
        role: "TUTOR",
        tutorProfile: {
          create: {
            name: tutor.name,
            bio: tutor.bio,
            status: tutor.status,
            pricing: tutor.pricing,
            experience: "5 years",
            subjects: {
              create: tutor.subjects.map((subject) => ({ subject })),
            },
            qualifications: {
              create: [{ title: "Ijazah", fileUrl: "https://example.com/ijazah.pdf" }],
            },
          },
        },
      },
      include: { tutorProfile: true },
    });

    ids.push(user.id);
  }

  return { verifiedId: ids[0], premiumId: ids[1], pendingId: ids[2] };
}

async function cleanup(ids: string[]) {
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

async function run() {
  console.log(`\nBE-030 Test Suite — ${BASE}\n${"=".repeat(50)}\n`);

  const health = await request("GET", "/api/health");
  if (health.status !== 200) {
    console.log("Server not reachable.\n");
    process.exit(1);
  }

  const { verifiedId, premiumId, pendingId } = await seedTutors();

  try {
    const publicList = await request("GET", "/api/tutors");
    const tutors = b(publicList.body).tutors as unknown[];
    record(
      "30.1",
      "Public list without auth",
      publicList.status === 200 && Array.isArray(tutors),
      "200 with tutors array",
      `${publicList.status}`
    );

    const ids = tutors.map((t) => b(t).id);
    record(
      "30.2",
      "Only VERIFIED/PREMIUM in list",
      ids.includes(verifiedId) && ids.includes(premiumId) && !ids.includes(pendingId),
      "verified+premium visible, pending hidden",
      `hasVerified=${ids.includes(verifiedId)} hasPending=${ids.includes(pendingId)}`
    );

    const quranFilter = await request("GET", "/api/tutors?subject=QURAN");
    const quranTutors = b(quranFilter.body).tutors as Record<string, unknown>[];
    record(
      "30.3",
      "Filter by subject QURAN",
      quranFilter.status === 200 &&
        quranTutors.length >= 1 &&
        quranTutors.every((t) => (b(t).subjects as string[]).includes("QURAN")),
      "only QURAN tutors",
      `count=${quranTutors.length}`
    );

    const arabicFilter = await request("GET", "/api/tutors?subject=ARABIC");
    record(
      "30.4",
      "Filter by subject ARABIC",
      arabicFilter.status === 200 &&
        (b(arabicFilter.body).tutors as unknown[]).some((t) => b(t).id === premiumId),
      "includes Omar Arabic",
      `status=${arabicFilter.status}`
    );

    const hifzFilter = await request("GET", "/api/tutors?subject=HIFZ");
    record(
      "30.5",
      "PENDING tutor hidden for HIFZ filter",
      hifzFilter.status === 200 &&
        !(b(hifzFilter.body).tutors as unknown[]).some((t) => b(t).id === pendingId),
      "pending not listed",
      `count=${(b(hifzFilter.body).tutors as unknown[]).length}`
    );

    const search = await request("GET", "/api/tutors?q=arabic");
    record(
      "30.6",
      "Search by q (name/bio)",
      search.status === 200 &&
        (b(search.body).tutors as unknown[]).some((t) => b(t).id === premiumId),
      "finds Omar Arabic",
      `count=${(b(search.body).tutors as unknown[]).length}`
    );

    const pagination = await request("GET", "/api/tutors?page=1&limit=1");
    const meta = b(pagination.body).meta as Record<string, unknown>;
    record(
      "30.7",
      "Pagination works",
      pagination.status === 200 &&
        (b(pagination.body).tutors as unknown[]).length === 1 &&
        Number(meta.total) >= 2,
      "limit=1 returns 1 item",
      `returned=${(b(pagination.body).tutors as unknown[]).length} total=${meta.total}`
    );

    const detail = await request("GET", `/api/tutors/${verifiedId}`);
    const tutor = b(detail.body).tutor as Record<string, unknown>;
    const quals = tutor.qualifications as unknown[];
    const subjects = tutor.subjects as string[];
    record(
      "30.8",
      "Tutor detail with qualifications & subjects",
      detail.status === 200 &&
        tutor.name === "Aisha Quran" &&
        quals.length >= 1 &&
        subjects.includes("QURAN"),
      "200 full profile",
      `${detail.status} quals=${quals?.length}`
    );

    const pendingDetail = await request("GET", `/api/tutors/${pendingId}`);
    record(
      "30.9",
      "Pending tutor detail returns 404",
      pendingDetail.status === 404 && b(pendingDetail.body).code === "TUTOR_NOT_FOUND",
      "404 TUTOR_NOT_FOUND",
      `${pendingDetail.status}`
    );

    const badSubject = await request("GET", "/api/tutors?subject=INVALID");
    record(
      "30.10",
      "Invalid subject rejected",
      badSubject.status === 400,
      "400 validation",
      `${badSubject.status}`
    );
  } finally {
    await cleanup([verifiedId, premiumId, pendingId]);
    await prisma.$disconnect();
  }

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;

  console.log(`\n${"=".repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed, ${results.length} total`);

  if (failed > 0) process.exit(1);
  console.log("\nAll BE-030 tests passed.\n");
}

run().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
