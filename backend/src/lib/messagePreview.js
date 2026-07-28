// Turns a message's raw content into human-readable text for a push
// notification body. Ported from mobile/src/lib/messagePreview.ts and web's
// equivalent -- same logic, same message-type keys, just on the backend.
//
// Some messages are stored as JSON (shared posts, story replies, message
// replies) rather than plain text. messageController.js was using that raw
// content directly as the push notification body, so a reply notification
// showed the literal JSON string -- {"type":"message_reply","quoted_sender":
// ...} -- on the recipient's lock screen instead of a real sentence.

function plainMessagePreview(content) {
  if (!content) return '';
  try {
    const data = JSON.parse(content);
    if (data && typeof data === 'object') {
      if (data.type === 'shared_post') return 'Shared a post';
      if (data.type === 'story_reply') return data.reply || 'Replied to your story';
      if (data.type === 'message_reply') return data.reply || '';
    }
  } catch {
    // not JSON -- plain text message, use as-is
  }
  return content;
}

module.exports = { plainMessagePreview };
