// ==========================================
// DEV@DEAKIN BACKEND WITH EMAIL TWO-STEP VERIFICATION
// ==========================================

const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const sgMail = require("@sendgrid/mail");
const crypto = require("crypto");
const admin = require("firebase-admin");
const path = require("path");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const PORT = process.env.PORT || 3000;

const JWT_SECRET = process.env.JWT_SECRET;
const OTP_SECRET = process.env.OTP_SECRET || JWT_SECRET;
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();

if (!JWT_SECRET) {
    throw new Error("JWT_SECRET must be configured in your .env file.");
}

if (!OTP_SECRET) {
    throw new Error("OTP_SECRET must be configured in your .env file.");
}



if (!process.env.SENDGRID_API_KEY || !process.env.FROM_EMAIL) {
    throw new Error("SENDGRID_API_KEY and FROM_EMAIL must be configured.");
}

// ==========================================
// MIDDLEWARE
// ==========================================

app.use(cors());
app.use(express.json());

// ==========================================
// FIREBASE ADMIN INITIALIZATION
// ==========================================

const fs = require("fs");
const path = require("path");

const renderSecretPath = "/etc/secrets/serviceAccountKey.json";

const serviceAccountPath = fs.existsSync(renderSecretPath)
    ? renderSecretPath
    : path.join(__dirname, "serviceAccountKey.json");

const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

const db = getFirestore();
const adminAuth = getAuth();

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// ==========================================
// GENERAL HELPERS
// ==========================================

async function findUserByEmail(email) {
    const cleanEmail = String(email).trim().toLowerCase();

    const snapshot = await db
        .collection("users")
        .where("email", "==", cleanEmail)
        .limit(1)
        .get();

    if (snapshot.empty) {
        return null;
    }

    const userDoc = snapshot.docs[0];

    return {
        id: userDoc.id,
        ...userDoc.data()
    };
}

function safeUser(user) {
    const email = String(user.email || "").trim().toLowerCase();

    return {
        id: user.id,
        name: user.name || email,
        email,
        plan: user.plan || "free",
        role:
            (ADMIN_EMAIL && email === ADMIN_EMAIL) ||
                user.role === "admin"
                ? "admin"
                : "user",
        ...(user.photoURL ? { photoURL: user.photoURL } : {})
    };
}

// ==========================================
// OTP CONFIGURATION
// ==========================================

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

function hashOtp(challengeId, otp) {
    return crypto
        .createHmac("sha256", OTP_SECRET)
        .update(`${challengeId}:${otp}`)
        .digest("hex");
}

function maskEmail(email) {
    const [name, domain] = String(email).split("@");

    if (!domain) {
        return email;
    }

    const visible = name.length > 2
        ? name.slice(0, 2)
        : name.slice(0, 1);

    return `${visible}${"*".repeat(
        Math.max(2, name.length - visible.length)
    )}@${domain}`;
}

async function createLoginChallenge(user, email) {
    if (user.status === "suspended") {
        const error = new Error(
            "This account has been suspended. Contact support."
        );
        error.status = 403;
        throw error;
    }

    const challengeId = crypto.randomUUID();

    const otp = crypto
        .randomInt(0, 1000000)
        .toString()
        .padStart(6, "0");

    const now = Date.now();

    await db.collection("loginChallenges").doc(challengeId).set({
        userId: user.id,
        email: String(email).trim().toLowerCase(),
        otpHash: hashOtp(challengeId, otp),
        attempts: 0,
        createdAt: now,
        expiresAt: now + OTP_TTL_MS
    });

    try {
        await sgMail.send({
            to: String(email).trim().toLowerCase(),
            from: process.env.FROM_EMAIL,
            subject: "Your DEV@Deakin verification code",
            text: `Your verification code is ${otp}. It expires in 5 minutes.`,
            html: `
                <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto">
                    <h2>DEV@Deakin Login Verification</h2>
                    <p>Use this code to complete your login:</p>
                    <h1 style="letter-spacing:8px">${otp}</h1>
                    <p>This code expires in 5 minutes.</p>
                    <p>If you did not try to log in, you can ignore this email.</p>
                </div>
            `
        });
    } catch (error) {
        console.error("OTP email error:", error);

        await db
            .collection("loginChallenges")
            .doc(challengeId)
            .delete();

        const emailError = new Error(
            "Unable to send verification email. Please try again."
        );
        emailError.status = 502;
        throw emailError;
    }

    return {
        challengeId,
        maskedEmail: maskEmail(email),
        requiresTwoStepVerification: true
    };
}

// ==========================================
// 1. REGISTER ENDPOINT
// ==========================================

app.post(["/register", "/api/register"], async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Name is required."
            });
        }

        if (name.trim().split(/\s+/).length < 2) {
            return res.status(400).json({
                success: false,
                message: "Please enter your first and last name."
            });
        }

        if (!email || !email.includes("@")) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid email address."
            });
        }

        if (!password || password.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters long."
            });
        }

        const cleanEmail = email.trim().toLowerCase();

        const existingUser = await findUserByEmail(cleanEmail);

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "An account with this email already exists. Please log in."
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const userId =
            "user_" +
            Date.now() +
            "_" +
            Math.random().toString(36).substring(2, 8);

        await db.collection("users").doc(userId).set({
            name: name.trim(),
            email: cleanEmail,
            password: hashedPassword,
            plan: "free",
            createdAt: new Date().toISOString()
        });

        return res.status(201).json({
            success: true,
            message: "Account registered successfully! Please log in.",
            userId,
            plan: "free"
        });

    } catch (error) {
        console.error("Registration error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error during registration. Please try again."
        });
    }
});

// ==========================================
// 2. EMAIL/PASSWORD LOGIN - SEND OTP
// ==========================================

app.post(["/login", "/api/login"], async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required."
            });
        }

        const cleanEmail = email.trim().toLowerCase();
        const user = await findUserByEmail(cleanEmail);

        if (!user || !user.password) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const passwordMatches = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatches) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const challenge = await createLoginChallenge(user, cleanEmail);

        return res.status(200).json({
            success: true,
            message: "Verification code sent to your email.",
            ...challenge
        });

    } catch (error) {
        console.error("Login error:", error);

        return res.status(error.status || 500).json({
            success: false,
            message: error.message || "Login failed. Please try again."
        });
    }
});

// ==========================================
// 3. GOOGLE LOGIN - SEND OTP
// ==========================================

app.post("/api/login/google", async (req, res) => {
    try {
        const { idToken } = req.body;

        if (!idToken) {
            return res.status(400).json({
                success: false,
                message: "Google authentication token is required."
            });
        }

        // Verify the Firebase ID token on the backend.
        const decodedToken = await adminAuth.verifyIdToken(idToken);

        const email = String(decodedToken.email || "")
            .trim()
            .toLowerCase();

        if (!email || !decodedToken.email_verified) {
            return res.status(401).json({
                success: false,
                message: "Please use a verified Google email address."
            });
        }

        let user = await findUserByEmail(email);

        // Create a profile if this Google user is new.
        if (!user) {
            const userId = decodedToken.uid;

            user = {
                id: userId,
                name: decodedToken.name || email.split("@")[0],
                email,
                plan: "free",
                photoURL: decodedToken.picture || ""
            };

            await db.collection("users").doc(userId).set({
                name: user.name,
                email: user.email,
                plan: user.plan,
                photoURL: user.photoURL,
                createdAt: new Date().toISOString(),
                authProvider: "google"
            });
        }

        const challenge = await createLoginChallenge(user, email);

        return res.status(200).json({
            success: true,
            message: "Verification code sent to your email.",
            ...challenge
        });

    } catch (error) {
        console.error("Google login error:", error);

        return res.status(error.status || 401).json({
            success: false,
            message: error.message || "Google login failed."
        });
    }
});

// ==========================================
// 4. VERIFY OTP AND ISSUE JWT
// ==========================================

app.post("/api/login/verify-otp", async (req, res) => {
    try {
        const { challengeId, otp } = req.body;

        if (!challengeId || !otp) {
            return res.status(400).json({
                success: false,
                message: "Verification code is required."
            });
        }

        if (!/^\d{6}$/.test(String(otp))) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid 6-digit verification code."
            });
        }

        const challengeRef = db
            .collection("loginChallenges")
            .doc(challengeId);

        const challengeSnapshot = await challengeRef.get();

        if (!challengeSnapshot.exists) {
            return res.status(400).json({
                success: false,
                message: "Verification session not found. Please log in again."
            });
        }

        const challenge = challengeSnapshot.data();

        if (Date.now() > challenge.expiresAt) {
            await challengeRef.delete();

            return res.status(400).json({
                success: false,
                message: "Verification code has expired. Please log in again."
            });
        }

        if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
            await challengeRef.delete();

            return res.status(429).json({
                success: false,
                message: "Too many incorrect attempts. Please log in again."
            });
        }

        const submittedHash = hashOtp(challengeId, String(otp));

        const expected = Buffer.from(challenge.otpHash, "hex");
        const submitted = Buffer.from(submittedHash, "hex");

        const matches =
            expected.length === submitted.length &&
            crypto.timingSafeEqual(expected, submitted);

        if (!matches) {
            await challengeRef.update({
                attempts: challenge.attempts + 1
            });

            return res.status(401).json({
                success: false,
                message: "Incorrect verification code. Please try again.",
                attemptsRemaining:
                    OTP_MAX_ATTEMPTS - challenge.attempts - 1
            });
        }

        const userSnapshot = await db
            .collection("users")
            .doc(challenge.userId)
            .get();

        if (!userSnapshot.exists) {
            await challengeRef.delete();

            return res.status(404).json({
                success: false,
                message: "User account not found."
            });
        }

        const user = {
            id: userSnapshot.id,
            ...userSnapshot.data()
        };

        if (user.status === "suspended") {
            await challengeRef.delete();

            return res.status(403).json({
                success: false,
                message: "This account has been suspended. Contact support."
            });
        }

        const userData = safeUser(user);

        const token = jwt.sign(
            {
                id: user.id,
                name: userData.name,
                email: userData.email,
                plan: userData.plan,
                role: userData.role
            },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        await challengeRef.delete();

        return res.status(200).json({
            success: true,
            message: "Login successful.",
            token,
            user: userData
        });

    } catch (error) {
        console.error("OTP verification error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to verify code. Please try again."
        });
    }
});

// ==========================================
// 5. AUTHENTICATION MIDDLEWARE
// ==========================================

function authenticateToken(req, res, next) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ")
        ? header.slice(7)
        : null;

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Authentication required."
        });
    }

    try {
        req.auth = jwt.verify(token, JWT_SECRET);
        req.user = req.auth;
        return next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Your session is invalid or expired. Please log in again."
        });
    }
}
// ==========================================
// GET ALL POSTS - BROWSE POSTS
// ==========================================

app.get("/api/posts", async (req, res) => {
    try {
        const snapshot = await db.collection("posts").get();

        const posts = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data()
        }));

        // Sort posts by newest first
        posts.sort((a, b) => {
            const getTime = (post) => {
                const date = post.createdAt;

                if (date?.seconds) {
                    return date.seconds * 1000;
                }

                const value = date || post.createdAtIso;
                const time = value ? new Date(value).getTime() : 0;

                return Number.isNaN(time) ? 0 : time;
            };

            return getTime(b) - getTime(a);
        });

        return res.status(200).json({
            success: true,
            posts
        });

    } catch (error) {
        console.error("Fetch posts error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to load posts."
        });
    }
});
// ==========================================
// 6. GET CURRENT USER
// ==========================================

app.get("/api/me", authenticateToken, async (req, res) => {
    try {
        const userSnapshot = await db
            .collection("users")
            .doc(req.auth.id)
            .get();

        if (!userSnapshot.exists) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        const user = {
            id: userSnapshot.id,
            ...userSnapshot.data()
        };

        return res.status(200).json({
            success: true,
            user: safeUser(user)
        });

    } catch (error) {
        console.error("Get user error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to get user information."
        });
    }
});


// ==========================================
// FORGOT PASSWORD - SEND RESET EMAIL
// ==========================================


app.post("/api/forgot-password", async (req, res) => {
    const genericMessage =
        "If an account exists with this email, a password reset link will be sent.";

    try {
        console.log("Forgot password request received");

        const email = String(req.body.email || "")
            .trim()
            .toLowerCase();

        if (!email || !email.includes("@")) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email address."
            });
        }

        const user = await findUserByEmail(email);

        console.log("Matching account found:", Boolean(user));

        // Generic response prevents revealing whether an account exists.
        if (!user) {
            return res.status(200).json({
                success: true,
                message: genericMessage
            });
        }

        const frontendUrl = process.env.FRONTEND_URL;

        if (!frontendUrl) {
            throw new Error("FRONTEND_URL is not configured.");
        }

        const resetToken = crypto.randomBytes(32).toString("hex");

        const tokenHash = crypto
            .createHash("sha256")
            .update(resetToken)
            .digest("hex");

        const expiresAt = Date.now() + 30 * 60 * 1000;

        await db.collection("passwordResetTokens")
            .doc(tokenHash)
            .set({
                userId: user.id,
                expiresAt,
                used: false,
                createdAt: Date.now()
            });

        const resetLink =
            `${frontendUrl}/reset-password?token=${resetToken}`;

        try {
            console.log("Attempting to send reset email...");

            const response = await sgMail.send({
                to: email,
                from: process.env.FROM_EMAIL,
                subject: "Reset your DEV@Deakin password",
                text: `Use this link to reset your password: ${resetLink}. This link expires in 30 minutes.`,
                html: `
                    <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto">
                        <h2>DEV@Deakin Password Reset</h2>
                        <p>We received a request to reset your password.</p>
                        <p>Click below to choose a new password.</p>
                        <a href="${resetLink}"
                           style="display:inline-block;padding:12px 20px;
                           background:#2563eb;color:white;text-decoration:none;
                           border-radius:5px;">
                           Reset Password
                        </a>
                        <p>This link expires in 30 minutes.</p>
                        <p>If you did not request this, ignore this email.</p>
                    </div>
                `
            });

            console.log(
                "Password reset email accepted by SendGrid. Status:",
                response[0]?.statusCode
            );

        } catch (emailError) {
            await db.collection("passwordResetTokens")
                .doc(tokenHash)
                .delete();

            console.error("SendGrid reset email error:", {
                message: emailError.message,
                code: emailError.code,
                response: emailError.response?.body
            });

            throw emailError;
        }

        return res.status(200).json({
            success: true,
            message: genericMessage
        });

    } catch (error) {
        console.error("Forgot password error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to process your request. Please try again."
        });
    }
});



// ==========================================
// RESET PASSWORD - SAVE NEW PASSWORD
// ==========================================

app.post("/api/reset-password", async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword || newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: "A valid reset token and password of at least 6 characters are required."
            });
        }

        const tokenHash = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");

        const tokenRef = db.collection("passwordResetTokens")
            .doc(tokenHash);

        const tokenSnapshot = await tokenRef.get();

        if (!tokenSnapshot.exists) {
            return res.status(400).json({
                success: false,
                message: "This password reset link is invalid or expired."
            });
        }

        const resetData = tokenSnapshot.data();

        if (
            resetData.used ||
            resetData.expiresAt < Date.now()
        ) {
            return res.status(400).json({
                success: false,
                message: "This password reset link is invalid or expired."
            });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        const userRef = db.collection("users").doc(resetData.userId);

        await db.runTransaction(async (transaction) => {
            const latestToken = await transaction.get(tokenRef);

            if (
                !latestToken.exists ||
                latestToken.data().used ||
                latestToken.data().expiresAt < Date.now()
            ) {
                throw new Error("RESET_TOKEN_INVALID");
            }

            transaction.update(userRef, {
                password: hashedPassword
            });

            transaction.update(tokenRef, {
                used: true,
                usedAt: Date.now()
            });
        });

        return res.status(200).json({
            success: true,
            message: "Your password has been reset successfully. You can now log in."
        });

    } catch (error) {
        console.error("Reset password error:", error);

        if (error.message === "RESET_TOKEN_INVALID") {
            return res.status(400).json({
                success: false,
                message: "This password reset link is invalid or expired."
            });
        }

        return res.status(500).json({
            success: false,
            message: "Unable to reset your password. Please try again."
        });
    }
});


// ==========================================
// 7. LOGOUT
// ==========================================

app.post("/api/logout", authenticateToken, (req, res) => {
    return res.status(200).json({
        success: true,
        message: "Logged out successfully."
    });
});

// ==========================================
// 8. UPGRADE PLAN ENDPOINT
// ==========================================

app.post(["/upgrade-plan", "/api/upgrade-plan"], async (req, res) => {
    try {
        const { userId, email, cardName, cardNumber, expiry, cvc } = req.body;

        if (!userId && !email) {
            return res.status(401).json({
                success: false,
                message: "Authentication required. Please log in first."
            });
        }

        if (!cardName || !cardName.trim()) {
            return res.status(400).json({
                success: false,
                message: "Please enter the cardholder name."
            });
        }

        const cleanCard = (cardNumber || "").replace(/\D/g, "");

        if (cleanCard.length < 15 || cleanCard.length > 19) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid credit card number."
            });
        }

        const expiryRegex = /^(0[1-9]|1[0-2])\/?([0-9]{2})$/;

        if (!expiry || !expiryRegex.test(expiry.trim())) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid expiry date in MM/YY format."
            });
        }

        const cleanCvc = (cvc || "").replace(/\D/g, "");

        if (cleanCvc.length < 3 || cleanCvc.length > 4) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid 3 or 4-digit CVC code."
            });
        }

        let targetUser = null;
        let targetUserId = userId;

        if (userId) {
            const userSnapshot = await db
                .collection("users")
                .doc(userId)
                .get();

            if (userSnapshot.exists) {
                targetUser = {
                    id: userSnapshot.id,
                    ...userSnapshot.data()
                };
            }
        }

        if (!targetUser && email) {
            targetUser = await findUserByEmail(email);

            if (targetUser) {
                targetUserId = targetUser.id;
            }
        }

        if (!targetUser) {
            return res.status(404).json({
                success: false,
                message: "User account could not be found."
            });
        }

        if (
            targetUser.plan === "premium" ||
            targetUser.plan === "paid"
        ) {
            return res.status(400).json({
                success: false,
                message: "You are already subscribed to the Paid plan."
            });
        }

        await db.collection("users").doc(targetUserId).set({
            plan: "premium",
            upgradedAt: new Date().toISOString(),
            cardLastFour: cleanCard.slice(-4)
        }, { merge: true });

        const updatedUser = {
            id: targetUserId,
            name: targetUser.name,
            email: targetUser.email,
            plan: "premium"
        };

        const token = jwt.sign(
            updatedUser,
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        return res.status(200).json({
            success: true,
            message: "Congratulations! You have successfully upgraded to the Paid plan.",
            token,
            user: updatedUser
        });

    } catch (error) {
        console.error("Upgrade plan error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error processing plan upgrade."
        });
    }
});

// ==========================================
// 9. NEWSLETTER SUBSCRIBE ENDPOINT
// ==========================================

const subscribers = [];

app.post(["/subscribe", "/api/subscribe"], async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({
            success: false,
            message: "Email address is required."
        });
    }

    if (!email.includes("@")) {
        return res.status(400).json({
            success: false,
            message: "Please enter a valid email address."
        });
    }

    if (subscribers.includes(email)) {
        return res.status(409).json({
            success: false,
            message: "This email is already subscribed."
        });
    }

    subscribers.push(email);

    const message = {
        to: email,
        from: process.env.FROM_EMAIL,
        subject: "Welcome to DEV@Deakin Daily Insider!",
        text: "Thank you for subscribing to our daily insider newsletter!",
        html: `
            <h2>Welcome to DEV@Deakin!</h2>
            <p>Thank you for subscribing to our Daily Insider newsletter.</p>
            <p>You have successfully joined our mailing list.</p>
        `
    };

    try {
        const response = await sgMail.send(message);

        console.log(
            "Newsletter email sent:",
            email,
            "Status:",
            response[0]?.statusCode
        );

        return res.status(201).json({
            success: true,
            message: "Successfully subscribed! Please check your email."
        });

    } catch (error) {
        console.error("Newsletter email error:", error);

        const index = subscribers.indexOf(email);

        if (index !== -1) {
            subscribers.splice(index, 1);
        }

        return res.status(500).json({
            success: false,
            message: "Subscription failed. Please try again later."
        });
    }
});

// ==========================================
// 10. ADMIN AUTHORIZATION
// ==========================================

async function requireAdmin(req, res, next) {
    try {
        const userSnapshot = await db
            .collection("users")
            .doc(req.auth.id)
            .get();

        if (!userSnapshot.exists) {
            return res.status(403).json({
                success: false,
                message: "Administrator access denied."
            });
        }

        const account = userSnapshot.data();

        const emailIsAllowlisted =
            ADMIN_EMAIL &&
            String(account.email || "").toLowerCase() === ADMIN_EMAIL;

        if (!emailIsAllowlisted && account.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Administrator access required."
            });
        }

        if (account.status === "suspended") {
            return res.status(403).json({
                success: false,
                message: "This account is suspended."
            });
        }

        req.admin = {
            id: req.auth.id,
            email: account.email
        };

        return next();

    } catch (error) {
        console.error("Admin authorization error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to verify administrator access."
        });
    }
}

// ==========================================
// 11. ADMIN OVERVIEW
// ==========================================

app.get(
    "/api/admin/overview",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const [usersSnapshot, postsSnapshot] = await Promise.all([
                db.collection("users").get(),
                db.collection("posts").get()
            ]);

            const users = usersSnapshot.docs.map(item => ({
                id: item.id,
                ...item.data()
            }));

            const posts = postsSnapshot.docs.map(item => ({
                id: item.id,
                ...item.data()
            }));

            return res.json({
                success: true,
                stats: {
                    totalUsers: users.length,
                    freeUsers: users.filter(
                        user => (user.plan || "free") === "free"
                    ).length,
                    paidUsers: users.filter(
                        user => ["paid", "premium"].includes(user.plan)
                    ).length,
                    suspendedUsers: users.filter(
                        user => user.status === "suspended"
                    ).length,
                    totalPosts: posts.length
                },
                users: users
                    .map(({ password, ...safe }) => safe)
                    .sort((a, b) =>
                        String(b.createdAt || "").localeCompare(
                            String(a.createdAt || "")
                        )
                    ),
                posts: posts.sort((a, b) =>
                    String(b.createdAt || b.createdAtIso || "").localeCompare(
                        String(a.createdAt || a.createdAtIso || "")
                    )
                )
            });

        } catch (error) {
            console.error("Admin overview error:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to load dashboard data. Confirm that your Firestore posts collection exists."
            });
        }
    }
);

// ==========================================
// 12. ADMIN UPDATE USER STATUS
// ==========================================

app.patch(
    "/api/admin/users/:id/status",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { status } = req.body || {};

            if (!["active", "suspended"].includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: "Status must be active or suspended."
                });
            }

            if (req.params.id === req.admin.id) {
                return res.status(400).json({
                    success: false,
                    message: "You cannot suspend your own administrator account."
                });
            }

            const userRef = db.collection("users").doc(req.params.id);
            const target = await userRef.get();

            if (!target.exists) {
                return res.status(404).json({
                    success: false,
                    message: "User not found."
                });
            }

            const targetData = target.data();

            if (
                targetData.role === "admin" ||
                (
                    ADMIN_EMAIL &&
                    String(targetData.email || "").toLowerCase() === ADMIN_EMAIL
                )
            ) {
                return res.status(403).json({
                    success: false,
                    message: "Administrator accounts cannot be suspended here."
                });
            }

            await userRef.update({
                status,
                updatedAt: new Date().toISOString()
            });

            return res.json({
                success: true,
                message: `User ${status === "suspended" ? "suspended" : "reactivated"} successfully.`
            });

        } catch (error) {
            console.error("Update user status error:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to update user status."
            });
        }
    }
);

// ==========================================
// 13. ADMIN DELETE POST
// ==========================================

app.delete(
    "/api/admin/posts/:id",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const postRef = db.collection("posts").doc(req.params.id);
            const postSnapshot = await postRef.get();

            if (!postSnapshot.exists) {
                return res.status(404).json({
                    success: false,
                    message: "Post not found."
                });
            }

            await postRef.delete();

            return res.json({
                success: true,
                message: "Post removed successfully."
            });

        } catch (error) {
            console.error("Delete post error:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to remove post."
            });
        }
    }
);

// ==========================================
// 14. ROOT / HEALTH CHECK
// ==========================================

app.get("/", (req, res) => {
    res.status(200).send("Backend is running successfully!");
});

// ==========================================
// START SERVER
// ==========================================

app.listen(PORT, () => {
    console.log(
        `DEV@Deakin Backend server running at http://localhost:${PORT}`
    );
});