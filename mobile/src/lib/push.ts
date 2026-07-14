import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { apiFetch } from './api';

// Show notifications even while the app is in the foreground.
// SDK 54 replaced shouldShowAlert with the more granular banner/list pair.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

let currentToken: string | null = null;

// Ask permission, get the Expo push token, and register it with our backend.
// Returns null if the user declines or on a simulator (push needs real hardware).
export async function registerForPush(): Promise<string | null> {
  try {
    if (!Device.isDevice) return null;

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#16a34a',
      });
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync();
    currentToken = token;

    await apiFetch('/api/push/register', {
      method: 'POST',
      body: JSON.stringify({ token, platform: Platform.OS }),
    });
    return token;
  } catch (err) {
    // Push is a bonus, never a blocker — a failure here must not stop login.
    console.log('Push registration failed:', err);
    return null;
  }
}

// On logout, so a signed-out phone stops receiving this user's notifications.
export async function unregisterPush() {
  if (!currentToken) return;
  try {
    await apiFetch('/api/push/unregister', {
      method: 'POST',
      body: JSON.stringify({ token: currentToken }),
    });
  } catch { /* best effort */ }
  currentToken = null;
}
