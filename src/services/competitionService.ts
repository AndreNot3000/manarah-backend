import {
  CompetitionStatus,
  CompetitionType,
  PaymentStatus,
  Prisma,
  RegistrationStatus,
} from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/errors";
import { createNotification } from "./notificationService";
import { getCompetitionDocPublicUrl } from "../middleware/upload";
import { ListCompetitionsQuery } from "../validators/competition";

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

export interface CompetitionListItem {
  id: string;
  title: string;
  description: string;
  fee: string;
  deadline: string;
  category: string;
  type: CompetitionType;
  status: CompetitionStatus;
  createdAt: string;
}

export interface CompetitionDocument {
  id: string;
  registrationId: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: string;
}

export interface CompetitionRegistrationItem {
  id: string;
  status: RegistrationStatus;
  paymentStatus: PaymentStatus;
  createdAt: string;
  documents: CompetitionDocument[];
  competition: CompetitionListItem;
}

export interface CompetitionDetail extends CompetitionListItem {
  registrationCount: number;
  userRegistration?: {
    id: string;
    status: RegistrationStatus;
    paymentStatus: PaymentStatus;
    documents: CompetitionDocument[];
  };
  winners?: {
    userId: string;
    name: string;
    email: string;
    placement: number;
  }[];
}

export interface CompetitionListResponse {
  competitions: CompetitionListItem[];
  meta: { page: number; limit: number; total: number };
}

export interface MyCompetitionsResponse {
  registrations: CompetitionRegistrationItem[];
  meta: { page: number; limit: number; total: number };
}

export interface RegistrationResponse {
  id: string;
  competitionId: string;
  userId: string;
  status: RegistrationStatus;
  paymentStatus: PaymentStatus;
  createdAt: string;
}

export interface DocumentsResponse {
  registrationId: string;
  documents: CompetitionDocument[];
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function mapCompetition(c: {
  id: string;
  title: string;
  description: string;
  fee: { toString(): string };
  deadline: Date;
  category: string;
  type: CompetitionType;
  status: CompetitionStatus;
  createdAt: Date;
}): CompetitionListItem {
  return {
    id: c.id,
    title: c.title,
    description: c.description,
    fee: c.fee.toString(),
    deadline: c.deadline.toISOString(),
    category: c.category,
    type: c.type,
    status: c.status,
    createdAt: c.createdAt.toISOString(),
  };
}

function mapDocument(d: {
  id: string;
  registrationId: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: Date;
}): CompetitionDocument {
  return {
    id: d.id,
    registrationId: d.registrationId,
    fileName: d.fileName,
    fileUrl: d.fileUrl,
    uploadedAt: d.uploadedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// BE-040 — Public listing & detail
// ---------------------------------------------------------------------------

export async function listCompetitions(
  query: ListCompetitionsQuery
): Promise<CompetitionListResponse> {
  const page = query.page;
  const limit = query.limit;
  const skip = (page - 1) * limit;

  const where = {
    ...(query.type ? { type: query.type } : {}),
    ...(query.status ? { status: query.status } : {}),
  };

  const [competitions, total] = await Promise.all([
    prisma.competition.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.competition.count({ where }),
  ]);

  return {
    competitions: competitions.map(mapCompetition),
    meta: { page, limit, total },
  };
}

export async function getCompetitionById(
  competitionId: string,
  userId?: string
): Promise<CompetitionDetail> {
  const competition = await prisma.competition.findUnique({
    where: { id: competitionId },
    include: {
      _count: { select: { registrations: true } },
      registrations: userId
        ? { where: { userId }, include: { documents: true } }
        : false,
    },
  });

  if (!competition) {
    throw new AppError("Competition not found", 404, "COMPETITION_NOT_FOUND");
  }

  const base = mapCompetition(competition);
  const userReg = userId
    ? (
        competition.registrations as (typeof competition.registrations[number] & {
          documents: { id: string; registrationId: string; fileName: string; fileUrl: string; uploadedAt: Date }[];
        })[]
      )[0]
    : undefined;

  // If results are published, fetch placements to construct leaderboard details
  let winners: CompetitionDetail["winners"] = undefined;
  if (competition.status === CompetitionStatus.RESULTS_PUBLISHED) {
    const winnerRegs = await prisma.competitionRegistration.findMany({
      where: { competitionId, placement: { not: null } },
      include: { user: { include: { studentProfile: true } } },
      orderBy: { placement: "asc" },
    });
    winners = winnerRegs.map(w => ({
      userId: w.userId,
      name: w.user.studentProfile?.name ?? w.user.email.split("@")[0],
      email: w.user.email,
      placement: w.placement!,
    }));
  }

  return {
    ...base,
    registrationCount: competition._count.registrations,
    ...(userReg
      ? {
          userRegistration: {
            id: userReg.id,
            status: userReg.status,
            paymentStatus: userReg.paymentStatus,
            documents: userReg.documents.map(mapDocument),
          },
        }
      : {}),
    winners,
  };
}

export async function getMyCompetitions(
  userId: string,
  page: number,
  limit: number
): Promise<MyCompetitionsResponse> {
  const skip = (page - 1) * limit;

  const [registrations, total] = await Promise.all([
    prisma.competitionRegistration.findMany({
      where: { userId },
      include: { competition: true, documents: true },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.competitionRegistration.count({ where: { userId } }),
  ]);

  return {
    registrations: registrations.map((r) => ({
      id: r.id,
      status: r.status,
      paymentStatus: r.paymentStatus,
      createdAt: r.createdAt.toISOString(),
      documents: r.documents.map(mapDocument),
      competition: mapCompetition(r.competition),
    })),
    meta: { page, limit, total },
  };
}

// ---------------------------------------------------------------------------
// BE-041 — Registration
// ---------------------------------------------------------------------------

export async function registerForCompetition(
  userId: string,
  competitionId: string
): Promise<RegistrationResponse> {
  const competition = await prisma.competition.findUnique({
    where: { id: competitionId },
  });

  if (!competition) {
    throw new AppError("Competition not found", 404, "COMPETITION_NOT_FOUND");
  }

  if (competition.status !== CompetitionStatus.OPEN) {
    throw new AppError("Competition is not open for registration", 400, "COMPETITION_NOT_OPEN");
  }

  if (new Date() > competition.deadline) {
    throw new AppError("Registration deadline has passed", 400, "DEADLINE_PASSED");
  }

  const feeAmount = Number(competition.fee.toString());
  const paymentStatus: PaymentStatus =
    feeAmount > 0 ? PaymentStatus.PENDING : PaymentStatus.CONFIRMED;

  let registration;
  try {
    registration = await prisma.competitionRegistration.create({
      data: { competitionId, userId, paymentStatus },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AppError(
        "You are already registered for this competition",
        409,
        "ALREADY_REGISTERED"
      );
    }
    throw error;
  }

  const notificationBody =
    feeAmount > 0
      ? `You have registered for "${competition.title}". Please upload your payment proof to confirm your spot.`
      : `You have successfully registered for "${competition.title}".`;

  await createNotification(userId, "Competition Registration", notificationBody);

  return {
    id: registration.id,
    competitionId: registration.competitionId,
    userId: registration.userId,
    status: registration.status,
    paymentStatus: registration.paymentStatus,
    createdAt: registration.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// BE-042 — Document upload & listing
// ---------------------------------------------------------------------------

export async function uploadCompetitionDocuments(
  userId: string,
  competitionId: string,
  files: { filename: string; originalname: string }[]
): Promise<DocumentsResponse> {
  if (files.length === 0) {
    throw new AppError("At least one file is required", 400, "NO_FILES");
  }

  const competition = await prisma.competition.findUnique({
    where: { id: competitionId },
    select: { id: true },
  });

  if (!competition) {
    throw new AppError("Competition not found", 404, "COMPETITION_NOT_FOUND");
  }

  const registration = await prisma.competitionRegistration.findUnique({
    where: { competitionId_userId: { competitionId, userId } },
  });

  if (!registration) {
    throw new AppError(
      "You are not registered for this competition",
      403,
      "NOT_REGISTERED"
    );
  }

  await prisma.$transaction(
    files.map((file) =>
      prisma.competitionDocument.create({
        data: {
          registrationId: registration.id,
          fileUrl: getCompetitionDocPublicUrl(file.filename),
          fileName: file.originalname,
        },
      })
    )
  );

  // Return all documents for this registration (existing + newly uploaded)
  const allDocuments = await prisma.competitionDocument.findMany({
    where: { registrationId: registration.id },
    orderBy: { uploadedAt: "desc" },
  });

  return {
    registrationId: registration.id,
    documents: allDocuments.map(mapDocument),
  };
}

export async function listCompetitionDocuments(
  userId: string,
  competitionId: string
): Promise<DocumentsResponse> {
  const competition = await prisma.competition.findUnique({
    where: { id: competitionId },
    select: { id: true },
  });

  if (!competition) {
    throw new AppError("Competition not found", 404, "COMPETITION_NOT_FOUND");
  }

  const registration = await prisma.competitionRegistration.findUnique({
    where: { competitionId_userId: { competitionId, userId } },
    include: { documents: { orderBy: { uploadedAt: "desc" } } },
  });

  if (!registration) {
    throw new AppError(
      "You are not registered for this competition",
      403,
      "NOT_REGISTERED"
    );
  }

  return {
    registrationId: registration.id,
    documents: registration.documents.map(mapDocument),
  };
}

export async function getRegistrationDocuments(registrationId: string): Promise<CompetitionDocument[]> {
  const documents = await prisma.competitionDocument.findMany({
    where: { registrationId },
    orderBy: { uploadedAt: "desc" },
  });
  return documents.map(mapDocument);
}

export async function updatePaymentStatus(registrationId: string, status: PaymentStatus): Promise<void> {
  const registration = await prisma.competitionRegistration.findUnique({
    where: { id: registrationId },
    include: { competition: true },
  });

  if (!registration) {
    throw new AppError("Registration not found", 404, "REGISTRATION_NOT_FOUND");
  }

  await prisma.competitionRegistration.update({
    where: { id: registrationId },
    data: { paymentStatus: status },
  });

  // Notify student
  await createNotification(
    registration.userId,
    "Payment Review Update",
    `Your payment receipt for "${registration.competition.title}" has been ${status === "CONFIRMED" ? "APPROVED" : "REJECTED"}.`
  );
}
