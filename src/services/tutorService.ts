import { Prisma, TutorStatus, TutorSubjectType } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/errors";
import {
  deleteAvatarFile,
  deleteQualificationFile,
  getAvatarFilenameFromUrl,
  getAvatarPublicUrl,
  getQualificationFilenameFromUrl,
  getQualificationPublicUrl,
} from "../middleware/upload";
import { ListTutorsQuery, UpdateTutorProfileInput } from "../validators/tutor";

const PUBLIC_TUTOR_STATUSES: TutorStatus[] = [TutorStatus.VERIFIED, TutorStatus.PREMIUM];

export interface TutorListItem {
  id: string;
  name: string;
  photoUrl: string | null;
  status: TutorStatus;
  pricing: string | null;
  experience: string | null;
  bio: string | null;
  subjects: TutorSubjectType[];
}

export interface TutorQualificationItem {
  id: string;
  title: string;
  fileUrl: string;
}

export interface TutorDetail extends TutorListItem {
  availability: string | null;
  qualifications: TutorQualificationItem[];
}

export interface OwnTutorProfile extends TutorDetail {
  email: string;
}

export interface TutorProfileUpdateFiles {
  photoFilename?: string;
  qualifications?: { title: string; filename: string }[];
}

export interface TutorListResponse {
  tutors: TutorListItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}

const listInclude = {
  subjects: true,
} satisfies Prisma.TutorProfileInclude;

const detailInclude = {
  subjects: true,
  qualifications: true,
} satisfies Prisma.TutorProfileInclude;

function formatPricing(value: { toString(): string } | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value.toString();
}

function mapTutorListItem(tutor: {
  userId: string;
  name: string;
  photoUrl: string | null;
  status: TutorStatus;
  pricing: { toString(): string } | null;
  experience: string | null;
  bio: string | null;
  subjects: { subject: TutorSubjectType }[];
}): TutorListItem {
  return {
    id: tutor.userId,
    name: tutor.name,
    photoUrl: tutor.photoUrl,
    status: tutor.status,
    pricing: formatPricing(tutor.pricing),
    experience: tutor.experience,
    bio: tutor.bio,
    subjects: tutor.subjects.map((s) => s.subject),
  };
}

function mapTutorDetail(tutor: {
  userId: string;
  name: string;
  photoUrl: string | null;
  status: TutorStatus;
  pricing: { toString(): string } | null;
  experience: string | null;
  bio: string | null;
  availability: string | null;
  subjects: { subject: TutorSubjectType }[];
  qualifications: { id: string; title: string; fileUrl: string }[];
}): TutorDetail {
  return {
    ...mapTutorListItem(tutor),
    availability: tutor.availability,
    qualifications: tutor.qualifications.map((q) => ({
      id: q.id,
      title: q.title,
      fileUrl: q.fileUrl,
    })),
  };
}

function buildPublicWhere(query: ListTutorsQuery): Prisma.TutorProfileWhereInput {
  const where: Prisma.TutorProfileWhereInput = {
    status: { in: PUBLIC_TUTOR_STATUSES },
  };

  if (query.subject) {
    where.subjects = { some: { subject: query.subject } };
  }

  if (query.q) {
    where.OR = [
      { name: { contains: query.q, mode: "insensitive" } },
      { bio: { contains: query.q, mode: "insensitive" } },
    ];
  }

  return where;
}

export async function listPublicTutors(query: ListTutorsQuery): Promise<TutorListResponse> {
  const page = query.page;
  const limit = query.limit;
  const skip = (page - 1) * limit;
  const where = buildPublicWhere(query);

  const [tutors, total] = await Promise.all([
    prisma.tutorProfile.findMany({
      where,
      include: listInclude,
      orderBy: [{ status: "desc" }, { name: "asc" }],
      skip,
      take: limit,
    }),
    prisma.tutorProfile.count({ where }),
  ]);

  return {
    tutors: tutors.map(mapTutorListItem),
    meta: { page, limit, total },
  };
}

export async function getPublicTutorById(tutorId: string): Promise<TutorDetail> {
  const tutor = await prisma.tutorProfile.findFirst({
    where: {
      userId: tutorId,
      status: { in: PUBLIC_TUTOR_STATUSES },
    },
    include: detailInclude,
  });

  if (!tutor) {
    throw new AppError("Tutor not found", 404, "TUTOR_NOT_FOUND");
  }

  return mapTutorDetail(tutor);
}

async function getTutorProfileOrThrow(tutorId: string) {
  const tutor = await prisma.tutorProfile.findUnique({
    where: { userId: tutorId },
    include: detailInclude,
  });

  if (!tutor) {
    throw new AppError("Tutor profile not found", 404, "PROFILE_NOT_FOUND");
  }

  return tutor;
}

export async function getOwnTutorProfile(tutorId: string): Promise<OwnTutorProfile> {
  const user = await prisma.user.findUnique({
    where: { id: tutorId },
    select: { email: true },
  });

  if (!user) {
    throw new AppError("User not found", 404, "USER_NOT_FOUND");
  }

  const tutor = await getTutorProfileOrThrow(tutorId);

  return {
    email: user.email,
    ...mapTutorDetail(tutor),
  };
}

export async function updateOwnTutorProfile(
  tutorId: string,
  input: UpdateTutorProfileInput,
  files: TutorProfileUpdateFiles = {}
): Promise<OwnTutorProfile> {
  const existing = await getTutorProfileOrThrow(tutorId);
  const previousPhoto = getAvatarFilenameFromUrl(existing.photoUrl);

  const hasScalarUpdates =
    input.bio !== undefined ||
    input.pricing !== undefined ||
    input.experience !== undefined ||
    input.availability !== undefined ||
    files.photoFilename !== undefined;

  const hasSubjectUpdates = input.subjects !== undefined;
  const hasQualificationRemovals = (input.removeQualificationIds?.length ?? 0) > 0;
  const hasQualificationUploads = (files.qualifications?.length ?? 0) > 0;

  if (
    !hasScalarUpdates &&
    !hasSubjectUpdates &&
    !hasQualificationRemovals &&
    !hasQualificationUploads
  ) {
    throw new AppError("No profile fields to update", 400, "NO_CHANGES");
  }

  if (hasQualificationRemovals) {
    const ownedIds = new Set(existing.qualifications.map((q) => q.id));
    const invalid = input.removeQualificationIds!.filter((id) => !ownedIds.has(id));
    if (invalid.length > 0) {
      throw new AppError("One or more qualifications were not found", 404, "QUALIFICATION_NOT_FOUND");
    }
  }

  await prisma.$transaction(async (tx) => {
    if (hasScalarUpdates || files.photoFilename) {
      await tx.tutorProfile.update({
        where: { userId: tutorId },
        data: {
          ...(input.bio !== undefined ? { bio: input.bio } : {}),
          ...(input.pricing !== undefined ? { pricing: input.pricing } : {}),
          ...(input.experience !== undefined ? { experience: input.experience } : {}),
          ...(input.availability !== undefined ? { availability: input.availability } : {}),
          ...(files.photoFilename
            ? { photoUrl: getAvatarPublicUrl(files.photoFilename) }
            : {}),
        },
      });
    }

    if (hasSubjectUpdates) {
      await tx.tutorSubject.deleteMany({ where: { tutorId } });
      if (input.subjects!.length > 0) {
        await tx.tutorSubject.createMany({
          data: input.subjects!.map((subject) => ({ tutorId, subject })),
        });
      }
    }

    if (hasQualificationRemovals) {
      await tx.tutorQualification.deleteMany({
        where: {
          id: { in: input.removeQualificationIds },
          tutorId,
        },
      });
    }

    if (hasQualificationUploads) {
      await tx.tutorQualification.createMany({
        data: files.qualifications!.map((qualification) => ({
          tutorId,
          title: qualification.title,
          fileUrl: getQualificationPublicUrl(qualification.filename),
        })),
      });
    }
  });

  if (files.photoFilename && previousPhoto && previousPhoto !== files.photoFilename) {
    deleteAvatarFile(previousPhoto);
  }

  if (hasQualificationRemovals) {
    for (const qualification of existing.qualifications) {
      if (input.removeQualificationIds!.includes(qualification.id)) {
        deleteQualificationFile(getQualificationFilenameFromUrl(qualification.fileUrl));
      }
    }
  }

  return getOwnTutorProfile(tutorId);
}
