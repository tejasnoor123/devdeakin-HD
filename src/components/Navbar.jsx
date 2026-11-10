import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";

function Navbar() {
    const { user, isAuthenticated, isPaidPlan, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        // Step 5: Frontend clears active JWT when user logs out
        logout();
        navigate("/login");
    };

    return (
        <nav className="navbar">
            <Link to="/" className="logo">
                DEV@Deakin
            </Link>

            <div className="search-container">
                <input
                    type="text"
                    placeholder="Search.."
                />
            </div>

            <div className="nav-links">
                <Link to="/post" className="nav-item">Post</Link>
                <Link to="/browse-posts" className="nav-item">
                    Browse Posts
                </Link>
                <Link to="/pricing" className="nav-item">Pricing</Link>

                {isAuthenticated ? (
                    <>
                        {user?.role === "admin" && <Link to="/admin" className="nav-item">Admin</Link>}
                        <div className="nav-user-box">
                            <span className="nav-user-greeting">
                                Hi, {user?.name || user?.email || "User"}
                            </span>
                            {isPaidPlan ? (
                                <span className="nav-paid-badge" title="Active Paid Subscription">
                                    PRO
                                </span>
                            ) : (
                                <span className="nav-free-badge" title="Free Member">
                                    FREE
                                </span>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={handleLogout}
                            className="nav-logout-btn"
                        >
                            Log out
                        </button>
                    </>
                ) : (
                    <>
                        <Link to="/login" className="nav-item">Login</Link>
                        <Link to="/signup" className="nav-item">Sign up</Link>
                    </>
                )}
            </div>
        </nav>
    );
}

export default Navbar;