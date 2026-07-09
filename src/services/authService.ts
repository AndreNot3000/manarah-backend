import { Prisma, User, UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { signToken } from "../utils/jwt";
import { hashPassword, comparePassword } from "../utils/password";
import { signPasswordResetToken, verifyPasswordResetToken } from "../utils/resetToken";
import {
  ForgotPasswordInput,
  LoginInput,
  RegisterStudentInput,
  RegisterTutorInput,
  ResetPasswordInput,
} from "../validators/auth";

import { sendWelcomeEmail, sendPasswordResetEmail } from "./emailService";

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export interface AuthUserResponse {
  id: string;
  email: string;
  role: UserRole;
  name: string;
}

function formatUser(
  user: User & {
    studentProfile?: { name: string } | null;
    tutorProfile?: { name: string } | null;
  }
): AuthUserResponse {
  const name =
    user.studentProfile?.name ?? user.tutorProfile?.name ?? user.email.split("@")[0];

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    name,
  };
}

function createAuthResponse(user: AuthUserResponse) {
  const token = signToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  return { token, user };
}

function handlePrismaError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new AuthError("Email already in use", 409, "EMAIL_EXISTS");
  }
  throw error;
}

export async function registerStudent(input: RegisterStudentInput) {
  const passwordHash = await hashPassword(input.password);
  const email = input.email.toLowerCase();

  try {
    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email,
          passwordHash,
          role: UserRole.STUDENT,
        },
      });

      await tx.studentProfile.create({
        data: {
          userId: createdUser.id,
          name: input.name,
          phone: input.phone,
        },
      });

      return tx.user.findUniqueOrThrow({
        where: { id: createdUser.id },
        include: { studentProfile: true, tutorProfile: true },
      });
    });

    const response = createAuthResponse(formatUser(user));

    // Send welcome email asynchronously
    sendWelcomeEmail(user.email, input.name, "STUDENT").catch((err) => {
      console.error("Failed to send student welcome email:", err);
    });

    return response;
  } catch (error) {
    handlePrismaError(error);
  }
}

export async function registerTutor(input: RegisterTutorInput) {
  const passwordHash = await hashPassword(input.password);
  const email = input.email.toLowerCase();

  try {
    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email,
          passwordHash,
          role: UserRole.TUTOR,
        },
      });

      await tx.tutorProfile.create({
        data: {
          userId: createdUser.id,
          name: input.name,
        },
      });

      return tx.user.findUniqueOrThrow({
        where: { id: createdUser.id },
        include: { studentProfile: true, tutorProfile: true },
      });
    });

    const response = createAuthResponse(formatUser(user));

    // Send welcome email asynchronously
    sendWelcomeEmail(user.email, input.name, "TUTOR").catch((err) => {
      console.error("Failed to send tutor welcome email:", err);
    });

    return response;
  } catch (error) {
    handlePrismaError(error);
  }
}

export async function login(input: LoginInput) {
  const email = input.email.toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email },
    include: { studentProfile: true, tutorProfile: true },
  });

  if (!user) {
    throw new AuthError("Invalid email or password", 401, "INVALID_CREDENTIALS");
  }

  const valid = await comparePassword(input.password, user.passwordHash);

  if (!valid) {
    throw new AuthError("Invalid email or password", 401, "INVALID_CREDENTIALS");
  }

  return createAuthResponse(formatUser(user));
}

export async function forgotPassword(input: ForgotPasswordInput) {
  const email = input.email.toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });

  if (user) {
    const resetToken = signPasswordResetToken(user.id);
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

    // Send reset link email asynchronously
    sendPasswordResetEmail(user.email, resetLink).catch((err) => {
      console.error("Failed to send password reset email:", err);
    });

    if (process.env.NODE_ENV !== "production") {
      console.log(`[password-reset] email=${user.email} token=${resetToken}`);
    }
  }

  return {
    message: "If an account exists for this email, a password reset link has been sent.",
  };
}

export async function resetPassword(input: ResetPasswordInput) {
  let userId: string;

  try {
    ({ userId } = verifyPasswordResetToken(input.token));
  } catch {
    throw new AuthError("Invalid or expired reset token", 400, "INVALID_RESET_TOKEN");
  }

  const passwordHash = await hashPassword(input.newPassword);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  return { message: "Password updated successfully" };
}
