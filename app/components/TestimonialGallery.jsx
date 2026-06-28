import Image from "next/image";

const reviews = [
  "/testimonials/review1.jpg",
  "/testimonials/review2.jpg",
  "/testimonials/review3.jpg",
  "/testimonials/review4.jpg",
  "/testimonials/review5.jpg",
  "/testimonials/review6.jpg",
  "/testimonials/review7.jpg",
  "/testimonials/review8.jpg",
];

export default function TestimonialGallery() {
  return (
    <section className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-6">

        <div className="text-center mb-14">

          <span className="text-blue-600 uppercase tracking-widest font-semibold">
            Real Customer Reviews
          </span>

          <h2 className="text-4xl font-black mt-3">
            Trusted by 300+ Customers
          </h2>

          <p className="text-gray-600 mt-4 text-lg">
            Genuine feedback from our happy customers across Malaysia, Brunei and South Korea.
          </p>

        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">

          {reviews.map((img, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-3xl shadow-xl border bg-white hover:-translate-y-2 hover:shadow-2xl transition-all duration-300"
            >
              <Image
                src={img}
                alt={`Review ${index + 1}`}
                width={500}
                height={1000}
                className="w-full h-full object-cover"
              />
            </div>
          ))}

        </div>

      </div>
    </section>
  );
}