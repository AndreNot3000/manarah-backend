import { z } from "zod";

export const createInquirySchema = z.object({
  tutorId: z.string().trim().min(1, "Tutor ID is required"),
  message: z.string().trim().min(1, "Message is required").max(2000),
});

export type CreateInquiryInput = z.infer<typeof createInquirySchema>;

export const listInquiriesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type ListInquiriesQuery = z.infer<typeof listInquiriesQuerySchema>;
