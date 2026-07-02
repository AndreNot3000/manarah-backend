import { InquiryStatus, Prisma, TutorStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/errors";
import { createNotification } from "./notificationService";
import { CreateInquiryInput, ListInquiriesQuery } from "../validators/inquiry";

const PUBLIC_TUTOR_STATUSES: TutorStatus[] = [TutorStatus.VERIFIED, TutorStatus.PREMIUM];

export interface InquiryResponse {
  id: string;
  tutorId: string;
  message: string;
  status: InquiryStatus;
  createdAt: string;
}

export interface TutorInquiryItem extends InquiryResponse {
  student: {
    id: string;
    name: string;
  };
}

export interface TutorInquiryListResponse {
  inquiries: TutorInquiryItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}

const inquiryInclude = {
  student: {
    include: {
      studentProfile: true,
    },
  },
} satisfies Prisma.TutorInquiryInclude;

function mapInquiry(inquiry: {
  id: string;
  tutorId: string;
  message: string;
  status: InquiryStatus;
  createdAt: Date;
}): InquiryResponse {
  return {
    id: inquiry.id,
    tutorId: inquiry.tutorId,
    message: inquiry.message,
    status: inquiry.status,
    createdAt: inquiry.createdAt.toISOString(),
  };
}

function mapTutorInquiry(inquiry: {
  id: string;
  tutorId: string;
  studentId: string;
  message: string;
  status: InquiryStatus;
  createdAt: Date;
  student: {
    studentProfile: {
      name: string;
    } | null;
  };
}): TutorInquiryItem {
  return {
    ...mapInquiry(inquiry),
    student: {
      id: inquiry.studentId,
      name: inquiry.student.studentProfile?.name ?? "Student",
    },
  };
}

async function getPublicTutorOrThrow(tutorId: string) {
  const tutor = await prisma.tutorProfile.findFirst({
    where: {
      userId: tutorId,
      status: { in: PUBLIC_TUTOR_STATUSES },
    },
    select: {
      userId: true,
      name: true,
    },
  });

  if (!tutor) {
    throw new AppError("Tutor not found", 404, "TUTOR_NOT_FOUND");
  }

  return tutor;
}

export async function createInquiry(
  studentId: string,
  input: CreateInquiryInput
): Promise<InquiryResponse> {
  if (studentId === input.tutorId) {
    throw new AppError("You cannot send an inquiry to yourself", 400, "INVALID_INQUIRY");
  }

  const [tutor, student] = await Promise.all([
    getPublicTutorOrThrow(input.tutorId),
    prisma.user.findUnique({
      where: { id: studentId },
      include: { studentProfile: true },
    }),
  ]);

  if (!student?.studentProfile) {
    throw new AppError("Student profile not found", 404, "PROFILE_NOT_FOUND");
  }

  const inquiry = await prisma.tutorInquiry.create({
    data: {
      tutorId: input.tutorId,
      studentId,
      message: input.message,
    },
  });

  const preview =
    input.message.length > 120 ? `${input.message.slice(0, 117)}...` : input.message;

  await createNotification(
    input.tutorId,
    "New student inquiry",
    `${student.studentProfile.name} sent you an inquiry about your tutoring profile: ${preview}`
  );

  return mapInquiry(inquiry);
}

export async function listTutorInquiries(
  tutorId: string,
  query: ListInquiriesQuery
): Promise<TutorInquiryListResponse> {
  const page = query.page;
  const limit = query.limit;
  const skip = (page - 1) * limit;

  const where = { tutorId };

  const [inquiries, total] = await Promise.all([
    prisma.tutorInquiry.findMany({
      where,
      include: inquiryInclude,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.tutorInquiry.count({ where }),
  ]);

  return {
    inquiries: inquiries.map(mapTutorInquiry),
    meta: { page, limit, total },
  };
}
