export default function Testimonials() {
  const testimonials = [
    {
      name: "UiTM Student",
      country: "Malaysia 🇲🇾",
      review:
        "AI detection turun dengan banyak dan assignment saya nampak lebih natural. Memang puas hati dengan servis ni.",
    },
    {
      name: "University Student",
      country: "Brunei 🇧🇳",
      review:
        "Very fast service. My document became much more human and easier to read. Highly recommended.",
    },
    {
      name: "International Student",
      country: "South Korea 🇰🇷",
      review:
        "Professional service with fast turnaround. The writing sounded much more natural.",
    },
  ];

  return (
    <section className="py-24 bg-slate-50">
      <div className="max-w-6xl mx-auto px-6">

        <div className="text-center mb-14">

          <span className="text-blue-600 font-semibold uppercase tracking-widest">
            Testimonials
          </span>

          <h2 className="text-4xl font-black mt-3">
            What Our Customers Say
          </h2>

          <p className="text-gray-600 mt-4 text-lg">
            Trusted by more than 300 customers from different countries.
          </p>

        </div>

        <div className="grid md:grid-cols-3 gap-8">

          {testimonials.map((item, index) => (
            <div
              key={index}
              className="bg-white rounded-3xl shadow-lg p-8 hover:shadow-xl transition"
            >
              <div className="text-yellow-400 text-2xl mb-4">
                ⭐⭐⭐⭐⭐
              </div>

              <p className="text-gray-600 leading-8 italic">
                "{item.review}"
              </p>

              <div className="mt-8">
                <h3 className="font-bold text-lg">
                  {item.name}
                </h3>

                <p className="text-blue-600">
                  {item.country}
                </p>
              </div>
            </div>
          ))}

        </div>

      </div>
    </section>
  );
}