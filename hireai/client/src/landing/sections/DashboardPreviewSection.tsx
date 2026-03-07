import { useRef, useLayoutEffect, useEffect, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  Inbox,
  Users,
  Briefcase,
  Calendar,
  BarChart3,
  Settings,
  Bell,
  Search,
  TrendingUp,
  Clock,
  CheckCircle,
  MessageSquare,
} from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const DESKTOP_QUERY = '(min-width: 1024px)';

const sidebarItems = [
  { icon: Inbox, label: 'Inbox', active: true },
  { icon: Users, label: 'Candidates' },
  { icon: Briefcase, label: 'Jobs' },
  { icon: Calendar, label: 'Calendar' },
  { icon: BarChart3, label: 'Analytics' },
  { icon: Settings, label: 'Settings' },
];

const metrics = [
  { label: 'Response time', value: '2.4h', change: '-12%', icon: Clock },
  { label: 'Meetings booked', value: '48', change: '+23%', icon: CheckCircle },
  { label: 'Conversion', value: '34%', change: '+8%', icon: TrendingUp },
];

const recentActivity = [
  { type: 'message', text: 'New lead from WhatsApp', time: '2m ago' },
  { type: 'booking', text: 'Interview scheduled', time: '15m ago' },
  { type: 'followup', text: 'Follow-up sent', time: '1h ago' },
];

const DashboardPreviewSection = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const activityCardRef = useRef<HTMLDivElement>(null);
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
          dashboardRef.current,
          { y: 28, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.8,
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
          end: '+=120%',
          pin: true,
          scrub: 0.6,
        },
      });

      scrollTl.fromTo(
        dashboardRef.current,
        { y: '90vh', scale: 0.92, opacity: 0 },
        { y: 0, scale: 1, opacity: 1, ease: 'none' },
        0
      );

      scrollTl.fromTo(
        sidebarRef.current,
        { x: '-30vw', opacity: 0 },
        { x: 0, opacity: 1, ease: 'none' },
        0.05
      );

      scrollTl.fromTo(
        mainContentRef.current,
        { x: '30vw', opacity: 0 },
        { x: 0, opacity: 1, ease: 'none' },
        0.08
      );

      scrollTl.fromTo(
        activityCardRef.current,
        { x: '40vw', opacity: 0 },
        { x: 0, opacity: 1, ease: 'none' },
        0.12
      );

      scrollTl.fromTo(
        dashboardRef.current,
        { scale: 1, opacity: 1 },
        { scale: 0.98, opacity: 0, ease: 'power2.in' },
        0.7
      );
    }, sectionRef);

    return () => ctx.revert();
  }, [isDesktop]);

  return (
    <section
      ref={sectionRef}
      className={`${isDesktop ? 'section-pinned' : 'section-flowing py-24'} bg-background flex items-center justify-center`}
    >
      <div
        ref={dashboardRef}
        className={`relative w-[min(96vw,1500px)] card-dark overflow-hidden ${
          isDesktop ? 'h-[min(80vh,860px)]' : 'h-auto'
        }`}
      >
        <div className="flex h-auto flex-col lg:h-full lg:flex-row">
          <div
            ref={sidebarRef}
            className="w-full bg-secondary/50 border-b border-white/[0.08] p-4 flex flex-col lg:w-[22%] lg:min-w-[190px] lg:border-b-0 lg:border-r"
          >
            <div className="flex items-center gap-2 mb-6 px-1">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
                <span className="text-primary-foreground font-bold text-sm">H</span>
              </div>
              <span className="font-sora font-bold truncate">HireAI</span>
            </div>

            <nav className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:block lg:space-y-1 flex-1">
              {sidebarItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-colors min-w-0 ${
                      item.active
                        ? 'bg-primary/20 text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="pt-4 border-t border-white/[0.08] mt-4">
              <div className="flex items-center gap-3 px-2 min-w-0">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/40 to-primary/20 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">Alex Chen</p>
                  <p className="text-xs text-muted-foreground truncate">Admin</p>
                </div>
              </div>
            </div>
          </div>

          <div ref={mainContentRef} className="min-w-0 flex-1 flex flex-col">
            <header className="min-h-16 border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
              <div className="w-full sm:w-auto">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search..."
                    className="bg-secondary/50 border border-white/[0.08] rounded-xl pl-9 pr-4 py-2 text-sm w-full sm:w-64 focus:outline-none focus:border-primary/50"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button className="relative p-2 hover:bg-white/5 rounded-xl transition-colors">
                  <Bell className="w-5 h-5" />
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full" />
                </button>
              </div>
            </header>

            <div className="flex-1 p-4 sm:p-6 lg:pr-72 overflow-auto min-w-0">
              <div className="mb-6 min-w-0">
                <h2 className="font-sora font-bold text-xl sm:text-2xl mb-1 break-words">
                  Your hiring command center
                </h2>
                <p className="text-muted-foreground text-sm break-words">
                  Track performance and manage candidates in real-time.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {metrics.map((metric) => {
                  const Icon = metric.icon;
                  const isPositive = metric.change.startsWith('+');
                  return (
                    <div
                      key={metric.label}
                      className="bg-secondary/30 border border-white/[0.08] rounded-2xl p-4 min-w-0"
                    >
                      <div className="flex items-center justify-between mb-3 gap-3 min-w-0">
                        <span className="text-sm text-muted-foreground truncate">
                          {metric.label}
                        </span>
                        <Icon className="w-4 h-4 text-primary shrink-0" />
                      </div>
                      <div className="flex items-end justify-between gap-3 min-w-0">
                        <span className="text-2xl font-sora font-semibold truncate">
                          {metric.value}
                        </span>
                        <span
                          className={`text-xs shrink-0 ${
                            isPositive ? 'text-green-400' : 'text-blue-400'
                          }`}
                        >
                          {metric.change}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="bg-secondary/30 border border-white/[0.08] rounded-2xl p-4 sm:p-5 h-[280px] sm:h-72 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <h3 className="font-sora font-semibold text-sm">
                    Hiring funnel
                  </h3>
                  <select className="bg-secondary/50 border border-white/[0.08] rounded-lg px-3 py-1 text-xs min-w-0">
                    <option>Last 30 days</option>
                  </select>
                </div>
                <div className="flex items-end justify-between h-[210px] sm:h-44 gap-2 sm:gap-3 min-w-0">
                  {['New', 'Contacted', 'Qualified', 'Interview', 'Offer', 'Hired'].map(
                    (stage, i) => {
                      const heights = ['100%', '75%', '60%', '45%', '30%', '20%'];
                      return (
                        <div key={stage} className="flex-1 min-w-0 flex flex-col items-center gap-2">
                          <div
                            className="w-full bg-primary/20 rounded-t-lg relative overflow-hidden"
                            style={{ height: heights[i] }}
                          >
                            <div
                              className="absolute bottom-0 left-0 right-0 bg-primary/40 rounded-t-lg transition-all duration-500"
                              style={{ height: '100%' }}
                            />
                          </div>
                          <span className="text-[9px] sm:text-[10px] text-muted-foreground text-center leading-tight break-words">
                            {stage}
                          </span>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
            </div>
          </div>

          <div
            ref={activityCardRef}
            className={`card-dark p-4 shadow-2xl ${
              isDesktop
                ? 'relative m-4 mt-0 lg:absolute lg:right-4 lg:top-20 lg:m-0 lg:w-64'
                : 'relative m-4 mt-0'
            }`}
          >
            <div className="flex items-center justify-between mb-4 gap-3">
              <h3 className="font-sora font-semibold text-sm truncate">Recent activity</h3>
              <span className="label-mono text-[10px] shrink-0">LIVE</span>
            </div>
            <div className="space-y-3">
              {recentActivity.map((activity, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-2 rounded-xl bg-white/[0.03] min-w-0"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs break-words">{activity.text}</p>
                    <p className="text-[10px] text-muted-foreground">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DashboardPreviewSection;
