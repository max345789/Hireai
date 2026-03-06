const Razorpay = require('razorpay');
const crypto = require('crypto');

const PLANS = {
  starter: {
    name: 'Starter',
    price: 14999,
    priceUSD: 199,
    currency: 'INR',
    features: [
      '1 AI Agent',
      'WhatsApp only',
      '500 conversations/month',
      'Basic dashboard',
      '14-day free trial',
    ],
    limits: { conversations: 500, agents: 1, channels: ['whatsapp'] },
  },
  pro: {
    name: 'Pro',
    price: 29999,
    priceUSD: 399,
    currency: 'INR',
    features: [
      '1 AI Agent',
      'All channels (WhatsApp + Email + Web)',
      'Unlimited conversations',
      'Analytics + Reports',
      'Follow-up automation',
      '14-day free trial',
    ],
    limits: { conversations: -1, agents: 1, channels: ['whatsapp', 'email', 'web'] },
  },
  team: {
    name: 'Team',
    price: 54999,
    priceUSD: 699,
    currency: 'INR',
    features: [
      '3 AI Agents',
      'All channels',
      'Unlimited conversations',
      'Full analytics + PDF reports',
      'Team members (max 3)',
      'Priority support',
      '14-day free trial',
    ],
    limits: { conversations: -1, agents: 3, channels: ['whatsapp', 'email', 'web'] },
  },
};

function getRazorpay() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) return null;
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

/**
 * Create a Razorpay order for a plan purchase.
 * Returns the order details + publishable key for the frontend checkout.
 */
async function createOrder(userId, planKey) {
  const rzp = getRazorpay();
  if (!rzp) {
    throw new Error('Razorpay not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to your .env file.');
  }

  const plan = PLANS[planKey];
  if (!plan) throw new Error(`Unknown plan: ${planKey}`);

  const order = await rzp.orders.create({
    amount: plan.price * 100, // paise (100 paise = 1 INR)
    currency: plan.currency,
    receipt: `rcpt_${userId}_${planKey}_${Date.now()}`,
    notes: {
      userId: String(userId),
      plan: planKey,
    },
  });

  return {
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId: process.env.RAZORPAY_KEY_ID,
    plan,
  };
}

/**
 * Verify Razorpay payment signature (HMAC-SHA256).
 * Throws if invalid.
 */
function verifyPayment(orderId, paymentId, signature) {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) throw new Error('Razorpay not configured');

  const body = `${orderId}|${paymentId}`;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');

  if (expected !== signature) {
    throw new Error('Payment signature verification failed. Possible tampering detected.');
  }
  return true;
}

/**
 * Handle Razorpay webhook events.
 * Returns { userId, updates } to be applied to the users table.
 */
function handleWebhookEvent(body, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (secret && signature) {
    const expected = crypto.createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');
    if (expected !== signature) {
      throw new Error('Invalid webhook signature');
    }
  }

  const { event, payload } = body;
  const result = { eventType: event, userId: null, updates: {} };

  if (event === 'payment.captured') {
    const payment = payload?.payment?.entity;
    result.userId = payment?.notes?.userId ? Number(payment.notes.userId) : null;
    result.updates = {
      plan: payment?.notes?.plan || 'starter',
      planStatus: 'active',
      planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  if (event === 'payment.failed') {
    const payment = payload?.payment?.entity;
    result.userId = payment?.notes?.userId ? Number(payment.notes.userId) : null;
    result.updates = { planStatus: 'past_due' };
  }

  if (event === 'subscription.activated') {
    const sub = payload?.subscription?.entity;
    result.userId = sub?.notes?.userId ? Number(sub.notes.userId) : null;
    result.updates = {
      plan: sub?.notes?.plan || 'starter',
      planStatus: 'active',
    };
  }

  if (event === 'subscription.cancelled' || event === 'subscription.expired') {
    const sub = payload?.subscription?.entity;
    result.userId = sub?.notes?.userId ? Number(sub.notes.userId) : null;
    result.updates = { plan: 'trial', planStatus: 'cancelled' };
  }

  return result;
}

/**
 * Get subscription status from the user record (Razorpay doesn't need real-time lookup for basic plans).
 */
function getSubscriptionStatus(user) {
  return {
    plan: user.plan || 'trial',
    status: user.planStatus || 'active',
    currentPeriodEnd: user.planExpiresAt || null,
    cancelAtPeriodEnd: false,
    provider: 'razorpay',
  };
}

module.exports = { PLANS, createOrder, verifyPayment, handleWebhookEvent, getSubscriptionStatus };
