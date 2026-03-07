import { useRef, useLayoutEffect, useEffect, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  Inbox,
  Bot,
  Calendar,
  RefreshCw,
  BarChart3,
  Users,
  GitBranch,
  Tag,
  Settings,
} from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const DESKTOP_QUERY = '(min-width: 1024px)';

// Desktop bento layout (4 cols × 4 rows = 16 cells, all items fit):
//  Col:  1          2          3          4
//  Row1: [inbox 2×2][inbox 2×2][ai-reply ][calendar ]
//  Row2: [inbox 2×2][inbox 2×2][analytics2×1        ]
//  Row3: [pipeline  ][pipeline ][sync     ][contacts ]
//  Row4: [pipeline  ][pipeline ][tags     ][settings ]
const features = [
  {
    id: 'inbox',
    title: 'Unified inbox',
    description: 'Email, WhatsApp, web chat in one thread.',
    icon: Inbox,
    size: 'large',
    position: 'col-start-1 col-span-2 row-start-1 row-span-2',
  },
  {
    id: 'ai-reply',
    title: 'AI replies',
    description: 'Instant, on-brand responses.',
    icon: Bot,
    size: 'small',
    position: 'col-start-3 row-start-1',
  },
  {
    id: 'calendar',
    title: 'Smart scheduling',
    description: 'Book interviews automatically.',
    icon: Calendar,
    size: 'small',
    position: 'col-start-4 row-start-1',
  },
  {
    id: 'analytics',
    title: 'Hiring analytics',
    description: 'See funnel velocity and drop-offs.',
    icon: BarChart3,
    size: 'medium',
    position: 'col-start-3 col-span-2 row-start-2',
  },
  {
    id: 'pipeline',
    title: 'Pipeline',
    description: 'Stages: New → Qualified → Interview → Hired.',
    icon: GitBranch,
    size: 'large',
    position: 'col-start-1 col-span-2 row-start-3 row-span-2',
  },
  {
    id: 'sync',
    title: 'Sync',
    description: 'Real-time updates.',
    icon: RefreshCw,
    size: 'small',
    position: 'col-start-3 row-start-3',
  },
  {
    id: 'contacts',
    title: 'Contacts',
    description: 'Manage all candidates in one place.',
    icon: Users,
    size: 'small',
    position: 'col-start-4 row-start-3',
  },
  {
    id: 'tags',
    title: 'Tags',
    description: 'Organize with labels.',
    icon: Tag,
    size: 'small',
    position: 'col-start-3 row-start-4',
  },
  {
    id: 'settings',
    title: 'Settings',
    description: 'Configure your workflow.',
    icon: Settings,
    size: 'small',
    position: 'col-start-4 row-start-4',
  },
];

const ModularGridSection = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
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

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      if (!isDesktop) {
        gsap.fromTo(
          cardRefs.current.filter(Boolean),
          { y: 20, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.6,
            stagger: 0.06,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: sectionRef.current,
              start: 'top 75%',
              toggleActions: 'play none none reverse',
            },
          }
        );
        return;
      }

      const scrollTl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top',
          end: '+=130%',
          pin: true,
          scrub: 0.6,
        },
      });

      cardRefs.current.forEach((card, i) => {
        if (!card) return;

        const isLeft = i % 3 === 0;
        const isRight = i % 3 === 2;
        const isTop = i < 3;
        const isBottom = i > 5;

        let fromX = '0';
        let fromY = '0';

        if (isLeft) fromX = '-60vw';
        else if (isRight) fromX = '60vw';
        else if (isTop) fromY = '-60vh';
        else if (isBottom) fromY = '60vh';

        const staggerDelay = i * 0.015;

        scrollTl.fromTo(
          card,
          {
            x: fromX,
            y: fromY,
            opacity: 0,
            scale: 0.985,
          },
          {
            x: 0,
            y: 0,
            opacity: 1,
            scale: 1,
            ease: 'none',
          },
          staggerDelay
        );
      });

      cardRefs.current.forEach((card, i) => {
        if (!card) return;

        const isLeft = i % 3 === 0;
        const isRight = i % 3 === 2;

        let toX = '0';
        if (isLeft) toX = '-25vw';
        else if (isRight) toX = '25vw';

        scrollTl.fromTo(
          card,
          { x: 0, opacity: 1 },
          { x: toX, opacity: 0, ease: 'power2.in' },
          0.7 + i * 0.01
        );
      });
    }, sectionRef);

    return () => ctx.revert();
  }, [isDesktop]);

  return (
    <section
      id="features"
      ref={sectionRef}
      className={`${isDesktop ? 'section-pinned' : 'section-flowing py-24'} bg-background flex items-center justify-center`}
    >
      <div className={`w-[min(94vw,1320px)] ${isDesktop ? 'h-[min(74vh,760px)]' : 'h-auto'} mx-auto px-4 sm:px-6`}>
        <div className={`grid gap-4 ${isDesktop ? 'grid-cols-4 grid-rows-4 h-full' : 'grid-cols-1 sm:grid-cols-2'}`}>
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.id}
                ref={(el) => { cardRefs.current[index] = el; }}
                className={`${isDesktop ? feature.position : 'min-h-[110px]'} card-dark p-5 flex flex-col min-w-0 group hover:-translate-y-1 transition-transform duration-300 ${
                  feature.size === 'large' ? 'gap-6' : 'justify-between gap-5'
                }`}
              >
                <div className="flex items-start justify-between gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors shrink-0">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  {feature.size === 'large' && (
                    <span className="label-mono text-[10px]">FEATURE</span>
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className={`font-sora font-semibold break-words mb-1 ${feature.size === 'large' ? 'text-lg sm:text-xl' : 'text-sm sm:text-base'}`}>
                    {feature.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground break-words">
                    {feature.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ModularGridSection;
