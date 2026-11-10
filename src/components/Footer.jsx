import { Link } from "react-router-dom";

function Footer() {
    return (
        <footer className="footer">

            <div className="footer-container">

                {/* Explore */}
                <div className="footer-column">
                    <h3>Explore</h3>

                    <a href="#about">Home</a>
                    <a href="#about">Questions</a>
                    <a href="#articles">Articles</a>
                    <a href="#tutorials">Tutorials</a>
                    <Link to="/pricing">Pricing Plans</Link>
                </div>


                {/* Support */}
                <div className="footer-column">
                    <h3>Support</h3>

                    <a href="#contact">FAQs</a>
                    <a href="#contact">Help</a>
                    <a href="#contact">Contact Us</a>
                </div>


                {/* Social */}
                <div className="footer-column social-column">
                    <h3>Stay connected</h3>

                    <div className="social-icons">

                        <a
                            href="https://www.facebook.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Facebook"
                        >
                            f
                        </a>

                        <a
                            href="https://twitter.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Twitter"
                        >
                            X
                        </a>

                        <a
                            href="https://www.instagram.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Instagram"
                        >
                            ◎
                        </a>

                    </div>
                </div>

            </div>


            {/* Bottom section */}
            <div className="footer-bottom">

                <h3>DEV@Deakin</h3>

                <div className="footer-links">
                    <a href="#privacy">Privacy Policy</a>
                    <a href="#terms">Terms</a>
                    <a href="#code">Code of Conduct</a>
                </div>

            </div>

        </footer>
    );
}

export default Footer;