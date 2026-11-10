import { useAuth } from "../context/useAuth";

function Hero() {
    const { isAuthenticated, isPaidPlan, user } = useAuth();

    return (
        <section className="hero">
            <div className="hero-content">
                {isAuthenticated && isPaidPlan && (
                    <div className="hero-pro-badge">
                        ★ DEV@Deakin Pro Insider Member
                    </div>
                )}
                <h1>Hello, I am {isAuthenticated && user?.name ? user.name : "Tejas"}</h1>

                <p>
                    Software Engineering Student
                </p>

                <p className="hero-description">
                    I build software, explore cybersecurity,
                    and enjoy working on practical technology projects.
                </p>

                <a
                    href="#work"
                    className="hero-button"
                >
                    Explore My Work
                </a>

            </div>

        </section>
    );
}

export default Hero;