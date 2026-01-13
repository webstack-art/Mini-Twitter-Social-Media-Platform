const express = require('express');
const { 
  createComment,
  getCommentsForPost,
  updateComment,
  deleteComment,
  likeComment,
  unlikeComment
} = require('../controllers/commentController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.post('/', auth, createComment);
router.get('/post/:postId', getCommentsForPost);
router.put('/:id', auth, updateComment);
router.delete('/:id', auth, deleteComment);
router.post('/:id/like', auth, likeComment);
router.delete('/:id/like', auth, unlikeComment);

module.exports = router;