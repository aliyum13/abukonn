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
  likeCommentHandler,
  deleteCommentHandler,
  updateCommentHandler,
  deletePost,
  updatePost,
  getReplies,
  addReply,
  repostPost,
  unrepostPost,
  viewPost,
  voteOnPoll,
  getPollVotersHandler,
  toggleRSVP,
  setBestAnswer,
  getPostAnalytics,
} = require('../controllers/postController');

const router = express.Router();

router.use(auth);

router.get('/', getFeed);
router.get('/following', getFollowingFeed);
router.get('/analytics', getPostAnalytics);
router.post('/', upload.single('image'), verifyFileSignature, createPost);
router.get('/:id', getSinglePost);
router.post('/:id/like', likePost);
router.get('/:id/comments', getComments);
router.post('/:id/comments', addComment);
router.delete('/:id', deletePost);
router.put('/:id', updatePost);
router.post('/:id/repost', repostPost);
router.delete('/:id/repost', unrepostPost);
router.post('/:id/view', viewPost);
router.post('/:id/vote', voteOnPoll);
router.get('/:id/voters', getPollVotersHandler);
router.post('/:id/rsvp', toggleRSVP);
router.get('/:id/comments/:commentId/replies', getReplies);
router.post('/:id/comments/:commentId/replies', addReply);
router.post('/:id/comments/:commentId/best-answer', setBestAnswer);
router.post('/:id/comments/:commentId/like', likeCommentHandler);
router.delete('/:id/comments/:commentId', deleteCommentHandler);
router.patch('/:id/comments/:commentId', updateCommentHandler);

module.exports = router;
