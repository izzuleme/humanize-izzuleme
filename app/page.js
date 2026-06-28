import Hero from "./components/Hero";
import Features from "./components/Features";
import Stats from "./components/Stats";
import HowItWorks from "./components/HowItWorks";
import BeforeAfter from "./components/BeforeAfter";
import TestimonialGallery from "./components/TestimonialGallery";
import Pricing from "./components/Pricing";

export default function Home() {
 return (
  <main className="bg-slate-50">

    <div className="max-w-5xl mx-auto bg-white shadow-2xl rounded-3xl overflow-hidden">
      <div className="grid md:grid-cols-2">
        <Hero />
        <Features />
      </div>
    </div>

    <Stats />

    <HowItWorks />

    <BeforeAfter />

    <TestimonialGallery />

  </main>
);
}