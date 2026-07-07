import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be at most 128 characters");

export const registerStudentSchema = z.object({
  email: z.string().email("Invalid email address").max(255),
  password: passwordSchema,
  name: z.string().trim().min(1, "Name is required").max(100),
  phone: z.string().trim().max(20).optional(),
});

export const registerTutorSchema = z.object({
  email: z.string().email("Invalid email address").max(255),
  password: passwordSchema,
  name: z.string().trim().min(1, "Name is required").max(100),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  newPassword: passwordSchema,
});

export type RegisterStudentInput = z.infer<typeof registerStudentSchema>;
export type RegisterTutorInput = z.infer<typeof registerTutorSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
