import {
  FaFileAlt,
  FaMagic,
  FaCheckCircle,
  FaWhatsapp,
} from "react-icons/fa";

export default function HowItWorks() {
  const steps = [
    {
      icon: <FaFileAlt size={35} />,
      title: "1. Send Your File",
      desc: "Upload your AI-generated assignment or document through WhatsApp.",
    },
    {
      icon: <FaMagic size={35} />,
      title: "2. We Humanize It",
      desc: "We rewrite your content into natural human writing while keeping the original meaning.",
    },
    {
      icon: <FaCheckCircle size={35} />,
      title: "3. Quality Check",
      desc: "Every document is checked carefully before delivery.",
    },
    {
      icon: <FaWhatsapp size={35} />,
      title: "4. Receive Your File",
      desc: "Get your completed document quickly through WhatsApp.",
    },
  ];

  return (
    <section className="py-24 bg-slate-50">
      <div className="max-w-6xl mx-auto px-6">

        <div className="text-center mb-14">

          <span className="text-blue-600 uppercase tracking-widest font-semibold">
            Simple Process
          </span>

          <h2 className="text-4xl font-black mt-3">
            How It Works
          </h2>

          <p className="text-gray-600 mt-4 text-lg">
            Getting your document humanized is quick and easy.
          </p>

        </div>

        <div className="grid md:grid-cols-4 gap-8">

          {steps.map((step, index) => (
            <div
              key={index}
              className="bg-white rounded-3xl shadow-lg p-8 text-center hover:-translate-y-2 hover:shadow-2xl transition-all duration-300"
            >
              <div className="text-blue-600 flex justify-center mb-6">
                {step.icon}
              </div>

              <h3 className="font-bold text-xl mb-4">
                {step.title}
              </h3>

              <p className="text-gray-600 leading-7">
                {step.desc}
              </p>
            </div>
          ))}

        </div>

      </div>
    </section>
  );
}