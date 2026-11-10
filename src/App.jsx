
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Post from "./pages/Post";
import BrowsePosts from "./pages/BrowsePosts";
import Pricing from "./pages/Pricing";
import AdminDashboard from "./pages/AdminDashboard";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import { AuthProvider } from "./context/AuthProvider";
import "./App.css";

function App() {
    return (
        <AuthProvider>
            <Router>
                <Navbar />
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/post" element={<Post />} />
                    <Route path="/browse-posts" element={<BrowsePosts />} />
                    <Route path="/pricing" element={<Pricing />} />
                    <Route path="/admin" element={<AdminDashboard />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                </Routes>

                <Footer />
            </Router>
        </AuthProvider>
    );
}

export default App;
