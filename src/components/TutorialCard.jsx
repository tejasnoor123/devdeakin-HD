function TutorialCard({
    title,
    description,
    rating,
    image,
    author
}) {

    return (
        <article className="tutorial-card">

            <div className="tutorial-image-container">

                <img
                    src={image}
                    alt={title}
                />

                <span className="tutorial-category">
                    Tutorial
                </span>

            </div>

            <div className="tutorial-content">

                <h3>
                    {title}
                </h3>

                <p>
                    {description}
                </p>

                <div className="tutorial-meta">

                    <span className="tutorial-rating">
                         {rating}
                    </span>

                    <span className="tutorial-author">
                        By {author}
                    </span>

                </div>

                <button className="tutorial-button">
                    Start Tutorial →
                </button>

            </div>

        </article>
    );
}

export default TutorialCard;