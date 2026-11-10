import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import "./AdminDashboard.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

export default function AdminDashboard() {
  const { user, token, isAuthenticated } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [activeTab, setActiveTab] = useState("users");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // The UI role is only a navigation convenience; every API request is
  // independently authorized by the Express backend.
  const isAdmin = user?.role === "admin";

  const loadDashboard = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/admin/overview`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to load admin dashboard.");
      setDashboard(data);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (dashboard?.users || []).filter((item) =>
      !term || `${item.name || ""} ${item.email || ""} ${item.plan || "free"}`.toLowerCase().includes(term)
    );
  }, [dashboard?.users, search]);

  const filteredPosts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (dashboard?.posts || []).filter((item) =>
      !term || `${item.title || ""} ${item.authorName || item.author?.name || ""} ${item.postType || ""}`.toLowerCase().includes(term)
    );
  }, [dashboard?.posts, search]);

  const updateUserStatus = async (targetUser) => {
    const nextStatus = targetUser.status === "suspended" ? "active" : "suspended";
    if (!window.confirm(`Are you sure you want to ${nextStatus === "suspended" ? "suspend" : "reactivate"} ${targetUser.email}?`)) return;
    setBusyId(targetUser.id); setNotice(""); setError("");
    try {
      const response = await fetch(`${API_BASE}/api/admin/users/${encodeURIComponent(targetUser.id)}/status`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to update user.");
      setNotice(data.message); await loadDashboard();
    } catch (err) { setError(err.message); }
    finally { setBusyId(""); }
  };

  const removePost = async (post) => {
    if (!window.confirm(`Permanently remove “${post.title || "this post"}”?`)) return;
    setBusyId(post.id); setNotice(""); setError("");
    try {
      const response = await fetch(`${API_BASE}/api/admin/posts/${encodeURIComponent(post.id)}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to remove post.");
      setNotice(data.message); await loadDashboard();
    } catch (err) { setError(err.message); }
    finally { setBusyId(""); }
  };

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin) return <main className="admin-page"><section className="admin-message"><h1>Admin access required</h1><p>This account does not have administrator permissions.</p></section></main>;

  const stats = dashboard?.stats || {};
  return (
    <main className="admin-page">
      <div className="admin-heading">
        <div><p className="admin-eyebrow">DEV@Deakin / Management</p><h1>Admin Dashboard</h1><p>Monitor your community and manage platform activity.</p></div>
        <button className="admin-refresh" onClick={loadDashboard} disabled={loading}>Refresh data</button>
      </div>

      {error && <div className="admin-alert error" role="alert">{error}</div>}
      {notice && <div className="admin-alert success" role="status">{notice}</div>}

      {loading && !dashboard ? <p className="admin-loading">Loading dashboard...</p> : (
        <>
          <section className="admin-stats" aria-label="Platform statistics">
            <article className="admin-stat"><span>Total users</span><strong>{stats.totalUsers ?? 0}</strong></article>
            <article className="admin-stat"><span>Total posts</span><strong>{stats.totalPosts ?? 0}</strong></article>
            <article className="admin-stat"><span>Free members</span><strong>{stats.freeUsers ?? 0}</strong></article>
            <article className="admin-stat"><span>Paid members</span><strong>{stats.paidUsers ?? 0}</strong></article>
            <article className="admin-stat"><span>Suspended</span><strong>{stats.suspendedUsers ?? 0}</strong></article>
          </section>

          <section className="admin-panel">
            <div className="admin-toolbar">
              <div className="admin-tabs">
                <button className={activeTab === "users" ? "active" : ""} onClick={() => { setActiveTab("users"); setSearch(""); }}>User management</button>
                <button className={activeTab === "posts" ? "active" : ""} onClick={() => { setActiveTab("posts"); setSearch(""); }}>Content moderation</button>
              </div>
              <input aria-label="Search records" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={activeTab === "users" ? "Search name, email or plan" : "Search title or author"} />
            </div>

            {activeTab === "users" ? (
              <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>User</th><th>Plan</th><th>Joined</th><th>Status</th><th>Action</th></tr></thead><tbody>
                {filteredUsers.map((item) => <tr key={item.id}><td><strong>{item.name || "Unnamed user"}</strong><small>{item.email}</small></td><td>{item.plan || "free"}</td><td>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "—"}</td><td><span className={`admin-status ${item.status === "suspended" ? "suspended" : "active"}`}>{item.status || "active"}</span></td><td>{item.role === "admin" || item.email?.toLowerCase() === user?.email?.toLowerCase() ? <span className="admin-protected">Protected</span> : <button className="admin-action" disabled={busyId === item.id} onClick={() => updateUserStatus(item)}>{busyId === item.id ? "Saving..." : item.status === "suspended" ? "Reactivate" : "Suspend"}</button>}</td></tr>)}
                {!filteredUsers.length && <tr><td colSpan="5" className="admin-empty">No users found.</td></tr>}
              </tbody></table></div>
            ) : (
              <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Post</th><th>Author</th><th>Type</th><th>Published</th><th>Action</th></tr></thead><tbody>
                {filteredPosts.map((item) => <tr key={item.id}><td><strong>{item.title || "Untitled post"}</strong><small>{item.abstract || item.description || "No summary"}</small></td><td>{item.authorName || item.author?.name || "Unknown"}</td><td>{item.postType || "Post"}</td><td>{item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000).toLocaleDateString() : item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "—"}</td><td><button className="admin-action danger" disabled={busyId === item.id} onClick={() => removePost(item)}>{busyId === item.id ? "Removing..." : "Remove"}</button></td></tr>)}
                {!filteredPosts.length && <tr><td colSpan="5" className="admin-empty">No posts found in the Firestore posts collection.</td></tr>}
              </tbody></table></div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
