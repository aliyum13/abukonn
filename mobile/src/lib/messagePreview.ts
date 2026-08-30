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

// The part of a message its sender can actually edit: plain text, or the reply
// text inside a reply / story-reply envelope. Returns '' for anything with no
// words of the sender's own — a shared-post card (those are the original
// post's words) or an attachment-only message. Callers treat '' as "don't
// offer Edit". Mirrors web's editableMessageText.
export function editableText(content: string | null | undefined): string {
  if (!content) return '';
  try {
    const data = JSON.parse(content);
    if (data && typeof data === 'object') {
      if (data.type === 'shared_post') return '';
      if (data.type === 'story_reply') return data.reply ?? '';
      if (data.type === 'message_reply') return data.reply ?? '';
    }
  } catch {
    // not JSON — plain text is editable as-is
  }
  return content;
}

// Puts edited text back where editableText took it from, keeping any JSON
// envelope intact — otherwise editing a reply would flatten it into a plain
// message and lose the quoted context it was rendering. Mirrors web's
// withEditedText.
export function withEditedText(content: string | null | undefined, text: string): string {
  if (content) {
    try {
      const data = JSON.parse(content);
      if (data && typeof data === 'object' && (data.type === 'story_reply' || data.type === 'message_reply')) {
        return JSON.stringify({ ...data, reply: text });
      }
    } catch {
      // plain text — nothing to preserve
    }
  }
  return text;
}
