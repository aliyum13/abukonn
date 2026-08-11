const crypto = require('crypto');
const User = require('../models/User');
const Payment = require('../models/Payment');
const { initializeTransaction, verifyTransaction } = require('../lib/paystack');

// ₦2000/month, in kobo. Single source of truth for the price.
const PRO_MONTHLY_KOBO = 200000;

// Generates a unique, collision-resistant transaction reference we control
// (so the webhook can correlate back to our payments row). Prefixed for easy
// dashboard scanning.
function makeReference(userId) {
  return `abukonn_pro_${userId}_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
}

// POST /api/pro/subscribe -- starts a ₦2000 monthly transaction for the
// authenticated user. Records a pending payment, asks Paystack to initialize,
// and hands the client back the authorization_url to open. Pro is NOT granted
// here -- only after verified success (webhook/verify).
async function initializePayment(req, res) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.email) return res.status(400).json({ message: 'Your account needs an email to subscribe.' });

    const reference = makeReference(user.id);
    await Payment.recordInitiated(user.id, reference, PRO_MONTHLY_KOBO, 'monthly');

    const clientUrl = process.env.CLIENT_URL || 'https://abukonn.com';
    const initData = await initializeTransaction({
      email: user.email,
      amountKobo: PRO_MONTHLY_KOBO,
      reference,
      callbackUrl: `${clientUrl}/pro/callback`,
      metadata: { user_id: user.id, plan: 'monthly' },
    });

    res.json({ authorization_url: initData.authorization_url, reference });
  } catch (err) {
    console.error('Pro initialize error:', err.message);
    res.status(500).json({ message: 'Could not start subscription. Please try again.' });
  }
}

// Shared success path: verify the transaction with Paystack, then -- if it
// genuinely succeeded and matches the expected amount -- transition the
// payment row (idempotently) and grant one Pro month. Returns true iff the
// user is Pro after this call. Safe to call more than once for the same
// reference (markSuccess only transitions a still-pending row, so Pro is
// granted exactly once even under duplicate webhooks + a racing verify).
async function fulfillIfPaid(reference) {
  const payment = await Payment.findByReference(reference);
  if (!payment) return false; // unknown reference -- ignore

  const tx = await verifyTransaction(reference);
  if (tx.status !== 'success') {
    if (tx.status === 'failed') await Payment.markFailed(reference);
    return false;
  }
  // Guard against amount tampering: only honor if Paystack reports at least
  // what we charged for the plan.
  if (typeof tx.amount === 'number' && tx.amount < payment.amount_kobo) {
    console.warn(`Pro payment ${reference} underpaid: got ${tx.amount}, expected ${payment.amount_kobo}`);
    return false;
  }

  const transitioned = await Payment.markSuccess(reference, tx.paid_at ? new Date(tx.paid_at) : new Date());
  if (transitioned) {
    // Only the call that actually flipped pending->success grants the month,
    // so a re-delivered webhook can't extend the subscription twice.
    await Payment.grantProMonth(payment.user_id);
  }
  return true;
}

// POST /api/pro/webhook -- Paystack calls this directly on payment events.
// This is the SOURCE OF TRUTH for granting Pro. The raw request body is
// required (mounted with express.raw before express.json) so we can verify
// Paystack's HMAC-SHA512 signature over the exact bytes -- without that
// check, anyone could POST a fake "charge.success" and get free Pro.
async function handleWebhook(req, res) {
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) {
      console.error('Webhook received but PAYSTACK_SECRET_KEY not set');
      return res.sendStatus(500);
    }
    // req.body is a raw Buffer here (express.raw). Verify signature first.
    const signature = req.headers['x-paystack-signature'];
    const hash = crypto.createHmac('sha512', secret).update(req.body).digest('hex');
    if (hash !== signature) {
      return res.sendStatus(401); // forged or corrupted -- reject
    }

    const event = JSON.parse(req.body.toString('utf8'));
    // Acknowledge fast (200) so Paystack doesn't retry; do the work after.
    // Only charge.success matters for granting Pro.
    if (event?.event === 'charge.success' && event?.data?.reference) {
      // fulfillIfPaid re-verifies server-side rather than trusting the
      // webhook payload's amount/status blindly -- defense in depth.
      fulfillIfPaid(event.data.reference).catch(err =>
        console.error('Webhook fulfill error:', err.message)
      );
    }
    res.sendStatus(200);
  } catch (err) {
    console.error('Webhook error:', err.message);
    // Still 200 on parse errors we can't act on, so Paystack stops retrying a
    // malformed event; genuine signature failures already returned 401 above.
    res.sendStatus(200);
  }
}

// GET /api/pro/verify/:reference -- client-triggered fallback after checkout,
// in case the webhook is delayed. Same verified-success path; returns current
// Pro status. Auth'd, and only lets a user verify their OWN payment.
async function verifyPayment(req, res) {
  try {
    const { reference } = req.params;
    const payment = await Payment.findByReference(reference);
    if (!payment || payment.user_id !== req.user.id) {
      return res.status(404).json({ message: 'Payment not found' });
    }
    await fulfillIfPaid(reference);
    const isPro = await User.isUserPro(req.user.id);
    res.json({ is_pro: isPro });
  } catch (err) {
    console.error('Pro verify error:', err.message);
    res.status(500).json({ message: 'Could not verify payment' });
  }
}

// GET /api/pro/status -- current Pro status for the authenticated user.
async function getProStatus(req, res) {
  try {
    // Self-correct if this user's Pro has lapsed (flips is_pro off + revokes a
    // pro-sourced badge) so status reads stay honest without a global sweep.
    await Payment.expireLapsedForUser(req.user.id);
    const isPro = await User.isUserPro(req.user.id);
    const user = await User.findById(req.user.id);
    res.json({ is_pro: isPro, pro_expires_at: user?.pro_expires_at || null });
  } catch (err) {
    console.error('Pro status error:', err.message);
    res.status(500).json({ message: 'Could not fetch status' });
  }
}

module.exports = { initializePayment, handleWebhook, verifyPayment, getProStatus, PRO_MONTHLY_KOBO };
