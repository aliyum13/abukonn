const pool = require('../config/db');

// Every Paystack transaction we initialize gets a row here, keyed by its
// unique reference. Status starts 'pending' and moves to 'success' or
// 'failed' only when Paystack tells us (via webhook, or a verify call) --
// NEVER on the client's say-so. The row is the audit trail: what was
// charged, to whom, when, and the raw gateway reference for reconciliation.
const CREATE_PAYMENTS_TABLE = `
CREATE TABLE IF NOT EXISTS abukonn.payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES abukonn.users(id) ON DELETE CASCADE,
  reference VARCHAR(100) NOT NULL UNIQUE,
  amount_kobo INTEGER NOT NULL,
  plan VARCHAR(20) NOT NULL DEFAULT 'monthly',
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

async function createPaymentsTable() {
  await pool.query(CREATE_PAYMENTS_TABLE);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_payments_user ON abukonn.payments(user_id, created_at DESC)`);
  console.log('Payments table ready');
}

// Records an initialized transaction as pending. amount is in kobo (Paystack's
// unit -- ₦2000 = 200000 kobo). reference is Paystack's transaction reference,
// which we generate and pass to them so we can correlate the webhook back.
async function recordInitiated(userId, reference, amountKobo, plan = 'monthly') {
  const result = await pool.query(
    `INSERT INTO abukonn.payments (user_id, reference, amount_kobo, plan, status)
     VALUES ($1, $2, $3, $4, 'pending') RETURNING *`,
    [userId, reference, amountKobo, plan]
  );
  return result.rows[0];
}

async function findByReference(reference) {
  const result = await pool.query(
    `SELECT * FROM abukonn.payments WHERE reference = $1`,
    [reference]
  );
  return result.rows[0] || null;
}

// Marks a payment successful. Idempotent by design: only flips a row that's
// still 'pending', and RETURNING tells the caller whether THIS call was the
// one that transitioned it. That matters because Paystack can deliver the
// same webhook more than once (and a verify call may race the webhook) --
// we must grant Pro exactly once per payment, never double-extend the
// subscription. Returns the row if this call did the transition, else null.
async function markSuccess(reference, paidAt) {
  const result = await pool.query(
    `UPDATE abukonn.payments
     SET status = 'success', paid_at = $2
     WHERE reference = $1 AND status = 'pending'
     RETURNING *`,
    [reference, paidAt || new Date()]
  );
  return result.rows[0] || null;
}

async function markFailed(reference) {
  await pool.query(
    `UPDATE abukonn.payments SET status = 'failed'
     WHERE reference = $1 AND status = 'pending'`,
    [reference]
  );
}

// Grants/extends Pro for one paid month. Extends from whichever is later --
// the user's current expiry (if they're still Pro, so they don't lose the
// remaining days) or now (if lapsed/new). Sets the fast is_pro flag TRUE.
// Called ONLY from the verified-success path, and only when markSuccess
// actually transitioned the row (so a re-delivered webhook can't extend
// twice).
async function grantProMonth(userId) {
  const result = await pool.query(
    `UPDATE abukonn.users
     SET is_pro = TRUE,
         pro_expires_at = GREATEST(COALESCE(pro_expires_at, NOW()), NOW()) + INTERVAL '1 month'
     WHERE id = $1
     RETURNING id, is_pro, pro_expires_at`,
    [userId]
  );
  return result.rows[0] || null;
}

// Sweep: flip is_pro FALSE for anyone whose pro_expires_at has passed. Cheap
// to run periodically (or before a Pro-sensitive read). Keeps the boolean
// honest without every read having to compare timestamps.
async function expireLapsed() {
  const result = await pool.query(
    `UPDATE abukonn.users SET is_pro = FALSE
     WHERE is_pro = TRUE AND pro_expires_at IS NOT NULL AND pro_expires_at <= NOW()
     RETURNING id`
  );
  return result.rowCount;
}

module.exports = {
  createPaymentsTable,
  recordInitiated,
  findByReference,
  markSuccess,
  markFailed,
  grantProMonth,
  expireLapsed,
};
