import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type ErrorRequestHandler } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { attachAuth } from "./auth.js";
import { bootstrapAdminIfNeeded } from "./bootstrapAdmin.js";
import authRoutes from "./routes/auth.js";
import usersRoutes from "./routes/users.js";
import diagramsRoutes from "./routes/diagrams.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 4000;
// The built frontend (vite build output) is copied here as part of the Docker image — see
// server/Dockerfile. Not present in local `npm run dev` unless you've run the root build yourself.
const STATIC_DIR = path.join(__dirname, "..", "public");

const app = express();
app.use(express.json());
app.use(cookieParser());
if (process.env.CORS_ORIGIN) {
  app.use(cors({ origin: process.env.CORS_ORIGIN.split(","), credentials: true }));
}
app.use(attachAuth);

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/diagrams", diagramsRoutes);

app.use(express.static(STATIC_DIR));
app.get(/^(?!\/api\/).*/, (_req, res) => {
  res.sendFile(path.join(STATIC_DIR, "index.html"), (err) => {
    if (err) res.status(404).send("Frontend build not found — run the root `npm run build` first.");
  });
});

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Lỗi máy chủ." });
};
app.use(errorHandler);

async function main() {
  await bootstrapAdminIfNeeded();
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
