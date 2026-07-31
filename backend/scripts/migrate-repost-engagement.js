'use strict';

/**
 * One-time migration to consolidate engagement from existing reposts onto the
 * ONE true original post, for the repost-linking fix.
 *
 * Before that fix, a repost behaved like an independent post: likes and
 * comments made on a repost were stored against the repost's own row, so
 * engagement was split across the original and every repost of it. Going
 * forward, all interactions resolve to the canonical original at write time.
 * This migrates the ALREADY-SPLIT historical data to match.
 *
 * For every post that is_repost = TRUE, resolving to its canonical original:
 *   - post_likes: re-point each like row from the repost to the original.
 *     post_likes has PRIMARY KEY (user_id, post_id), so if that user already
 *     liked the original, the re-point would collide -- ON CONFLICT DO NOTHING
 *     drops the duplicate (correct: one person, one like on the original),
 *     and the now-orphaned repost like row is deleted either way.
 *   - comments: re-point each comment row from the repost to the original.
 *     No unique constraint (a user may comment many times), so these all move.
 *   - After re-pointing, every affected post's likes_count / comments_count is
 *     RECOMPUTED from the actual rows (COUNT(*)), not arithmetic'd -- so the
 *     stored counters end up exactly consistent with reality regardless of any
 *     pre-existing drift, double-counts, or partial prior runs.
 *   - repost_count on each canonical original is recomputed as the number of
 *     reposts still pointing at it.
 *
 * Chains (a repost of a repost, from before repostPost resolved transitively)
 * are handled: resolveCanonical walks up to the true root, and every like/
 * comment lands on that root.
 *
 *   node scripts/migrate-repost-engagement.js          # dry run, counts only
 *   node scripts/migrate-repost-engagement.js --apply  # write changes
 *
 * NON-DESTRUCTIVE to posts: reposts themselves are NOT deleted -- they stay as
 * reach/attribution (the whole point of a repost). Only their engagement ROWS
 * move. Safe to re-run: after a successful run there are no likes/comments left
 * pointing at reposts, so a second run finds nothing to move and just
 * re-confirms the counts.
 */

require('dotenv').config();
const pool = require('../src/config/db');

const APPLY = process.argv.includes('--apply');

// Mirror of Post.resolveCanonicalPost, standalone so the script doesn't depend
// on model internals. Walks up the repost chain to the true original, capping
// at 5 hops (cycle/corruption safety net) and stopping at the last existing
// post if a link was deleted.
async function resolveCanonicalId(startId, byId) {
  let current = byId.get(startId);
  let hops = 0;
  while (current && current.is_repost && current.original_post_id && hops < 5) {
    const next = byId.get(current.original_post_id);
    if (!next) break; // original deleted -- stop at last valid
    current = next;
    hops += 1;
  }
  return current ? current.id : startId;
}

async function main() {
  console.log(APPLY ? 'APPLYING — writing changes\n' : 'DRY RUN — no writes (pass --apply to write)\n');

  // Load every post's identity/lineage once, so canonical resolution is pure
  // in-memory (no per-row DB round trips).
  const posts = await pool.query(
    'SELECT id, is_repost, original_post_id FROM abukonn.posts'
  );
  const byId = new Map(posts.rows.map((p) => [p.id, p]));
  const reposts = posts.rows.filter((p) => p.is_repost && p.original_post_id);

  console.log(`total posts:        ${posts.rows.length}`);
  console.log(`reposts:            ${reposts.rows?.length ?? reposts.length}\n`);

  // Build repost.id -> canonical original id for every repost.
  const repostToCanonical = new Map();
  for (const r of reposts) {
    const canonical = await resolveCanonicalId(r.id, byId);
    if (canonical !== r.id) repostToCanonical.set(r.id, canonical);
  }
  const repostIds = [...repostToCanonical.keys()];

  if (repostIds.length === 0) {
    console.log('No reposts with a resolvable original — nothing to migrate.');
    await pool.end();
    return;
  }

  // Count engagement rows currently sitting on reposts (the rows that will move).
  const likeRows = await pool.query(
    'SELECT post_id, user_id FROM abukonn.post_likes WHERE post_id = ANY($1)',
    [repostIds]
  );
  const commentRows = await pool.query(
    'SELECT post_id FROM abukonn.comments WHERE post_id = ANY($1)',
    [repostIds]
  );

  console.log(`likes currently on reposts:     ${likeRows.rows.length}`);
  console.log(`comments currently on reposts:  ${commentRows.rows.length}`);

  // How many like re-points would collide (user already liked the original) and
  // so be dropped rather than moved -- reported so the numbers reconcile.
  const originalLikes = await pool.query(
    'SELECT post_id, user_id FROM abukonn.post_likes WHERE post_id = ANY($1)',
    [[...new Set([...repostToCanonical.values()])]]
  );
  const originalLikeSet = new Set(originalLikes.rows.map((r) => `${r.user_id}:${r.post_id}`));
  let collisions = 0;
  for (const r of likeRows.rows) {
    const canonical = repostToCanonical.get(r.post_id);
    if (originalLikeSet.has(`${r.user_id}:${canonical}`)) collisions++;
  }
  console.log(`  of those likes, ${collisions} already exist on the original (dropped, not double-counted)`);
  console.log(`  ${likeRows.rows.length - collisions} likes would newly move to originals\n`);

  const affectedOriginals = new Set(repostToCanonical.values());
  console.log(`canonical originals affected:   ${affectedOriginals.size}`);
  console.log(`reposts whose engagement moves:  ${repostIds.length}\n`);

  if (!APPLY) {
    console.log('Dry run complete. Re-run with --apply to write.');
    await pool.end();
    return;
  }

  const client = await pool.connect();
  let movedLikes = 0;
  let movedComments = 0;
  try {
    await client.query('BEGIN');

    // Re-point likes one repost at a time. ON CONFLICT DO NOTHING drops a like
    // whose (user, original) already exists; then delete any that remain on the
    // repost (the dropped duplicates), so no like is left pointing at a repost.
    for (const [repostId, canonicalId] of repostToCanonical) {
      const moved = await client.query(
        `INSERT INTO abukonn.post_likes (user_id, post_id, created_at)
         SELECT user_id, $2, created_at FROM abukonn.post_likes WHERE post_id = $1
         ON CONFLICT (user_id, post_id) DO NOTHING`,
        [repostId, canonicalId]
      );
      movedLikes += moved.rowCount;
      await client.query('DELETE FROM abukonn.post_likes WHERE post_id = $1', [repostId]);

      const movedC = await client.query(
        'UPDATE abukonn.comments SET post_id = $2 WHERE post_id = $1',
        [repostId, canonicalId]
      );
      movedComments += movedC.rowCount;
    }

    // Recompute counters from actual rows for every affected original AND every
    // repost (reposts should now read 0 for likes/comments). Recompute, don't
    // arithmetic -- guarantees consistency with the real rows regardless of any
    // prior drift.
    const allAffected = [...new Set([...affectedOriginals, ...repostIds])];
    await client.query(
      `UPDATE abukonn.posts p SET
         likes_count = (SELECT COUNT(*) FROM abukonn.post_likes pl WHERE pl.post_id = p.id),
         comments_count = (SELECT COUNT(*) FROM abukonn.comments c WHERE c.post_id = p.id)
       WHERE p.id = ANY($1)`,
      [allAffected]
    );

    // Recompute repost_count on each canonical original as the number of
    // reposts still pointing at it.
    await client.query(
      `UPDATE abukonn.posts p SET
         repost_count = (SELECT COUNT(*) FROM abukonn.posts r WHERE r.is_repost = TRUE AND r.original_post_id = p.id)
       WHERE p.id = ANY($1)`,
      [[...affectedOriginals]]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  console.log(`Done. Moved ${movedLikes} likes and ${movedComments} comments onto originals.`);
  console.log('Recomputed likes_count / comments_count / repost_count on all affected posts.');
  await pool.end();
}

main().catch(async (err) => {
  console.error('Migration failed:', err.message);
  try { await pool.end(); } catch { /* ignore */ }
  process.exitCode = 1;
});
