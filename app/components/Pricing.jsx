export default function Pricing() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-24">

      <div className="text-center mb-14">

        <span className="text-blue-600 font-semibold uppercase tracking-widest">
          PRICING
        </span>

        <h2 className="text-4xl font-black mt-3 text-slate-900">
          Choose Your Package
        </h2>

        <p className="text-gray-500 mt-4">
          Affordable pricing for students who need fast and quality humanization.
        </p>

      </div>

      <div className="grid md:grid-cols-3 gap-8">

        {/* Basic */}

        <div className="border rounded-3xl p-8 shadow hover:shadow-xl duration-300">

          <h3 className="text-2xl font-bold">Basic</h3>

          <p className="text-5xl font-black mt-5">
            RM1
          </p>

          <p className="text-gray-500 mb-8">
            Per Page
          </p>

          <ul className="space-y-4 text-gray-700">

            <li>✅ English Assignment</li>

            <li>✅ AI Humanization</li>

            <li>✅ Fast Delivery</li>

            <li>✅ AI Detection Optimized</li>

          </ul>

          <a
            href="https://wa.me/60XXXXXXXXXX"
            className="mt-10 block text-center bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-black"
          >
            Order Now
          </a>

        </div>

        {/* Popular */}

        <div className="border-2 border-blue-600 rounded-3xl p-8 shadow-2xl scale-105 relative">

          <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-5 py-2 rounded-full text-sm font-bold">
            MOST POPULAR
          </div>

          <h3 className="text-2xl font-bold">
            10 Pages
          </h3>

          <p className="text-5xl font-black mt-5">
            RM8
          </p>

          <p className="text-green-600 font-semibold">
            Save RM2
          </p>

          <ul className="space-y-4 mt-8 text-gray-700">

            <li>✅ Everything in Basic</li>

            <li>✅ Priority Queue</li>

            <li>✅ Faster Delivery</li>

            <li>✅ Better Value</li>

          </ul>

          <a
            href="https://wa.me/60XXXXXXXXXX"
            className="mt-10 block text-center bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700"
          >
            Order Promotion
          </a>

        </div>

        {/* Premium */}

        <div className="border rounded-3xl p-8 shadow hover:shadow-xl duration-300">

          <h3 className="text-2xl font-bold">
            20 Pages
          </h3>

          <p className="text-5xl font-black mt-5">
            RM15
          </p>

          <p className="text-green-600 font-semibold">
            Best Value
          </p>

          <ul className="space-y-4 mt-8 text-gray-700">

            <li>✅ Everything Included</li>

            <li>✅ Highest Priority</li>

            <li>✅ Fast Delivery</li>

            <li>✅ Great Savings</li>

          </ul>

          <a
            href="https://wa.me/60XXXXXXXXXX"
            className="mt-10 block text-center bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-black"
          >
            Order Promotion
          </a>

        </div>

      </div>

      <div className="mt-14 bg-green-50 border border-green-200 rounded-3xl p-8">

        <div className="grid md:grid-cols-2 gap-4 text-lg">

          <p>✅ Optimized for low AI detection scores</p>

          <p>✅ Fast delivery (around 20–40 minutes)</p>

          <p>✅ Suitable for assignments & reports</p>

          <p>✅ 300+ Happy Customers</p>

          <p>✅ English documents only</p>

          <p>✅ Secure & Confidential</p>

        </div>

      </div>

    </section>
  );
}