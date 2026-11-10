import Hero from "../components/Hero";
import About from "../components/About";
import Projects from "../components/Projects";
import Articles from "../components/Articles";
import Tutorials from "../components/Tutorials";
import Photos from "../components/Photos";
import Newsletter from "../components/Newsletter";

function Home() {
    return (
        <main>
            <Hero />
            <About />
            <Projects />
            <Articles />
            <Tutorials />
            <Photos />
            <Newsletter />
        </main>
    );
}

export default Home;
