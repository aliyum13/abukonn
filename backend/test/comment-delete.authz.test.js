// Regression guard for comment-delete authorisation.
//
// The bug this protects against: "let people delete comments on reposts" is
// very easy to mis-fix by authorising on the POST OWNER (so a reposter could
// delete anyone's comment on their repost) instead of on the COMMENT AUTHOR.
// The correct rule is author-only, and it is enforced in SQL --
// `DELETE ... WHERE id = $1 AND user_id = $2` -- so the thing worth locking
// down is that the author scoping is still in the statement and still fed the
// caller's own id.
//
// Runs with the Node built-in test runner (`node --test`), no dependencies and
// no database: `../config/db` is replaced in require.cache before the model is
// loaded. The fake pool interprets the statement rather than blindly returning
// rows -- if the `user_id = $2` scoping is ever dropped, the fake stops
// filtering too and the "someone else's comment" cases below fail. That is the
// point: this asserts the query is author-scoped, not that Postgres works.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// One comment, authored by user 7, living on post 42.
const FIXTURE = { id: 1, post_id: 42, user_id: 7 };

let lastQuery = null;

const dbPath = require.resolve('../src/config/db');
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    query: async (sql, params) => {
      lastQuery = { sql, params };
      const normalised = sql.replace(/\s+/g, ' ');
      const [commentId, userId] = params;

      // Mimic the WHERE clause the statement actually declares.
      let match = FIXTURE.id === commentId;
      if (/user_id\s*=\s*\$2/.test(normalised)) {
        match = match && FIXTURE.user_id === userId;
      }
      return { rows: match ? [{ post_id: FIXTURE.post_id }] : [] };
    },
  },
};

const Comment = require(path.join(__dirname, '../src/models/Comment.js'));

test('the comment author can delete their own comment', async () => {
  const result = await Comment.deleteComment(FIXTURE.id, FIXTURE.user_id);
  assert.notEqual(result, null, 'author should be allowed to delete');
  assert.equal(result.post_id, FIXTURE.post_id);
});

test('the DELETE is scoped by comment author, not by post owner', async () => {
  await Comment.deleteComment(FIXTURE.id, FIXTURE.user_id);
  const sql = lastQuery.sql.replace(/\s+/g, ' ');

  assert.match(sql, /DELETE FROM \S*comments/i);
  assert.match(sql, /user_id\s*=\s*\$2/,
    'author scoping removed: a post owner or reposter could delete anyone\'s comment');
  assert.deepEqual(lastQuery.params, [FIXTURE.id, FIXTURE.user_id],
    'the delete must be parameterised with the CALLER\'s id, not the post owner\'s');
});

test('a reposter cannot delete someone else\'s comment on their repost', async () => {
  // User 99 reposted post 42. The comment is user 7's. Reposting grants no
  // authority over other people's comments.
  const reposterId = 99;
  const result = await Comment.deleteComment(FIXTURE.id, reposterId);
  assert.equal(result, null, 'a non-author must not be able to delete the comment');
});

test('the post owner cannot delete someone else\'s comment either', async () => {
  const postOwnerId = 55;
  const result = await Comment.deleteComment(FIXTURE.id, postOwnerId);
  assert.equal(result, null, 'owning the post is not authority over its comments');
});

test('deleting a comment that does not exist returns null', async () => {
  const result = await Comment.deleteComment(4242, FIXTURE.user_id);
  assert.equal(result, null);
});
