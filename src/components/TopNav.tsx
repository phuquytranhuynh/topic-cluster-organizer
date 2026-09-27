import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function TopNav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <header className="app-header">
      <div>
        <h1>Topic Cluster Organizer</h1>
        <p className="tagline">Sắp xếp bài viết website thành sơ đồ liên kết Topic Cluster</p>
      </div>
      <nav className="top-nav">
        <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
          Sơ đồ của tôi
        </NavLink>
        {user?.role === "admin" && (
          <>
            <NavLink to="/admin/users" className={({ isActive }) => (isActive ? "active" : "")}>
              Quản lý người dùng
            </NavLink>
            <NavLink to="/admin/diagrams" className={({ isActive }) => (isActive ? "active" : "")}>
              Tất cả sơ đồ
            </NavLink>
          </>
        )}
      </nav>
      <div className="user-badge">
        <span>
          {user?.name} <span className="count">({user?.role === "admin" ? "admin" : "user"})</span>
        </span>
        <button type="button" className="secondary" onClick={handleLogout}>
          Đăng xuất
        </button>
      </div>
    </header>
  );
}
