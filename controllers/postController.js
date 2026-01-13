const Post = require('../models/Post');
const User = require('../models/User');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');

// Helper function to extract hashtags and mentions from content
const extractHashtagsAndMentions = (content) => {
  const hashtags = content.match(/#[a-zA-Z0-9_]+/g) || [];
  const mentions = content.match(/@[a-zA-Z0-9_]+/g) || [];
  
  return {
    hashtags: hashtags.map(tag => tag.substring(1).toLowerCase()), // remove # and lowercase
    mentions: mentions.map(mention => mention.substring(1).toLowerCase()) // remove @ and lowercase
  };
};

const createPost = async (req, res) => {
  try {
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ message: 'Content is required' });
    }

    if (content.length > 280) {
      return res.status(400).json({ message: 'Content must be less than 280 characters' });
    }

    const { hashtags, mentions } = extractHashtagsAndMentions(content);

    const post = new Post({
      userId: req.user._id,
      content: content.trim(),
      hashtags,
      mentions
    });

    await post.save();

    // Populate user info for the response
    const populatedPost = await Post.findById(post._id)
      .populate('userId', 'username profilePic')
      .exec();

    // Notify mentioned users
    if (mentions.length > 0) {
      for (const mention of mentions) {
        const mentionedUser = await User.findOne({ username: mention });
        if (mentionedUser) {
          const notification = new Notification({
            userId: mentionedUser._id,
            senderId: req.user._id,
            type: 'mention',
            postId: post._id,
            message: `${req.user.username} mentioned you in a post`
          });
          await notification.save();

          // Emit notification via socket.io if available
          if (global.io) {
            global.io.to(mentionedUser._id.toString()).emit('notification', {
              notification: notification.toObject()
            });
          }
        }
      }
    }

    res.status(201).json(populatedPost);
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getPost = async (req, res) => {
  try {
    const { id } = req.params;

    const post = await Post.findById(id)
      .populate('userId', 'username profilePic')
      .populate({
        path: 'comments',
        populate: {
          path: 'userId',
          select: 'username profilePic'
        }
      })
      .exec();

    if (!post || post.isDeleted) {
      return res.status(404).json({ message: 'Post not found' });
    }

    res.json(post);
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updatePost = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (content && content.length > 280) {
      return res.status(400).json({ message: 'Content must be less than 280 characters' });
    }

    const post = await Post.findById(id);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (post.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this post' });
    }

    if (content) {
      const { hashtags, mentions } = extractHashtagsAndMentions(content);
      
      post.content = content.trim();
      post.hashtags = hashtags;
      post.mentions = mentions;
    }

    await post.save();

    const updatedPost = await Post.findById(post._id)
      .populate('userId', 'username profilePic')
      .exec();

    res.json(updatedPost);
  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deletePost = async (req, res) => {
  try {
    const { id } = req.params;

    const post = await Post.findById(id);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (post.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this post' });
    }

    // Instead of deleting, mark as deleted (soft delete)
    post.isDeleted = true;
    await post.save();

    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getUserPosts = async (req, res) => {
  try {
    const { id } = req.params;

    const posts = await Post.find({ 
      userId: id, 
      isDeleted: false 
    })
    .populate('userId', 'username profilePic')
    .sort({ createdAt: -1 })
    .limit(50); // Limit to prevent too many results

    res.json(posts);
  } catch (error) {
    console.error('Get user posts error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getTimeline = async (req, res) => {
  try {
    // Get IDs of users that the current user is following
    const user = await User.findById(req.user._id).populate('following');
    const followingIds = user.following.map(u => u._id);
    // Include the user's own ID to see their own posts
    followingIds.push(req.user._id);

    const posts = await Post.find({ 
      userId: { $in: followingIds },
      isDeleted: false
    })
    .populate('userId', 'username profilePic')
    .sort({ createdAt: -1 })
    .limit(50);

    res.json(posts);
  } catch (error) {
    console.error('Get timeline error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const likePost = async (req, res) => {
  try {
    const { id } = req.params;

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Check if user already liked the post
    const alreadyLiked = post.likes.includes(req.user._id);
    if (alreadyLiked) {
      return res.status(400).json({ message: 'Post already liked' });
    }

    // Add user to likes array
    post.likes.push(req.user._id);
    await post.save();

    // Create notification for the post owner (unless it's the same user)
    if (post.userId.toString() !== req.user._id.toString()) {
      const notification = new Notification({
        userId: post.userId,
        senderId: req.user._id,
        type: 'like',
        postId: post._id,
        message: `${req.user.username} liked your post`
      });
      await notification.save();

      // Emit notification via socket.io if available
      if (global.io) {
        global.io.to(post.userId.toString()).emit('notification', {
          notification: notification.toObject()
        });
      }
    }

    // Populate user info for the response
    const updatedPost = await Post.findById(post._id)
      .populate('userId', 'username profilePic')
      .exec();

    res.json(updatedPost);
  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const unlikePost = async (req, res) => {
  try {
    const { id } = req.params;

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Check if user has liked the post
    const likedIndex = post.likes.indexOf(req.user._id);
    if (likedIndex === -1) {
      return res.status(400).json({ message: 'Post not liked' });
    }

    // Remove user from likes array
    post.likes.splice(likedIndex, 1);
    await post.save();

    // Populate user info for the response
    const updatedPost = await Post.findById(post._id)
      .populate('userId', 'username profilePic')
      .exec();

    res.json(updatedPost);
  } catch (error) {
    console.error('Unlike post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createPost,
  getPost,
  updatePost,
  deletePost,
  getUserPosts,
  getTimeline,
  likePost,
  unlikePost
};