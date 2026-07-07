import { TutorStatus, UserRole } from "@prisma/client";
import { z } from "zod";

export const listUsersQuerySchema = z.object({
  role: z.nativeEnum(UserRole).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

export const verifyTutorSchema = z.object({
  status: z.enum(["VERIFIED", "REJECTED"]),
});

export type VerifyTutorInput = z.infer<typeof verifyTutorSchema>;
