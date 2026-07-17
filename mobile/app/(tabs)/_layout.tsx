import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/ThemeContext';

// Tabs mirror the web bottom nav: Feed, News, Library, Profile. Real vector
// icons (Ionicons) rather than emoji — outline when inactive, filled when
// active, the standard iOS/Android tab convention.
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function tabIcon(active: IoniconName, inactive: IoniconName) {
  return ({ color, size, focused }: { color: string; size: number; focused: boolean }) => (
    <Ionicons name={focused ? active : inactive} size={size} color={color} />
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
      <Tabs.Screen name="feed" options={{ title: 'Feed', tabBarIcon: tabIcon('home', 'home-outline') }} />
      <Tabs.Screen name="news" options={{ title: 'News', tabBarIcon: tabIcon('newspaper', 'newspaper-outline') }} />
      <Tabs.Screen name="library" options={{ title: 'Library', tabBarIcon: tabIcon('library', 'library-outline') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: tabIcon('person', 'person-outline') }} />

      <Tabs.Screen name="messages" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
    </Tabs>
  );
}
