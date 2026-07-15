import { useEffect, useState, useCallback } from 'react';
import { Tabs } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { apiFetch } from '../../src/lib/api';
import { colors } from '../../src/theme';

export default function TabsLayout() {
  const [unread, setUnread] = useState(0);

  const refreshBadge = useCallback(async () => {
    try {
      const d = await apiFetch<{ count: number }>('/api/notifications/unread-count');
      setUnread(d.count || 0);
    } catch {
      // Badge is cosmetic — never surface an error for it.
    }
  }, []);

  useEffect(() => {
    refreshBadge();
    // Poll modestly. The push itself is instant; this just keeps the badge
    // honest while the app stays open.
    const t = setInterval(refreshBadge, 30000);

    // A push arriving while the app is open should bump the badge immediately
    // rather than waiting up to 30s for the next poll.
    const sub = Notifications.addNotificationReceivedListener(() => refreshBadge());

    return () => { clearInterval(t); sub.remove(); };
  }, [refreshBadge]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tabs.Screen name="feed" options={{ title: 'Feed' }} />
      <Tabs.Screen name="library" options={{ title: 'Library' }} />
      <Tabs.Screen name="messages" options={{ title: 'Messages' }} />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Alerts',
          tabBarBadge: unread > 0 ? (unread > 99 ? '99+' : unread) : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.brand, fontSize: 10 },
        }}
      />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
