
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

export default function ResetPassword() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get("token");

    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [resetComplete, setResetComplete] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage("");
        setError("");

        if (!token) {
            setError("Invalid password reset link. Please request a new one.");
            return;
        }

        if (newPassword.length < 6) {
            setError("Password must be at least 6 characters long.");
            return;
        }

        if (newPassword !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setLoading(true);

        try {
            const response = await fetch("/api/reset-password", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    token,
                    newPassword
                })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                setError(data.message || "Unable to reset your password.");
                return;
            }

            setMessage(data.message);
            setResetComplete(true);
            setNewPassword("");
            setConfirmPassword("");
        } catch (err) {
            console.error("Reset password error:", err);
            setError("Unable to connect to the server. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card login-card">
                <h2 className="signup-title">Reset Password</h2>

                {message && (
                    <div className="auth-alert success-alert">
                        {message}
                    </div>
                )}

                {error && (
                    <div className="auth-alert error-alert">
                        {error}
                    </div>
                )}

                {!token ? (
                    <p style={{ textAlign: "center", fontSize: "14px" }}>
                        This reset link is invalid.{" "}
                        <Link to="/forgot-password">
                            Request another reset link
                        </Link>
                    </p>
                ) : resetComplete ? (
                    <p style={{ textAlign: "center", fontSize: "14px" }}>
                        Your password has been changed.{" "}
                        <Link to="/login">Log in now</Link>
                    </p>
                ) : (
                    <form onSubmit={handleSubmit} className="auth-form">
                        <div className="form-group">
                            <label htmlFor="new-password">New password</label>
                            <input
                                id="new-password"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Enter new password"
                                autoComplete="new-password"
                                minLength={6}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="confirm-password">
                                Confirm new password
                            </label>
                            <input
                                id="confirm-password"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Confirm new password"
                                autoComplete="new-password"
                                minLength={6}
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            className="auth-btn"
                            disabled={loading}
                        >
                            {loading ? "Updating..." : "Reset Password"}
                        </button>
                    </form>
                )}

                <p style={{
                    textAlign: "center",
                    marginTop: "22px",
                    fontSize: "14px"
                }}>
                    <Link to="/login" style={{ color: "#2563eb" }}>
                        Back to Login
                    </Link>
                </p>
            </div>
        </div>
    );
}
