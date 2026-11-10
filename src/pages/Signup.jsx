
//useState is hook which is used to store the values entered in the form
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
//creates a new account using email and password
import { signInWithPopup } from "firebase/auth";
//getDoc(get a document),setDoc(set a document),doc(document in database)
import { doc, getDoc, setDoc } from "firebase/firestore";
//db(database),auth(authorization),googleProvider(google sign in)
import { db, auth, googleProvider } from "../firebase";

function Signup() {
    // Store the values entered in the form
    //useState is hook which is used to store the values entered in the form
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");


    //used navigate is hook which is used to navigate between javascript code
    const navigate = useNavigate();

    // Save the user's details in localStorage
    //this function saves the user info in the browser local storage and retrive it when needed
    const saveUser = (user, userName = "") => {
        //this stores information under a specific key
        localStorage.setItem(
            "dev_deakin_user",
            //json.stringify is used to convert the object to a string
            JSON.stringify({
                // || is used here as a logical OR operator,this means if the first value is not available 
                // then it will use the second value and if the second value is not available 
                // then it will use the third value
                name: userName || user.displayName || user.email,
                email: user.email,
                //if photoURL is not available then it will store empty string
                photoURL: user.photoURL || ""
            })
        );
    };

    // Create an account using Google
    const handleGoogleSignIn = async () => {
        //clear the errors
        setError("");

        try {
            // Open the Google sign-in popup
            const result = await signInWithPopup(auth, googleProvider);
            //store the user details in result variable
            const user = result.user;

            // Check whether the user's profile already exists
            const userRef = doc(db, "users", user.uid);
            const userData = await getDoc(userRef);

            // Save the profile if this is the user's first time
            if (!userData.exists()) {
                await setDoc(userRef, {
                    name: user.displayName || "",
                    email: user.email,
                    photoURL: user.photoURL || "",
                    //store the date of creation of the user
                    //toISOString() is used to convert the date to a string in UTC format
                    createdAt: new Date().toISOString()
                });
            }

            //save the user details in local storage
            saveUser(user);
            //navigate to the home page
            navigate("/");
        } catch (error) {
            console.log("Google signup failed", error);
            setError("Google sign-up failed. Please try again.");
        }
    };

    // Check the form before creating an account
    const validateForm = () => {
        //name.trim() is used to remove the white spaces from the name
        //split(/\s+/) is used to split the name into an array of words by whitespace
        //length is used to check the number of words
        if (name.trim().split(/\s+/).length < 2) {
            return "Please enter your first and last name.";
        }

        // Check whether both passwords match
        if (password !== confirmPassword) {
            return "Passwords do not match.";
        }

        // Firebase requires a password of at least 6 characters
        if (password.length < 6) {
            return "Password must be at least 6 characters.";
        }

        // If all validations pass, return an empty string
        return "";
    };

    // Handle signup using email and password via Express backend
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        // Check the entered details
        const message = validateForm();
        if (message) {
            setError(message);
            return;
        }

        try {
            // Task D1 Step 1: Send registration details to backend
            const response = await fetch("/api/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name: name.trim(),
                    email: email.trim().toLowerCase(),
                    password
                })
            });

            const data = await response.json();

            // Task D1 Step 2: If invalid, show message from backend
            if (!response.ok || !data.success) {
                setError(data.message || "Registration failed. Please try again.");
                return;
            }

            // On success, redirect to login page with success notification
            navigate("/login", {
                state: {
                    message: data.message || "Account created successfully! Please log in."
                }
            });
        } catch (err) {
            console.error("Signup network error:", err);
            setError("Unable to connect to the registration server. Please ensure the backend is running on port 3000.");
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card signup-card">
                <h2 className="signup-title">
                    Create a DEV@Deakin Account
                </h2>

                {/* Show a message if something goes wrong */}
                {error && (
                    <div className="error-alert">
                        {error}
                    </div>
                )}

                {/* Form for creating an account */}
                <form onSubmit={handleSubmit} className="auth-form-horizontal">
                    <div className="form-row">
                        <label htmlFor="signup-name">Name*</label>
                        <input
                            id="signup-name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="First and Last name"
                            required
                        />
                    </div>

                    <div className="form-row">
                        <label htmlFor="signup-email">Email*</label>
                        <input
                            id="signup-email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="user@example.com"
                            required
                        />
                    </div>

                    <div className="form-row">
                        <label htmlFor="signup-password">Password*</label>
                        <input
                            id="signup-password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="At least 6 characters"
                            required
                        />
                    </div>

                    <div className="form-row">
                        <label htmlFor="signup-confirm-password">
                            Confirm password*
                        </label>
                        <input
                            id="signup-confirm-password"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Re-enter password"
                            required
                        />
                    </div>

                    <div className="form-action-row">
                        <button type="submit" className="auth-btn">
                            Create
                        </button>
                    </div>
                </form>

                <div className="auth-divider">
                    {/* span is used to display the or text between the two buttons */}
                    <span>or</span>
                </div>

                {/* Create or access an account using Google */}
                <button
                    type="button"
                    className="google-btn"
                    onClick={handleGoogleSignIn}
                >
                    <div className="google-icon">
                        <img
                            src="https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_120x44dp.png"
                            alt="Google"
                        />
                    </div>
                    Continue with Google
                </button>

                {/* Link to the login page for existing users */}
                <div className="auth-footer-hint">
                    Already have an account?{" "}
                    <Link to="/login" className="auth-link">
                        Log in here
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default Signup;
