import TutorialCard from "./TutorialCard";

function Tutorials() {

    const tutorials = [
        {
            title: "React Basics",
            description: "Learn the fundamentals of React and how to create reusable components.",
            image: "/images/react-tutorial.jpg",
            rating: "5.0",
            author: "Tejas"
        },

        {
            title: "React Router",
            description: "Learn how to navigate between different pages in a React application.",
            image: "/images/router-tutorial.jpg",
            rating: "5.0",
            author: "Tejas"
        },

        {
            title: "ExpressJS",
            description: "Learn how to build a backend server using ExpressJS and NodeJS.",
            image: "/images/express-tutorial.jpg",
            rating: "4.9",
            author: "Tejas"
        }
    ];

    return (
        <section className="tutorials" id="tutorials">

            <div className="section-heading">

                <p className="section-label">
                    LEARN SOMETHING NEW
                </p>

                <h2>
                    Featured Tutorials
                </h2>

                <p className="section-subtitle">
                    Step-by-step tutorials to improve your
                    software development skills.
                </p>

            </div>

            <div className="tutorial-grid">

                {tutorials.map((tutorial, index) => (

                    <TutorialCard
                        key={index}
                        title={tutorial.title}
                        description={tutorial.description}
                        image={tutorial.image}
                        rating={tutorial.rating}
                        author={tutorial.author}
                    />

                ))}

            </div>

            <a
                href="#tutorials"
                className="see-all"
            >
                See all tutorials
            </a>

        </section>
    );
}

export default Tutorials;