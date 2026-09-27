import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { AUTH_COOKIE_NAME, requireAuth, signSessionToken, verifyPassword } from "../auth.js";

const router = Router();

const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function cookieOptions() {
  // Secure by default in production (cookie only sent over HTTPS) — but that also means logins
  // silently fail to persist if you're testing over plain http://<ip>:4000 before TLS is set up.
  // COOKIE_SECURE=false is an explicit escape hatch for exactly that window, never the default.
  const secure =
    process.env.COOKIE_SECURE === "false"
      ? false
      : process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    maxAge: COOKIE_MAX_AGE_MS,
  };
}

function toPublicUser(u: { id: string; email: string; name: string; role: string; isActive: boolean }) {
  return { id: u.id, email: u.email, name: u.name, role: u.role, isActive: u.isActive };
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Email hoặc mật khẩu không hợp lệ." });
    return;
  }
  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !user.isActive || !(await verifyPassword(password, user.passwordHash))) {
    res.status(401).json({ error: "Email hoặc mật khẩu không đúng." });
    return;
  }
  const token = signSessionToken({ sub: user.id, role: user.role });
  res.cookie(AUTH_COOKIE_NAME, token, cookieOptions());
  res.json({ user: toPublicUser(user) });
});

router.post("/logout", (_req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME);
  res.json({ ok: true });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.auth!.sub } });
  if (!user || !user.isActive) {
    res.clearCookie(AUTH_COOKIE_NAME);
    res.status(401).json({ error: "Phiên đăng nhập không còn hợp lệ." });
    return;
  }
  res.json({ user: toPublicUser(user) });
});

export default router;
