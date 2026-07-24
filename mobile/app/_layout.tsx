import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { AuthProvider } from '../src/context/AuthContext';
import { ThemeProvider, useTheme } from '../src/theme/ThemeContext';

// Tapping a push should land you on the thing it's about, not just open the app
// wherever you last left it. The backend attaches a data payload to every push
// ({ type, postId | conversationId | userId }); this routes on it.
function useNotificationRouting() {
  const router = useRouter();

  useEffect(() => {
    const route = (data: Record<string, unknown> | undefined) => {
      if (!data) return;
      // Data shapes emitted by the backend (see lib/notify + controllers):
      //   { type:'conversation', conversationId } / { type:'post', postId }
      //   { type:'profile', userId } / { type:'story', userId }
      if (data.type === 'conversation' && data.conversationId) {
        router.push({ pathname: '/chat/[id]', params: { id: String(data.conversationId), name: 'Chat' } });
      } else if (data.type === 'post' && data.postId) {
        router.push({ pathname: '/post/[id]', params: { id: String(data.postId) } });
      } else if (data.type === 'profile' && data.userId) {
        router.push({ pathname: '/user/[id]', params: { id: String(data.userId) } });
      } else if (data.type === 'story') {
        router.push('/(tabs)/feed');
      } else {
        router.push('/(tabs)/notifications');
      }
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
  const { scheme } = useTheme();
  return (
    <>
      {/* Flip status-bar icons to suit the background: dark icons on light, light on dark */}
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <AuthProvider>
          <Routes />
        </AuthProvider>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
