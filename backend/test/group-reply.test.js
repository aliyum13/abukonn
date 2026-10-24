// Group chat Reply. A reply is not a column: it is the same JSON envelope the
// private chat uses, {type:'message_reply', quoted_sender, quoted_text, reply},
// stored in the message's `content`. So what the server owes a group reply is
// only that it treats that content sensibly: the push reads as the reply text
// rather than JSON, and @mentions come from what the sender TYPED, not from the
// quote the envelope carries. These run the real sendGroupMessage controller
// with the models and push stubbed.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const stub = (id, exports) => {
  const p = require.resolve(id.startsWith('.') ? path.join(__dirname, id) : id);
  require.cache[p] = { id: p, filename: p, loaded: true, exports };
};

const saved = [];
const mentionNotifications = [];
const pushes = [];

const MEMBERS = [
  { id: 1, username: 'ada', status: 'active' },   // sender
  { id: 2, username: 'bob', status: 'active' },
  { id: 3, username: 'chi', status: 'active' },
];

stub('../src/config/db', { query: async () => ({ rows: [] }) });
stub('../src/models/Group', {
  isMember: async () => true,
  sendGroupMessage: async args => { saved.push(args); return { id: 100, group_id: args.groupId, sender_id: args.senderId, content: args.content }; },
  getGroupMembers: async () => MEMBERS,
  getGroupById: async () => ({ id: 9, name: 'CSC 300L' }),
});
stub('../src/models/User', { findById: async () => ({ full_name: 'Ada', profile_photo_url: null }) });
stub('../src/models/Notification', {
  createNotification: async args => { mentionNotifications.push(args); },
});
stub('../src/lib/push', {
  sendPushToUsers: async (ids, payload) => { pushes.push({ ids, payload }); },
});

const { sendGroupMessage } = require('../src/controllers/groupController');
const { ownMessageText, plainMessagePreview } = require('../src/lib/messagePreview');

const reply = (quotedText, text, quotedSender = 'Chidi') =>
  JSON.stringify({ type: 'message_reply', quoted_sender: quotedSender, quoted_text: quotedText, reply: text });

// The notification work in sendGroupMessage is fire-and-forget after the
// response is sent; give its promise chain time to settle.
const settle = async () => { for (let i = 0; i < 10; i++) await new Promise(r => setImmediate(r)); };

async function send(content, extra = {}) {
  const res = {
    statusCode: 200, body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
  await sendGroupMessage({ params: { id: '9' }, user: { id: 1 }, body: { content, ...extra }, app: { get: () => null } }, res);
  await settle();
  return res;
}

test.beforeEach(() => { saved.length = 0; mentionNotifications.length = 0; pushes.length = 0; });

test('a reply is stored exactly as sent: the envelope round-trips untouched', async () => {
  const content = reply('see you at 4', 'ok');
  const res = await send(content);
  assert.equal(res.statusCode, 201);
  assert.equal(saved[0].content, content);
  assert.deepEqual(JSON.parse(res.body.message.content), {
    type: 'message_reply', quoted_sender: 'Chidi', quoted_text: 'see you at 4', reply: 'ok',
  });
});

test('the push for a reply reads as the reply text, never as JSON', async () => {
  await send(reply('see you at 4', 'ok, I will be there'));
  assert.equal(pushes.length, 1);
  assert.equal(pushes[0].payload.body, '{name} in CSC 300L: ok, I will be there');
  assert.doesNotMatch(pushes[0].payload.body, /message_reply|quoted_/);
});

test('a long reply is truncated in the push from the reply text, not the envelope', async () => {
  const long = 'x'.repeat(100);
  await send(reply('q'.repeat(300), long));
  assert.equal(pushes[0].payload.body, `{name} in CSC 300L: ${'x'.repeat(70)}…`);
});

test('@handles inside the QUOTED text do not mention anyone', async () => {
  await send(reply('@bob can you check the notes?', 'done, thanks'));
  assert.equal(mentionNotifications.length, 0);
  // bob is an ordinary recipient, so he gets the group push -- not a mention.
  assert.deepEqual(pushes[0].ids.sort(), [2, 3]);
});

test('@handles the sender typed in the reply itself still mention them', async () => {
  await send(reply('anyone free tomorrow?', '@bob I am, are you?'));
  assert.deepEqual(mentionNotifications.map(n => [n.recipientId, n.type]), [[2, 'mention']]);
  // Mentioned members get the mention notification instead of a second push.
  assert.deepEqual(pushes[0].ids, [3]);
});

test('a plain message with an @mention behaves as before', async () => {
  await send('@chi are you coming?');
  assert.deepEqual(mentionNotifications.map(n => n.recipientId), [3]);
  assert.deepEqual(pushes[0].ids, [2]);
  assert.equal(pushes[0].payload.body, '{name} in CSC 300L: @chi are you coming?');
});

test('a reply whose quote is an image-only message still sends', async () => {
  const res = await send(reply('📷 Photo', 'nice one'));
  assert.equal(res.statusCode, 201);
  assert.equal(pushes[0].payload.body, '{name} in CSC 300L: nice one');
});

test('ownMessageText: typed words only', () => {
  assert.equal(ownMessageText('hello @bob'), 'hello @bob');
  assert.equal(ownMessageText(reply('@bob hi', 'ok')), 'ok');
  assert.equal(ownMessageText(JSON.stringify({ type: 'story_reply', reply: 'love it', text_content: '@bob' })), 'love it');
  assert.equal(ownMessageText(JSON.stringify({ type: 'shared_post', content: '@bob look' })), '');
  assert.equal(ownMessageText(JSON.stringify({ type: 'message_reply' })), '');
  assert.equal(ownMessageText(''), '');
  assert.equal(ownMessageText(null), '');
  // JSON that is not one of ours is just text the user typed.
  assert.equal(ownMessageText('{"a":1}'), '{"a":1}');
  assert.equal(ownMessageText('123'), '123');
});

test('plainMessagePreview of a reply (the push body source) is the reply text', () => {
  assert.equal(plainMessagePreview(reply('q', 'the answer')), 'the answer');
});
