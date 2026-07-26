type SecureStoreModule = typeof import('expo-secure-store');

// expo-secure-store's entry point calls requireNativeModule('ExpoSecureStore')
// at MODULE SCOPE (throws if the native module isn't in the binary — see
// src/lib/push.ts for the fuller explanation of why that's dangerous on the
// launch path). This file is imported from AuthContext and ThemeContext, both
// reached while app/_layout.tsx's module graph loads, so a static import here
// carries the same launch-abort risk expo-notifications had. Lazy + guarded
// instead: if SecureStore is unavailable the app still starts, just signed out
// with the default theme, rather than not starting at all.
let mod: SecureStoreModule | null | undefined;
function getSecureStore(): SecureStoreModule | null {
  if (mod !== undefined) return mod;
  try {
    mod = require('expo-secure-store') as SecureStoreModule;
  } catch (err) {
    console.log('SecureStore unavailable', err);
    mod = null;
  }
  return mod;
}

// The auth token lives in the device keychain/keystore, not plain storage.
const TOKEN_KEY = 'abukonn_token';

export async function saveToken(t: string) {
  const SecureStore = getSecureStore();
  if (!SecureStore) throw new Error('Secure storage is unavailable on this device.');
  await SecureStore.setItemAsync(TOKEN_KEY, t);
}
export async function getToken(): Promise<string | null> {
  const SecureStore = getSecureStore();
  if (!SecureStore) return null;
  try { return await SecureStore.getItemAsync(TOKEN_KEY); } catch { return null; }
}
export async function clearToken() {
  const SecureStore = getSecureStore();
  if (!SecureStore) return;
  try { await SecureStore.deleteItemAsync(TOKEN_KEY); } catch { /* already gone */ }
}
