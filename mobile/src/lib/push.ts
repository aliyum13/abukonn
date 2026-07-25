import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { apiFetch } from './api';

type NotificationsModule = typeof import('expo-notifications');
type DeviceModule = typeof import('expo-device');

/**
 * expo-notifications is loaded lazily, and that is the whole point of this file's
 * shape.
 *
 * `import * as Notifications from 'expo-notifications'` is not a cheap import.
 * Its index eagerly re-exports about twenty submodules, ten of which call
 * `requireNativeModule('Expo…')` at MODULE SCOPE. requireNativeModule throws
 * `Cannot find native module 'X'` when that module isn't registered in the built
 * binary — and because the throw happens while the module graph is being
 * evaluated, it lands before React mounts and before any ErrorBoundary exists.
 * In a release build that reaches RCTFatal and aborts the process: SIGABRT on
 * launch, with a crash report showing only the native abort.
 *
 * A try/catch around setNotificationHandler could never help, because the import
 * that throws is hoisted above it. Requiring the module on first use, inside a
 * guard, keeps it off the launch path entirely: if notifications are broken the
 * app still starts and simply has no push.
 */
let notificationsModule: NotificationsModule | null | undefined;
let deviceModule: DeviceModule | null | undefined;

function getNotifications(): NotificationsModule | null {
  if (notificationsModule !== undefined) return notificationsModule;
  try {
    notificationsModule = require('expo-notifications') as NotificationsModule;
  } catch (err) {
    console.log('Push: expo-notifications unavailable', err);
    notificationsModule = null;
  }
  return notificationsModule;
}

function getDevice(): DeviceModule | null {
  if (deviceModule !== undefined) return deviceModule;
  try {
    deviceModule = require('expo-device') as DeviceModule;
  } catch (err) {
    console.log('Push: expo-device unavailable', err);
    deviceModule = null;
  }
  return deviceModule;
}

/** Shared with the notification-tap routing in the root layout. */
export function notificationsApi(): NotificationsModule | null {
  return getNotifications();
}

// Show notifications even while the app is in the foreground.
// SDK 54 replaced shouldShowAlert with the more granular banner/list pair.
//
// Called from an effect once the tree is mounted, NOT at module load.
let handlerInstalled = false;
export function initPushHandler() {
  if (handlerInstalled) return;
  handlerInstalled = true;

  const Notifications = getNotifications();
  if (!Notifications) return;

  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  } catch (err) {
    console.log('Push: setNotificationHandler failed', err);
  }
}

let currentToken: string | null = null;

// Ask permission, get the Expo push token, and register it with our backend.
// Returns null if the user declines or on a simulator (push needs real hardware).
export async function registerForPush(): Promise<string | null> {
  try {
    const Notifications = getNotifications();
    if (!Notifications) return null;

    const Device = getDevice();
    if (Device && !Device.isDevice) return null;

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

    // Pass the EAS projectId explicitly. Inference works in some contexts and
    // silently fails in others ('No projectId found'), which is exactly how push
    // was broken before. Being explicit also means the token survives the project
    // being renamed or transferred between accounts.
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;

    if (!projectId) {
      console.log('Push: no EAS projectId — run `eas init`.');
      return null;
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
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
