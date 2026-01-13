const express = require('express');
const { 
  getUserProfile, 
  updateUserProfile, 
  followUser, 
  unfollowUser,
  getUserFollowers,
  getUserFollowing
} = require('../controllers/userController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.get('/:id', getUserProfile);
router.put('/profile', auth, updateUserProfile);
router.post('/:id/follow', auth, followUser);
router.delete('/:id/unfollow', auth, unfollowUser);
router.get('/:id/followers', getUserFollowers);
router.get('/:id/following', getUserFollowing);

module.exports = router;