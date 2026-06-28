import Hero from "@/components/Hero";
import Features from "@/components/Features";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 via-white to-slate-100 px-5 py-10">
      <div className="max-w-5xl w-full bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden">
        <div className="grid md:grid-cols-2">
          <Hero />
          <Features />
        </div>
      </div>
    </main>
  );
}