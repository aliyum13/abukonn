// The SQL behind edit and delete, on a real Postgres (PGlite). news-manage.test.js proves who
// is allowed through a fake database; this proves the statements themselves do what the
// handlers assume: partial updates build valid placeholders, category is never touched,
// delete returns the cover URL and cascades likes.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const db = new PGlite();
const dbPath = require.resolve('../src/config/db');
require.cache[dbPath] = {
  id: dbPath, filename: dbPath, loaded: true,
  exports: {
    async query(sql, params) {
      if (!params || params.length === 0) {
        const r = await db.exec(sql);
        return r[r.length - 1] || { rows: [] };
      }
      return db.query(sql, params);
    },
  },
};
const News = require(path.join('..', 'src', 'models', 'News'));

test.before(async () => {
  await db.exec(`CREATE SCHEMA abukonn;
    CREATE TABLE abukonn.users (id SERIAL PRIMARY KEY, full_name TEXT);
    INSERT INTO abukonn.users (full_name) VALUES ('Author'), ('Reader');`);
  await db.exec(News.CREATE_NEWS_TABLE);
  await db.exec(`ALTER TABLE abukonn.news ADD COLUMN IF NOT EXISTS likes_count INTEGER NOT NULL DEFAULT 0`);
  await db.exec(News.CREATE_NEWS_LIKES_TABLE);
});

const insert = async (extra = {}) => (await News.createNews({
  title: 'Original title', content: 'Original body', imageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/abukonn/news/a.jpg',
  createdBy: 1, ...extra,
}));

test('getNewsOwnership returns author and cover, or null', async () => {
  const a = await insert();
  assert.deepEqual(await News.getNewsOwnership(a.id), { id: a.id, created_by: 1, image_url: a.image_url });
  assert.equal(await News.getNewsOwnership(999999), null);
});

test('updateNews changes only the fields given and never touches category', async () => {
  const a = await insert();
  let row = await News.updateNews(a.id, { title: 'New title' });
  assert.equal(row.title, 'New title');
  assert.equal(row.content, 'Original body');
  assert.equal(row.image_url, a.image_url);
  assert.equal(row.category, 'general');

  row = await News.updateNews(a.id, { title: 'T2', content: 'C2', imageUrl: 'https://res.cloudinary.com/demo/image/upload/v2/abukonn/news/b.jpg' });
  assert.deepEqual([row.title, row.content, row.image_url], ['T2', 'C2', 'https://res.cloudinary.com/demo/image/upload/v2/abukonn/news/b.jpg']);

  row = await News.updateNews(a.id, { imageUrl: null }); // clears the cover
  assert.equal(row.image_url, null);
  assert.equal(row.title, 'T2');
});

test('updateNews: nothing to change is undefined, a missing article is null', async () => {
  const a = await insert();
  assert.equal(await News.updateNews(a.id, {}), undefined);
  assert.equal(await News.updateNews(a.id, { title: '', content: '' }), undefined);
  assert.equal(await News.updateNews(999999, { title: 'x' }), null);
});

test('deleteNews removes the row, returns the cover URL, and cascades likes', async () => {
  const a = await insert();
  await db.query(`INSERT INTO abukonn.news_likes (user_id, news_id) VALUES (2, $1)`, [a.id]);
  const removed = await News.deleteNews(a.id);
  assert.deepEqual(removed, { id: a.id, title: 'Original title', image_url: a.image_url });
  assert.equal((await db.query(`SELECT 1 FROM abukonn.news WHERE id = $1`, [a.id])).rows.length, 0);
  assert.equal((await db.query(`SELECT 1 FROM abukonn.news_likes WHERE news_id = $1`, [a.id])).rows.length, 0);
  assert.equal(await News.deleteNews(a.id), null);
});
