import { CompetitionStatus, CompetitionType } from "@prisma/client";
import { z } from "zod";

export const listCompetitionsQuerySchema = z.object({
  type: z.nativeEnum(CompetitionType).optional(),
  status: z.nativeEnum(CompetitionStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type ListCompetitionsQuery = z.infer<typeof listCompetitionsQuerySchema>;

// ---------------------------------------------------------------------------
// Admin competition CRUD (BE-052)
// ---------------------------------------------------------------------------

export const createCompetitionSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().min(1, "Description is required"),
  fee: z.coerce.number().min(0, "Fee must be 0 or more").default(0),
  deadline: z.string().datetime({ message: "deadline must be a valid ISO datetime" }),
  category: z.string().trim().min(1, "Category is required").max(100),
  type: z.nativeEnum(CompetitionType),
  status: z.nativeEnum(CompetitionStatus).optional().default(CompetitionStatus.DRAFT),
});

export type CreateCompetitionInput = z.infer<typeof createCompetitionSchema>;

export const updateCompetitionSchema = createCompetitionSchema.partial();

export type UpdateCompetitionInput = z.infer<typeof updateCompetitionSchema>;

const placementSchema = z.object({
  userId: z.string().min(1),
  placement: z.number().int().min(1),
});

export const publishResultsSchema = z.object({
  winners: z.array(placementSchema).min(1, "At least one winner is required"),
  published: z.literal(true),
});

export type PublishResultsInput = z.infer<typeof publishResultsSchema>;
