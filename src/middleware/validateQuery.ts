import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      res.status(400).json({
        error: "Validation failed",
        details: result.error.flatten().fieldErrors,
      });
      return;
    }

    res.locals.validatedQuery = result.data;
    next();
  };
}

export function getValidatedQuery<T>(res: Response): T {
  return res.locals.validatedQuery as T;
}
