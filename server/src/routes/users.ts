import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { hashPassword, requireAdmin } from "../auth.js";

const router = Router();
router.use(requireAdmin);

function toPublicUser(u: {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
}) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    isActive: u.isActive,
    createdAt: u.createdAt,
  };
}

router.get("/", async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  res.json({ users: users.map(toPublicUser) });
});

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, "Mật khẩu cần ít nhất 6 ký tự."),
  name: z.string().min(1, "Cần nhập tên."),
  role: z.enum(["admin", "user"]).default("user"),
});

router.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." });
    return;
  }
  const { email, password, name, role } = parsed.data;
  try {
    const user = await prisma.user.create({
      data: { email: email.toLowerCase(), passwordHash: await hashPassword(password), name, role },
    });
    res.status(201).json({ user: toPublicUser(user) });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      res.status(409).json({ error: "Email này đã có tài khoản." });
      return;
    }
    throw err;
  }
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["admin", "user"]).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

router.patch("/:id", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." });
    return;
  }
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) {
    res.status(404).json({ error: "Không tìm thấy người dùng." });
    return;
  }

  const demotingOrDeactivatingLastAdmin =
    target.role === "admin" &&
    ((parsed.data.role && parsed.data.role !== "admin") || parsed.data.isActive === false);
  if (demotingOrDeactivatingLastAdmin) {
    const otherActiveAdmins = await prisma.user.count({
      where: { role: "admin", isActive: true, id: { not: target.id } },
    });
    if (otherActiveAdmins === 0) {
      res.status(400).json({ error: "Không thể bỏ quyền admin cuối cùng — cần ít nhất 1 admin đang hoạt động." });
      return;
    }
  }

  const { name, role, isActive, password } = parsed.data;
  const user = await prisma.user.update({
    where: { id: target.id },
    data: {
      ...(name !== undefined && { name }),
      ...(role !== undefined && { role }),
      ...(isActive !== undefined && { isActive }),
      ...(password !== undefined && { passwordHash: await hashPassword(password) }),
    },
  });
  res.json({ user: toPublicUser(user) });
});

router.delete("/:id", async (req, res) => {
  if (req.params.id === req.auth!.sub) {
    res.status(400).json({ error: "Không thể tự xóa tài khoản của chính mình." });
    return;
  }
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) {
    res.status(404).json({ error: "Không tìm thấy người dùng." });
    return;
  }
  if (target.role === "admin") {
    const otherActiveAdmins = await prisma.user.count({
      where: { role: "admin", isActive: true, id: { not: target.id } },
    });
    if (otherActiveAdmins === 0) {
      res.status(400).json({ error: "Không thể xóa admin cuối cùng." });
      return;
    }
  }
  const diagramCount = await prisma.diagram.count({ where: { ownerId: target.id } });
  await prisma.user.delete({ where: { id: target.id } });
  res.json({ ok: true, deletedDiagramCount: diagramCount });
});

export default router;
