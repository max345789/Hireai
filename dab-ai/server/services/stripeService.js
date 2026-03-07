let stripe;

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!stripe) {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  }
  return stripe;
}

const PLANS = {
  starter: {
    name: 'Starter',
    price: 119,
    priceId: process.env.STRIPE_PRICE_STARTER || null,
    features: ['1 AI Agent', 'WhatsApp + Web chat', '500 conversations/month', 'Dashboard + inbox'],
    limits: { conversations: 500, agents: 1, channels: ['whatsapp', 'web'] },
  },
  pro: {
    name: 'Pro',
    price: 239,
    priceId: process.env.STRIPE_PRICE_PRO || null,
    features: ['2 AI Agents', 'All channels (WhatsApp + Email + Web)', 'Unlimited conversations', 'Analytics + Reports'],
    limits: { conversations: -1, agents: 2, channels: ['whatsapp', 'email', 'web'] },
  },
  team: {
    name: 'Team',
    price: 359,
    priceId: process.env.STRIPE_PRICE_TEAM || null,
    features: ['3 AI Agents', 'All channels', 'Unlimited conversations', 'Full analytics', 'Team members (max 3)', 'Priority reports'],
    limits: { conversations: -1, agents: 3, channels: ['whatsapp', 'email', 'web'] },
  },
};

/**
 * Create or retrieve a Stripe customer for a user.
 */
async function getOrCreateCustomer(user) {
  const s = getStripe();
  if (!s) throw new Error('Stripe not configured');

  if (user.stripeCustomerId) {
    return s.customers.retrieve(user.stripeCustomerId);
  }

  return s.customers.create({
    email: user.email,
    name: user.agencyName,
    metadata: { userId: String(user.id) },
  });
}

/**
 * Create a Stripe Checkout session for a subscription.
 */
async function createCheckoutSession(user, planKey, successUrl, cancelUrl) {
  const s = getStripe();
  if (!s) throw new Error('Stripe not configured. Add STRIPE_SECRET_KEY to your environment.');

  const plan = PLANS[planKey];
  if (!plan) throw new Error(`Unknown plan: ${planKey}`);
  if (!plan.priceId) throw new Error(`Price ID not configured for plan: ${planKey}. Add STRIPE_PRICE_${planKey.toUpperCase()} to .env`);

  const customer = await getOrCreateCustomer(user);

  const session = await s.checkout.sessions.create({
    mode: 'subscription',
    customer: customer.id,
    line_items: [{ price: plan.priceId, quantity: 1 }],
    success_url: successUrl || `${process.env.BASE_URL}/billing?success=1`,
    cancel_url: cancelUrl || `${process.env.BASE_URL}/billing?cancelled=1`,
    metadata: { userId: String(user.id), plan: planKey },
    subscription_data: { metadata: { userId: String(user.id), plan: planKey } },
  });

  return session;
}

/**
 * Create a Stripe Customer Portal session for subscription management.
 */
async function createPortalSession(user, returnUrl) {
  const s = getStripe();
  if (!s) throw new Error('Stripe not configured');
  if (!user.stripeCustomerId) throw new Error('No Stripe customer found for this account');

  const session = await s.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: returnUrl || `${process.env.BASE_URL}/billing`,
  });

  return session;
}

/**
 * Handle Stripe webhook events.
 * Returns { userId, updates } where updates are fields to apply to the users table.
 */
async function handleWebhookEvent(rawBody, signature) {
  const s = getStripe();
  if (!s) throw new Error('Stripe not configured');

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET not set');

  let event;
  try {
    event = s.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    throw new Error(`Webhook signature verification failed: ${err.message}`);
  }

  const { type, data } = event;
  const obj = data.object;

  const result = { eventType: type, userId: null, updates: {} };

  if (type === 'checkout.session.completed') {
    result.userId = obj.metadata?.userId ? Number(obj.metadata.userId) : null;
    result.updates = {
      stripeCustomerId: obj.customer,
      plan: obj.metadata?.plan || 'starter',
      planStatus: 'active',
    };
  }

  if (type === 'customer.subscription.updated' || type === 'customer.subscription.created') {
    result.userId = obj.metadata?.userId ? Number(obj.metadata.userId) : null;
    result.updates = {
      plan: obj.metadata?.plan || 'starter',
      planStatus: obj.status === 'active' ? 'active' : obj.status,
      planExpiresAt: new Date(obj.current_period_end * 1000).toISOString(),
    };
  }

  if (type === 'customer.subscription.deleted') {
    result.userId = obj.metadata?.userId ? Number(obj.metadata.userId) : null;
    result.updates = {
      plan: 'trial',
      planStatus: 'cancelled',
    };
  }

  if (type === 'invoice.payment_failed') {
    // Customer object has userId in metadata if set up correctly
    const customerId = obj.customer;
    // We'll look up by stripeCustomerId on the caller side
    result.stripeCustomerId = customerId;
    result.updates = { planStatus: 'past_due' };
  }

  return result;
}

/**
 * Get subscription status for a user (from Stripe).
 */
async function getSubscriptionStatus(user) {
  const s = getStripe();
  if (!s || !user.stripeCustomerId) {
    return {
      plan: user.plan || 'trial',
      status: user.planStatus || 'active',
      currentPeriodEnd: user.planExpiresAt || null,
      cancelAtPeriodEnd: false,
    };
  }

  try {
    const subscriptions = await s.subscriptions.list({
      customer: user.stripeCustomerId,
      status: 'all',
      limit: 1,
    });

    const sub = subscriptions.data[0];
    if (!sub) {
      return { plan: user.plan || 'trial', status: 'inactive', currentPeriodEnd: null, cancelAtPeriodEnd: false };
    }

    return {
      plan: sub.metadata?.plan || user.plan || 'starter',
      status: sub.status,
      currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    };
  } catch {
    return { plan: user.plan || 'trial', status: user.planStatus || 'active', currentPeriodEnd: user.planExpiresAt || null, cancelAtPeriodEnd: false };
  }
}

module.exports = {
  PLANS,
  createCheckoutSession,
  createPortalSession,
  handleWebhookEvent,
  getSubscriptionStatus,
};
