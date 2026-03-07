import { useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Link2, Bot, Trophy } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const steps = [
  {
    number: '01',
    title: 'Connect your channels',
    description:
      'Email, calendar, WhatsApp—integrated in minutes. Our webhooks sync with your existing tools so you never miss a lead.',
    icon: Link2,
    visual: (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 p-3 bg-white/[0.05] rounded-xl">
          <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
            <span className="text-red-400 text-xs font-bold">G</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">Gmail</p>
            <p className="text-xs text-muted-foreground truncate">Connected</p>
          </div>
          <div className="w-2 h-2 bg-green-400 rounded-full" />
        </div>
        <div className="flex items-center gap-3 p-3 bg-white/[0.05] rounded-xl">
          <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
            <span className="text-green-400 text-xs font-bold">W</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">WhatsApp</p>
            <p className="text-xs text-muted-foreground truncate">Connected</p>
          </div>
          <div className="w-2 h-2 bg-green-400 rounded-full" />
        </div>
        <div className="flex items-center gap-3 p-3 bg-white/[0.05] rounded-xl">
          <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <span className="text-blue-400 text-xs font-bold">C</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">Calendar</p>
            <p className="text-xs text-muted-foreground truncate">Connected</p>
          </div>
          <div className="w-2 h-2 bg-green-400 rounded-full" />
        </div>
      </div>
    ),
  },
  {
    number: '02',
    title: 'AI handles the back-and-forth',
    description:
      'Replies, reminders, and scheduling—automatic. Our AI understands context and responds like your best team member.',
    icon: Bot,
    visual: (
      <div className="bg-white/[0.03] rounded-xl p-4 space-y-3">
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
            <span className="text-primary text-xs font-bold">AI</span>
          </div>
          <div className="bg-white/[0.08] rounded-2xl rounded-tl-sm px-4 py-2 max-w-[80%]">
            <p className="text-xs break-words">
              Hi Sarah! Thanks for your interest. Are you available for a quick
              call this week?
            </p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <div className="bg-primary/20 rounded-2xl rounded-tr-sm px-4 py-2 max-w-[80%]">
            <p className="text-xs break-words">Tuesday 2pm works for me!</p>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
            <span className="text-primary text-xs font-bold">AI</span>
          </div>
          <div className="bg-white/[0.08] rounded-2xl rounded-tl-sm px-4 py-2 max-w-[80%]">
            <p className="text-xs break-words">
              Perfect! I've scheduled Tuesday 2pm. Calendar invite sent 📅
            </p>
          </div>
        </div>
      </div>
    ),
  },
  {
    number: '03',
    title: 'Close candidates faster',
    description:
      'Fewer drop-offs, more interviews booked. Track every touchpoint and optimize your hiring funnel.',
    icon: Trophy,
    visual: (
      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 bg-white/[0.05] rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/40 to-primary/20" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">Sarah Johnson</p>
              <p className="text-xs text-muted-foreground truncate">Senior Designer</p>
            </div>
          </div>
          <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
            Hired
          </span>
        </div>
        <div className="flex items-center justify-between p-3 bg-white/[0.05] rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400/40 to-blue-400/20" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">Mike Chen</p>
              <p className="text-xs text-muted-foreground truncate">Engineer</p>
            </div>
          </div>
          <span className="px-2 py-1 bg-primary/20 text-primary text-xs rounded-full">
            Interview
          </span>
        </div>
        <div className="flex items-center justify-between p-3 bg-white/[0.05] rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400/40 to-purple-400/20" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">Emma Davis</p>
              <p className="text-xs text-muted-foreground truncate">Product Manager</p>
            </div>
          </div>
          <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full">
            Qualified
          </span>
        </div>
      </div>
    ),
  },
];

const HowItWorksSection = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
  const lineRef = useRef<SVGPathElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      // Animate each step card
      stepRefs.current.forEach((step) => {
        if (step) {
          gsap.fromTo(
            step,
            { y: '8vh', opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: 0.8,
              ease: 'power2.out',
              scrollTrigger: {
                trigger: step,
                start: 'top 80%',
                toggleActions: 'play none none reverse',
              },
            }
          );

          // Animate visual
          const visual = step.querySelector('.step-visual');
          if (visual) {
            gsap.fromTo(
              visual,
              { x: '6vw', opacity: 0 },
              {
                x: 0,
                opacity: 1,
                duration: 0.8,
                ease: 'power2.out',
                scrollTrigger: {
                  trigger: step,
                  start: 'top 75%',
                  toggleActions: 'play none none reverse',
                },
              }
            );
          }
        }
      });

      // Animate connecting line
      if (lineRef.current) {
        const length = lineRef.current.getTotalLength();
        gsap.set(lineRef.current, {
          strokeDasharray: length,
          strokeDashoffset: length,
        });

        gsap.to(lineRef.current, {
          strokeDashoffset: 0,
          ease: 'none',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 60%',
            end: 'bottom 40%',
            scrub: true,
          },
        });
      }
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
          <p className="label-mono mb-4">HOW IT WORKS</p>
          <h2 className="font-sora font-bold text-3xl lg:text-4xl mb-4">
            Set up in minutes, not months
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Our AI-powered platform integrates with your existing tools and starts
            working immediately.
          </p>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Connecting line (visible on lg+) */}
          <svg
            className="absolute left-1/2 top-0 h-full w-4 -translate-x-1/2 hidden lg:block"
            preserveAspectRatio="none"
          >
            <path
              ref={lineRef}
              d="M 8 0 L 8 100%"
              stroke="rgba(182, 255, 46, 0.3)"
              strokeWidth="2"
              fill="none"
              className="h-full"
              style={{ height: '100%' }}
            />
          </svg>

          <div className="space-y-12 lg:space-y-24">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isEven = index % 2 === 0;

              return (
                <div
                  key={step.number}
                  ref={(el) => { stepRefs.current[index] = el; }}
                  className={`relative grid lg:grid-cols-2 gap-8 lg:gap-16 items-center ${
                    isEven ? '' : 'lg:direction-rtl'
                  }`}
                >
                  {/* Step number badge */}
                  <div
                    className={`absolute left-1/2 -translate-x-1/2 -top-4 w-8 h-8 bg-primary rounded-full flex items-center justify-center hidden lg:flex z-10`}
                  >
                    <span className="text-primary-foreground text-xs font-bold">
                      {step.number}
                    </span>
                  </div>

                  {/* Text content */}
                  <div className={`${isEven ? 'lg:pr-16' : 'lg:pl-16 lg:order-2'} min-w-0`}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center lg:hidden">
                        <Icon className="w-6 h-6 text-primary" />
                      </div>
                      <span className="label-mono lg:hidden">STEP {step.number}</span>
                    </div>
                    <h3 className="font-sora font-semibold text-2xl mb-3 break-words">
                      {step.title}
                    </h3>
                    <p className="text-muted-foreground leading-relaxed break-words">
                      {step.description}
                    </p>
                  </div>

                  {/* Visual */}
                  <div
                    className={`step-visual min-w-0 ${
                      isEven ? 'lg:pl-16' : 'lg:pr-16 lg:order-1'
                    }`}
                  >
                    <div className="card-dark p-5">{step.visual}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
