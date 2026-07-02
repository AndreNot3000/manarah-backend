import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100).optional(),
  phone: z
    .string()
    .trim()
    .max(20)
    .optional()
    .nullable()
    .transform((value) => (value === "" ? null : value)),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export function parseUpdateProfileInput(body: Record<string, unknown>): UpdateProfileInput {
  const parsed = updateProfileSchema.safeParse({
    name: body.name,
    phone: body.phone,
  });

  if (!parsed.success) {
    throw parsed.error;
  }

  return parsed.data;
}
