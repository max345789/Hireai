import { useRef, useLayoutEffect, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ChevronDown } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const faqs = [
  {
    question: 'How does the AI scheduling work?',
    answer:
      'Our AI analyzes your calendar availability and the candidate\'s preferences to automatically suggest optimal meeting times. It handles timezone conversions, sends invites, and reschedules if conflicts arise—all via natural conversation.',
  },
  {
    question: 'What channels are supported?',
    answer:
      'We support email (Gmail, Outlook), WhatsApp Business, web chat widgets, SMS via Twilio, and Slack. All conversations are unified into a single inbox per candidate.',
  },
  {
    question: 'Is candidate data secure?',
    answer:
      'Absolutely. We are SOC 2 Type II certified and GDPR compliant. All data is encrypted at rest and in transit. We never use your candidate data to train our AI models.',
  },
  {
    question: 'Can we override the AI?',
    answer:
      'Yes, anytime. You can pause the AI for specific leads, edit its responses before sending, or take over conversations completely. Human agents always have final control.',
  },
  {
    question: 'Do you offer SLAs?',
    answer:
      'Yes, our Business plan includes a 99.9% uptime SLA with dedicated support response times. We also offer custom enterprise SLAs for large organizations.',
  },
  {
    question: 'How do I migrate from another ATS?',
    answer:
      'We provide free migration assistance for all paid plans. Our team will help export your data from Greenhouse, Lever, Ashby, or any other ATS and import it into HireAI seamlessly.',
  },
];

const FAQSection = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        listRef.current,
        { y: 30, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 70%',
            toggleActions: 'play none none reverse',
          },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section
      id="faq"
      ref={sectionRef}
      className="section-flowing bg-secondary/30 py-16 sm:py-20 lg:py-28"
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center mb-10 sm:mb-12">
          <p className="label-mono mb-4">FAQ</p>
          <h2 className="font-sora font-bold text-2xl sm:text-3xl lg:text-4xl mb-4">
            Frequently asked questions
          </h2>
          <p className="text-muted-foreground">
            Everything you need to know about HireAI.
          </p>
        </div>

        {/* FAQ List */}
        <div ref={listRef} className="space-y-3">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="bg-card border border-white/[0.08] rounded-2xl overflow-hidden"
            >
              <button
                onClick={() => toggleFaq(index)}
                className="w-full flex items-center justify-between gap-3 p-5 text-left hover:bg-white/[0.02] transition-colors min-w-0"
              >
                <span className="font-sora font-medium text-sm lg:text-base pr-2 break-words">
                  {faq.question}
                </span>
                <ChevronDown
                  className={`w-5 h-5 text-muted-foreground flex-shrink-0 transition-transform duration-250 ${
                    openIndex === index ? 'rotate-180' : ''
                  }`}
                />
              </button>
              <div
                className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                  openIndex === index ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                }`}
              >
                <div className="overflow-hidden">
                  <p className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed break-words">
                    {faq.answer}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Contact CTA */}
        <div className="mt-12 text-center">
          <p className="text-muted-foreground mb-4">
            Still have questions?
          </p>
          <a href="/login" className="btn-secondary text-sm">
            Contact support
          </a>
        </div>
      </div>
    </section>
  );
};

export default FAQSection;
