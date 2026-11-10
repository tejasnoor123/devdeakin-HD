import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Pricing.css";
import { useAuth } from "../context/useAuth";
import { db } from "../firebase";
import { doc, setDoc, getDocs, collection, query, where } from "firebase/firestore";

function Pricing() {
    // State for billing cycle (monthly vs annual)
    const [isAnnual, setIsAnnual] = useState(false);

    // State for demo info modal
    const [modalInfo, setModalInfo] = useState(null);

    // Modal display states
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    // Form inputs and request states
    const [paymentData, setPaymentData] = useState({
        name: "",
        cardNumber: "",
        expiry: "",
        cvv: ""
    });
    const [paymentError, setPaymentError] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);

    // Auth context values
    const { user, isAuthenticated, isPaidPlan, updateSession } = useAuth();
    const navigate = useNavigate();

    // Trigger demo details modal
    const handleSelectPlan = (planName) => {
        setModalInfo({
            title: `${planName} Selected`,
            message: `You selected the ${planName} (${isAnnual ? "Annual" : "Monthly"} billing). This is a demonstration for SIT313 Task D1.`
        });
    };

    // Verify auth and subscription status before opening payment modal
    const handleUpgradeClick = () => {
        if (!isAuthenticated) {
            alert("Please log in to upgrade your plan.");
            return;
        }

        if (isPaidPlan) {
            alert("You are already on a Paid plan.");
            return;
        }

        // Open upgrade modal for free tier users
        setPaymentError("");
        setShowUpgradeModal(true);
    };

    // Generic input change handler
    const handlePaymentChange = (e) => {
        const { name, value } = e.target;
        setPaymentData((prev) => ({ ...prev, [name]: value }));
    };

    // Format card number with spaces every 4 digits
    const handleCardNumberChange = (e) => {
        //replace(/\D/g, "") is used to remove all non-digit characters
        //slice(0, 16) is used to limit the number of digits to 16
        const raw = e.target.value.replace(/\D/g, "").slice(0, 16);
        //match(/.{1,4}/g) is used to split the raw value into groups of 4 digits
        //join(" ") is used to join the groups of 4 digits with spaces
        const formatted = raw.match(/.{1,4}/g)?.join(" ") || raw;
        setPaymentData((prev) => ({ ...prev, cardNumber: formatted }));
    };

    // Format expiration date to MM/YY
    const handleExpiryChange = (e) => {
        const raw = e.target.value.replace(/\D/g, "").slice(0, 4);
        //raw value will be like "mm" or "mm/yy"
        if (raw.length >= 3) {
            //raw.slice(0, 2) is used to get the first 2 digits (month)
            //raw.slice(2) is used to get the remaining digits (year)
            setPaymentData((prev) => ({
                ...prev,
                expiry: `${raw.slice(0, 2)}/${raw.slice(2)}`
            }));
        } else {
            setPaymentData((prev) => ({ ...prev, expiry: raw }));
        }
    };

    // Restrict CVV input to digits only
    const handleCvvChange = (e) => {
        //replace(/\D/g, "") is used to remove all non-digit characters
        
        const raw = e.target.value.replace(/\D/g, "").slice(0, 4);
        // raw value will be like "cvv"
        setPaymentData((prev) => ({ ...prev, cvv: raw }));
    };

    // Validate payment form inputs
    const validatePayment = () => {
        const { name, cardNumber, expiry, cvv } = paymentData;

        // Check cardholder name
        if (!name || name.trim().length < 2) {
            setPaymentError("Please enter the cardholder's full name.");
            return false;
        }

        // Check for complete 16-digit card number
        const cleanCard = (cardNumber || "").replace(/\s+/g, "");
        if (cleanCard.length !== 16 || !/^\d{16}$/.test(cleanCard)) {
            setPaymentError("Please enter a valid 16-digit credit card number.");
            return false;
        }

        // Check MM/YY format
        const expiryRegex = /^(0[1-9]|1[0-2])\/([0-9]{2})$/;
        if (!expiry || !expiryRegex.test(expiry.trim())) {
            setPaymentError("Please enter a valid expiry date in MM/YY format (e.g. 09/28).");
            return false;
        }

        // Check 3 or 4 digit CVV
        const cleanCvv = (cvv || "").trim();
        if (cleanCvv.length < 3 || cleanCvv.length > 4 || !/^\d+$/.test(cleanCvv)) {
            setPaymentError("Please enter a valid 3 or 4 digit security code (CVC/CVV).");
            return false;
        }

        return true;
    };

    // Process payment and sync plan changes
    const handlePaymentSubmit = async (e) => {
        e.preventDefault();
        setPaymentError("");

        // Halt submission if validation fails
        if (!validatePayment()) {
            return;
        }

        setIsProcessing(true);

        try {
            const cleanCard = paymentData.cardNumber.replace(/\s+/g, "");
            const targetUserId = user?.id || user?.uid;

            // Attempt to update plan via custom backend API
            let backendUpdated = false;
            try {
                const response = await fetch("/api/upgrade-plan", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        userId: targetUserId,
                        email: user?.email,
                        cardName: paymentData.name.trim(),
                        cardNumber: cleanCard,
                        expiry: paymentData.expiry.trim(),
                        cvc: paymentData.cvv.trim()
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.user) {
                        backendUpdated = true;
                        updateSession(data.token, data.user);
                    }
                }
            } catch (backendError) {
                console.warn("Backend upgrade call skipped/offline:", backendError.message);
            }

            // Locate user document ID if missing
            let userDocId = targetUserId;
            if (!userDocId && user?.email) {
                const usersRef = collection(db, "users");
                const q = query(usersRef, where("email", "==", user.email.trim().toLowerCase()));
                const querySnap = await getDocs(q);
                if (!querySnap.empty) {
                    userDocId = querySnap.docs[0].id;
                }
            }

            // Direct fallback sync to Firestore user document
            if (userDocId) {
                const userRef = doc(db, "users", userDocId);
                await setDoc(
                    userRef,
                    {
                        plan: "paid",
                        upgradedAt: new Date().toISOString(),
                        cardLastFour: cleanCard.slice(-4),
                        cardholderName: paymentData.name.trim()
                    },
                    { merge: true }
                );
            }

            // Sync auth state locally if backend was unreachable
            if (!backendUpdated) {
                const updatedUser = { ...user, plan: "paid" };
                updateSession(null, updatedUser);
            }

            // Reset UI state and show success modal
            setIsProcessing(false);
            setShowUpgradeModal(false);
            setPaymentData({ name: "", cardNumber: "", expiry: "", cvv: "" });
            setShowSuccessModal(true);
        } catch (err) {
            console.error("Plan upgrade error:", err);
            setPaymentError("Failed to update plan. Please check your connection and try again.");
            setIsProcessing(false);
        }
    };

    return (
        <div className="pricing-page-wrapper">
            <div className="pricing-container">
                {/* Active user membership status banner */}
                {isAuthenticated && (
                    <div className={`user-plan-status-banner ${isPaidPlan ? "status-paid" : "status-free"}`}>
                        <div className="status-banner-text">
                            {isPaidPlan ? (
                                <span>
                                    <strong>You are currently on the Paid plan!</strong> You have unlimited posts, priority expert answers, and an active Pro badge across DEV@Deakin.
                                </span>
                            ) : (
                                <span>
                                    <strong>You are currently on the Free plan.</strong> Upgrade below to unlock unlimited monthly posts, 100 MB uploads, and priority answers.
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {/* Page header and title */}
                <div className="pricing-header">
                    <span className="pricing-badge-label">Membership & Plans</span>
                    <h1 className="pricing-title">Simple, Transparent Pricing</h1>
                    <p className="pricing-subtitle">
                        Choose the right plan to share code, ask technical questions,
                        and accelerate your development journey on DEV@Deakin.
                    </p>

                    {/* Billing frequency toggle */}
                    <div className="billing-toggle-container">
                        <button
                            type="button"
                            className={`billing-toggle-btn ${!isAnnual ? "active" : ""}`}
                            onClick={() => setIsAnnual(false)}
                        >
                            Monthly Billing
                        </button>
                        <button
                            type="button"
                            className={`billing-toggle-btn ${isAnnual ? "active" : ""}`}
                            onClick={() => setIsAnnual(true)}
                        >
                            Annual Billing
                        </button>
                    </div>
                </div>

                {/* Plan options cards */}
                <div className="pricing-cards-grid">
                    {/* Free tier card */}
                    <div className={`pricing-card ${isAuthenticated && !isPaidPlan ? "card-current-active" : ""}`}>
                        <h2 className="card-plan-name">Free Community</h2>
                        <p className="card-plan-desc">
                            Essential access for students and learners getting started with DEV@Deakin.
                        </p>

                        <div className="card-price-box">
                            <span className="card-currency"></span>
                            <span className="card-amount">0</span>
                            <span className="card-period">/ month (forever free)</span>
                        </div>

                        {/* Free tier feature list */}
                        <ul className="card-features-list">
                            <li className="card-feature-item included">
                                <span className="feature-icon-check"></span>
                                <span>Browse public community articles and questions</span>
                            </li>
                            <li className="card-feature-item included">
                                <span className="feature-icon-check"></span>
                                <span>Post up to <strong>5 questions or articles</strong> per month</span>
                            </li>
                            <li className="card-feature-item included">
                                <span className="feature-icon-check"></span>
                                <span>Image upload size limit of <strong>5 MB</strong> per post</span>
                            </li>
                            <li className="card-feature-item included">
                                <span className="feature-icon-check"></span>
                                <span>Community comments and answer upvoting</span>
                            </li>
                            <li className="card-feature-item included">
                                <span className="feature-icon-check"></span>
                                <span>Access to foundational tutorials</span>
                            </li>
                            <li className="card-feature-item excluded">
                                <span className="feature-icon-cross">✕</span>
                                <span>Access to exclusive Premium insider articles</span>
                            </li>
                            <li className="card-feature-item excluded">
                                <span className="feature-icon-cross">✕</span>
                                <span>Priority answers from top developers</span>
                            </li>
                            <li className="card-feature-item excluded">
                                <span className="feature-icon-cross">✕</span>
                                <span>Verified DEV@Deakin Pro badge</span>
                            </li>
                            <li className="card-feature-item excluded">
                                <span className="feature-icon-cross">✕</span>
                                <span>Ad-free reading experience</span>
                            </li>
                        </ul>

                        {/* Free plan action button */}
                        <button
                            type="button"
                            className="plan-btn plan-btn-secondary"
                            onClick={() => handleSelectPlan("Free Community Plan")}
                        >
                            {isPaidPlan ? "Free Tier" : "Current Plan"}
                        </button>
                    </div>

                    {/* Paid tier card */}
                    <div className={`pricing-card ${isPaidPlan ? "card-current-paid" : ""}`}>
                        <h2 className="card-plan-name">Pro Insider</h2>
                        <p className="card-plan-desc">
                            High-capacity posting, larger storage, and premium developer mentorship.
                        </p>

                        <div className="card-price-box">
                            <span className="card-currency">$</span>
                            <span className="card-amount">{isAnnual ? "9" : "12"}</span>
                            <span className="card-period">/ month {isAnnual ? "(billed annually)" : "(billed monthly)"}</span>
                        </div>

                        {/* Paid tier feature list */}
                        <ul className="card-features-list">
                            <li className="card-feature-item included">
                                <span className="feature-icon-check"> </span>
                                <span>Everything in Free, plus all exclusive articles</span>
                            </li>
                            <li className="card-feature-item included">
                                <span className="feature-icon-check"> </span>
                                <span><strong>Unlimited posts</strong> and questions each month</span>
                            </li>
                            <li className="card-feature-item included">
                                <span className="feature-icon-check"></span>
                                <span>Increased upload limit of <strong>100 MB</strong> per asset</span>
                            </li>
                            <li className="card-feature-item included">
                                <span className="feature-icon-check"></span>
                                <span><strong>Priority answer ranking</strong> & expert code reviews</span>
                            </li>
                            <li className="card-feature-item included">
                                <span className="feature-icon-check"></span>
                                <span>Access to advanced project source code & webinars</span>
                            </li>
                            <li className="card-feature-item included">
                                <span className="feature-icon-check"></span>
                                <span>Verified <strong>DEV@Deakin Pro badge</strong> on profile</span>
                            </li>
                            <li className="card-feature-item included">
                                <span className="feature-icon-check"></span>
                                <span><strong>100% Ad-free</strong> reading experience</span>
                            </li>
                            <li className="card-feature-item included">
                                <span className="feature-icon-check"></span>
                                <span>Author analytics & engagement metrics dashboard</span>
                            </li>
                        </ul>

                        {/* Upgrade plan CTA button */}
                        <button
                            type="button"
                            className={`plan-btn ${isPaidPlan ? "plan-btn-current" : "plan-btn-primary"}`}
                            onClick={handleUpgradeClick}
                        >
                            {isPaidPlan ? " Current Plan (Paid)" : "Upgrade Plan"}
                        </button>
                    </div>
                </div>

                {/* Feature breakdown comparison table */}
                <div className="comparison-section">
                    <div className="comparison-heading">
                        <h3>Detailed Feature Comparison</h3>
                        <p>A comprehensive side-by-side look at what is included under each plan.</p>
                    </div>

                    <div className="table-responsive">
                        <table className="comparison-table">
                            <thead>
                                <tr>
                                    <th>Feature</th>
                                    <th>Free Community</th>
                                    <th>Pro Insider (Paid)</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="category-row">
                                    <td colSpan="3">Publishing & Limits</td>
                                </tr>
                                <tr>
                                    <td>Monthly Post Quota</td>
                                    <td>5 posts / month</td>
                                    <td className="table-check"> Unlimited Posts</td>
                                </tr>
                                <tr>
                                    <td>Image Upload Limit</td>
                                    <td>5 MB / image</td>
                                    <td className="table-check"> 100 MB / asset</td>
                                </tr>
                                <tr>
                                    <td>Code Repository Attachment</td>
                                    <td>Standard text only</td>
                                    <td className="table-check"> Multi-file zip & live preview</td>
                                </tr>

                                <tr className="category-row">
                                    <td colSpan="3">Community & Extras</td>
                                </tr>
                                <tr>
                                    <td>Verified Pro Badge</td>
                                    <td className="table-cross">—</td>
                                    <td className="table-check"> Yes</td>
                                </tr>
                                <tr>
                                    <td>Ad-Free Experience</td>
                                    <td className="table-cross">—</td>
                                    <td className="table-check"> 100% Ad-Free</td>
                                </tr>
                                <tr>
                                    <td>Post Analytics & Insights</td>
                                    <td>Basic view counts</td>
                                    <td className="table-check"> Detailed reader analytics</td>
                                </tr>
                                <tr>
                                    <td>Support Level</td>
                                    <td>Community forum</td>
                                    <td className="table-check"> 24/7 Priority support</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Payment checkout modal */}
            {showUpgradeModal && (
                <div
                    className="pricing-modal-backdrop"
                    onClick={() => !isProcessing && setShowUpgradeModal(false)}
                >
                    <div
                        className="payment-modal-container"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="payment-modal-header">
                            <div>
                                <h3 className="payment-modal-title">Upgrade to Pro Insider</h3>
                                <p className="payment-modal-subtitle">
                                    Enter your payment details to unlock unlimited posting and Pro perks.
                                </p>
                            </div>
                            <button
                                type="button"
                                className="payment-modal-x"
                                onClick={() => !isProcessing && setShowUpgradeModal(false)}
                                disabled={isProcessing}
                            >
                                &times;
                            </button>
                        </div>

                        {/* Order cost summary */}
                        <div className="payment-summary-box">
                            <div>
                                <div className="payment-summary-name">Pro Insider Membership</div>
                                <div className="payment-summary-sub">
                                    {isAnnual ? "Billed annually ($108/year)" : "Billed monthly ($12/month)"}
                                </div>
                            </div>
                            <div className="payment-summary-price">
                                ${isAnnual ? "9" : "12"}
                                <span className="payment-summary-period">/mo</span>
                            </div>
                        </div>

                        {/* Error message banner */}
                        {paymentError && (
                            <div className="payment-error-box" role="alert">
                                <span></span>
                                <span>{paymentError}</span>
                            </div>
                        )}

                        {/* Card details form */}
                        <form onSubmit={handlePaymentSubmit} className="payment-form" noValidate>
                            <div className="payment-form-group">
                                <label htmlFor="cardName" className="payment-label">
                                    Cardholder Name
                                </label>
                                <input
                                    type="text"
                                    id="cardName"
                                    name="name"
                                    className="payment-input"
                                    placeholder="e.g. Jane Doe"
                                    value={paymentData.name}
                                    onChange={handlePaymentChange}
                                    disabled={isProcessing}
                                    required
                                />
                            </div>

                            <div className="payment-form-group">
                                <label htmlFor="cardNumber" className="payment-label">
                                    Credit Card Number
                                </label>
                                <input
                                    type="text"
                                    id="cardNumber"
                                    name="cardNumber"
                                    className="payment-input"
                                    placeholder="4532 0000 0000 8890"
                                    value={paymentData.cardNumber}
                                    onChange={handleCardNumberChange}
                                    maxLength="19"
                                    disabled={isProcessing}
                                    required
                                />
                            </div>

                            <div className="payment-form-row">
                                <div className="payment-form-group half">
                                    <label htmlFor="expiry" className="payment-label">
                                        Expiry Date
                                    </label>
                                    <input
                                        type="text"
                                        id="expiry"
                                        name="expiry"
                                        className="payment-input"
                                        placeholder="MM/YY"
                                        value={paymentData.expiry}
                                        onChange={handleExpiryChange}
                                        maxLength="5"
                                        disabled={isProcessing}
                                        required
                                    />
                                </div>

                                <div className="payment-form-group half">
                                    <label htmlFor="cvv" className="payment-label">
                                        Security Code (CVC)
                                    </label>
                                    <input
                                        type="password"
                                        id="cvv"
                                        name="cvv"
                                        className="payment-input"
                                        placeholder="123"
                                        value={paymentData.cvv}
                                        onChange={handleCvvChange}
                                        maxLength="4"
                                        disabled={isProcessing}
                                        required
                                    />
                                </div>
                            </div>

                            {/* Form submit/cancel buttons */}
                            <div className="payment-actions">
                                <button
                                    type="button"
                                    className="payment-cancel-btn"
                                    onClick={() => setShowUpgradeModal(false)}
                                    disabled={isProcessing}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="payment-submit-btn"
                                    disabled={isProcessing}
                                >
                                    {isProcessing ? "Processing Upgrade..." : `Pay $${isAnnual ? "9" : "12"} & Upgrade`}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Upgrade completion modal */}
            {showSuccessModal && (
                <div
                    className="pricing-modal-backdrop"
                    onClick={() => setShowSuccessModal(false)}
                >
                    <div
                        className="payment-success-box"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="success-icon-wrap"></div>
                        <h3>Welcome to Pro Insider!</h3>
                        <p>
                            Your account has been successfully upgraded to the <strong>Paid plan</strong> and saved to Firestore.
                        </p>
                        <p className="success-subtext">
                            You now have unlimited post publishing, priority answer status, and your verified Pro badge is active across the site.
                        </p>
                        <button
                            type="button"
                            className="payment-submit-btn"
                            onClick={() => {
                                setShowSuccessModal(false);
                                navigate("/post");
                            }}
                        >
                            Got It &bull; Start Posting
                        </button>
                    </div>
                </div>
            )}

            {/* Generic demo alert modal */}
            {modalInfo && (
                <div
                    className="pricing-modal-backdrop"
                    onClick={() => setModalInfo(null)}
                >
                    <div
                        className="pricing-modal-box"
                        // stop propagation of click event from parent component to the child component
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h4>{modalInfo.title}</h4>
                        <p>{modalInfo.message}</p>
                        <button
                            type="button"
                            className="pricing-modal-close-btn"
                            onClick={() => setModalInfo(null)}
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Pricing;