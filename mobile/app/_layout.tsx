import { useEffect, useState } from 'react';
import { Stack, useRouter, useRootNavigationState } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../src/context/AuthContext';
import { ThemeProvider, useTheme } from '../src/theme/ThemeContext';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { subscribeToFatal } from '../src/lib/earlyErrorHandler';
import { initPushHandler, notificationsApi } from '../src/lib/push';

// Tapping a push should land you on the thing it's about, not just open the app
// wherever you last left it. The backend attaches a data payload to every push
// ({ type, postId | conversationId | userId }); this routes on it.
//
// expo-notifications is reached through notificationsApi() rather than a static
// import: importing it evaluates ten module-scope requireNativeModule() calls,
// any of which can throw before React mounts and abort the app on launch. See
// src/lib/push.ts.
function useNotificationRouting() {
  const router = useRouter();
  // Navigating before the root navigator has mounted throws
  // 'Attempted to navigate before mounting the Root Layout component'.
  const navigationState = useRootNavigationState();
  const navigatorReady = !!navigationState?.key;

  useEffect(() => {
    if (!navigatorReady) return;

    const Notifications = notificationsApi();
    if (!Notifications) return;

    let cancelled = false;

    const route = (data: Record<string, unknown> | undefined) => {
      if (!data) return;
      // Data shapes emitted by the backend (see lib/notify + controllers):
      //   { type:'conversation', conversationId } / { type:'post', postId }
      //   { type:'profile', userId } / { type:'story', userId }
      //   { type:'group', groupId }
      try {
        if (data.type === 'conversation' && data.conversationId) {
          router.push({ pathname: '/chat/[id]', params: { id: String(data.conversationId), name: 'Chat' } });
        } else if (data.type === 'post' && data.postId) {
          router.push({ pathname: '/post/[id]', params: { id: String(data.postId) } });
        } else if (data.type === 'profile' && data.userId) {
          router.push({ pathname: '/user/[id]', params: { id: String(data.userId) } });
        } else if (data.type === 'group' && data.groupId) {
          router.push({ pathname: '/group/[id]', params: { id: String(data.groupId) } });
        } else if (data.type === 'story') {
          router.push('/(tabs)/feed');
        } else {
          router.push('/(tabs)/notifications');
        }
      } catch (err) {
        // A push that can't be routed must never take the app down with it.
        console.log('Notification routing failed:', err);
      }
    };

    // Opened FROM a notification while the app was closed. The .catch matters:
    // an unhandled rejection here used to have nowhere to go.
    Notifications.getLastNotificationResponseAsync()
      .then(res => {
        if (cancelled || !res) return;
        route(res.notification.request.content.data as Record<string, unknown>);
      })
      .catch(err => console.log('getLastNotificationResponseAsync failed:', err));

    // Tapped while the app was already running.
    let sub: { remove: () => void } | null = null;
    try {
      sub = Notifications.addNotificationResponseReceivedListener(res => {
        route(res.notification.request.content.data as Record<string, unknown>);
      });
    } catch (err) {
      console.log('Notification listener failed:', err);
    }

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [router, navigatorReady]);
}

function Routes() {
  useNotificationRouting();
  const { scheme } = useTheme();

  // Foreground notification presentation. Deliberately in an effect: doing this
  // at module load is what aborted the app on iOS before anything could paint.
  useEffect(() => { initPushHandler(); }, []);

  return (
    <>
      {/* Flip status-bar icons to suit the background: dark icons on light, light on dark */}
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}

// Rethrows a captured out-of-React error from *inside* the boundary, so the
// boundary can render it. Throwing in RootLayout itself would escape it.
//
// The handler itself is installed in index.js, before this module is even
// evaluated — anything that throws during module evaluation is handled there.
function GlobalErrorGate({ children }: { children: React.ReactNode }) {
  const [globalError, setGlobalError] = useState<Error | null>(null);

  useEffect(() => subscribeToFatal(setGlobalError), []);

  if (globalError) throw globalError;
  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <GlobalErrorGate>
        <ThemeProvider>
          <SafeAreaProvider>
            <AuthProvider>
              <Routes />
            </AuthProvider>
          </SafeAreaProvider>
        </ThemeProvider>
      </GlobalErrorGate>
    </ErrorBoundary>
  );
}
