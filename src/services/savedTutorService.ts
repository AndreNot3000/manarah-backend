import { Prisma, TutorStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/errors";

export interface SavedTutorResponse {
  tutorId: string;
  name: string;
  photoUrl: string | null;
  status: TutorStatus;
  pricing: string | null;
  subjects: string[];
  savedAt: string;
}

function formatPricing(value: { toString(): string } | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value.toString();
}

function mapSavedTutor(saved: {
  createdAt: Date;
  tutor: {
    userId: string;
    name: string;
    photoUrl: string | null;
    status: TutorStatus;
    pricing: { toString(): string } | null;
    subjects: { subject: string }[];
  };
}): SavedTutorResponse {
  return {
    tutorId: saved.tutor.userId,
    name: saved.tutor.name,
    photoUrl: saved.tutor.photoUrl,
    status: saved.tutor.status,
    pricing: formatPricing(saved.tutor.pricing),
    subjects: saved.tutor.subjects.map((s) => s.subject),
    savedAt: saved.createdAt.toISOString(),
  };
}

const savedTutorInclude = {
  tutor: {
    include: {
      subjects: true,
    },
  },
} satisfies Prisma.SavedTutorInclude;

async function getTutorOrThrow(tutorId: string) {
  const tutor = await prisma.tutorProfile.findUnique({
    where: { userId: tutorId },
    select: { userId: true },
  });

  if (!tutor) {
    throw new AppError("Tutor not found", 404, "TUTOR_NOT_FOUND");
  }

  return tutor;
}

export async function listSavedTutors(studentId: string): Promise<SavedTutorResponse[]> {
  const saved = await prisma.savedTutor.findMany({
    where: { studentId },
    include: savedTutorInclude,
    orderBy: { createdAt: "desc" },
  });

  return saved.map(mapSavedTutor);
}

export async function saveTutor(studentId: string, tutorId: string): Promise<SavedTutorResponse> {
  if (studentId === tutorId) {
    throw new AppError("You cannot save yourself", 400, "INVALID_TUTOR");
  }

  await getTutorOrThrow(tutorId);

  const saved = await prisma.savedTutor.upsert({
    where: {
      studentId_tutorId: { studentId, tutorId },
    },
    create: { studentId, tutorId },
    update: {},
    include: savedTutorInclude,
  });

  return mapSavedTutor(saved);
}

export async function unsaveTutor(studentId: string, tutorId: string): Promise<void> {
  const result = await prisma.savedTutor.deleteMany({
    where: { studentId, tutorId },
  });

  if (result.count === 0) {
    throw new AppError("Saved tutor not found", 404, "SAVED_TUTOR_NOT_FOUND");
  }
}
