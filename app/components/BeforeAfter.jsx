import { FaArrowRight, FaWhatsapp } from "react-icons/fa";

export default function BeforeAfter() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-6xl mx-auto px-6">

        <div className="text-center mb-16">

          <span className="text-blue-600 font-semibold uppercase tracking-widest">
            Before vs After
          </span>

          <h2 className="text-4xl font-black mt-3 text-slate-900">
            See The Difference
          </h2>

          <p className="text-gray-600 mt-4 text-lg">
            Our goal is to reduce AI detection while preserving the original meaning of your writing.
          </p>

        </div>

        <div className="grid md:grid-cols-3 items-center gap-8">

          {/* BEFORE */}

          <div className="rounded-3xl border shadow-lg p-8 text-center">

            <h3 className="text-2xl font-bold text-red-600 mb-6">
              BEFORE
            </h3>

            <div className="text-7xl font-black text-red-500">
              98%
            </div>

            <p className="mt-4 text-gray-600">
              High AI Detection
            </p>

          </div>

          {/* ARROW */}

          <div className="flex justify-center">

            <FaArrowRight
              size={45}
              className="text-blue-500"
            />

          </div>

          {/* AFTER */}

          <div className="rounded-3xl border shadow-lg p-8 text-center">

            <h3 className="text-2xl font-bold text-green-600 mb-6">
              AFTER
            </h3>

            <div className="text-7xl font-black text-green-500">
              3%
            </div>

            <p className="mt-4 text-gray-600">
              Natural Human Writing
            </p>

          </div>

        </div>

        <div className="mt-14 flex flex-wrap justify-center gap-4">

          <span className="bg-green-100 text-green-700 px-5 py-3 rounded-full font-semibold">
            ✔ Natural Writing
          </span>

          <span className="bg-blue-100 text-blue-700 px-5 py-3 rounded-full font-semibold">
            ✔ Original Meaning
          </span>

          <span className="bg-purple-100 text-purple-700 px-5 py-3 rounded-full font-semibold">
            ✔ Human-Like Flow
          </span>

        </div>

        <div className="flex justify-center mt-12">

          <a
            href="/api/order"
            className="bg-green-500 hover:bg-green-600 transition text-white font-bold text-xl px-8 py-5 rounded-2xl flex items-center gap-3"
          >
            <FaWhatsapp />
            Order via WhatsApp
          </a>

        </div>

      </div>
    </section>
  );
}