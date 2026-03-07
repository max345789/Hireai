import { useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const integrations = [
  { name: 'Gmail', color: 'bg-red-500/20 text-red-400' },
  { name: 'Outlook', color: 'bg-blue-500/20 text-blue-400' },
  { name: 'Calendar', color: 'bg-green-500/20 text-green-400' },
  { name: 'Slack', color: 'bg-purple-500/20 text-purple-400' },
  { name: 'WhatsApp', color: 'bg-green-600/20 text-green-500' },
  { name: 'Zoom', color: 'bg-blue-400/20 text-blue-300' },
  { name: 'Greenhouse', color: 'bg-orange-500/20 text-orange-400' },
  { name: 'Ashby', color: 'bg-pink-500/20 text-pink-400' },
  { name: 'Zapier', color: 'bg-orange-400/20 text-orange-300' },
  { name: 'HubSpot', color: 'bg-orange-600/20 text-orange-500' },
  { name: 'Salesforce', color: 'bg-blue-600/20 text-blue-500' },
  { name: 'Notion', color: 'bg-gray-500/20 text-gray-400' },
];

const IntegrationsSection = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const headlineRef = useRef<HTMLDivElement>(null);
  const row1Ref = useRef<HTMLDivElement>(null);
  const row2Ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      // Headline animation
      gsap.fromTo(
        headlineRef.current,
        { y: 24, opacity: 0 },
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

      // Row parallax
      if (row1Ref.current) {
        gsap.fromTo(
          row1Ref.current,
          { x: 0 },
          {
            x: '-12vw',
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

      if (row2Ref.current) {
        gsap.fromTo(
          row2Ref.current,
          { x: 0 },
          {
            x: '12vw',
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
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="section-flowing bg-secondary/30 py-24 lg:py-32 overflow-hidden"
    >
      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <div ref={headlineRef} className="text-center mb-16">
          <p className="label-mono mb-4">INTEGRATIONS</p>
          <h2 className="font-sora font-bold text-3xl lg:text-4xl mb-4">
            Plays nice with your stack
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Native integrations and webhooks for the tools you already use.
          </p>
        </div>
      </div>

      {/* Scrolling rows */}
      <div className="space-y-4">
        <div ref={row1Ref} className="flex gap-3 sm:gap-4 px-4">
          {[...integrations.slice(0, 6), ...integrations.slice(0, 6)].map(
            (integration, i) => (
              <div
                key={`row1-${i}`}
                className="flex-shrink-0 w-[130px] h-[88px] sm:w-[140px] sm:h-[90px] card-dark rounded-2xl flex flex-col items-center justify-center gap-2 hover:-translate-y-1 transition-transform duration-300"
              >
                <div className={`w-10 h-10 rounded-xl ${integration.color} flex items-center justify-center`}>
                  <span className="text-xs font-bold">
                    {integration.name.slice(0, 2)}
                  </span>
                </div>
                <span className="font-mono text-xs max-w-[108px] truncate">
                  {integration.name}
                </span>
              </div>
            )
          )}
        </div>

        <div ref={row2Ref} className="flex gap-3 sm:gap-4 px-4">
          {[...integrations.slice(6), ...integrations.slice(6)].map(
            (integration, i) => (
              <div
                key={`row2-${i}`}
                className="flex-shrink-0 w-[130px] h-[88px] sm:w-[140px] sm:h-[90px] card-dark rounded-2xl flex flex-col items-center justify-center gap-2 hover:-translate-y-1 transition-transform duration-300"
              >
                <div className={`w-10 h-10 rounded-xl ${integration.color} flex items-center justify-center`}>
                  <span className="text-xs font-bold">
                    {integration.name.slice(0, 2)}
                  </span>
                </div>
                <span className="font-mono text-xs max-w-[108px] truncate">
                  {integration.name}
                </span>
              </div>
            )
          )}
        </div>
      </div>

      {/* CTA */}
      <div className="max-w-6xl mx-auto px-6 mt-12 text-center">
        <button className="btn-secondary text-sm">
          View all integrations
        </button>
      </div>
    </section>
  );
};

export default IntegrationsSection;
