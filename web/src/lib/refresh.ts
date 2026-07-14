'use client';

import { useEffect, useRef } from 'react';

// ── Tap-the-active-tab to refresh ────────────────────────────────────────────
//
// Standard social-app behaviour: when you're already on a page and tap that
// page's nav icon again, the content refreshes and jumps back to the top.
//
// Next.js won't re-navigate to the route you're already on, and router.refresh()
// doesn't help either — these pages fetch their data client-side in useEffect,
// so a router refresh wouldn't re-run those fetches.
//
// Instead the nav broadcasts a small event and each page listens for it. A page
// opts in by calling usePageRefresh(() => reload()); pages that don't opt in
// simply scroll to top, which is still the expected behaviour.

const EVENT = 'abukonn:page-refresh';

/** Fired by the nav when the ALREADY-ACTIVE tab is tapped. */
export function triggerPageRefresh(path: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { path } }));
  // Smooth so it reads as a deliberate action rather than a jarring jump.
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Subscribe a page to the refresh signal.
 *
 * @param onRefresh  re-fetch this page's data
 * @param path       the route this page lives at, so a refresh meant for one
 *                   page can't trigger a reload on another that happens to be
 *                   mounted.
 */
export function usePageRefresh(onRefresh: () => void, path: string) {
  // Held in a ref so pages can pass an inline/unmemoized function without the
  // listener being torn down and re-added on every render.
  const cb = useRef(onRefresh);
  useEffect(() => { cb.current = onRefresh; }, [onRefresh]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ path: string }>).detail;
      if (!detail || detail.path === path) cb.current();
    };
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, [path]);
}
