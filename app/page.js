import Image from "next/image";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 via-white to-slate-100 px-5 py-10">
      <div className="max-w-5xl w-full bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden">

        <div className="grid md:grid-cols-2">

          {/* LEFT */}
          <div className="p-10 flex flex-col justify-center">

            <Image
              src="/logo.png"
              width={120}
              height={120}
              alt="Humanize Logo"
              className="mb-6"
            />

            <span className="text-blue-700 font-semibold uppercase tracking-widest">
              IZZULEME HUMANIZE
            </span>

            <h1 className="text-5xl font-black mt-4 leading-tight text-slate-900">
              Reduce AI Detection. Improve Originality
            </h1>

            <p className="text-gray-600 mt-6 text-lg leading-8">
              We transform AI-generated content into natural, human-like writing that passes AI detection with greater confidence while preserving your original meaning.
            </p>

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

            <a
              href="/api/order"
              className="mt-10 bg-green-500 hover:bg-green-600 duration-300 text-white text-xl font-bold py-5 rounded-2xl text-center shadow-lg hover:shadow-green-300"
            >
              📲 ORDER SEKARANG
            </a>

          </div>

          {/* RIGHT */}

          <div className="bg-gradient-to-br from-blue-700 to-blue-500 text-white p-10 flex flex-col justify-center">

            <h2 className="text-3xl font-bold mb-8">
              Why Choose Our Humanize Service?
            </h2>

            <div className="space-y-6">

              <div className="bg-white/10 rounded-2xl p-5">
                <h3 className="font-bold text-xl">
                  High AI Detection Reduction
                </h3>

                <p className="text-blue-100 mt-2">
                  Reduce AI detection scores while maintaining the original meaning of your content.
                </p>
              </div>

              <div className="bg-white/10 rounded-2xl p-5">
                <h3 className="font-bold text-xl">
                  Natural Human Writing
                </h3>

                <p className="text-blue-100 mt-2">
                  Your text is rewritten to sound fluent, natural, and authentic.
                </p>
              </div>

              <div className="bg-white/10 rounded-2xl p-5">
                <h3 className="font-bold text-xl">
                  Fast & Reliable Service
                </h3>

                <p className="text-blue-100 mt-2">
                  Receive your completed document quickly with secure handling of every file.
                </p>
              </div>

            </div>

          </div>

        </div>

      </div>
    </main>
  );
}