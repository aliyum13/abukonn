const dns = require('dns').promises;
const net = require('net');

// ── Link preview fetching ────────────────────────────────────────────────────
//
// This fetches a URL that a USER supplied, which makes it a classic SSRF risk:
// without guards, someone could paste http://localhost:5432, an internal
// Railway address, or a cloud metadata endpoint and make our own server fetch
// its internals and hand the contents back to them.
//
// Defences, in order:
//   1. Scheme allow-list — http/https only (no file:, gopher:, etc.)
//   2. Resolve the hostname and reject any PRIVATE/loopback/link-local IP.
//      Done AFTER DNS resolution, because a perfectly public-looking hostname
//      can deliberately resolve to 127.0.0.1 or 169.254.169.254.
//   3. Follow redirects manually, re-checking the IP at EVERY hop — otherwise a
//      public URL could 302 straight to an internal one.
//   4. Hard timeout, redirect cap, and response size cap, so a slow or enormous
//      page can't tie up the server.
//
// Anything that fails these checks returns null. A link preview is a nicety;
// it is never worth taking a risk for.

const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 5000;
const MAX_BYTES = 512 * 1024; // 512KB of HTML is far more than enough for <head>

// Is this IP inside a range we must never fetch?
function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const p = ip.split('.').map(Number);
    if (p[0] === 10) return true;                                  // 10.0.0.0/8
    if (p[0] === 127) return true;                                 // loopback
    if (p[0] === 0) return true;                                   // 0.0.0.0/8
    if (p[0] === 169 && p[1] === 254) return true;                 // link-local / cloud metadata
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;     // 172.16.0.0/12
    if (p[0] === 192 && p[1] === 168) return true;                 // 192.168.0.0/16
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true;    // CGNAT
    if (p[0] >= 224) return true;                                  // multicast / reserved
    return false;
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v === '::1' || v === '::') return true;                    // loopback / unspecified
    if (v.startsWith('fe80')) return true;                         // link-local
    if (v.startsWith('fc') || v.startsWith('fd')) return true;     // unique local
    // IPv4-mapped (::ffff:127.0.0.1) — check the embedded v4 address
    const m = v.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (m) return isPrivateIp(m[1]);
    return false;
  }
  return true; // unknown format — refuse
}

// Validate a URL and confirm its host doesn't resolve to anything internal.
async function assertSafeUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  // If the host is already a literal IP, check it directly.
  if (net.isIP(url.hostname)) {
    if (isPrivateIp(url.hostname)) return null;
    return url;
  }

  let addresses;
  try {
    addresses = await dns.lookup(url.hostname, { all: true });
  } catch {
    return null;
  }
  if (!addresses.length) return null;
  // Every resolved address must be public — a host resolving to both a public
  // and a private IP is a known SSRF trick.
  if (addresses.some(a => isPrivateIp(a.address))) return null;

  return url;
}

// Fetch with manual redirect handling so each hop is re-validated.
async function safeFetch(rawUrl) {
  let current = rawUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await assertSafeUrl(current);
    if (!url) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res;
    try {
      res = await fetch(url.href, {
        redirect: 'manual', // we re-check every hop ourselves
        signal: controller.signal,
        headers: {
          // Identify ourselves honestly, and ask for HTML.
          'User-Agent': 'ABUkonnBot/1.0 (+https://abukonn.com)',
          Accept: 'text/html,application/xhtml+xml',
        },
      });
    } catch {
      clearTimeout(timer);
      return null;
    }
    clearTimeout(timer);

    // Redirect? Re-validate the destination on the next loop.
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) return null;
      current = new URL(loc, url.href).href;
      continue;
    }
    if (!res.ok) return null;

    const type = res.headers.get('content-type') || '';
    if (!type.includes('text/html')) return null; // only HTML has OG tags

    // Read at most MAX_BYTES so an enormous page can't exhaust memory.
    const reader = res.body?.getReader();
    if (!reader) return null;
    const chunks = [];
    let total = 0;
    while (total < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      chunks.push(value);
    }
    try { await reader.cancel(); } catch { /* already closed */ }

    const html = Buffer.concat(chunks.map(c => Buffer.from(c))).toString('utf8');
    return { html, finalUrl: url.href };
  }
  return null; // too many redirects
}

// ── Metadata extraction ──────────────────────────────────────────────────────

const decodeEntities = (s = '') =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
   .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
   .trim();

// Pull a meta tag's content, tolerating attribute order (content before/after
// property) and either single or double quotes.
function metaContent(html, keys) {
  for (const key of keys) {
    const patterns = [
      new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["']`, 'i'),
      new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${key}["']`, 'i'),
    ];
    for (const re of patterns) {
      const m = html.match(re);
      if (m && m[1].trim()) return decodeEntities(m[1]);
    }
  }
  return null;
}

function extractPreview(html, finalUrl) {
  const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title =
    metaContent(html, ['og:title', 'twitter:title']) ||
    (titleTag ? decodeEntities(titleTag[1]) : null);

  const description =
    metaContent(html, ['og:description', 'twitter:description', 'description']);

  let image = metaContent(html, ['og:image', 'og:image:url', 'twitter:image']);
  if (image) {
    try { image = new URL(image, finalUrl).href; } catch { image = null; }
    // Only allow http(s) images — no data: URIs pulled into our UI.
    if (image && !/^https?:\/\//i.test(image)) image = null;
  }

  const siteName = metaContent(html, ['og:site_name']) || new URL(finalUrl).hostname;

  if (!title && !description && !image) return null; // nothing worth showing

  const clamp = (s, n) => (s && s.length > n ? `${s.slice(0, n)}…` : s);

  return {
    url: finalUrl,
    title: clamp(title, 140),
    description: clamp(description, 200),
    image,
    site_name: clamp(siteName, 60),
  };
}

// Public entry point. Returns a preview object, or null if the URL is unsafe,
// unreachable, or simply has no metadata.
async function getLinkPreview(rawUrl) {
  const fetched = await safeFetch(rawUrl);
  if (!fetched) return null;
  try {
    return extractPreview(fetched.html, fetched.finalUrl);
  } catch {
    return null;
  }
}

// Find the first http(s) URL in a block of text.
function firstUrlIn(text = '') {
  const m = text.match(/https?:\/\/[^\s<>"']+/i);
  return m ? m[0] : null;
}

module.exports = { getLinkPreview, firstUrlIn, isPrivateIp };
