import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Navigation from './sections/Navigation';
import HeroSection from './sections/HeroSection';
import ModularGridSection from './sections/ModularGridSection';
import DashboardPreviewSection from './sections/DashboardPreviewSection';
import HowItWorksSection from './sections/HowItWorksSection';
import IntegrationsSection from './sections/IntegrationsSection';
import TestimonialsSection from './sections/TestimonialsSection';
import PricingSection from './sections/PricingSection';
import FAQSection from './sections/FAQSection';
import FinalCTASection from './sections/FinalCTASection';
import './landing.css';

gsap.registerPlugin(ScrollTrigger);

export default function LandingPage() {
  const mainRef = useRef<HTMLDivElement>(null);
  const snapTriggerRef = useRef<ScrollTrigger | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
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
    if (!isDesktop) {
      snapTriggerRef.current?.kill();
      snapTriggerRef.current = null;
      return undefined;
    }

    const timer = setTimeout(() => {
      const pinned = ScrollTrigger.getAll()
        .filter((st) => st.vars.pin)
        .sort((a, b) => a.start - b.start);

      const maxScroll = ScrollTrigger.maxScroll(window);

      if (!maxScroll || pinned.length === 0) return;

      const pinnedRanges = pinned.map((st) => ({
        start: st.start / maxScroll,
        end: (st.end ?? st.start) / maxScroll,
        center: (st.start + ((st.end ?? st.start) - st.start) * 0.5) / maxScroll,
      }));

      snapTriggerRef.current?.kill();
      snapTriggerRef.current = ScrollTrigger.create({
        snap: {
          snapTo: (value: number) => {
            const inPinned = pinnedRanges.some(
              (r) => value >= r.start - 0.02 && value <= r.end + 0.02
            );
            if (!inPinned) return value;

            const target = pinnedRanges.reduce(
              (closest, r) => (
                Math.abs(r.center - value) < Math.abs(closest - value)
                  ? r.center
                  : closest
              ),
              pinnedRanges[0]?.center ?? 0
            );
            return target;
          },
          duration: { min: 0.15, max: 0.35 },
          delay: 0,
          ease: 'power2.out',
        },
      });
    }, 500);

    return () => {
      clearTimeout(timer);
      snapTriggerRef.current?.kill();
      snapTriggerRef.current = null;
    };
  }, [isDesktop]);

  useEffect(() => () => {
    snapTriggerRef.current?.kill();
    ScrollTrigger.getAll().forEach((st) => st.kill());
  }, []);

  return (
    <div ref={mainRef} className="relative bg-background min-h-screen overflow-x-clip">
      {/* Noise overlay */}
      <div className="noise-overlay" />
      
      {/* Navigation */}
      <Navigation />
      
      {/* Sections */}
      <main className="relative overflow-x-clip">
        <HeroSection />
        <ModularGridSection />
        <DashboardPreviewSection />
        <HowItWorksSection />
        <IntegrationsSection />
        <TestimonialsSection />
        <PricingSection />
        <FAQSection />
        <FinalCTASection />
      </main>
    </div>
  );
}
