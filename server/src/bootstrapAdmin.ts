import { prisma } from "./db.js";
import { hashPassword } from "./auth.js";

/**
 * There is no public sign-up — an admin creates every other account through the admin UI — so on a
 * brand-new database there would be no way to log in at all. If the users table is empty, seed exactly
 * one admin from env vars so the first deploy has a way in.
 */
export async function bootstrapAdminIfNeeded() {
  const existingCount = await prisma.user.count();
  if (existingCount > 0) return;

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || "Quản trị viên";
  if (!email || !password) {
    console.warn(
      "[bootstrap] Chưa có user nào và thiếu ADMIN_EMAIL/ADMIN_PASSWORD — sẽ không tạo được tài khoản admin đầu tiên."
    );
    return;
  }

  await prisma.user.create({
    data: { email: email.toLowerCase(), passwordHash: await hashPassword(password), name, role: "admin" },
  });
  console.log(`[bootstrap] Đã tạo tài khoản admin đầu tiên: ${email}`);
}
