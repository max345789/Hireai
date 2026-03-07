import { useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CheckCircle2 } from 'lucide-react';
import { Particles } from '@/components/ui/particles';

gsap.registerPlugin(ScrollTrigger);

const FinalCTASection = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        cardRef.current,
        { y: '8vh', opacity: 0 },
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

      buttonRefs.current.forEach((btn, i) => {
        if (btn) {
          gsap.fromTo(
            btn,
            { scale: 0.98, opacity: 0 },
            {
              scale: 1,
              opacity: 1,
              duration: 0.5,
              delay: 0.3 + i * 0.1,
              ease: 'power2.out',
              scrollTrigger: {
                trigger: sectionRef.current,
                start: 'top 70%',
                toggleActions: 'play none none reverse',
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
      className="section-flowing bg-background py-16 sm:py-20 lg:py-28"
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div
          ref={cardRef}
          className="card-dark p-8 lg:p-12 relative overflow-hidden"
        >
          {/* Background gradient */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

          {/* Particles */}
          <Particles
            className="absolute inset-0"
            quantity={60}
            ease={80}
            color="#b6ff2e"
            size={0.5}
          />

          <div className="relative z-10">
            <div className="max-w-xl min-w-0">
              <h2 className="font-sora font-bold text-3xl lg:text-4xl mb-4">
                Hire faster.{' '}
                <span className="text-primary">Follow up automatically.</span>
              </h2>
              <p className="text-muted-foreground mb-8 break-words">
                Set up in 10 minutes. No credit card required. Join hundreds of
                teams already using HireAI to transform their hiring process.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-8">
                <a
                  href="/register"
                  ref={(el) => { buttonRefs.current[0] = el; }}
                  className="btn-primary w-full sm:w-auto text-center"
                >
                  Start free
                </a>
                <a
                  href="/login"
                  ref={(el) => { buttonRefs.current[1] = el; }}
                  className="btn-secondary w-full sm:w-auto text-center"
                >
                  Talk to sales
                </a>
              </div>

              {/* Trust indicators */}
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <span>14-day free trial</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <span>No credit card</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <span>Cancel anytime</span>
                </div>
              </div>
            </div>

            {/* Status line */}
            <div className="mt-8 lg:mt-0 lg:absolute lg:bottom-0 lg:right-0 p-0 lg:p-8">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="font-mono text-xs text-muted-foreground">
                  All systems operational
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-20 pt-8 border-t border-white/[0.08]">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">H</span>
              </div>
              <span className="font-sora font-bold">HireAI</span>
            </div>

            {/* Links */}
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">
                Privacy
              </a>
              <a href="#" className="hover:text-foreground transition-colors">
                Terms
              </a>
              <a href="#" className="hover:text-foreground transition-colors">
                Security
              </a>
              <a href="#" className="hover:text-foreground transition-colors">
                Status
              </a>
            </div>

            {/* Copyright */}
            <p className="text-sm text-muted-foreground">
              © 2026 HireAI. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </section>
  );
};

export default FinalCTASection;
