import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./App.css";
import { AuthProvider } from "./auth/AuthContext";
import { RequireAdmin, RequireAuth } from "./auth/RouteGuards";
import { AdminDiagramsPage } from "./pages/AdminDiagramsPage";
import { AdminUsersPage } from "./pages/AdminUsersPage";
import { DiagramEditorPage } from "./pages/DiagramEditorPage";
import { DiagramListPage } from "./pages/DiagramListPage";
import { LoginPage } from "./pages/LoginPage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <DiagramListPage />
              </RequireAuth>
            }
          />
          <Route
            path="/diagrams/:id"
            element={
              <RequireAuth>
                <DiagramEditorPage />
              </RequireAuth>
            }
          />
          <Route
            path="/admin/users"
            element={
              <RequireAdmin>
                <AdminUsersPage />
              </RequireAdmin>
            }
          />
          <Route
            path="/admin/diagrams"
            element={
              <RequireAdmin>
                <AdminDiagramsPage />
              </RequireAdmin>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
