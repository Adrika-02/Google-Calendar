import { Request, Response, NextFunction } from "express";
import { verifyToken, type JwtPayload } from "../lib/jwt.js";
import { AppError } from "../lib/errors.js";

// Extend Express Request with auth fields
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId: string | null;
      authUser: JwtPayload | null;
    }
  }
}

const COOKIE_NAME = "gcal_token";

/** Reads the JWT cookie and attaches userId to req. Never throws — guests get userId=null. */
export function attachUser(req: Request, _res: Response, next: NextFunction): void {
  req.userId = null;
  req.authUser = null;

  const token: string | undefined = req.cookies?.[COOKIE_NAME];
  if (!token) return next();

  try {
    const payload = verifyToken(token);
    req.userId = payload.sub;
    req.authUser = payload;
  } catch {
    // Expired or tampered token — treat as guest, clear cookie on response
    _res.clearCookie(COOKIE_NAME);
  }

  next();
}

/** Use on routes that must be authenticated. */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.userId) {
    next(new AppError(401, "UNAUTHORIZED", "Authentication required"));
    return;
  }
  next();
}

export const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  path: "/",
};

export { COOKIE_NAME };
