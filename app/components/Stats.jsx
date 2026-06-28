export default function Stats() {
  const stats = [
    {
      number: "300+",
      title: "Happy Customers",
    },
    {
      number: "1000+",
      title: "Documents Humanized",
    },
    {
      number: "99%",
      title: "Customer Satisfaction",
    },
    {
      number: "24/7",
      title: "Support",
    },
  ];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-6xl mx-auto px-6">

        <div className="text-center mb-14">

          <span className="text-blue-600 font-semibold uppercase tracking-widest">
            Trusted by Students
          </span>

          <h2 className="text-4xl font-black mt-3 text-slate-900">
            Numbers That Speak For Themselves
          </h2>

          <p className="text-gray-600 mt-4 text-lg">
            Hundreds of students and professionals trust Humanize Izzuleme.
          </p>

        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">

          {stats.map((item) => (
            <div
              key={item.title}
              className="bg-white rounded-3xl shadow-lg border p-8 text-center hover:shadow-xl transition"
            >
              <h3 className="text-5xl font-black text-blue-600">
                {item.number}
              </h3>

              <p className="mt-4 text-gray-600 font-medium">
                {item.title}
              </p>
            </div>
          ))}

        </div>

      </div>
    </section>
  );
}