import rateLimit from "express-rate-limit";

const authWindowMs = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000);
const loginMax = Number(process.env.AUTH_LOGIN_RATE_LIMIT_MAX ?? 10);
const registerMax = Number(process.env.AUTH_REGISTER_RATE_LIMIT_MAX ?? 10);
const resetMax = Number(process.env.AUTH_RESET_RATE_LIMIT_MAX ?? 5);

function rateLimitHandler(_req: import("express").Request, res: import("express").Response) {
  res.status(429).json({
    error: "Too many requests. Please try again later.",
    code: "RATE_LIMITED",
  });
}

export const loginRateLimiter = rateLimit({
  windowMs: authWindowMs,
  max: loginMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

export const registerRateLimiter = rateLimit({
  windowMs: authWindowMs,
  max: registerMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

export const passwordResetRateLimiter = rateLimit({
  windowMs: authWindowMs,
  max: resetMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});
