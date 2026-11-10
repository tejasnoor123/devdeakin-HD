function Projects() {

    const projects = [
        {
            title: "Smart Door Lock System",
            description:
                "A smart security system using RFID, fingerprint authentication, keypad and servo motor.",
            image: "/images/smart-lock.jpg.png"
        },
        {
            title: "Software Engineering Projects",
            description:
                "Practical software projects developed during my Software Engineering studies.",
            image: "/images/campus.jpg.png"
        },
        {
            title: "Academic Achievements",
            description:
                "Projects, activities and achievements from my university journey.",
            image: "/images/award.jpg.png"
        }
    ];

    return (
        <section className="projects" id="work">
            <div className="section-heading">
                <p className="section-label">MY PROJECTS</p>

                <h2>Featured Work</h2>

                <p className="section-subtitle">
                    Explore some of the projects I have worked on.
                </p>
            </div>

            <div className="project-grid">

                {projects.map((project, index) => (
                    <div className="project-card" key={index}>

                        <img
                            src={project.image}
                            alt={project.title}
                        />

                        <div className="project-content">

                            <h3>{project.title}</h3>

                            <p>
                                {project.description}
                            </p>

                            <a
                                href="#contact"
                                className="project-button"
                            >
                                Learn More →
                            </a>

                        </div>

                    </div>
                ))}

            </div>
        </section>
    );
}

export default Projects;