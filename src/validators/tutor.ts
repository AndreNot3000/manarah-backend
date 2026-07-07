import { z } from "zod";
import { TutorSubjectType } from "@prisma/client";

export const listTutorsQuerySchema = z.object({
  subject: z.nativeEnum(TutorSubjectType).optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type ListTutorsQuery = z.infer<typeof listTutorsQuerySchema>;

export const TUTOR_SUBJECTS = Object.values(TutorSubjectType);

const pricingSchema = z
  .union([
    z.string().trim().regex(/^\d+(\.\d{1,2})?$/, "Pricing must be a valid amount"),
    z.number().nonnegative(),
  ])
  .optional()
  .nullable()
  .transform((value) => {
    if (value === null || value === undefined) return value;
    return typeof value === "number" ? value.toFixed(2) : value;
  });

export const updateTutorProfileSchema = z.object({
  bio: z.string().trim().max(2000).optional().nullable(),
  pricing: pricingSchema,
  experience: z.string().trim().max(500).optional().nullable(),
  availability: z.string().trim().max(500).optional().nullable(),
  subjects: z.array(z.nativeEnum(TutorSubjectType)).optional(),
  removeQualificationIds: z.array(z.string().trim().min(1)).optional(),
});

export type UpdateTutorProfileInput = z.infer<typeof updateTutorProfileSchema>;

function parseJsonArrayField(value: unknown, fieldName: string): unknown {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      throw new Error(`Invalid JSON for ${fieldName}`);
    }
  }
  return value;
}

export function parseUpdateTutorProfileInput(body: Record<string, unknown>): UpdateTutorProfileInput {
  const parsed = updateTutorProfileSchema.safeParse({
    bio: body.bio,
    pricing: body.pricing,
    experience: body.experience,
    availability: body.availability,
    subjects: parseJsonArrayField(body.subjects, "subjects"),
    removeQualificationIds: parseJsonArrayField(body.removeQualificationIds, "removeQualificationIds"),
  });

  if (!parsed.success) {
    throw parsed.error;
  }

  return parsed.data;
}

export function parseQualificationTitles(value: unknown): string[] {
  const raw = parseJsonArrayField(value, "qualificationTitles");
  if (raw === undefined) return [];

  const result = z.array(z.string().trim().min(1).max(200)).safeParse(raw);
  if (!result.success) {
    throw result.error;
  }

  return result.data;
}
