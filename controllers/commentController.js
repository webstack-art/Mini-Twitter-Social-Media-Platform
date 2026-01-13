const Comment = require('../models/Comment');
const Post = require('../models/Post');
const User = require('../models/User');
const Notification = require('../models/Notification');

const createComment = async (req, res) => {
  try {
    const { postId, content, parentId } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ message: 'Content is required' });
    }

    if (content.length > 280) {
      return res.status(400).json({ message: 'Content must be less than 280 characters' });
    }

    // Check if post exists
    const post = await Post.findById(postId);
    if (!post || post.isDeleted) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // If it's a reply to another comment, check if that comment exists
    if (parentId) {
      const parentComment = await Comment.findById(parentId);
      if (!parentComment) {
        return res.status(404).json({ message: 'Parent comment not found' });
      }
    }

    const comment = new Comment({
      postId,
      userId: req.user._id,
      content: content.trim(),
      parentId: parentId || null
    });

    await comment.save();

    // Populate user info for the response
    const populatedComment = await Comment.findById(comment._id)
      .populate('userId', 'username profilePic')
      .exec();

    // Create notification for the post owner (unless it's the same user)
    if (post.userId.toString() !== req.user._id.toString()) {
      const notification = new Notification({
        userId: post.userId,
        senderId: req.user._id,
        type: 'comment',
        postId: post._id,
        commentId: comment._id,
        message: `${req.user.username} commented on your post`
      });
      await notification.save();

      // Emit notification via socket.io if available
      if (global.io) {
        global.io.to(post.userId.toString()).emit('notification', {
          notification: notification.toObject()
        });
      }
    }

    // If this is a reply to another comment, notify the original comment author
    if (parentId) {
      const parentComment = await Comment.findById(parentId).populate('userId', '_id');
      if (parentComment && parentComment.userId.toString() !== req.user._id.toString() 
          && parentComment.userId.toString() !== post.userId.toString()) {
        
        const notification = new Notification({
          userId: parentComment.userId,
          senderId: req.user._id,
          type: 'comment',
          postId: post._id,
          commentId: comment._id,
          message: `${req.user.username} replied to your comment`
        });
        await notification.save();

        // Emit notification via socket.io if available
        if (global.io) {
          global.io.to(parentComment.userId.toString()).emit('notification', {
            notification: notification.toObject()
          });
        }
      }
    }

    res.status(201).json(populatedComment);
  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getCommentsForPost = async (req, res) => {
  try {
    const { postId } = req.params;

    // Check if post exists
    const post = await Post.findById(postId);
    if (!post || post.isDeleted) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const comments = await Comment.find({ 
      postId, 
      isDeleted: false,
      parentId: null // Only root comments, not replies
    })
    .populate('userId', 'username profilePic')
    .sort({ createdAt: -1 });

    // For each root comment, also get its replies
    for (let i = 0; i < comments.length; i++) {
      comments[i].replies = await Comment.find({
        parentId: comments[i]._id,
        isDeleted: false
      })
      .populate('userId', 'username profilePic')
      .sort({ createdAt: 1 }); // Replies sorted chronologically
    }

    res.json(comments);
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ message: 'Content is required' });
    }

    if (content.length > 280) {
      return res.status(400).json({ message: 'Content must be less than 280 characters' });
    }

    const comment = await Comment.findById(id);

    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    if (comment.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this comment' });
    }

    if (comment.isDeleted) {
      return res.status(400).json({ message: 'Cannot update a deleted comment' });
    }

    comment.content = content.trim();
    await comment.save();

    const updatedComment = await Comment.findById(comment._id)
      .populate('userId', 'username profilePic')
      .exec();

    res.json(updatedComment);
  } catch (error) {
    console.error('Update comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteComment = async (req, res) => {
  try {
    const { id } = req.params;

    const comment = await Comment.findById(id);

    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    if (comment.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this comment' });
    }

    // Instead of deleting, mark as deleted (soft delete)
    comment.isDeleted = true;
    await comment.save();

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const likeComment = async (req, res) => {
  try {
    const { id } = req.params;

    const comment = await Comment.findById(id);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Check if user already liked the comment
    const alreadyLiked = comment.likes.includes(req.user._id);
    if (alreadyLiked) {
      return res.status(400).json({ message: 'Comment already liked' });
    }

    // Add user to likes array
    comment.likes.push(req.user._id);
    await comment.save();

    // Create notification for the comment owner (unless it's the same user)
    if (comment.userId.toString() !== req.user._id.toString()) {
      const notification = new Notification({
        userId: comment.userId,
        senderId: req.user._id,
        type: 'like',
        commentId: comment._id,
        message: `${req.user.username} liked your comment`
      });
      await notification.save();

      // Emit notification via socket.io if available
      if (global.io) {
        global.io.to(comment.userId.toString()).emit('notification', {
          notification: notification.toObject()
        });
      }
    }

    // Populate user info for the response
    const updatedComment = await Comment.findById(comment._id)
      .populate('userId', 'username profilePic')
      .exec();

    res.json(updatedComment);
  } catch (error) {
    console.error('Like comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const unlikeComment = async (req, res) => {
  try {
    const { id } = req.params;

    const comment = await Comment.findById(id);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Check if user has liked the comment
    const likedIndex = comment.likes.indexOf(req.user._id);
    if (likedIndex === -1) {
      return res.status(400).json({ message: 'Comment not liked' });
    }

    // Remove user from likes array
    comment.likes.splice(likedIndex, 1);
    await comment.save();

    // Populate user info for the response
    const updatedComment = await Comment.findById(comment._id)
      .populate('userId', 'username profilePic')
      .exec();

    res.json(updatedComment);
  } catch (error) {
    console.error('Unlike comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createComment,
  getCommentsForPost,
  updateComment,
  deleteComment,
  likeComment,
  unlikeComment
};