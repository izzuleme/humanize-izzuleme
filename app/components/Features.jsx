export default function Features() {
  return (
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
  );
}