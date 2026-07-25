import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Palette, lightColors, darkColors, applyPalette } from './index';

export type ThemeMode = 'system' | 'light' | 'dark';
const STORE_KEY = 'abukonn_theme_mode';

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
    SecureStore.setItemAsync(STORE_KEY, m).catch(() => {});
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
