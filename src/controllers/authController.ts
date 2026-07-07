import { Request, Response } from "express";
import {
  AuthError,
  forgotPassword,
  login,
  registerStudent,
  registerTutor,
  resetPassword,
} from "../services/authService";
import {
  ForgotPasswordInput,
  LoginInput,
  RegisterStudentInput,
  RegisterTutorInput,
  ResetPasswordInput,
} from "../validators/auth";

function handleAuthError(res: Response, error: unknown) {
  if (error instanceof AuthError) {
    res.status(error.statusCode).json({
      error: error.message,
      code: error.code,
    });
    return;
  }

  console.error(error);
  res.status(500).json({ error: "Internal server error" });
}

export async function registerStudentHandler(req: Request, res: Response) {
  try {
    const result = await registerStudent(req.body as RegisterStudentInput);
    res.status(201).json(result);
  } catch (error) {
    handleAuthError(res, error);
  }
}

export async function registerTutorHandler(req: Request, res: Response) {
  try {
    const result = await registerTutor(req.body as RegisterTutorInput);
    res.status(201).json(result);
  } catch (error) {
    handleAuthError(res, error);
  }
}

export async function loginHandler(req: Request, res: Response) {
  try {
    const result = await login(req.body as LoginInput);
    res.json(result);
  } catch (error) {
    handleAuthError(res, error);
  }
}

export async function forgotPasswordHandler(req: Request, res: Response) {
  try {
    const result = await forgotPassword(req.body as ForgotPasswordInput);
    res.json(result);
  } catch (error) {
    handleAuthError(res, error);
  }
}

export async function resetPasswordHandler(req: Request, res: Response) {
  try {
    const result = await resetPassword(req.body as ResetPasswordInput);
    res.json(result);
  } catch (error) {
    handleAuthError(res, error);
  }
}

export function meHandler(req: Request, res: Response) {
  res.json({ user: req.user });
}

export function adminCheckHandler(_req: Request, res: Response) {
  res.json({ ok: true });
}
