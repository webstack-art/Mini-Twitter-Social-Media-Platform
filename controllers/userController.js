const User = require('../models/User');
const Post = require('../models/Post');

const getUserProfile = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get user's posts count
    const postsCount = await Post.countDocuments({ userId: id, isDeleted: false });

    res.json({
      ...user.toObject(),
      postsCount,
      followers: user.followers.length,
      following: user.following.length
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateUserProfile = async (req, res) => {
  try {
    const { bio, profilePic, coverPic } = req.body;
    
    const updatedFields = {};
    if (bio !== undefined) updatedFields.bio = bio;
    if (profilePic !== undefined) updatedFields.profilePic = profilePic;
    if (coverPic !== undefined) updatedFields.coverPic = coverPic;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updatedFields,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Update user profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const followUser = async (req, res) => {
  try {
    const { id } = req.params;
    const userIdToFollow = id;

    // Check if user is trying to follow themselves
    if (req.user._id.toString() === userIdToFollow) {
      return res.status(400).json({ message: 'You cannot follow yourself' });
    }

    // Check if both users exist
    const userToFollow = await User.findById(userIdToFollow);
    if (!userToFollow) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if already following
    const isFollowing = req.user.following.includes(userIdToFollow);
    if (isFollowing) {
      return res.status(400).json({ message: 'Already following this user' });
    }

    // Update both users
    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { following: userIdToFollow }
    });

    await User.findByIdAndUpdate(userIdToFollow, {
      $addToSet: { followers: req.user._id }
    });

    // TODO: Create notification for the user being followed
    // This would involve creating a notification and emitting via socket.io
    // if (global.io) {
    //   global.io.to(userIdToFollow).emit('notification', {
    //     message: `${req.user.username} started following you`,
    //     type: 'follow'
    //   });
    // }

    res.json({ message: 'Successfully followed user' });
  } catch (error) {
    console.error('Follow user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const unfollowUser = async (req, res) => {
  try {
    const { id } = req.params;
    const userIdToUnfollow = id;

    // Check if already not following
    const isFollowing = req.user.following.includes(userIdToUnfollow);
    if (!isFollowing) {
      return res.status(400).json({ message: 'Not following this user' });
    }

    // Update both users
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { following: userIdToUnfollow }
    });

    await User.findByIdAndUpdate(userIdToUnfollow, {
      $pull: { followers: req.user._id }
    });

    res.json({ message: 'Successfully unfollowed user' });
  } catch (error) {
    console.error('Unfollow user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getUserFollowers = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id).populate('followers', 'username profilePic');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user.followers);
  } catch (error) {
    console.error('Get user followers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getUserFollowing = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id).populate('following', 'username profilePic');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user.following);
  } catch (error) {
    console.error('Get user following error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getUserProfile,
  updateUserProfile,
  followUser,
  unfollowUser,
  getUserFollowers,
  getUserFollowing
};