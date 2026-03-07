import { useState } from 'react';
import { Building2, Smartphone, Mail, FileText, Bot, CheckCircle2, ArrowRight, ArrowLeft, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../lib/api';

const STEPS = [
  { id: 1, icon: Building2, title: 'Agency Details', subtitle: 'Tell us about your business' },
  { id: 2, icon: Smartphone, title: 'WhatsApp Setup', subtitle: 'Connect your Twilio number' },
  { id: 3, icon: Mail, title: 'Email Setup', subtitle: 'Connect your Gmail account' },
  { id: 4, icon: FileText, title: 'Property Listings', subtitle: 'Add your properties' },
  { id: 5, icon: Bot, title: 'AI Personality', subtitle: 'Customise your agent' },
];

function StepIndicator({ steps, current }) {
  return (
    <div className="mb-8 flex items-center justify-center gap-2">
      {steps.map((step, i) => {
        const done = current > step.id;
        const active = current === step.id;
        return (
          <div key={step.id} className="flex items-center">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
              done ? 'bg-emerald-500 text-white' : active ? 'bg-accent text-white shadow-glow' : 'bg-surface text-textSoft'
            }`}>
              {done ? <CheckCircle2 className="h-4 w-4" /> : step.id}
            </div>
            {i < steps.length - 1 && (
              <div className={`mx-1 h-0.5 w-8 ${done ? 'bg-emerald-500' : 'bg-surface'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    agencyName: '',
    logoUrl: '',
    twilioKey: '',
    gmailConfig: '',
    listingsData: '',
    agentPersonality: 'Warm, proactive, and concise real estate assistant. Always professional and helpful.',
    greetingMessage: 'Hi! Looking for your dream property? I\'m here to help 24/7 🏠',
    widgetColor: '#6C63FF',
  });

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleCsvUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => set('listingsData', String(reader.result || ''));
    reader.readAsText(file);
  }

  async function save(isLast = false) {
    setSaving(true);
    setError('');
    try {
      await apiRequest('/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          ...form,
          onboardingComplete: isLast ? 1 : 0,
        }),
      });
      if (isLast) {
        navigate('/');
      } else {
        setStep((s) => s + 1);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const currentStep = STEPS.find((s) => s.id === step);
  const Icon = currentStep.icon;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg p-4">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-10%] top-[-20%] h-[500px] w-[500px] animate-float rounded-full bg-accent/20 blur-[130px]" />
        <div className="absolute bottom-[-20%] right-[-10%] h-[400px] w-[400px] rounded-full bg-cyan-500/10 blur-[110px]" />
      </div>

      <div className="relative z-10 w-full max-w-lg">
        <div className="mb-6 text-center">
          <div className="mb-2 inline-flex items-center gap-2 rounded-2xl border border-accent/30 bg-accent/10 px-4 py-2">
            <Building2 className="h-5 w-5 text-accent" />
            <span className="font-heading text-xl text-white">DAB AI Setup</span>
          </div>
          <p className="text-sm text-textSoft">Get your AI agent live in 5 minutes</p>
        </div>

        <StepIndicator steps={STEPS} current={step} />

        <div className="rounded-2xl border border-white/10 bg-card p-6 shadow-glow">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/20">
              <Icon className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h2 className="font-heading text-xl text-white">{currentStep.title}</h2>
              <p className="text-xs text-textSoft">{currentStep.subtitle}</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-200">{error}</div>
          )}

          {/* Step 1: Agency Details */}
          {step === 1 && (
            <div className="space-y-4">
              <label className="block text-xs text-textSoft">
                Agency Name *
                <input
                  value={form.agencyName}
                  onChange={(e) => set('agencyName', e.target.value)}
                  placeholder="Dream Properties Ltd"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-bg px-4 py-2.5 text-sm text-white outline-none focus:border-accent"
                />
              </label>
              <label className="block text-xs text-textSoft">
                Logo URL (optional)
                <input
                  value={form.logoUrl}
                  onChange={(e) => set('logoUrl', e.target.value)}
                  placeholder="https://yoursite.com/logo.png"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-bg px-4 py-2.5 text-sm text-white outline-none focus:border-accent"
                />
              </label>
              <label className="block text-xs text-textSoft">
                Widget Chat Greeting
                <input
                  value={form.greetingMessage}
                  onChange={(e) => set('greetingMessage', e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-bg px-4 py-2.5 text-sm text-white outline-none focus:border-accent"
                />
              </label>
              <label className="block text-xs text-textSoft">
                Widget Accent Color
                <div className="mt-1 flex items-center gap-3">
                  <input
                    type="color"
                    value={form.widgetColor}
                    onChange={(e) => set('widgetColor', e.target.value)}
                    className="h-10 w-16 cursor-pointer rounded-lg border border-white/10 bg-bg"
                  />
                  <span className="text-sm text-white">{form.widgetColor}</span>
                </div>
              </label>
            </div>
          )}

          {/* Step 2: WhatsApp */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="rounded-xl border border-blue-400/20 bg-blue-500/10 p-3 text-xs text-blue-200">
                <p className="font-semibold">How to get Twilio credentials:</p>
                <ol className="mt-1 list-decimal pl-4 space-y-1">
                  <li>Sign up at twilio.com</li>
                  <li>Get a WhatsApp-enabled number</li>
                  <li>Find your Account SID and Auth Token in the Twilio console</li>
                  <li>Paste your number below in the format: +1234567890</li>
                </ol>
              </div>
              <label className="block text-xs text-textSoft">
                Twilio Account SID | Auth Token | WhatsApp Number
                <input
                  value={form.twilioKey}
                  onChange={(e) => set('twilioKey', e.target.value)}
                  placeholder="ACxxxxxxxxx|your_auth_token|+1234567890"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-bg px-4 py-2.5 text-sm text-white outline-none focus:border-accent font-mono"
                />
              </label>
              <p className="text-xs text-textSoft">Format: <code className="text-accent">SID|TOKEN|+NUMBER</code> — you can also skip this and set it up later in Settings.</p>
            </div>
          )}

          {/* Step 3: Email */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-xl border border-blue-400/20 bg-blue-500/10 p-3 text-xs text-blue-200">
                <p className="font-semibold">How to connect Gmail:</p>
                <ol className="mt-1 list-decimal pl-4 space-y-1">
                  <li>Go to Google Account → Security → App passwords</li>
                  <li>Generate an app password for "Mail"</li>
                  <li>Enter your Gmail + app password below</li>
                </ol>
              </div>
              <label className="block text-xs text-textSoft">
                Gmail Address | App Password
                <input
                  value={form.gmailConfig}
                  onChange={(e) => set('gmailConfig', e.target.value)}
                  placeholder="your@gmail.com|your-app-password"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-bg px-4 py-2.5 text-sm text-white outline-none focus:border-accent font-mono"
                />
              </label>
              <p className="text-xs text-textSoft">Format: <code className="text-accent">email|password</code> — skip to configure later.</p>
            </div>
          )}

          {/* Step 4: Listings */}
          {step === 4 && (
            <div className="space-y-4">
              <p className="text-xs text-textSoft">
                Add your property listings so the AI can answer questions about specific properties.
                You can upload a CSV or paste data manually.
              </p>
              <label className="block text-xs text-textSoft">
                Listings (CSV or free text)
                <textarea
                  rows={6}
                  value={form.listingsData}
                  onChange={(e) => set('listingsData', e.target.value)}
                  placeholder="Property 1: 3BR apartment in Dubai Marina, AED 2.5M, Available now&#10;Property 2: Villa in Palm Jumeirah, AED 8M, Available Q2 2025&#10;..."
                  className="mt-1 w-full rounded-xl border border-white/10 bg-bg px-4 py-2.5 text-sm text-white outline-none focus:border-accent"
                />
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-surface px-3 py-2 text-xs text-textSoft hover:text-white">
                <Upload className="h-4 w-4" />
                Upload CSV File
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsvUpload} />
              </label>
            </div>
          )}

          {/* Step 5: AI Personality */}
          {step === 5 && (
            <div className="space-y-4">
              <label className="block text-xs text-textSoft">
                AI Agent Personality & Instructions
                <textarea
                  rows={5}
                  value={form.agentPersonality}
                  onChange={(e) => set('agentPersonality', e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-bg px-4 py-2.5 text-sm text-white outline-none focus:border-accent"
                />
              </label>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-textSoft">Quick presets:</p>
                {[
                  'Warm, proactive, and concise. Always end with a soft question.',
                  'Formal and professional. Use polite British English. Focus on luxury market.',
                  'Energetic and enthusiastic. Perfect for first-time buyers. Explain everything clearly.',
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => set('agentPersonality', preset)}
                    className="block w-full rounded-lg border border-white/10 bg-surface/60 px-3 py-2 text-left text-xs text-textSoft hover:border-accent/40 hover:text-white"
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-xs text-emerald-200">
                🎉 You're almost done! Your AI agent will be live as soon as you click Launch.
              </div>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-surface px-4 py-2 text-xs text-textSoft hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
            ) : (
              <div />
            )}

            <button
              type="button"
              onClick={() => save(step === 5)}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {saving ? 'Saving...' : step === 5 ? '🚀 Launch My Agent' : (
                <>Next <ArrowRight className="h-4 w-4" /></>
              )}
            </button>
          </div>

          {step < 5 && (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              className="mt-3 w-full text-center text-xs text-textSoft hover:text-white"
            >
              Skip this step →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
