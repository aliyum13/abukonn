import { useRef, useEffect, useCallback } from 'react';
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

  // Stable identity is the whole point -- callers do
  // `useEffect(() => { load(); setRefresh(load); }, [load, setRefresh])`, and an
  // unmemoized setRefresh here gave that effect a NEW dependency on every single
  // render of the calling screen (a fresh function object each time), so it
  // re-fired on every render rather than just on mount -- feed.tsx's version of
  // this re-ran load() itself on every render (a self-sustaining refetch loop,
  // the main cause of the never-ending spinner), library.tsx's re-assigned the
  // ref repeatedly (wasteful but not itself a refetch). useCallback makes this
  // identity stable across renders so both effects only fire when they should:
  // once on mount, and again only when the load callback itself actually changes.
  const setRefresh = useCallback((fn: () => void) => { refreshRef.current = fn; }, []);
  return { ref, setRefresh };
}
