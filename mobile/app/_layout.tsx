import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { AuthProvider } from '../src/context/AuthContext';

// Tapping a push should land you on the thing it's about, not just open the app
// wherever you last left it. The backend attaches a data payload to every push
// ({ type, postId | conversationId | userId }); this routes on it.
function useNotificationRouting() {
  const router = useRouter();

  useEffect(() => {
    const route = (data: Record<string, unknown> | undefined) => {
      if (!data) return;
      if (data.type === 'conversation' && data.conversationId) {
        router.push({
          pathname: '/chat/[id]',
          params: { id: String(data.conversationId), name: 'Chat' },
        });
        return;
      }
      // Posts, stories and profiles have no dedicated mobile screen yet, so send
      // them to the notifications list rather than nowhere at all.
      router.push('/(tabs)/notifications');
    };

    // Opened FROM a notification while the app was closed.
    Notifications.getLastNotificationResponseAsync().then(res => {
      if (res) route(res.notification.request.content.data as Record<string, unknown>);
    });

    // Tapped while the app was already running.
    const sub = Notifications.addNotificationResponseReceivedListener(res => {
      route(res.notification.request.content.data as Record<string, unknown>);
    });

    return () => sub.remove();
  }, [router]);
}

function Routes() {
  useNotificationRouting();
  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Routes />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
