import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import "./Post.css";

// Form for creating a Question or Article.
// Posts are submitted to the Express backend, not directly to Firestore.
function Post() {
    const { user, token, isAuthenticated, isPaidPlan } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [postType, setPostType] = useState("question");

    const [question, setQuestion] = useState({
        title: "",
        description: "",
        tags: ""
    });

    const [article, setArticle] = useState({
        title: "",
        abstract: "",
        content: "",
        tags: ""
    });

    const [modal, setModal] = useState({
        isOpen: false,
        type: "success",
        title: "",
        messages: []
    });

    const isQuestion = postType === "question";
    const data = isQuestion ? question : article;

    function showModal(type, title, messages) {
        setModal({
            isOpen: true,
            type,
            title,
            messages
        });
    }

    function handleChange(e) {
        const { name, value } = e.target;

        if (isQuestion) {
            setQuestion(previous => ({ ...previous, [name]: value }));
        } else {
            setArticle(previous => ({ ...previous, [name]: value }));
        }
    }

    async function handleSubmit(e) {
        e.preventDefault();

        // A post must be submitted by an authenticated user.
        if (!isAuthenticated || !token) {
            showModal(
                "error",
                "Login Required",
                ["Please log in before submitting a post."]
            );
            return;
        }

        const errors = [];
        const tags = data.tags
            .split(",")
            .map(tag => tag.trim())
            .filter(Boolean);

        if (!data.title.trim()) {
            errors.push("Title is required.");
        } else if (data.title.trim().length < 5) {
            errors.push("Title must be at least 5 characters long.");
        } else if (data.title.trim().length > 150) {
            errors.push("Title cannot exceed 150 characters.");
        }

        if (isQuestion && !question.description.trim()) {
            errors.push("Please describe your problem.");
        }

        if (!isQuestion && !article.abstract.trim()) {
            errors.push("Please enter an abstract.");
        }

        if (!isQuestion && !article.content.trim()) {
            errors.push("Please enter the article content.");
        }

        if (tags.length === 0) {
            errors.push("Please add at least one tag.");
        } else if (tags.length > 3) {
            errors.push("You can add a maximum of 3 tags.");
        } else if (tags.some(tag => tag.length > 30)) {
            errors.push("Each tag must be 30 characters or fewer.");
        }

        if (errors.length > 0) {
            showModal("error", "Post Submission Failed", errors);
            return;
        }

        // Match the fields expected by the backend API.
        const postPayload = {
            title: data.title.trim(),
            postType,
            description: isQuestion ? question.description.trim() : "",
            abstract: isQuestion ? "" : article.abstract.trim(),
            content: isQuestion ? "" : article.content.trim(),
            tags
        };

        setIsSubmitting(true);

        try {
            const response = await fetch("/api/posts", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(postPayload)
            });

            const result = await response.json().catch(() => ({}));

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message || `Post submission failed (${response.status}).`
                );
            }

            showModal(
                "success",
                "Post Published Successfully!",
                [
                    `Your ${postType} "${data.title.trim()}" has been saved.`,
                    `Post ID: ${result.postId}`
                ]
            );

            if (isQuestion) {
                setQuestion({ title: "", description: "", tags: "" });
            } else {
                setArticle({ title: "", abstract: "", content: "", tags: "" });
            }
        } catch (error) {
            console.error("Post submission error:", error);
            showModal(
                "error",
                "Post Submission Failed",
                [
                    error.message ||
                    "Unable to publish your post. Please try again."
                ]
            );
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div className="post-page-wrapper">
            <div className="post-container">
                {isAuthenticated && (
                    <div className={`post-plan-banner ${isPaidPlan ? "post-plan-paid" : "post-plan-free"}`}>
                        {isPaidPlan ? (
                            <span>
                                <strong>PRO Member Active:</strong> You have unlimited monthly posting,
                                100 MB upload quota, and priority answer ranking enabled.
                            </span>
                        ) : (
                            <span>
                                <strong>Free Community Plan:</strong> 5 monthly posts limit.{" "}
                                <Link
                                    to="/pricing"
                                    style={{
                                        color: "#2563eb",
                                        fontWeight: 700,
                                        textDecoration: "underline"
                                    }}
                                >
                                    Upgrade to Pro
                                </Link>{" "}
                                for unlimited posts &amp; 100 MB uploads.
                            </span>
                        )}
                    </div>
                )}

                {!isAuthenticated && (
                    <div className="post-plan-banner post-plan-free">
                        Please <Link to="/login">log in</Link> to submit a post.
                    </div>
                )}

                <div className="post-header-bar">New Post</div>

                <div className="post-type-selector">
                    <span className="selector-label">Select Post Type:</span>

                    <label className="radio-option">
                        <input
                            type="radio"
                            name="postType"
                            checked={isQuestion}
                            onChange={() => setPostType("question")}
                        />
                        <span>Question</span>
                    </label>

                    <label className="radio-option">
                        <input
                            type="radio"
                            name="postType"
                            checked={!isQuestion}
                            onChange={() => setPostType("article")}
                        />
                        <span>Article</span>
                    </label>
                </div>

                <div className="post-header-bar">
                    What do you want to ask or share
                </div>

                <p className="post-hint-text">
                    {isQuestion
                        ? "For a question, fill in the details below."
                        : "For an article, fill in the details below."}
                </p>

                <form onSubmit={handleSubmit} className="post-form">
                    <div className="conditional-fields">
                        <div className="form-row">
                            <label htmlFor="title" className="field-label">
                                Title
                            </label>

                            <input
                                id="title"
                                name="title"
                                className="text-input"
                                placeholder="Enter a title"
                                value={data.title}
                                onChange={handleChange}
                            />
                        </div>

                        {isQuestion ? (
                            <div className="form-column">
                                <label htmlFor="description" className="field-label">
                                    Describe your problem
                                </label>

                                <textarea
                                    id="description"
                                    name="description"
                                    rows="10"
                                    className="textarea-input"
                                    placeholder="Explain your problem and what you have tried..."
                                    value={question.description}
                                    onChange={handleChange}
                                />
                            </div>
                        ) : (
                            <>
                                <div className="form-column">
                                    <label htmlFor="abstract" className="field-label">
                                        Abstract
                                    </label>

                                    <textarea
                                        id="abstract"
                                        name="abstract"
                                        rows="3"
                                        className="textarea-input"
                                        placeholder="Enter an abstract"
                                        value={article.abstract}
                                        onChange={handleChange}
                                    />
                                </div>

                                <div className="form-column">
                                    <label htmlFor="content" className="field-label">
                                        Article Text
                                    </label>

                                    <textarea
                                        id="content"
                                        name="content"
                                        rows="10"
                                        className="textarea-input"
                                        placeholder="Enter your article"
                                        value={article.content}
                                        onChange={handleChange}
                                    />
                                </div>
                            </>
                        )}

                        <div className="form-row">
                            <label htmlFor="tags" className="field-label">
                                Tags
                            </label>

                            <input
                                id="tags"
                                name="tags"
                                className="text-input"
                                placeholder="Add up to 3 tags, separated by commas"
                                value={data.tags}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <div className="post-actions">
                        <button
                            type="submit"
                            className="post-btn"
                            disabled={isSubmitting || !isAuthenticated}
                        >
                            {isSubmitting ? "Publishing..." : "Post"}
                        </button>
                    </div>
                </form>
            </div>

            {modal.isOpen && (
                <div
                    className="modal-overlay"
                    onClick={() => setModal(previous => ({
                        ...previous,
                        isOpen: false
                    }))}
                >
                    <div
                        className={`modal-dialog ${
                            modal.type === "error" ? "modal-error" : "modal-success"
                        }`}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="modal-header">
                            <span className="modal-icon">
                                {modal.type === "error" ? "!" : "✓"}
                            </span>
                            <h3>{modal.title}</h3>
                        </div>

                        <div className="modal-body">
                            {modal.messages.map((message, index) => (
                                <p key={index}>{message}</p>
                            ))}
                        </div>

                        <div className="modal-footer">
                            <button
                                type="button"
                                className="modal-btn"
                                onClick={() => setModal(previous => ({
                                    ...previous,
                                    isOpen: false
                                }))}
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Post;
