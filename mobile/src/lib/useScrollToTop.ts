import { useRef, useEffect } from 'react';
import { FlatList } from 'react-native';
import { useNavigation } from 'expo-router';

// Tapping the already-active tab scrolls that screen to the top and (optionally)
// refreshes it — the behaviour web has via tap-to-refresh.
//
// The refresh callback is read through a ref so screens can pass a function
// that's defined later in the component body (e.g. a useCallback `load`) without
// hitting use-before-declaration. Just call setRefresh(load) once load exists,
// or pass nothing for scroll-only.
export function useTabScrollToTop<T>() {
  const ref = useRef<FlatList<T>>(null);
  const refreshRef = useRef<(() => void) | null>(null);
  const navigation = useNavigation();

  useEffect(() => {
    // @ts-expect-error tabPress is provided by the tab navigator at runtime
    const unsub = navigation.addListener('tabPress', () => {
      ref.current?.scrollToOffset({ offset: 0, animated: true });
      refreshRef.current?.();
    });
    return unsub;
  }, [navigation]);

  const setRefresh = (fn: () => void) => { refreshRef.current = fn; };
  return { ref, setRefresh };
}
