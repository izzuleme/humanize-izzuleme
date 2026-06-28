"use client";

import { useState } from "react";
import { FaChevronDown } from "react-icons/fa";

const faqs = [
  {
    question: "How long does the process take?",
    answer:
      "Most documents are completed within 20–40 minutes depending on the number of pages.",
  },
  {
    question: "Can I submit Bahasa Melayu assignments?",
    answer:
      "Currently, our humanize service only supports English documents.",
  },
  {
    question: "Will my document be confidential?",
    answer:
      "Yes. Every file is handled privately and will never be shared with anyone.",
  },
  {
    question: "Can you guarantee a low AI detection score?",
    answer:
      "We optimize every document to reduce AI detection while preserving its original meaning. Results can vary depending on the checker used.",
  },
  {
    question: "How do I place an order?",
    answer:
      "Simply click any WhatsApp button on the website, send your document, and we'll guide you through the process.",
  },
];

export default function FAQ() {
  const [open, setOpen] = useState(null);

  return (
    <section className="py-24 bg-slate-50">
      <div className="max-w-4xl mx-auto px-6">

        <div className="text-center mb-14">

          <span className="uppercase tracking-widest text-blue-600 font-semibold">
            FAQ
          </span>

          <h2 className="text-4xl font-black mt-3">
            Frequently Asked Questions
          </h2>

        </div>

        <div className="space-y-5">

          {faqs.map((faq, index) => (

            <div
              key={index}
              className="bg-white rounded-2xl shadow"
            >

              <button
                onClick={() =>
                  setOpen(open === index ? null : index)
                }
                className="w-full flex justify-between items-center p-6 text-left font-bold text-lg"
              >

                {faq.question}

                <FaChevronDown
                  className={`duration-300 ${
                    open === index ? "rotate-180" : ""
                  }`}
                />

              </button>

              {open === index && (

                <div className="px-6 pb-6 text-gray-600 leading-8">

                  {faq.answer}

                </div>

              )}

            </div>

          ))}

        </div>

      </div>
    </section>
  );
}