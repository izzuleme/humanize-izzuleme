import Image from "next/image";
import { FaWhatsapp, FaStar } from "react-icons/fa";

export default function Hero() {
  return (
    <div className="p-10 flex flex-col justify-center">

      {/* Logo */}
      <Image
        src="/logo.png"
        width={120}
        height={120}
        alt="Humanize Izzuleme"
        className="mb-6"
      />

      {/* Badge */}
      <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full font-semibold w-fit">
        ⭐ Trusted by 300+ Students Worldwide
      </div>

      {/* Heading */}
      <h1 className="text-5xl lg:text-6xl font-black mt-6 leading-tight text-slate-900">
        Humanize Your AI Writing
        <br />
        <span className="text-blue-600">
          Without Losing Meaning
        </span>
      </h1>

      {/* Description */}
      <p className="text-gray-600 mt-6 text-lg leading-8 max-w-xl">
        We rewrite AI-generated content into natural, human-like writing
        that helps reduce AI detection while keeping your original ideas,
        structure and quality intact.
      </p>

      {/* Stats */}
      <div className="flex flex-wrap gap-4 mt-8">

        <div className="bg-white shadow rounded-2xl px-5 py-4">
          <h2 className="text-3xl font-bold text-blue-600">
            300+
          </h2>
          <p className="text-gray-500 text-sm">
            Happy Customers
          </p>
        </div>

        <div className="bg-white shadow rounded-2xl px-5 py-4">
          <h2 className="text-3xl font-bold text-green-600">
            3
          </h2>
          <p className="text-gray-500 text-sm">
            Countries Served
          </p>
        </div>

        <div className="bg-white shadow rounded-2xl px-5 py-4">
          <h2 className="text-3xl font-bold text-purple-600">
            24/7
          </h2>
          <p className="text-gray-500 text-sm">
            Customer Support
          </p>
        </div>

      </div>

      {/* Features */}
      <div className="flex flex-wrap gap-3 mt-8">

        <span className="bg-green-100 text-green-700 px-4 py-2 rounded-full font-semibold">
          ⚡ Fast Delivery
        </span>

        <span className="bg-blue-100 text-blue-700 px-4 py-2 rounded-full font-semibold">
          🎯 High Accuracy
        </span>

        <span className="bg-purple-100 text-purple-700 px-4 py-2 rounded-full font-semibold">
          🔒 100% Secure
        </span>

      </div>

      {/* Button */}
      <a
        href="/api/order"
        className="mt-10 bg-green-500 hover:bg-green-600 duration-300 text-white text-xl font-bold py-5 rounded-2xl shadow-lg hover:shadow-green-300 flex items-center justify-center gap-3"
      >
        <FaWhatsapp size={28} />
        <span>Order via WhatsApp</span>
      </a>

      {/* Social Proof */}
      <div className="flex items-center gap-3 mt-8">

        <div className="flex text-yellow-400">
          <FaStar />
          <FaStar />
          <FaStar />
          <FaStar />
          <FaStar />
        </div>

        <span className="text-gray-600">
          Rated <b>5.0/5</b> by students & professionals
        </span>

      </div>

    </div>
  );
}