import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useTheme } from '../../src/theme/ThemeContext';

// Tabs mirror the web bottom nav: Feed, News, Library, Profile — with the same
// emoji icons web uses in its nav, so there's a real glyph instead of the blank
// default. Messages and Notifications live in the ☰ menu (href: null hides them
// from the bar but keeps their routes working).
function tabIcon(emoji: string) {
  return ({ focused }: { focused: boolean }) => (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
  );
}

export default function TabsLayout() {
  const { palette } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.brand,
        tabBarInactiveTintColor: palette.muted,
        tabBarStyle: {
          backgroundColor: palette.surface,
          borderTopColor: palette.border,
        },
      }}
    >
      <Tabs.Screen name="feed" options={{ title: 'Feed', tabBarIcon: tabIcon('🏠') }} />
      <Tabs.Screen name="news" options={{ title: 'News', tabBarIcon: tabIcon('📰') }} />
      <Tabs.Screen name="library" options={{ title: 'Library', tabBarIcon: tabIcon('📚') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: tabIcon('👤') }} />

      <Tabs.Screen name="messages" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
    </Tabs>
  );
}
