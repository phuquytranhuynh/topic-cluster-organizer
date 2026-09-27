import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import type { UserRole } from "@prisma/client";

function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET env var is required");
  return secret;
}
const JWT_SECRET = requireJwtSecret();

export const AUTH_COOKIE_NAME = "tco_session";
const TOKEN_TTL = "7d";

export interface AuthTokenPayload {
  sub: string;
  role: UserRole;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signSessionToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

function verifySessionToken(token: string): AuthTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
  } catch {
    return null;
  }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthTokenPayload;
    }
  }
}

/** Populates req.auth from the session cookie, if present and valid. Does not reject the request. */
export function attachAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[AUTH_COOKIE_NAME];
  if (typeof token === "string") {
    const payload = verifySessionToken(token);
    if (payload) req.auth = payload;
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.auth) {
    res.status(401).json({ error: "Chưa đăng nhập." });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.auth) {
    res.status(401).json({ error: "Chưa đăng nhập." });
    return;
  }
  if (req.auth.role !== "admin") {
    res.status(403).json({ error: "Chỉ admin mới thực hiện được thao tác này." });
    return;
  }
  next();
}
