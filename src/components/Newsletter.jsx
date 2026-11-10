import { useState } from "react";

function Newsletter() {
    const [email, setEmail] = useState("");
    const [statusMessage, setStatusMessage] = useState("");
    const [isError, setIsError] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubscribe = async (e) => {
        e.preventDefault();
        setStatusMessage("");
        setIsError(false);
        setLoading(true);

        try {
            const response = await fetch("/api/subscribe", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ email: email.trim() })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                setIsError(true);
                setStatusMessage(data.message || "Failed to subscribe.");
            } else {
                setIsError(false);
                setStatusMessage(data.message || "Successfully subscribed!");
                setEmail("");
            }
        } catch (err) {
            console.error("Subscription error:", err);
            setIsError(true);
            setStatusMessage("Could not connect to server. Please try again later.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <section className="newsletter" id="contact">
            <div className="newsletter-container">
                <h2>SIGN UP FOR OUR DAILY INSIDER</h2>

                <form className="newsletter-form" onSubmit={handleSubscribe}>
                    <input
                        type="email"
                        placeholder="Enter your email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />

                    <button type="submit" disabled={loading}>
                        {loading ? "Subscribing..." : "Subscribe"}
                    </button>
                </form>

                {statusMessage && (
                    <p
                        style={{
                            marginTop: "12px",
                            fontSize: "14px",
                            fontWeight: 600,
                            color: isError ? "#d93025" : "#188038"
                        }}
                    >
                        {statusMessage}
                    </p>
                )}
            </div>
        </section>
    );
}

export default Newsletter;