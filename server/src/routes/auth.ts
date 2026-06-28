import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma.js";
import { signToken } from "../lib/jwt.js";
import { attachUser, requireAuth, COOKIE_NAME, COOKIE_OPTIONS } from "../middleware/auth.js";
import { AppError } from "../lib/errors.js";
import { registerSchema, loginSchema } from "../schemas/auth.schemas.js";

const router = Router();

// Apply auth middleware to all routes in this router
router.use(attachUser);

// ── POST /api/auth/register ───────────────────────────────────────────────────

router.post("/register", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, name, password } = registerSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError(409, "EMAIL_TAKEN", "An account with this email already exists");
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, name, passwordHash },
      select: { id: true, email: true, name: true },
    });

    const token = signToken({ sub: user.id, email: user.email, name: user.name });
    res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);
    res.status(201).json({ data: user });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────

router.post("/login", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    // Use constant-time compare even on missing user to prevent timing attacks
    const hash = user?.passwordHash ?? "$2a$12$invalidhashpadding000000000000000000000000000000000";
    const valid = await bcrypt.compare(password, hash);

    if (!user || !valid) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Incorrect email or password");
    }

    const token = signToken({ sub: user.id, email: user.email, name: user.name });
    res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);
    res.json({ data: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────

router.post("/logout", (_req: Request, res: Response) => {
  res.clearCookie(COOKIE_NAME, { path: "/" });
  res.json({ message: "Logged out" });
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────

router.get("/me", requireAuth, (req: Request, res: Response) => {
  res.json({
    data: {
      id: req.userId!,
      email: req.authUser!.email,
      name: req.authUser!.name,
    },
  });
});

export default router;
