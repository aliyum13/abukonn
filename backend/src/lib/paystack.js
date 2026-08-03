// Thin wrapper around the Paystack REST API. The secret key is read from the
// environment (PAYSTACK_SECRET_KEY) and never hardcoded or committed -- set it
// in Railway's env vars. Uses native fetch (node 22), matching the codebase's
// existing outbound-HTTP convention (see lib/linkPreview.js).
//
// TEST keys (sk_test_...) hit the same endpoints; Paystack decides test vs
// live from the key itself, so no code change is needed to go live -- just
// swap the env var.

const PAYSTACK_BASE = 'https://api.paystack.co';

function secretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error('PAYSTACK_SECRET_KEY is not set');
  return key;
}

// Kicks off a transaction. Paystack returns an authorization_url the client
// opens to pay, plus its own reference echoed back. We pass our own reference
// so the later webhook/verify correlates to our payments row. amountKobo is
// in kobo (₦2000 = 200000). email is required by Paystack for receipts.
async function initializeTransaction({ email, amountKobo, reference, callbackUrl, metadata }) {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      amount: amountKobo,
      reference,
      callback_url: callbackUrl,
      metadata,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.status) {
    throw new Error(data.message || 'Paystack initialize failed');
  }
  return data.data; // { authorization_url, access_code, reference }
}

// Server-side verification of a transaction by reference. This is the
// authoritative check on whether money actually moved -- used both by the
// webhook (after signature check) and by the client-triggered verify
// fallback. Returns Paystack's transaction object; caller inspects
// data.status === 'success'.
async function verifyTransaction(reference) {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secretKey()}` },
  });
  const data = await res.json();
  if (!res.ok || !data.status) {
    throw new Error(data.message || 'Paystack verify failed');
  }
  return data.data; // { status, amount, reference, ... }
}

module.exports = { initializeTransaction, verifyTransaction };
