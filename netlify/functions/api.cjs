const express = require("express");
const serverless = require("serverless-http");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const sgMail = require("@sendgrid/mail");
const { initializeApp } = require("firebase/app");
const {
    getFirestore,
    collection,
    query,
    where,
    getDocs,
    getDoc,
    doc,
    setDoc
} = require("firebase/firestore");

const app = express();
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "dev_fallback_secret_local_only";

// Firebase initialization for serverless function
const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// Configure SendGrid if key is present
if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

app.use(cors());
app.use(express.json());

// Helper to find a user by email in Firestore
async function findUserByEmail(email) {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("email", "==", email.trim().toLowerCase()));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        return null;
    }

    const docSnap = snapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() };
}

// Health check endpoint
router.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// ==========================================
// 1. REGISTER ENDPOINT
// ==========================================
router.post("/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Validation
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

        // Check if user already exists
        const existingUser = await findUserByEmail(cleanEmail);
        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "An account with this email already exists. Please log in."
            });
        }

        // Hash the password with bcrypt
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Store user in Firestore with default free plan
        const userId = "user_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8);
        await setDoc(doc(db, "users", userId), {
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
// 2. LOGIN ENDPOINT
// ==========================================
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required."
            });
        }

        const cleanEmail = email.trim().toLowerCase();

        // Find user by email
        const user = await findUserByEmail(cleanEmail);
        if (!user || !user.password) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        // Compare password with bcrypt hash
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const userPlan = user.plan || "free";

        // Generate signed JWT
        const token = jwt.sign(
            {
                id: user.id,
                name: user.name,
                email: user.email,
                plan: userPlan
            },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        return res.status(200).json({
            success: true,
            message: "Login successful!",
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                plan: userPlan
            }
        });
    } catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error during login."
        });
    }
});

// ==========================================
// 3. UPGRADE PLAN ENDPOINT (Task D1)
// ==========================================
router.post("/upgrade-plan", async (req, res) => {
    try {
        const { userId, email, cardName, cardNumber, expiry, cvc } = req.body;

        if (!userId && !email) {
            return res.status(401).json({
                success: false,
                message: "Authentication required. Please log in first."
            });
        }

        // Validate payment fields
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
                message: "Please enter a valid credit card number (16 digits)."
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

        // Find user by userId or email
        let targetUser = null;
        let userDocId = userId;

        if (userId) {
            try {
                const userSnap = await getDoc(doc(db, "users", userId));
                if (userSnap.exists()) {
                    targetUser = { id: userSnap.id, ...userSnap.data() };
                }
            } catch (err) {
                console.log("Could not find user by direct id:", err.message);
            }
        }

        if (!targetUser && email) {
            targetUser = await findUserByEmail(email);
            if (targetUser) {
                userDocId = targetUser.id;
            }
        }

        if (!targetUser) {
            return res.status(404).json({
                success: false,
                message: "User account could not be found."
            });
        }

        // Check if user is already on a paid plan
        if (targetUser.plan === "premium" || targetUser.plan === "paid") {
            return res.status(400).json({
                success: false,
                message: "You are already subscribed to the Paid plan."
            });
        }

        // Upgrade user in Firestore
        await setDoc(
            doc(db, "users", userDocId),
            {
                plan: "premium",
                upgradedAt: new Date().toISOString(),
                cardLastFour: cleanCard.slice(-4)
            },
            { merge: true }
        );

        // Sign an updated JWT token containing the new plan
        const updatedUser = {
            id: userDocId,
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
// 4. NEWSLETTER SUBSCRIBE ENDPOINT
// ==========================================
const subscribers = [];

router.post("/subscribe", async (req, res) => {
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
        if (process.env.SENDGRID_API_KEY && process.env.FROM_EMAIL) {
            const response = await sgMail.send(message);
            console.log("Email sent to:", email, "Status:", response[0]?.statusCode);
        }

        return res.status(201).json({
            success: true,
            message: "Successfully subscribed! Please check your email."
        });
    } catch (error) {
        console.error("Email sending error:", error);
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

// Mount router on all path patterns Netlify or clients might send
app.use("/.netlify/functions/api", router);
app.use("/api", router);
app.use("/", router);

module.exports.handler = serverless(app);

