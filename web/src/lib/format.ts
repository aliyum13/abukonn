export function timeAgo(dateString: string) {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateString).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
  });
}

export function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString('en-NG', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function excerpt(content: string, max = 120) {
  if (content.length <= max) return content;
  return `${content.slice(0, max).trim()}...`;
}

/**
 * Format an academic level for display.
 *
 * Levels are stored WITH the word already in them ("300 Level", "Postgraduate"),
 * so appending " level" in the UI produces "300 Level level". This normalises
 * the value whether or not it already contains the word, and leaves
 * non-numeric levels like "Postgraduate" alone.
 */
export function formatLevel(level: string | null | undefined): string {
  if (!level) return '';
  const trimmed = level.trim();
  // Already contains the word (e.g. "300 Level") — use as-is.
  if (/level/i.test(trimmed)) return trimmed;
  // Bare number (e.g. "300") — add the word.
  if (/^\d+$/.test(trimmed)) return `${trimmed} Level`;
  // Anything else (e.g. "Postgraduate") — leave alone.
  return trimmed;
}

/**
 * Returns a friendly preview string for a conversation's last message.
 *
 * Some messages are stored as JSON (shared posts, story replies, message
 * replies) rather than plain text. Rendering the raw JSON in the conversation
 * list looks broken (e.g. `{"type":"message_reply",...}`), so this normalises
 * them to a short human string. Mirrors the messages page's own preview logic so
 * the inline Messages tab in the feed reads identically.
 */
export function friendlyPreview(content: string | null | undefined): string {
  if (!content) return 'No messages yet';
  try {
    const data = JSON.parse(content);
    if (data && typeof data === 'object') {
      if (data.type === 'shared_post') return '📌 Shared a post';
      if (data.type === 'story_reply') return `↩ ${data.reply ?? ''}`.trim();
      if (data.type === 'message_reply') return `↩ ${data.reply ?? ''}`.trim();
    }
  } catch { /* not JSON — fall through to plain text */ }
  return content;
}
