function ArticleCard({
    title,
    description,
    image,
    rating,
    author
}) {

    return (
        <article className="article-card">

            <div className="article-image-container">
                <img
                    src={image}
                    alt={title}
                />

                <span className="article-category">
                    Article
                </span>
            </div>

            <div className="article-content">

                <h3>{title}</h3>

                <p className="article-description">
                    {description}
                </p>

                <div className="article-meta">

                    <span className="article-rating">
                        ★ {rating}
                    </span>

                    <span className="article-author">
                        By {author}
                    </span>

                </div>

                <button className="read-button">
                    Read Article →
                </button>

            </div>

        </article>
    );
}

export default ArticleCard;