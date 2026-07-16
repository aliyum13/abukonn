// Design tokens mirrored from the web app (tailwind.config + globals.css), so
// mobile matches web rather than looking like a plainer cousin. Values are the
// light-mode CSS variables; the brand ramp is the same green scale.

export const colors = {
  // Brand green ramp (identical to web's brand.* scale)
  brand: '#16a34a',      // brand-600 — primary actions
  brand500: '#22c55e',
  brand400: '#4ade80',
  brand50: '#f0fdf4',    // tint backgrounds
  brand100: '#dcfce7',

  // Surfaces — the page is NOT pure white on web; cards sit on a muted ground
  bg: '#f8fafc',         // --surface-muted (page background)
  surface: '#ffffff',    // --surface (cards)
  surfaceSubtle: '#f1f5f9',

  // Ink — slate, not pure black (a big part of the polished feel)
  text: '#0f172a',       // --ink
  textSecondary: '#475569',
  muted: '#94a3b8',      // --ink-muted
  faint: '#cbd5e1',

  // Borders
  border: '#e2e8f0',     // --border
  borderStrong: '#cbd5e1',

  danger: '#dc2626',
  white: '#ffffff',
};

export const radius = {
  sm: 8,
  md: 12,   // web's rounded-xl — default card radius
  lg: 16,
  full: 999,
};

export const shadow = {
  card: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
};
