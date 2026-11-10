
import { useState } from "react";
import { Link } from "react-router-dom";

export default function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage("");
        setError("");
        setLoading(true);

        try {
            const response = await fetch("/api/forgot-password", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email: email.trim().toLowerCase()
                })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                setError(data.message || "Unable to process your request.");
                return;
            }

            setMessage(data.message);
        } catch (err) {
            console.error("Forgot password error:", err);
            setError("Unable to connect to the server. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card login-card">
                <h2 className="signup-title">Forgot Password</h2>

                <p style={{
                    textAlign: "center",
                    color: "#6b7280",
                    fontSize: "14px",
                    marginBottom: "24px"
                }}>
                    Enter your registered email address. If an account exists,
                    we will send you a password reset link.
                </p>

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

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="form-group">
                        <label htmlFor="forgot-email">Email address</label>
                        <input
                            id="forgot-email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="user@example.com"
                            autoComplete="email"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="auth-btn"
                        disabled={loading}
                    >
                        {loading ? "Sending..." : "Send Reset Link"}
                    </button>
                </form>

                <p style={{
                    textAlign: "center",
                    marginTop: "22px",
                    fontSize: "14px"
                }}>
                    Remember your password?{" "}
                    <Link to="/login" style={{ color: "#2563eb" }}>
                        Back to Login
                    </Link>
                </p>
            </div>
        </div>
    );
}
