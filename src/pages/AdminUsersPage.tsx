import { useEffect, useState } from "react";
import {
  ApiError,
  createUser,
  deleteUser,
  listUsers,
  updateUser,
  type PublicUser,
  type UserRole,
} from "../api";
import { useAuth } from "../auth/AuthContext";
import { TopNav } from "../components/TopNav";

function EditUserRow({ user, onDone, onError }: { user: PublicUser; onDone: () => void; onError: (m: string) => void }) {
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState<UserRole>(user.role);
  const [isActive, setIsActive] = useState(user.isActive);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await updateUser(user.id, { name, role, isActive, ...(password ? { password } : {}) });
      onDone();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Không lưu được thay đổi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="editing">
      <td>{user.email}</td>
      <td>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </td>
      <td>
        <select value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
          <option value="user">user</option>
          <option value="admin">admin</option>
        </select>
      </td>
      <td>
        <label className="inline-label">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Đang hoạt động
        </label>
      </td>
      <td>
        <input
          type="password"
          placeholder="Mật khẩu mới (bỏ trống nếu giữ nguyên)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </td>
      <td className="actions">
        <button type="button" onClick={save} disabled={saving}>
          Lưu
        </button>
        <button type="button" className="secondary" onClick={onDone}>
          Hủy
        </button>
      </td>
    </tr>
  );
}

export function AdminUsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<PublicUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("user");
  const [creating, setCreating] = useState(false);

  function reload() {
    listUsers()
      .then(({ users }) => setUsers(users))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Không tải được danh sách người dùng."));
  }

  useEffect(reload, []);

  async function handleCreate() {
    setError(null);
    setCreating(true);
    try {
      await createUser({ email: newEmail.trim(), password: newPassword, name: newName.trim(), role: newRole });
      setNewEmail("");
      setNewName("");
      setNewPassword("");
      setNewRole("user");
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không tạo được tài khoản.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(u: PublicUser) {
    if (!confirm(`Xóa tài khoản "${u.name}" (${u.email})? Mọi sơ đồ của người này cũng sẽ bị xóa vĩnh viễn.`)) return;
    try {
      const result = await deleteUser(u.id);
      if (result.deletedDiagramCount > 0) {
        alert(`Đã xóa tài khoản cùng ${result.deletedDiagramCount} sơ đồ.`);
      }
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không xóa được tài khoản.");
    }
  }

  return (
    <div className="app">
      <TopNav />
      <main>
        <section className="panel">
          <h2>Quản lý người dùng</h2>
          <p className="hint">
            Không có form tự đăng ký — mọi tài khoản nhân viên đều do admin tạo tại đây bằng email + mật khẩu.
          </p>

          <h3>Tạo tài khoản mới</h3>
          <div className="form-grid">
            <label>
              Email
              <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            </label>
            <label>
              Tên hiển thị
              <input value={newName} onChange={(e) => setNewName(e.target.value)} />
            </label>
            <label>
              Mật khẩu ban đầu
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </label>
            <label>
              Vai trò
              <select value={newRole} onChange={(e) => setNewRole(e.target.value as UserRole)}>
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>
            </label>
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating || !newEmail.trim() || !newName.trim() || newPassword.length < 6}
            >
              {creating ? "Đang tạo…" : "Tạo tài khoản"}
            </button>
          </div>

          {error && <p className="errors">{error}</p>}

          <h3>Danh sách tài khoản{users ? ` (${users.length})` : ""}</h3>
          {users === null ? (
            <p className="hint">Đang tải…</p>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Tên</th>
                    <th>Vai trò</th>
                    <th>Trạng thái</th>
                    <th>Mật khẩu</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) =>
                    editingId === u.id ? (
                      <EditUserRow key={u.id} user={u} onDone={() => { setEditingId(null); reload(); }} onError={setError} />
                    ) : (
                      <tr key={u.id}>
                        <td>{u.email}</td>
                        <td>{u.name}</td>
                        <td>
                          <span className={`badge ${u.role === "admin" ? "pillar" : "supporting"}`}>{u.role}</span>
                        </td>
                        <td>{u.isActive ? "Hoạt động" : "Đã khóa"}</td>
                        <td>—</td>
                        <td className="actions">
                          <button type="button" onClick={() => setEditingId(u.id)}>
                            Sửa
                          </button>
                          <button
                            type="button"
                            className="danger"
                            onClick={() => handleDelete(u)}
                            disabled={u.id === me?.id}
                          >
                            Xóa
                          </button>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
