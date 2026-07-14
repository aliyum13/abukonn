import * as SecureStore from 'expo-secure-store';

// The auth token lives in the device keychain/keystore, not plain storage.
const TOKEN_KEY = 'abukonn_token';

export async function saveToken(t: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, t);
}
export async function getToken(): Promise<string | null> {
  try { return await SecureStore.getItemAsync(TOKEN_KEY); } catch { return null; }
}
export async function clearToken() {
  try { await SecureStore.deleteItemAsync(TOKEN_KEY); } catch { /* already gone */ }
}
