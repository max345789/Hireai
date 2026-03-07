import { useRef, useLayoutEffect, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Check, Sparkles } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const plans = [
  {
    name: 'Starter',
    description: 'For small teams',
    price: 49,
    features: [
      '2 team members',
      '500 candidates',
      'Core inbox',
      'Email integration',
      'Basic analytics',
    ],
    cta: 'Start free trial',
    highlighted: false,
  },
  {
    name: 'Professional',
    description: 'For growing teams',
    price: 129,
    features: [
      '5 team members',
      'Unlimited candidates',
      'AI scheduling',
      'WhatsApp integration',
      'Advanced analytics',
      'Priority support',
    ],
    cta: 'Start free trial',
    highlighted: true,
  },
  {
    name: 'Business',
    description: 'For scale',
    price: 299,
    features: [
      'Unlimited team members',
      'Unlimited candidates',
      'Custom AI training',
      'All integrations',
      'Dedicated account manager',
      'SLA guarantee',
      'Custom workflows',
    ],
    cta: 'Contact sales',
    highlighted: false,
  },
];

const PricingSection = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      cardRefs.current.forEach((card, i) => {
        if (card) {
          gsap.fromTo(
            card,
            { y: '8vh', opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: 0.8,
              delay: i * 0.1,
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
      id="pricing"
      ref={sectionRef}
      className="section-flowing bg-background py-16 sm:py-20 lg:py-28"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <p className="label-mono mb-4">PRICING</p>
          <h2 className="font-sora font-bold text-3xl lg:text-4xl mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto mb-8">
            Start free for 14 days. No credit card required.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-2 p-1 bg-secondary/50 rounded-full">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-2 rounded-full text-sm transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-4 py-2 rounded-full text-sm transition-all flex items-center gap-2 ${
                billingCycle === 'yearly'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Yearly
              <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">
                -20%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {plans.map((plan, index) => (
            <div
              key={plan.name}
              ref={(el) => { cardRefs.current[index] = el; }}
              className={`relative card-dark p-6 lg:p-8 flex flex-col ${
                plan.highlighted
                  ? 'border-primary/50 shadow-[0_0_40px_rgba(182,255,46,0.1)]'
                  : ''
              }`}
            >
              {/* Highlighted badge */}
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <div className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-medium">
                    <Sparkles className="w-3 h-3" />
                    Most popular
                  </div>
                </div>
              )}

              {/* Plan header */}
              <div className="mb-6 min-w-0">
                <h3 className="font-sora font-semibold text-lg mb-1">{plan.name}</h3>
                <p className="text-sm text-muted-foreground break-words">{plan.description}</p>
              </div>

              {/* Price */}
              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="font-sora font-bold text-4xl">
                    ${billingCycle === 'yearly' ? Math.round(plan.price * 0.8) : plan.price}
                  </span>
                  <span className="text-muted-foreground">/mo</span>
                </div>
                {billingCycle === 'yearly' && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Billed annually
                  </p>
                )}
              </div>

              {/* Features */}
              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm break-words">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <a
                href={plan.cta === 'Contact sales' ? '/login' : '/register'}
                className={`w-full py-3 rounded-full font-medium transition-all text-center ${
                  plan.highlighted
                    ? 'btn-primary'
                    : 'btn-secondary'
                }`}
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
