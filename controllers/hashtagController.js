const Post = require('../models/Post');

const getTrendingHashtags = async (req, res) => {
  try {
    // Get posts from the last 24 hours
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const posts = await Post.find({
      createdAt: { $gte: yesterday },
      isDeleted: false
    }).select('hashtags likes');

    // Count occurrences of each hashtag
    const hashtagCount = {};
    
    posts.forEach(post => {
      post.hashtags.forEach(hashtag => {
        if (!hashtagCount[hashtag]) {
          hashtagCount[hashtag] = { count: 0, engagement: 0 };
        }
        hashtagCount[hashtag].count += 1;
        hashtagCount[hashtag].engagement += post.likes.length; // Add likes as engagement
      });
    });

    // Convert to array and sort by total activity (posts + engagement)
    const trendingHashtags = Object.keys(hashtagCount)
      .map(tag => ({
        tag,
        count: hashtagCount[tag].count,
        engagement: hashtagCount[tag].engagement,
        totalActivity: hashtagCount[tag].count + hashtagCount[tag].engagement
      }))
      .sort((a, b) => b.totalActivity - a.totalActivity)
      .slice(0, 20); // Top 20 trending hashtags

    res.json(trendingHashtags);
  } catch (error) {
    console.error('Get trending hashtags error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getPostsByHashtag = async (req, res) => {
  try {
    const { tag } = req.params;

    const posts = await Post.find({
      hashtags: { $regex: new RegExp(`^${tag}$`, 'i') }, // Case insensitive exact match
      isDeleted: false
    })
    .populate('userId', 'username profilePic')
    .sort({ createdAt: -1 })
    .limit(50);

    res.json(posts);
  } catch (error) {
    console.error('Get posts by hashtag error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getTrendingHashtags,
  getPostsByHashtag
};