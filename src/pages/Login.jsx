import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../firebase";
import { useAuth } from "../context/useAuth";

function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [otp, setOtp] = useState("");
    const [challengeId, setChallengeId] = useState("");
    const [maskedEmail, setMaskedEmail] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();
    const location = useLocation();
    const message = location.state?.message;
    const { login } = useAuth();

    const beginVerification = (data) => {
        setChallengeId(data.challengeId);
        setMaskedEmail(data.maskedEmail || "");
        setOtp("");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const response = await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email.trim().toLowerCase(), password })
            });
            const data = await response.json();

            if (!response.ok || !data.success) {
                setError(data.message || "Invalid email or password.");
                return;
            }

            beginVerification(data);
        } catch (err) {
            console.error("Backend login request failed:", err);
            setError("Could not connect to the authentication server. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setError("");
        setLoading(true);

        try {
            const result = await signInWithPopup(auth, googleProvider);
            const idToken = await result.user.getIdToken();

            const response = await fetch("/api/login/google", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ idToken })
            });
            const data = await response.json();

            if (!response.ok || !data.success) {
                setError(data.message || "Google sign-in failed. Please try again.");
                return;
            }

            beginVerification(data);
        } catch (err) {
            console.error("Google sign-in error:", err);
            if (err.code === "auth/popup-blocked") {
                setError("Popup was blocked by your browser. Please allow popups for this site and try again.");
            } else if (err.code === "auth/popup-closed-by-user") {
                setError("Sign-in popup was closed before completing.");
            } else {
                setError(err.message || "Google sign-in failed. Please try again.");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const response = await fetch("/api/login/verify-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ challengeId, otp })
            });
            const data = await response.json();

            if (!response.ok || !data.success) {
                setError(data.message || "Verification failed. Please try again.");
                return;
            }

            login(data.token, data.user);
            navigate("/");
        } catch (err) {
            console.error("OTP verification request failed:", err);
            setError("Could not verify your code. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const backToLogin = () => {
        setChallengeId("");
        setOtp("");
        setError("");
    };

    return (
        <div className="auth-page">
            <div className="auth-card login-card">
                <div className="auth-card-header">
                    <Link to="/signup" className="auth-switch-btn">Sign up</Link>
                </div>

                {message && <div className="auth-alert success-alert">{message}</div>}
                {error && <div className="auth-alert error-alert">{error}</div>}

                {!challengeId ? (
                    <>
                        <form onSubmit={handleSubmit} className="auth-form">
                            <div className="form-group">
                                <label htmlFor="login-email">Your email</label>
                                <input
                                    id="login-email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    autoComplete="email"
                                    placeholder="user@example.com"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="login-password">Your password</label>
                                <input
                                    id="login-password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoComplete="current-password"
                                    placeholder="Enter your password"
                                    required
                                />
                            </div>

                            <div style={{ textAlign: "right", marginTop: "-12px", marginBottom: "18px" }}>
                                <Link
                                    to="/forgot-password"
                                    style={{
                                        color: "#2563eb",
                                        fontSize: "13px",
                                        textDecoration: "none"
                                    }}
                                >
                                    Forgot password?
                                </Link>
                            </div>
                            
                            <button type="submit" className="auth-btn" disabled={loading}>
                                {loading ? "Sending code..." : "Login"}
                            </button>
                        </form>

                        <div className="auth-divider"><span>or</span></div>

                        <button
                            type="button"
                            className="google-btn"
                            onClick={handleGoogleSignIn}
                            disabled={loading}
                        >
                            {loading ? "Please wait..." : "Continue with Google"}
                        </button>
                    </>
                ) : (
                    <form onSubmit={handleVerifyOtp} className="auth-form">
                        <div className="form-group">
                            <label htmlFor="login-otp">Email verification code</label>
                            <p>Enter the six-digit code sent to {maskedEmail || "your email address"}.</p>
                            <input
                                id="login-otp"
                                type="text"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                pattern="[0-9]{6}"
                                maxLength={6}
                                value={otp}
                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                placeholder="Enter 6-digit code"
                                required
                            />
                        </div>

                        <button type="submit" className="auth-btn" disabled={loading || otp.length !== 6}>
                            {loading ? "Verifying..." : "Verify and login"}
                        </button>

                        <button
                            type="button"
                            className="google-btn"
                            onClick={backToLogin}
                            disabled={loading}
                        >
                            Back to login
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}

export default Login;
