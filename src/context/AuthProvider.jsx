import { useState } from "react";
import { AuthContext } from "./authCore";

export function AuthProvider({ children }) {
    const [token, setToken] = useState(() => {
        try {
            return localStorage.getItem("dev_deakin_token") || null;
        } catch {
            return null;
        }
    });

    const [user, setUser] = useState(() => {
        try {
            const stored = localStorage.getItem("dev_deakin_user");
            return stored ? JSON.parse(stored) : null;
        } catch {
            return null;
        }
    });

    const login = (jwtToken, userData) => {
        try {
            localStorage.setItem("dev_deakin_token", jwtToken);
            localStorage.setItem("dev_deakin_user", JSON.stringify(userData));
        } catch (error) {
            console.error("Failed to write to localStorage:", error);
        }
        setToken(jwtToken);
        setUser(userData);
    };

    const logout = () => {
        try {
            localStorage.removeItem("dev_deakin_token");
            localStorage.removeItem("dev_deakin_user");
        } catch (error) {
            console.error("Failed to clear localStorage:", error);
        }
        setToken(null);
        setUser(null);
    };

    const updateSession = (newToken, updatedUserData) => {
        try {
            if (newToken) {
                localStorage.setItem("dev_deakin_token", newToken);
                setToken(newToken);
            }
            if (updatedUserData) {
                localStorage.setItem("dev_deakin_user", JSON.stringify(updatedUserData));
                setUser(updatedUserData);
            }
        } catch (error) {
            console.error("Failed to update session:", error);
        }
    };

    const isPaidPlan = user?.plan === "premium" || user?.plan === "paid";

    return (
        <AuthContext.Provider
            value={{
                user,
                token,
                login,
                logout,
                updateSession,
                isPaidPlan,
                isAuthenticated: !!token
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export default AuthProvider;
