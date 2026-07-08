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

export const updatePaymentSchema = z.object({
  status: z.enum(["CONFIRMED", "REJECTED"]),
});

export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>;

export const createAnnouncementSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  body: z.string().trim().min(1, "Body is required"),
});

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
