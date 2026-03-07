const express = require('express');
const User = require('../models/User');
const {
  PLANS,
  createOrder,
  verifyPayment,
  handleWebhookEvent,
  getSubscriptionStatus,
} = require('../services/razorpayService');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /billing/plans — list all plans
router.get('/billing/plans', async (_req, res) => {
  const plans = Object.entries(PLANS).map(([key, plan]) => ({ key, ...plan }));
  return res.json({ plans });
});

// GET /billing/status — current user's subscription status
router.get('/billing/status', requireAuth, async (req, res) => {
  try {
    const user = await User.getById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const status = getSubscriptionStatus(user);
    return res.json({ subscription: status, plan: PLANS[status.plan] || null });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /billing/razorpay/order — create a Razorpay order
router.post('/billing/razorpay/order', requireAuth, async (req, res) => {
  try {
    const { plan } = req.body;
    if (!plan) return res.status(400).json({ error: 'plan is required' });

    if (!process.env.RAZORPAY_KEY_ID) {
      return res.status(400).json({
        error: 'Razorpay not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to your .env file.',
        demo: true,
      });
    }

    const order = await createOrder(req.user.id, plan);
    return res.json(order);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /billing/razorpay/verify — verify signature & activate plan
router.post('/billing/razorpay/verify', requireAuth, async (req, res) => {
  try {
    const { orderId, paymentId, signature, plan } = req.body;

    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({ error: 'orderId, paymentId, and signature are required' });
    }

    verifyPayment(orderId, paymentId, signature);

    // Activate plan for 30 days
    const planExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await User.updateSettings(req.user.id, {
      plan: plan || 'starter',
      planStatus: 'active',
      planExpiresAt: planExpiry,
    });

    return res.json({ success: true, plan, message: 'Payment verified. Plan activated!' });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

// POST /billing/razorpay/webhook — Razorpay webhook
router.post('/billing/razorpay/webhook', express.json(), async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const result = handleWebhookEvent(req.body, signature);

    if (result.userId && Object.keys(result.updates).length > 0) {
      await User.updateSettings(result.userId, result.updates);
    }

    return res.json({ received: true });
  } catch (error) {
    console.error('[Razorpay webhook]', error.message);
    return res.status(400).json({ error: error.message });
  }
});

module.exports = router;
