import { Tabs } from 'expo-router';
import { colors } from '../../src/theme';

// Tabs mirror the web bottom nav exactly: Feed, News, Library, Profile.
// Messages and Notifications are reached from the ☰ menu (as on web, where they
// live in the logo menu, not the bottom bar). They stay in this folder so their
// routes work — href: null just hides them from the tab bar.
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tabs.Screen name="feed" options={{ title: 'Feed' }} />
      <Tabs.Screen name="news" options={{ title: 'News' }} />
      <Tabs.Screen name="library" options={{ title: 'Library' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />

      <Tabs.Screen name="messages" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
    </Tabs>
  );
}
