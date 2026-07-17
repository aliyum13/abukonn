// Theme tokens mirrored from web (light + dark), so mobile matches web in both
// modes. Values are web's globals.css CSS variables.

export interface Palette {
  brand: string;
  brand500: string;
  brand400: string;
  brand50: string;
  brand100: string;
  bg: string;
  surface: string;
  surfaceSubtle: string;
  text: string;
  textSecondary: string;
  muted: string;
  faint: string;
  border: string;
  borderStrong: string;
  danger: string;
  white: string;
}

export const lightColors: Palette = {
  brand: '#16a34a',
  brand500: '#22c55e',
  brand400: '#4ade80',
  brand50: '#f0fdf4',
  brand100: '#dcfce7',
  bg: '#f8fafc',
  surface: '#ffffff',
  surfaceSubtle: '#f1f5f9',
  text: '#0f172a',
  textSecondary: '#475569',
  muted: '#94a3b8',
  faint: '#cbd5e1',
  border: '#e2e8f0',
  borderStrong: '#cbd5e1',
  danger: '#dc2626',
  white: '#ffffff',
};

export const darkColors: Palette = {
  brand: '#16a34a',
  brand500: '#22c55e',
  brand400: '#4ade80',
  brand50: '#0f2417',      // dark tint that reads as a green wash
  brand100: '#14331f',
  bg: '#0a0a0a',           // page ground
  surface: '#111111',      // cards
  surfaceSubtle: '#1a1a1a',
  text: '#f5f5f5',
  textSecondary: '#a0a0a0',
  muted: '#666666',
  faint: '#2a2a2a',
  border: '#222222',
  borderStrong: '#333333',
  danger: '#f87171',
  white: '#ffffff',        // stays white — used for text on the brand-green buttons
};

// A LIVE palette object. Screens do `import { colors }` and read colors.bg etc.
// The ThemeProvider mutates these fields in place when the mode changes, then
// bumps a version in context to trigger re-renders — so every screen picks up
// the new palette without each one needing a hook. Start in light; the provider
// sets the real value on mount before first paint.
export const colors: Palette = { ...lightColors };

export function applyPalette(p: Palette) {
  Object.assign(colors, p);
}

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 999,
};

export const shadow = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
};
