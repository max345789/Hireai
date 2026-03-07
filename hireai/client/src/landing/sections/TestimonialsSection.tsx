import { useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Quote } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const testimonials = [
  {
    quote:
      'We cut scheduling time by 70%. Candidates hear back in minutes, not days.',
    name: 'Lena V.',
    role: 'Talent Lead, Series B SaaS',
    avatar: '/avatar_01.jpg',
  },
  {
    quote:
      "It feels like we hired a coordinator—without the headcount. The AI handles follow-ups perfectly.",
    name: 'Marcus T.',
    role: 'VP People, Fintech',
    avatar: '/avatar_02.jpg',
  },
];

const TestimonialsSection = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      cardRefs.current.forEach((card, i) => {
        if (card) {
          gsap.fromTo(
            card,
            { y: '10vh', opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: 0.8,
              ease: 'power2.out',
              scrollTrigger: {
                trigger: card,
                start: 'top 80%',
                toggleActions: 'play none none reverse',
              },
            }
          );

          // Parallax separation
          gsap.fromTo(
            card,
            { y: 0 },
            {
              y: i === 0 ? -20 : -10,
              ease: 'none',
              scrollTrigger: {
                trigger: sectionRef.current,
                start: 'top bottom',
                end: 'bottom top',
                scrub: true,
              },
            }
          );
        }
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="section-flowing bg-background py-24 lg:py-32"
    >
      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="label-mono mb-4">TESTIMONIALS</p>
          <h2 className="font-sora font-bold text-3xl lg:text-4xl mb-4">
            Loved by hiring teams
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            See what industry leaders say about transforming their hiring process.
          </p>
        </div>

        {/* Testimonial Cards */}
        <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
          {testimonials.map((testimonial, index) => (
            <div
              key={testimonial.name}
              ref={(el) => { cardRefs.current[index] = el; }}
              className="card-dark p-6 lg:p-8 relative"
            >
              {/* Quote icon */}
              <div className="absolute top-6 right-6 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Quote className="w-5 h-5 text-primary" />
              </div>

              {/* Quote text */}
              <blockquote className="text-lg lg:text-xl font-sora font-medium leading-relaxed mb-8 pr-12 break-words">
                "{testimonial.quote}"
              </blockquote>

              {/* Author */}
              <div className="flex items-center gap-4">
                <img
                  src={testimonial.avatar}
                  alt={testimonial.name}
                  className="w-14 h-14 rounded-full object-cover grayscale"
                />
                <div className="min-w-0">
                  <p className="font-sora font-semibold break-words">{testimonial.name}</p>
                  <p className="font-mono text-xs text-muted-foreground break-words">
                    {testimonial.role}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
