import ArticleCard from "./ArticleCard";

function Articles() {

    const articles = [
        {
            title: "Introduction to React",
            description: "Learn the basics of React components and how to build modern user interfaces.",
            image: "/images/react.jpg",
            rating: "5.0",
            author: "Tejas"
        },
        {
            title: "Getting Started with NodeJS",
            description: "Understand NodeJS and learn how JavaScript can be used for backend development.",
            image: "/images/nodejs.jpg",
            rating: "5.0",
            author: "Tejas"
        },
        {
            title: "Understanding React Hooks",
            description: "Learn how React Hooks such as useState and useEffect help manage application state.",
            image: "/images/hooks.jpg",
            rating: "5.0",
            author: "Tejas"
        }
    ];

    return (
        <section className="articles" id="articles">

            <div className="section-heading">
                <p className="section-label">LEARN & EXPLORE</p>

                <h2>Featured Articles</h2>

                <p className="section-subtitle">
                    Explore articles about web development, programming
                    and modern software technologies.
                </p>
            </div>

            <div className="article-grid">

                {articles.map((article, index) => (
                    <ArticleCard
                        key={index}
                        title={article.title}
                        description={article.description}
                        image={article.image}
                        rating={article.rating}
                        author={article.author}
                    />
                ))}

            </div>

            <a href="#articles" className="see-all">
                See all articles
            </a>

        </section>
    );
}

export default Articles;