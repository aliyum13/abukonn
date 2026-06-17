const express = require('express');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
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
router.post('/', upload.single('image'), createPost);
router.post('/:id/like', likePost);
router.post('/:id/comments', addComment);
router.delete('/:id', deletePost);

module.exports = router;
