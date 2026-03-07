import { useEffect, useRef, useLayoutEffect, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { MessageSquare, Calendar, UserPlus } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const DESKTOP_QUERY = '(min-width: 1024px)';

const HeroSection = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const centerCardRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLDivElement>(null);
  const satelliteRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scanlineRef = useRef<HTMLDivElement>(null);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(DESKTOP_QUERY);
    const update = () => setIsDesktop(mediaQuery.matches);

    update();
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', update);
      return () => mediaQuery.removeEventListener('change', update);
    }

    mediaQuery.addListener(update);
    return () => mediaQuery.removeListener(update);
  }, []);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });

      tl.fromTo(
        scanlineRef.current,
        { opacity: 0.04 },
        { opacity: 0.1, duration: 0.6, yoyo: true, repeat: 1 },
        0
      );

      tl.fromTo(
        centerCardRef.current,
        { opacity: 0, scale: 0.96, y: 18 },
        { opacity: 1, scale: 1, y: 0, duration: 0.9 },
        0.15
      );

      const words = headlineRef.current?.querySelectorAll('.word');
      if (words?.length) {
        tl.fromTo(
          words,
          { opacity: 0, y: 16 },
          { opacity: 1, y: 0, duration: 0.5, stagger: 0.04 },
          0.35
        );
      }

      const cards = satelliteRefs.current.filter(Boolean);
      tl.fromTo(
        cards,
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.6, stagger: 0.1 },
        isDesktop ? 0.45 : 0.3
      );
    }, sectionRef);

    return () => ctx.revert();
  }, [isDesktop]);

  useLayoutEffect(() => {
    if (!isDesktop) return undefined;

    const ctx = gsap.context(() => {
      const scrollTl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top',
          end: '+=130%',
          pin: true,
          scrub: 0.6,
          onLeaveBack: () => {
            gsap.set(centerCardRef.current, { opacity: 1, y: 0 });
            satelliteRefs.current.forEach((card) => {
              if (card) gsap.set(card, { opacity: 1, x: 0 });
            });
          },
        },
      });

      scrollTl.fromTo(
        centerCardRef.current,
        { y: 0, opacity: 1 },
        { y: '-18vh', opacity: 0, ease: 'power2.in' },
        0.7
      );

      satelliteRefs.current.forEach((card, i) => {
        if (card) {
          const exitX = i === 2 ? '10vw' : '-10vw';
          scrollTl.fromTo(
            card,
            { x: 0, opacity: 1 },
            { x: exitX, opacity: 0, ease: 'power2.in' },
            0.72 + i * 0.02
          );
        }
      });
    }, sectionRef);

    return () => ctx.revert();
  }, [isDesktop]);

  return (
    <section
      ref={sectionRef}
      className={`${isDesktop ? 'section-pinned' : 'section-flowing py-24'} bg-background flex items-center justify-center overflow-x-clip`}
    >
      <div ref={scanlineRef} className={`scanline ${isDesktop ? '' : 'hidden'}`} />

      {isDesktop ? (
        <>
          <div
            ref={(el) => { satelliteRefs.current[0] = el; }}
            className="absolute left-[clamp(1rem,5vw,6rem)] top-[12vh] w-[clamp(180px,16vw,280px)] h-[clamp(150px,20vh,220px)] card-dark p-5 flex flex-col justify-between"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                <UserPlus className="w-5 h-5 text-primary" />
              </div>
              <span className="label-mono truncate">NEW LEAD</span>
            </div>
            <div>
              <p className="text-2xl font-sora font-semibold">24</p>
              <p className="text-sm text-muted-foreground">Today</p>
            </div>
          </div>

          <div
            ref={(el) => { satelliteRefs.current[1] = el; }}
            className="absolute left-[clamp(1rem,5vw,6rem)] top-[60vh] w-[clamp(180px,16vw,280px)] h-[clamp(160px,22vh,260px)] card-dark p-5 flex flex-col justify-between"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
                <MessageSquare className="w-5 h-5 text-blue-400" />
              </div>
              <span className="label-mono truncate">QUALIFY</span>
            </div>
            <div className="space-y-2">
              <div className="h-2 bg-white/10 rounded-full w-full" />
              <div className="h-2 bg-white/10 rounded-full w-3/4" />
              <div className="h-2 bg-primary/30 rounded-full w-1/2" />
            </div>
          </div>

          <div
            ref={(el) => { satelliteRefs.current[2] = el; }}
            className="absolute right-[clamp(1rem,5vw,6rem)] top-[34vh] w-[clamp(180px,16vw,280px)] h-[clamp(170px,24vh,300px)] card-dark p-5 flex flex-col justify-between"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5 text-green-400" />
              </div>
              <span className="label-mono truncate">BOOKED</span>
            </div>
            <div>
              <p className="text-3xl font-sora font-semibold text-primary">18</p>
              <p className="text-sm text-muted-foreground break-words">Interviews scheduled</p>
            </div>
            <div className="flex -space-x-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/40 to-primary/20 border-2 border-card"
                />
              ))}
            </div>
          </div>

          <div
            ref={centerCardRef}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(92vw,920px)] lg:w-[min(72vw,920px)] min-h-[300px] card-dark p-8 lg:p-10 flex flex-col justify-between"
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
                <span className="text-primary-foreground font-bold text-sm">H</span>
              </div>
            </div>

            <div ref={headlineRef} className="space-y-4 min-w-0">
              <p className="label-mono">AUTOMATED HIRING ASSISTANT</p>
              <h1 className="font-sora font-bold text-4xl md:text-5xl xl:text-6xl tracking-tight break-words">
                <span className="word inline-block mr-2">Hire</span>
                <span className="word inline-block text-primary">AI</span>
              </h1>
              <p className="word text-base lg:text-lg text-muted-foreground max-w-[42ch] break-words">
                AI scheduling and follow-ups for hiring teams.
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              <a href="/register" className="btn-primary">Start free</a>
              <a href="/login" className="btn-secondary">Book a demo</a>
            </div>
          </div>
        </>
      ) : (
        <div className="w-[min(94vw,1200px)] mx-auto px-4 sm:px-6">
          <div
            ref={centerCardRef}
            className="card-dark p-6 sm:p-8 flex flex-col gap-6"
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
                <span className="text-primary-foreground font-bold text-sm">H</span>
              </div>
              <span className="label-mono">AUTOMATED HIRING ASSISTANT</span>
            </div>

            <div ref={headlineRef} className="space-y-3 min-w-0">
              <h1 className="font-sora font-bold text-4xl sm:text-5xl tracking-tight break-words">
                <span className="word inline-block mr-2">Hire</span>
                <span className="word inline-block text-primary">AI</span>
              </h1>
              <p className="word text-base sm:text-lg text-muted-foreground break-words max-w-[42ch]">
                AI scheduling and follow-ups for hiring teams.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <a href="/register" className="btn-primary w-full sm:w-auto">Start free</a>
              <a href="/login" className="btn-secondary w-full sm:w-auto">Book a demo</a>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div
              ref={(el) => { satelliteRefs.current[0] = el; }}
              className="card-dark p-4 flex items-center gap-3 min-w-0"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                <UserPlus className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="label-mono truncate">NEW LEADS</p>
                <p className="text-lg font-sora font-semibold">24 today</p>
              </div>
            </div>

            <div
              ref={(el) => { satelliteRefs.current[1] = el; }}
              className="card-dark p-4 flex items-center gap-3 min-w-0"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
                <MessageSquare className="w-5 h-5 text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="label-mono truncate">QUALIFICATION</p>
                <p className="text-sm text-muted-foreground break-words">Faster candidate replies</p>
              </div>
            </div>

            <div
              ref={(el) => { satelliteRefs.current[2] = el; }}
              className="card-dark p-4 flex items-center gap-3 min-w-0"
            >
              <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5 text-green-400" />
              </div>
              <div className="min-w-0">
                <p className="label-mono truncate">BOOKED</p>
                <p className="text-sm text-muted-foreground break-words">18 interviews scheduled</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default HeroSection;
