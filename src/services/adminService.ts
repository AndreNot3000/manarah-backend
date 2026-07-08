import { UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/errors";
import { createNotification } from "./notificationService";

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

export interface AdminStats {
  totalUsers: number;
  students: number;
  tutors: number;
  admins: number;
  competitions: number;
  registrations: number;
  pendingTutors: number;
  pendingPayments: number;
}

// ---------------------------------------------------------------------------
// BE-050 — Admin stats
// ---------------------------------------------------------------------------

export async function getAdminStats(): Promise<AdminStats> {
  const [
    totalUsers,
    students,
    tutors,
    admins,
    competitions,
    registrations,
    pendingTutors,
    pendingPayments,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: UserRole.STUDENT } }),
    prisma.user.count({ where: { role: UserRole.TUTOR } }),
    prisma.user.count({ where: { role: UserRole.ADMIN } }),
    prisma.competition.count(),
    prisma.competitionRegistration.count(),
    prisma.tutorProfile.count({ where: { status: "PENDING" } }),
    prisma.competitionRegistration.count({ where: { paymentStatus: "PENDING" } }),
  ]);

  return {
    totalUsers,
    students,
    tutors,
    admins,
    competitions,
    registrations,
    pendingTutors,
    pendingPayments,
  };
}

// ---------------------------------------------------------------------------
// BE-051 — User & tutor admin
// ---------------------------------------------------------------------------

export interface AdminUserListItem {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  createdAt: string;
  status?: string; // For tutors
}

export interface AdminUserListResponse {
  users: AdminUserListItem[];
  meta: { page: number; limit: number; total: number };
}

export interface TutorVerificationResponse {
  id: string;
  name: string;
  status: string; // TutorStatus or "REJECTED" (synthetic)
}

export async function listUsers(query: {
  role?: UserRole;
  page: number;
  limit: number;
}): Promise<AdminUserListResponse> {
  const page = query.page;
  const limit = query.limit;
  const skip = (page - 1) * limit;

  const where = query.role ? { role: query.role } : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: { studentProfile: true, tutorProfile: true },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      name:
        u.studentProfile?.name ??
        u.tutorProfile?.name ??
        u.email.split("@")[0],
      createdAt: u.createdAt.toISOString(),
      ...(u.tutorProfile ? { status: u.tutorProfile.status } : {}),
    })),
    meta: { page, limit, total },
  };
}

export async function verifyTutor(
  tutorId: string,
  status: "VERIFIED" | "REJECTED"
): Promise<TutorVerificationResponse> {
  const tutor = await prisma.tutorProfile.findUnique({
    where: { userId: tutorId },
  });

  if (!tutor) {
    throw new AppError("Tutor not found", 404, "TUTOR_NOT_FOUND");
  }

  const { TutorStatus } = await import("@prisma/client");
  const tutorStatus = status === "VERIFIED" ? TutorStatus.VERIFIED : TutorStatus.PENDING;

  // On VERIFIED — update status; on REJECTED — keep as PENDING (no REJECTED state in schema)
  const updated = await prisma.tutorProfile.update({
    where: { userId: tutorId },
    data: { status: tutorStatus },
  });

  // Notify the tutor
  const message =
    status === "VERIFIED"
      ? "Congratulations! Your tutor profile has been verified. You can now be discovered by students."
      : "Your tutor profile application has been reviewed and was not approved at this time. Please contact support for more information.";

  await createNotification(tutorId, "Profile Status Update", message);

  return {
    id: updated.userId,
    name: updated.name,
    // Return the action taken, not just the db status, so frontend knows it was rejected
    status: status === "REJECTED" ? "REJECTED" : updated.status,
  };
}

// ---------------------------------------------------------------------------
// BE-052 — Competition admin CRUD
// ---------------------------------------------------------------------------

import {
  CreateCompetitionInput,
  UpdateCompetitionInput,
  PublishResultsInput,
} from "../validators/competition";
import { CreateAnnouncementInput } from "../validators/admin";
import { CompetitionStatus, CompetitionType, RegistrationStatus } from "@prisma/client";

export interface AdminCompetitionResponse {
  id: string;
  title: string;
  description: string;
  fee: string;
  deadline: string;
  category: string;
  type: CompetitionType;
  status: CompetitionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ParticipantItem {
  registrationId: string;
  userId: string;
  name: string;
  email: string;
  registrationStatus: RegistrationStatus;
  paymentStatus: string;
  registeredAt: string;
}

export interface ParticipantsResponse {
  competitionId: string;
  title: string;
  participants: ParticipantItem[];
  total: number;
}

function mapAdminCompetition(c: {
  id: string;
  title: string;
  description: string;
  fee: { toString(): string };
  deadline: Date;
  category: string;
  type: CompetitionType;
  status: CompetitionStatus;
  createdAt: Date;
  updatedAt: Date;
}): AdminCompetitionResponse {
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
    updatedAt: c.updatedAt.toISOString(),
  };
}

export async function createCompetition(
  input: CreateCompetitionInput
): Promise<AdminCompetitionResponse> {
  const competition = await prisma.competition.create({
    data: {
      title: input.title,
      description: input.description,
      fee: input.fee,
      deadline: new Date(input.deadline),
      category: input.category,
      type: input.type,
      status: input.status ?? CompetitionStatus.DRAFT,
    },
  });

  return mapAdminCompetition(competition);
}

export async function updateCompetition(
  competitionId: string,
  input: UpdateCompetitionInput
): Promise<AdminCompetitionResponse> {
  const existing = await prisma.competition.findUnique({
    where: { id: competitionId },
  });

  if (!existing) {
    throw new AppError("Competition not found", 404, "COMPETITION_NOT_FOUND");
  }

  const competition = await prisma.competition.update({
    where: { id: competitionId },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.fee !== undefined ? { fee: input.fee } : {}),
      ...(input.deadline !== undefined ? { deadline: new Date(input.deadline) } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
  });

  return mapAdminCompetition(competition);
}

export async function getCompetitionParticipants(
  competitionId: string
): Promise<ParticipantsResponse> {
  const competition = await prisma.competition.findUnique({
    where: { id: competitionId },
    include: {
      registrations: {
        include: {
          user: {
            include: { studentProfile: true, tutorProfile: true },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!competition) {
    throw new AppError("Competition not found", 404, "COMPETITION_NOT_FOUND");
  }

  const participants: ParticipantItem[] = competition.registrations.map((r) => ({
    registrationId: r.id,
    userId: r.userId,
    name:
      r.user.studentProfile?.name ??
      r.user.tutorProfile?.name ??
      r.user.email.split("@")[0],
    email: r.user.email,
    registrationStatus: r.status,
    paymentStatus: r.paymentStatus,
    registeredAt: r.createdAt.toISOString(),
  }));

  return {
    competitionId: competition.id,
    title: competition.title,
    participants,
    total: participants.length,
  };
}

export function buildParticipantsCsv(data: ParticipantsResponse): string {
  const header = [
    "registrationId",
    "userId",
    "name",
    "email",
    "registrationStatus",
    "paymentStatus",
    "registeredAt",
  ].join(",");

  const rows = data.participants.map((p) =>
    [
      p.registrationId,
      p.userId,
      `"${p.name.replace(/"/g, '""')}"`,
      p.email,
      p.registrationStatus,
      p.paymentStatus,
      p.registeredAt,
    ].join(",")
  );

  return [header, ...rows].join("\n");
}

export async function publishResults(
  competitionId: string,
  input: PublishResultsInput
): Promise<AdminCompetitionResponse> {
  const competition = await prisma.competition.findUnique({
    where: { id: competitionId },
    include: { registrations: { select: { userId: true } } },
  });

  if (!competition) {
    throw new AppError("Competition not found", 404, "COMPETITION_NOT_FOUND");
  }

  // Validate all winner userIds are registered for this competition
  const registeredUserIds = new Set(competition.registrations.map((r) => r.userId));
  const invalidWinners = input.winners.filter((w) => !registeredUserIds.has(w.userId));
  if (invalidWinners.length > 0) {
    throw new AppError(
      `The following users are not registered for this competition: ${invalidWinners.map((w) => w.userId).join(", ")}`,
      400,
      "INVALID_WINNERS"
    );
  }

  // Update placement ranks in database
  const updatePlacementPromises = input.winners.map((winner) => {
    return prisma.competitionRegistration.updateMany({
      where: { competitionId, userId: winner.userId },
      data: { placement: winner.placement },
    });
  });
  await Promise.all(updatePlacementPromises);

  // Update competition status to RESULTS_PUBLISHED
  const updated = await prisma.competition.update({
    where: { id: competitionId },
    data: { status: CompetitionStatus.RESULTS_PUBLISHED },
  });

  // Notify all registered participants
  const notificationPromises = competition.registrations.map((r) => {
    const winner = input.winners.find((w) => w.userId === r.userId);
    const body = winner
      ? `Results are out for "${competition.title}". Congratulations — you placed #${winner.placement}!`
      : `Results have been published for "${competition.title}". Check the competition page to see the results.`;

    return createNotification(r.userId, "Competition Results Published", body);
  });

  await Promise.all(notificationPromises);

  return mapAdminCompetition(updated);
}

export async function createAnnouncement(
  input: CreateAnnouncementInput
) {
  // Create announcement in database
  const announcement = await prisma.announcement.create({
    data: {
      title: input.title,
      body: input.body,
    },
  });

  // Fetch all users in database
  const users = await prisma.user.findMany({
    select: { id: true },
  });

  // Create notifications in background parallel
  const notificationPromises = users.map((u) => {
    return createNotification(u.id, `Broadcast: ${input.title}`, input.body);
  });
  await Promise.all(notificationPromises);

  return {
    id: announcement.id,
    title: announcement.title,
    body: announcement.body,
    createdAt: announcement.createdAt.toISOString(),
  };
}
