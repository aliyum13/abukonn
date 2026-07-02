const express = require('express');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const { verifyFileSignature } = require('../middleware/verifyFileSignature');
const {
  createPost,
  getFeed,
  getFollowingFeed,
  getSinglePost,
  likePost,
  addComment,
  getComments,
  deletePost,
  getReplies,
  addReply,
  repostPost,
  viewPost,
  voteOnPoll,
  toggleRSVP,
  setBestAnswer,
} = require('../controllers/postController');

const router = express.Router();

router.use(auth);

router.get('/', getFeed);
router.get('/following', getFollowingFeed);
router.post('/', upload.single('image'), verifyFileSignature, createPost);
router.get('/:id', getSinglePost);
router.post('/:id/like', likePost);
router.get('/:id/comments', getComments);
router.post('/:id/comments', addComment);
router.delete('/:id', deletePost);
router.post('/:id/repost', repostPost);
router.post('/:id/view', viewPost);
router.post('/:id/vote', voteOnPoll);
router.post('/:id/rsvp', toggleRSVP);
router.get('/:id/comments/:commentId/replies', getReplies);
router.post('/:id/comments/:commentId/replies', addReply);
router.post('/:id/comments/:commentId/best-answer', setBestAnswer);

module.exports = router;
