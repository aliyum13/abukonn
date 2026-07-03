'use client';

import { useState, useCallback, useRef } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export interface MentionUser {
  id: number;
  username: string;
  full_name: string;
  profile_photo_url: string | null;
}

/**
 * Detects an active @mention query at the cursor position and fetches
 * matching users. Call `handleChange` from the textarea's onChange with
 * the new value and cursor position; call `applyMention` when a user is
 * picked from the dropdown to splice their @username into the text.
 */
export function useMentionAutocomplete(token: string | null) {
  const [query, setQuery] = useState<string | null>(null);
  const [results, setResults] = useState<MentionUser[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (!token) return;
      try {
        const res = await fetch(`${API_URL}/api/users/mention-search?q=${encodeURIComponent(q)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json() as { users: MentionUser[] };
          setResults(data.users);
          setActiveIndex(0);
        }
      } catch { /* silent */ }
    }, 150);
  }, [token]);

  /** Call on every textarea change with the new text and cursor position. */
  const handleChange = useCallback((text: string, cursorPos: number) => {
    // Look backward from the cursor for an active @token (no whitespace since the @)
    const upToCursor = text.slice(0, cursorPos);
    const match = upToCursor.match(/(?:^|[^\w@])@([a-zA-Z0-9_]{0,30})$/);
    if (match) {
      const start = cursorPos - match[1].length - 1;
      setMentionStart(start);
      setQuery(match[1]);
      if (match[1].length > 0) search(match[1]);
      else setResults([]);
    } else {
      setMentionStart(null);
      setQuery(null);
      setResults([]);
    }
  }, [search]);

  const close = useCallback(() => {
    setQuery(null);
    setResults([]);
    setMentionStart(null);
  }, []);

  /** Splices the picked user's @username into text at the active mention position. Returns the new text and new cursor position. */
  const applyMention = useCallback((text: string, cursorPos: number, user: MentionUser): { text: string; cursorPos: number } => {
    if (mentionStart === null) return { text, cursorPos };
    const before = text.slice(0, mentionStart);
    const after = text.slice(cursorPos);
    const insertion = `@${user.username} `;
    const newText = `${before}${insertion}${after}`;
    const newCursorPos = before.length + insertion.length;
    close();
    return { text: newText, cursorPos: newCursorPos };
  }, [mentionStart, close]);

  const isOpen = query !== null && results.length > 0;

  return {
    isOpen,
    results,
    activeIndex,
    setActiveIndex,
    handleChange,
    applyMention,
    close,
  };
}

export function MentionDropdown({
  results,
  activeIndex,
  onPick,
}: {
  results: MentionUser[];
  activeIndex: number;
  onPick: (user: MentionUser) => void;
}) {
  if (results.length === 0) return null;
  return (
    <div className="absolute z-40 mt-1 w-64 max-h-56 overflow-y-auto rounded-xl border border-border bg-white py-1 shadow-lg dark:bg-[#151515] dark:border-[#333]">
      {results.map((u, i) => (
        <button
          key={u.id}
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onPick(u); }}
          className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition ${
            i === activeIndex ? 'bg-surface-muted dark:bg-[#222]' : 'hover:bg-surface-muted dark:hover:bg-[#222]'
          }`}
        >
          <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-brand-100 dark:bg-brand-950">
            {u.profile_photo_url ? (
              <img src={u.profile_photo_url} alt={u.full_name} className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-[11px] font-bold text-brand-700 dark:text-brand-400">
                {u.full_name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-ink">{u.full_name}</p>
            <p className="truncate text-[11px] text-ink-muted">@{u.username}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
