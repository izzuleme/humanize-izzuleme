import Image from "next/image";
import { FaWhatsapp } from "react-icons/fa";

export default function Navbar() {
  return (
    <nav className="fixed top-0 left-0 w-full z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">

        <div className="flex items-center gap-3">
          <Image
            src="/logo.png"
            width={45}
            height={45}
            alt="Logo"
            className="rounded-full"
          />

          <span className="font-bold text-xl text-slate-900">
            IZZULEME HUMANIZE
          </span>
        </div>

        <div className="hidden md:flex items-center gap-10 font-medium text-slate-700">

          <a href="#">Home</a>

          <a href="#features">Features</a>

          <a href="#faq">FAQ</a>

          <a href="#contact">Contact</a>

        </div>

        <a
          href="https://wa.me/601161310958"
          target="_blank"
          className="bg-[#25D366] hover:bg-[#20ba5a] transition px-5 py-3 rounded-xl text-white font-bold flex items-center gap-2"
        >
          <FaWhatsapp />
          WhatsApp
        </a>

      </div>
    </nav>
  );
}