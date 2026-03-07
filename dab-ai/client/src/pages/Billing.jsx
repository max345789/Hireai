import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, IndianRupee, Zap, Users, BarChart2, Shield, Headphones } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../lib/api';

const PLAN_COLORS = {
  starter: { border: 'border-blue-400/30', bg: 'bg-blue-500/10', badge: 'bg-blue-500/20 text-blue-300' },
  pro: { border: 'border-accent/40', bg: 'bg-accent/10', badge: 'bg-accent/20 text-violet-300' },
  team: { border: 'border-emerald-400/30', bg: 'bg-emerald-500/10', badge: 'bg-emerald-500/20 text-emerald-300' },
};

const PLAN_ICONS = { starter: Zap, pro: BarChart2, team: Users };

function PlanCard({ plan, current, onSubscribe, loading }) {
  const colors = PLAN_COLORS[plan.key] || PLAN_COLORS.starter;
  const Icon = PLAN_ICONS[plan.key] || Zap;
  const isActive = current?.plan === plan.key && current?.status === 'active';
  const isPro = plan.key === 'pro';

  return (
    <div className={`relative rounded-2xl border ${colors.border} ${colors.bg} p-5 ${isPro ? 'ring-2 ring-accent/50' : ''}`}>
      {isPro && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-accent px-3 py-0.5 text-xs font-bold text-white">Most Popular</span>
        </div>
      )}

      <div className="mb-4 flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${colors.badge}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-heading text-lg text-white">{plan.name}</h3>
          {isActive && (
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300">
              Current Plan
            </span>
          )}
        </div>
      </div>

      <div className="mb-4 flex items-end gap-1">
        <IndianRupee className="mb-1.5 h-5 w-5 text-white" />
        <span className="font-heading text-4xl text-white">
          {plan.price ? Math.round(plan.price).toLocaleString('en-IN') : '—'}
        </span>
        <span className="mb-1 text-sm text-textSoft">/month</span>
      </div>

      <ul className="mb-6 space-y-2">
        {(plan.features || []).map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-slate-200">
            <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
            {feature}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => onSubscribe(plan.key)}
        disabled={loading || isActive}
        className={`w-full rounded-xl py-2.5 text-sm font-semibold transition ${
          isActive
            ? 'cursor-default bg-emerald-500/20 text-emerald-300'
            : isPro
              ? 'bg-accent text-white hover:opacity-90'
              : 'border border-white/15 bg-surface text-white hover:bg-surface/80'
        } disabled:opacity-60`}
      >
        {isActive ? '✓ Active' : loading ? 'Opening checkout...' : `Get ${plan.name}`}
      </button>
    </div>
  );
}

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function Billing() {
  const [searchParams] = useSearchParams();
  const [plans, setPlans] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState('');
  const [message, setMessage] = useState('');
  const rzpRef = useRef(null);

  useEffect(() => {
    if (searchParams.get('success') === '1') {
      setMessage('🎉 Payment successful! Your subscription is now active.');
    }
  }, [searchParams]);

  useEffect(() => {
    async function load() {
      try {
        const [plansData, statusData] = await Promise.all([
          apiRequest('/billing/plans'),
          apiRequest('/billing/status'),
        ]);
        setPlans(plansData.plans || []);
        setSubscription(statusData.subscription || null);
      } catch (error) {
        setMessage(error.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSubscribe(planKey) {
    setCheckoutLoading(planKey);
    setMessage('');

    try {
      const orderData = await apiRequest('/billing/razorpay/order', {
        method: 'POST',
        body: JSON.stringify({ plan: planKey }),
      });

      if (orderData.demo) {
        setMessage('⚠️ Razorpay not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to your .env file.');
        setCheckoutLoading('');
        return;
      }

      const loaded = await loadRazorpayScript();
      if (!loaded) {
        setMessage('Failed to load Razorpay checkout. Check your internet connection.');
        setCheckoutLoading('');
        return;
      }

      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'DAB AI',
        description: `${orderData.plan?.name} Plan — Monthly`,
        image: '/favicon.ico',
        order_id: orderData.orderId,
        theme: { color: '#6C63FF' },
        modal: {
          ondismiss() {
            setMessage('Checkout cancelled. No charge was made.');
            setCheckoutLoading('');
          },
        },
        handler: async function (response) {
          try {
            const verifyData = await apiRequest('/billing/razorpay/verify', {
              method: 'POST',
              body: JSON.stringify({
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
                plan: planKey,
              }),
            });

            if (verifyData.success) {
              setMessage(`🎉 Payment verified! ${orderData.plan?.name} plan is now active.`);
              const statusData = await apiRequest('/billing/status');
              setSubscription(statusData.subscription || null);
            }
          } catch (err) {
            setMessage(`Verification failed: ${err.message}`);
          } finally {
            setCheckoutLoading('');
          }
        },
      };

      rzpRef.current = new window.Razorpay(options);
      rzpRef.current.open();
    } catch (error) {
      setMessage(error.message);
      setCheckoutLoading('');
    }
  }

  const statusColor =
    {
      active: 'text-emerald-300 bg-emerald-500/20',
      trialing: 'text-blue-300 bg-blue-500/20',
      past_due: 'text-amber-300 bg-amber-500/20',
      cancelled: 'text-rose-300 bg-rose-500/20',
      inactive: 'text-textSoft bg-surface',
    }[subscription?.status || 'inactive'] || 'text-textSoft bg-surface';

  return (
    <div className="min-h-screen bg-bg p-4 text-white sm:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/5 bg-card/95 px-4 py-3">
          <div>
            <h1 className="font-heading text-2xl">Billing</h1>
            <p className="text-xs text-textSoft">Manage your subscription — powered by Razorpay</p>
          </div>
          <Link
            to="/inbox"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-surface px-3 py-2 text-xs text-textSoft hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Dashboard
          </Link>
        </header>

        {message && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              message.startsWith('🎉')
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                : message.startsWith('⚠️')
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                  : 'border-rose-500/40 bg-rose-500/10 text-rose-200'
            }`}
          >
            {message}
          </div>
        )}

        {subscription && (
          <div className="rounded-2xl border border-white/5 bg-card/95 p-5">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <p className="text-xs text-textSoft">Current Plan</p>
                <div className="mt-1 flex items-center gap-3">
                  <span className="font-heading text-2xl capitalize text-white">{subscription.plan}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusColor}`}>
                    {subscription.status}
                  </span>
                </div>
                {subscription.currentPeriodEnd && (
                  <p className="mt-1 text-xs text-textSoft">
                    Renews on {new Date(subscription.currentPeriodEnd).toLocaleDateString('en-IN')}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex h-40 items-center justify-center text-sm text-textSoft">Loading plans...</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {plans.map((plan) => (
              <PlanCard
                key={plan.key}
                plan={plan}
                current={subscription}
                onSubscribe={handleSubscribe}
                loading={checkoutLoading === plan.key}
              />
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { icon: Shield, title: 'Secure Payments', desc: 'PCI-DSS compliant via Razorpay' },
            { icon: IndianRupee, title: 'INR Billing', desc: 'No hidden forex charges' },
            { icon: Headphones, title: '24/7 Support', desc: 'Real humans, not bots' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex items-center gap-3 rounded-xl border border-white/5 bg-card/60 p-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="text-xs text-textSoft">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-white/5 bg-card/95 p-5">
          <h3 className="mb-4 font-heading text-lg text-white">Billing FAQ</h3>
          <div className="space-y-4">
            {[
              {
                q: 'Can I cancel anytime?',
                a: 'Yes. Contact support to cancel. Your access continues until the end of the billing period.',
              },
              {
                q: 'What payment methods are accepted?',
                a: 'All UPI apps (GPay, PhonePe, Paytm), net banking, credit/debit cards, and EMI via Razorpay.',
              },
              {
                q: 'Can I switch plans?',
                a: 'Yes. Upgrade or downgrade anytime. Contact support — we will prorate any difference.',
              },
              {
                q: 'Is there a free trial?',
                a: 'Yes — new accounts get 14 days free on the Pro plan. No credit card required to start.',
              },
            ].map((item) => (
              <div key={item.q} className="border-b border-white/5 pb-3 last:border-0 last:pb-0">
                <p className="text-sm font-semibold text-white">{item.q}</p>
                <p className="mt-1 text-xs text-textSoft">{item.a}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-card/95 p-4 text-center text-xs text-textSoft">
          <Shield className="mx-auto mb-2 h-5 w-5 opacity-40" />
          Payments processed securely by <span className="text-accent">Razorpay</span>. We never store your card details.
        </div>
      </div>
    </div>
  );
}
