import type { Article, StoreData, TopicCluster } from "./types";
import type { PositionOverrides } from "./diagramPositions";
import type { HiddenArticleIds, HiddenClusterIds } from "./diagramVisibility";

export type UserRole = "admin" | "user";

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  createdAt?: string;
}

export interface DiagramSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  owner?: { id: string; name: string; email: string };
}

export interface DiagramRecord {
  id: string;
  ownerId: string;
  name: string;
  clusters: TopicCluster[];
  articles: Article[];
  positions: PositionOverrides | null;
  hiddenClusterIds: HiddenClusterIds | null;
  hiddenArticleIds: HiddenArticleIds | null;
  createdAt: string;
  updatedAt: string;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    throw new ApiError(res.status, (body && body.error) || `Lỗi không xác định (HTTP ${res.status}).`);
  }
  return body as T;
}

// --- Auth ---
export function login(email: string, password: string) {
  return request<{ user: PublicUser }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}
export function logout() {
  return request<{ ok: true }>("/auth/logout", { method: "POST" });
}
export function fetchMe() {
  return request<{ user: PublicUser }>("/auth/me");
}

// --- Admin: users ---
export function listUsers() {
  return request<{ users: PublicUser[] }>("/users");
}
export function createUser(input: { email: string; password: string; name: string; role: UserRole }) {
  return request<{ user: PublicUser }>("/users", { method: "POST", body: JSON.stringify(input) });
}
export function updateUser(
  id: string,
  patch: Partial<{ name: string; role: UserRole; isActive: boolean; password: string }>
) {
  return request<{ user: PublicUser }>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}
export function deleteUser(id: string) {
  return request<{ ok: true; deletedDiagramCount: number }>(`/users/${id}`, { method: "DELETE" });
}

// --- Diagrams ---
export function listMyDiagrams() {
  return request<{ diagrams: DiagramSummary[] }>("/diagrams");
}
export function listAllDiagrams() {
  return request<{ diagrams: DiagramSummary[] }>("/diagrams/all");
}
export function getDiagram(id: string) {
  return request<{ diagram: DiagramRecord }>(`/diagrams/${id}`);
}
export function createDiagram(input: Partial<StoreData> & { name?: string }) {
  return request<{ diagram: DiagramRecord }>("/diagrams", { method: "POST", body: JSON.stringify(input) });
}
export interface DiagramPatch {
  name?: string;
  clusters?: TopicCluster[];
  articles?: Article[];
  positions?: PositionOverrides | null;
  hiddenClusterIds?: HiddenClusterIds | null;
  hiddenArticleIds?: HiddenArticleIds | null;
}
export function updateDiagram(id: string, patch: DiagramPatch) {
  return request<{ diagram: DiagramRecord }>(`/diagrams/${id}`, { method: "PUT", body: JSON.stringify(patch) });
}
export function deleteDiagram(id: string) {
  return request<{ ok: true }>(`/diagrams/${id}`, { method: "DELETE" });
}
