import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { apiFetch } from './api';

// Unread News badge state, shared between the tab bar (shows it) and the News
// screen (clears it). Module-level on purpose: both live in different parts of
// the tree, and the count is just a number the server owns.
let count = 0;
let viewingNews = false;
const listeners = new Set<() => void>();

function setCount(n: number) {
  if (n === count) return;
  count = n;
  listeners.forEach(l => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => { listeners.delete(l); };
};

export function useNewsUnreadCount(): number {
  return useSyncExternalStore(subscribe, () => count);
}

export async function refreshNewsUnread() {
  try {
    const data = await apiFetch<{ count: number }>('/api/news/unread-count');
    // A request already in flight when News was opened must not put the badge
    // back on the screen that just cleared it.
    if (!viewingNews) setCount(data.count ?? 0);
  } catch {
    // best-effort; the next poll will catch up
  }
}

// Called when the News screen gains focus: clears the badge locally right away
// and tells the server the user has now seen News.
export async function markNewsSeen() {
  setCount(0);
  try {
    await apiFetch('/api/news/seen', { method: 'POST' });
  } catch {
    // best-effort
  }
}

export function setViewingNews(v: boolean) {
  viewingNews = v;
}

// Keeps the badge fresh while signed in: on mount, every minute, and whenever
// the app returns to the foreground. Resets when signed out so one account's
// count never shows for the next.
export function useNewsUnreadPolling(enabled: boolean) {
  useEffect(() => {
    if (!enabled) {
      setCount(0);
      return;
    }
    refreshNewsUnread();
    const id = setInterval(refreshNewsUnread, 60_000);
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') refreshNewsUnread();
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [enabled]);
}
