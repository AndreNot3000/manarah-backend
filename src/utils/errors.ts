export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function handleControllerError(res: import("express").Response, error: unknown) {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      error: error.message,
      code: error.code,
    });
    return;
  }

  console.error(error);
  res.status(500).json({ error: "Internal server error" });
}
