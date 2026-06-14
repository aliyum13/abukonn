const express = require('express');
const auth = require('../middleware/auth');
const {
  createPost,
  getFeed,
  likePost,
  addComment,
  deletePost,
} = require('../controllers/postController');

const router = express.Router();

router.use(auth);

router.get('/', getFeed);
router.post('/', createPost);
router.post('/:id/like', likePost);
router.post('/:id/comments', addComment);
router.delete('/:id', deletePost);

module.exports = router;
