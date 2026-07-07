import { UserRole, TutorStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/errors";
import {
  deleteAvatarFile,
  getAvatarFilenameFromUrl,
  getAvatarPublicUrl,
} from "../middleware/upload";
import { UpdateProfileInput } from "../validators/user";

interface StudentProfileData {
  name: string;
  phone: string | null;
  avatarUrl: string | null;
}

interface TutorProfileData {
  name: string;
  photoUrl: string | null;
  status: TutorStatus;
  bio: string | null;
  experience: string | null;
  availability: string | null;
  pricing: string | null;
}

export type UserProfileResponse =
  | {
      id: string;
      email: string;
      role: typeof UserRole.STUDENT;
      profile: StudentProfileData;
    }
  | {
      id: string;
      email: string;
      role: typeof UserRole.TUTOR;
      profile: TutorProfileData;
    }
  | {
      id: string;
      email: string;
      role: typeof UserRole.ADMIN;
      profile: null;
    };

function formatPricing(value: { toString(): string } | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value.toString();
}

function mapUserProfile(user: {
  id: string;
  email: string;
  role: UserRole;
  studentProfile: {
    name: string;
    phone: string | null;
    avatarUrl: string | null;
  } | null;
  tutorProfile: {
    name: string;
    photoUrl: string | null;
    status: TutorStatus;
    bio: string | null;
    experience: string | null;
    availability: string | null;
    pricing: { toString(): string } | null;
  } | null;
}): UserProfileResponse {
  if (user.role === UserRole.STUDENT) {
    if (!user.studentProfile) {
      throw new AppError("Student profile not found", 404, "PROFILE_NOT_FOUND");
    }

    return {
      id: user.id,
      email: user.email,
      role: UserRole.STUDENT,
      profile: {
        name: user.studentProfile.name,
        phone: user.studentProfile.phone,
        avatarUrl: user.studentProfile.avatarUrl,
      },
    };
  }

  if (user.role === UserRole.TUTOR) {
    if (!user.tutorProfile) {
      throw new AppError("Tutor profile not found", 404, "PROFILE_NOT_FOUND");
    }

    return {
      id: user.id,
      email: user.email,
      role: UserRole.TUTOR,
      profile: {
        name: user.tutorProfile.name,
        photoUrl: user.tutorProfile.photoUrl,
        status: user.tutorProfile.status,
        bio: user.tutorProfile.bio,
        experience: user.tutorProfile.experience,
        availability: user.tutorProfile.availability,
        pricing: formatPricing(user.tutorProfile.pricing),
      },
    };
  }

  return {
    id: user.id,
    email: user.email,
    role: UserRole.ADMIN,
    profile: null,
  };
}

async function getUserWithProfiles(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      studentProfile: true,
      tutorProfile: true,
    },
  });

  if (!user) {
    throw new AppError("User not found", 404, "USER_NOT_FOUND");
  }

  return user;
}

export async function getCurrentUserProfile(userId: string): Promise<UserProfileResponse> {
  const user = await getUserWithProfiles(userId);
  return mapUserProfile(user);
}

export async function updateCurrentUserProfile(
  userId: string,
  input: UpdateProfileInput,
  avatarFilename?: string
): Promise<UserProfileResponse> {
  const user = await getUserWithProfiles(userId);

  if (user.role === UserRole.ADMIN) {
    throw new AppError("Admin profile cannot be updated via this endpoint", 400, "ADMIN_PROFILE");
  }

  if (user.role === UserRole.STUDENT) {
    if (!user.studentProfile) {
      throw new AppError("Student profile not found", 404, "PROFILE_NOT_FOUND");
    }

    const previousAvatar = getAvatarFilenameFromUrl(user.studentProfile.avatarUrl);
    const avatarUrl = avatarFilename ? getAvatarPublicUrl(avatarFilename) : undefined;

    await prisma.studentProfile.update({
      where: { userId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(avatarUrl !== undefined ? { avatarUrl } : {}),
      },
    });

    if (avatarFilename && previousAvatar && previousAvatar !== avatarFilename) {
      deleteAvatarFile(previousAvatar);
    }
  }

  if (user.role === UserRole.TUTOR) {
    if (!user.tutorProfile) {
      throw new AppError("Tutor profile not found", 404, "PROFILE_NOT_FOUND");
    }

    const previousPhoto = getAvatarFilenameFromUrl(user.tutorProfile.photoUrl);
    const photoUrl = avatarFilename ? getAvatarPublicUrl(avatarFilename) : undefined;

    await prisma.tutorProfile.update({
      where: { userId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(photoUrl !== undefined ? { photoUrl } : {}),
      },
    });

    if (avatarFilename && previousPhoto && previousPhoto !== avatarFilename) {
      deleteAvatarFile(previousPhoto);
    }
  }

  return getCurrentUserProfile(userId);
}
