const express = require('express');
const { 
  createPost,
  getPost,
  updatePost,
  deletePost,
  getUserPosts,
  getTimeline,
  likePost,
  unlikePost
} = require('../controllers/postController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.post('/', auth, createPost);
router.get('/:id', getPost);
router.put('/:id', auth, updatePost);
router.delete('/:id', auth, deletePost);
router.get('/user/:id', getUserPosts);
router.get('/', auth, getTimeline);
router.post('/:id/like', auth, likePost);
router.delete('/:id/like', auth, unlikePost);

module.exports = router;