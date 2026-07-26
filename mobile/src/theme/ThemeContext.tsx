import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { Palette, lightColors, darkColors, applyPalette } from './index';

export type ThemeMode = 'system' | 'light' | 'dark';
const STORE_KEY = 'abukonn_theme_mode';

// Lazy + guarded for the same reason as src/lib/storage.ts: expo-secure-store
// throws at MODULE SCOPE if its native module isn't in the binary, and this
// file is on the launch path (imported directly by app/_layout.tsx). Themed
// preference just falls back to 'system' if it's unavailable.
type SecureStoreModule = typeof import('expo-secure-store');
let secureStoreMod: SecureStoreModule | null | undefined;
function getSecureStore(): SecureStoreModule | null {
  if (secureStoreMod !== undefined) return secureStoreMod;
  try {
    secureStoreMod = require('expo-secure-store') as SecureStoreModule;
  } catch (err) {
    console.log('SecureStore unavailable', err);
    secureStoreMod = null;
  }
  return secureStoreMod;
}

interface ThemeState {
  mode: ThemeMode;              // the user's choice
  scheme: 'light' | 'dark';    // the resolved scheme actually in use
  palette: Palette;
  setMode: (m: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeState | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme(); // 'light' | 'dark' | null, follows the phone
  const [mode, setModeState] = useState<ThemeMode>('system');

  // Load the saved choice once on launch.
  //
  // This used to hold the whole tree back (`if (!ready) return null`) to avoid a
  // light-to-dark flash. That was a launch hazard: the root layout is required to
  // render a navigator on its FIRST render, and returning null meant it didn't —
  // any navigation before the keychain read resolved threw 'Attempted to navigate
  // before mounting the Root Layout component'. The default is 'system', which
  // already matches the phone, so the flash only ever affected users who had
  // explicitly overridden it, and a wrong frame beats a crash.
  //
  // Deferred a tick because SecureStore is a native call and the launch path is
  // where iOS was aborting.
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      (async () => {
        const SecureStore = getSecureStore();
        if (!SecureStore) return;
        try {
          const saved = await SecureStore.getItemAsync(STORE_KEY);
          if (cancelled) return;
          if (saved === 'light' || saved === 'dark' || saved === 'system') setModeState(saved);
        } catch { /* default system */ }
      })();
    }, 0);
    return () => { cancelled = true; clearTimeout(t); };
  }, []);

  const scheme: 'light' | 'dark' =
    mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode;

  const palette = scheme === 'dark' ? darkColors : lightColors;

  // Keep the live `colors` object (imported directly by some modules) in sync.
  applyPalette(palette);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    getSecureStore()?.setItemAsync(STORE_KEY, m).catch(() => {});
  }, []);

  const value = useMemo(() => ({ mode, scheme, palette, setMode }), [mode, scheme, palette, setMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

// Build themed styles inside a component: pass a factory that takes the palette
// and returns a StyleSheet. Rebuilt whenever the palette changes, so a theme
// switch restyles the screen immediately.
export function useThemedStyles<T>(factory: (p: Palette) => T): T {
  const { palette } = useTheme();
  return useMemo(() => factory(palette), [palette, factory]);
}
