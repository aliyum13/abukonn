// Turns a conversation's raw last_message into a friendly preview.
//
// Some messages are stored as JSON (shared posts, story replies, message
// replies) rather than plain text. Showing the raw JSON in the list looks broken
// (e.g. {"type":"message_reply",...}), so normalise them to a short string.
// Mirrors the web app's friendlyPreview so both read identically.
export function friendlyPreview(content: string | null | undefined): string {
  if (!content) return 'No messages yet';
  try {
    const data = JSON.parse(content);
    if (data && typeof data === 'object') {
      if (data.type === 'shared_post') return '📌 Shared a post';
      if (data.type === 'story_reply') return `↩ ${data.reply ?? ''}`.trim();
      if (data.type === 'message_reply') return `↩ ${data.reply ?? ''}`.trim();
    }
  } catch {
    // not JSON — fall through to plain text
  }
  return content;
}

// Clean, human-readable text for copy/forward — strips JSON envelopes to their
// underlying text (no emoji prefixes). Mirrors web's plainMessageText.
export function plainText(content: string | null | undefined): string {
  if (!content) return '';
  try {
    const data = JSON.parse(content);
    if (data && typeof data === 'object') {
      if (data.type === 'shared_post') return data.content ?? '';
      if (data.type === 'story_reply') return data.reply ?? '';
      if (data.type === 'message_reply') return data.reply ?? '';
    }
  } catch {
    // not JSON — plain text
  }
  return content;
}
