import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { requireAdmin, requireAuth } from "../auth.js";

const router = Router();
router.use(requireAuth);

// clusters/articles/positions/hidden*Ids are stored as opaque JSON blobs (see schema.prisma) — the
// client owns their real shape, so the server only checks the coarse array/record/nullable shape via
// zod above and otherwise passes them through untouched. Prisma's generated Json input type is a
// recursive JSON-value union that plain `unknown[]`/`Record<string, unknown>` doesn't structurally
// satisfy, hence the cast.
function toJsonInput(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

const listSelect = {
  id: true,
  name: true,
  createdAt: true,
  updatedAt: true,
} as const;

// GET /api/diagrams — the current user's own diagrams, list view (no article/cluster payload).
router.get("/", async (req, res) => {
  const diagrams = await prisma.diagram.findMany({
    where: { ownerId: req.auth!.sub },
    select: listSelect,
    orderBy: { updatedAt: "desc" },
  });
  res.json({ diagrams });
});

// GET /api/diagrams/all — admin oversight: every user's diagrams, with owner info.
router.get("/all", requireAdmin, async (_req, res) => {
  const diagrams = await prisma.diagram.findMany({
    select: { ...listSelect, owner: { select: { id: true, name: true, email: true } } },
    orderBy: { updatedAt: "desc" },
  });
  res.json({ diagrams });
});

async function loadOwnedDiagram(id: string, auth: { sub: string; role: string }) {
  const diagram = await prisma.diagram.findUnique({ where: { id } });
  if (!diagram) return { diagram: null, forbidden: false };
  if (diagram.ownerId !== auth.sub && auth.role !== "admin") return { diagram: null, forbidden: true };
  return { diagram, forbidden: false };
}

router.get("/:id", async (req, res) => {
  const { diagram, forbidden } = await loadOwnedDiagram(req.params.id, req.auth!);
  if (forbidden) {
    res.status(403).json({ error: "Bạn không có quyền xem sơ đồ này." });
    return;
  }
  if (!diagram) {
    res.status(404).json({ error: "Không tìm thấy sơ đồ." });
    return;
  }
  res.json({ diagram });
});

const createSchema = z.object({
  name: z.string().min(1).default("Sơ đồ chưa đặt tên"),
  clusters: z.array(z.unknown()).default([]),
  articles: z.array(z.unknown()).default([]),
});

router.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." });
    return;
  }
  const diagram = await prisma.diagram.create({
    data: {
      ownerId: req.auth!.sub,
      name: parsed.data.name,
      clusters: toJsonInput(parsed.data.clusters),
      articles: toJsonInput(parsed.data.articles),
    },
  });
  res.status(201).json({ diagram });
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  clusters: z.array(z.unknown()).optional(),
  articles: z.array(z.unknown()).optional(),
  positions: z.record(z.unknown()).nullable().optional(),
  hiddenClusterIds: z.record(z.unknown()).nullable().optional(),
  hiddenArticleIds: z.record(z.unknown()).nullable().optional(),
});

router.put("/:id", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." });
    return;
  }
  const { diagram, forbidden } = await loadOwnedDiagram(req.params.id, req.auth!);
  if (forbidden) {
    res.status(403).json({ error: "Bạn không có quyền sửa sơ đồ này." });
    return;
  }
  if (!diagram) {
    res.status(404).json({ error: "Không tìm thấy sơ đồ." });
    return;
  }
  const { name, clusters, articles, positions, hiddenClusterIds, hiddenArticleIds } = parsed.data;
  const updated = await prisma.diagram.update({
    where: { id: diagram.id },
    data: {
      ...(name !== undefined && { name }),
      ...(clusters !== undefined && { clusters: toJsonInput(clusters) }),
      ...(articles !== undefined && { articles: toJsonInput(articles) }),
      ...(positions !== undefined && { positions: positions === null ? Prisma.JsonNull : toJsonInput(positions) }),
      ...(hiddenClusterIds !== undefined && {
        hiddenClusterIds: hiddenClusterIds === null ? Prisma.JsonNull : toJsonInput(hiddenClusterIds),
      }),
      ...(hiddenArticleIds !== undefined && {
        hiddenArticleIds: hiddenArticleIds === null ? Prisma.JsonNull : toJsonInput(hiddenArticleIds),
      }),
    },
  });
  res.json({ diagram: updated });
});

router.delete("/:id", async (req, res) => {
  const { diagram, forbidden } = await loadOwnedDiagram(req.params.id, req.auth!);
  if (forbidden) {
    res.status(403).json({ error: "Bạn không có quyền xóa sơ đồ này." });
    return;
  }
  if (!diagram) {
    res.status(404).json({ error: "Không tìm thấy sơ đồ." });
    return;
  }
  await prisma.diagram.delete({ where: { id: diagram.id } });
  res.json({ ok: true });
});

export default router;
