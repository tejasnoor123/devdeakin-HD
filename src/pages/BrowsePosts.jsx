import { useEffect, useState } from "react";
import { useAuth } from "../context/useAuth";
import "./BrowsePosts.css";

export default function BrowsePosts() {
  const { token } = useAuth();

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hiddenPosts, setHiddenPosts] = useState([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [postType, setPostType] = useState("all");
  const [tagFilter, setTagFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  const fetchPosts = async () => {
    try {
      setLoading(true);
      setError("");

      const headers = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch("/api/posts", { headers });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to load posts.");
      }

      setPosts(data.posts || []);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [token]);

  const resetFilters = () => {
    setSearchQuery("");
    setPostType("all");
    setTagFilter("");
    setDateFilter("");
    setHiddenPosts([]);
  };

  const hidePost = (id) => {
    setHiddenPosts((current) => [...current, id]);
  };

  const visiblePosts = posts.filter((post) => {
    if (hiddenPosts.includes(post.id)) return false;

    // Search across the post title, text, author, type, and tags.
    const searchableText = [
      post.title,
      post.description,
      post.abstract,
      post.content,
      post.authorName,
      post.author?.name,
      post.postType,
      ...(post.tags || []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (
      searchQuery.trim() &&
      !searchableText.includes(searchQuery.trim().toLowerCase())
    ) {
      return false;
    }

    if (postType !== "all" && post.postType !== postType) {
      return false;
    }

    if (
      tagFilter.trim() &&
      !(post.tags || []).some((tag) =>
        String(tag).toLowerCase().includes(tagFilter.trim().toLowerCase())
      )
    ) {
      return false;
    }

    if (dateFilter) {
      const postDate = post.createdAt?.seconds
        ? new Date(post.createdAt.seconds * 1000)
        : new Date(post.createdAt || post.createdAtIso);

      if (Number.isNaN(postDate.getTime())) return false;

      if (postDate.toISOString().slice(0, 10) !== dateFilter) {
        return false;
      }
    }

    return true;
  });

  const getPostDate = (post) => {
    const value = post.createdAt;

    if (value?.seconds) {
      return new Date(value.seconds * 1000).toLocaleString();
    }

    if (value) return new Date(value).toLocaleString();

    if (post.createdAtIso) {
      return new Date(post.createdAtIso).toLocaleString();
    }

    return "Date unavailable";
  };

  if (loading) {
    return (
      <div className="browse-posts">
        <p>Loading posts...</p>
      </div>
    );
  }

  return (
    <main className="browse-posts">
      <h1>Browse Posts</h1>
      <p>Explore questions and articles shared by the community.</p>

      <section className="post-filters">
        <label className="search-field">
          Search posts
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, content, author or tag..."
            aria-label="Search posts"
          />
        </label>

        <label>
          Post type
          <select
            value={postType}
            onChange={(e) => setPostType(e.target.value)}
          >
            <option value="all">All posts</option>
            <option value="question">Questions</option>
            <option value="article">Articles</option>
          </select>
        </label>

        <label>
          Filter by tag
          <input
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            placeholder="Enter a tag"
          />
        </label>

        <label>
          Filter by date
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
        </label>

        <button type="button" onClick={resetFilters}>
          Reset
        </button>
      </section>

      {error && <p className="browse-error">{error}</p>}

      {!error && (
        <p className="posts-result-count" aria-live="polite">
          Showing {visiblePosts.length} of {posts.length} posts
        </p>
      )}

      {!error && visiblePosts.length === 0 && (
        <p className="no-posts-message">
          {searchQuery.trim()
            ? `No posts found for "${searchQuery.trim()}". Try another search.`
            : "No posts found."}
        </p>
      )}

      <section className="posts-list">
        {visiblePosts.map((post) => (
          <article className="browse-post-card" key={post.id}>
            <div className="post-card-heading">
              <span>{post.postType || "Post"}</span>
              <span>{post.postPlan || "Free"}</span>
            </div>

            <h2>{post.title}</h2>

            <p className="post-author">
              By {post.authorName || post.author?.name || "Unknown author"}
            </p>

            <p className="post-date">{getPostDate(post)}</p>

            {post.postType === "question" ? (
              <p>{post.description}</p>
            ) : (
              <>
                <p>{post.abstract}</p>
                <p className="post-full-content">{post.content}</p>
              </>
            )}

            {post.tags?.length > 0 && (
              <div className="post-tags">
                {post.tags.map((tag, index) => (
                  <span key={`${tag}-${index}`}>#{tag}</span>
                ))}
              </div>
            )}

            <div className="post-card-actions">
              <button
                type="button"
                onClick={() => hidePost(post.id)}
              >
                Hide
              </button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
