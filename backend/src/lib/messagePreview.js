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

// The words the sender themselves typed, as opposed to context the message
// carries along. A reply stores the quoted message INSIDE its content
// envelope, so scanning raw content for @mentions treats the quoted
// message's @handles as if the replier had just written them: replying "ok"
// to "@bob can you check?" would notify bob a second time, and notify him
// even when the reply is to someone else's quote of him. Callers that look for
// intent in what was typed (mentions) should look here, not at raw content.
// A shared post has no words of the sender's own; its text is the post's.
function ownMessageText(content) {
  if (!content) return '';
  try {
    const data = JSON.parse(content);
    if (data && typeof data === 'object') {
      if (data.type === 'shared_post') return '';
      if (data.type === 'story_reply' || data.type === 'message_reply') return data.reply || '';
    }
  } catch {
    // not JSON -- plain text message, use as-is
  }
  return content;
}

module.exports = { plainMessagePreview, ownMessageText };
