const express = require('express');
const { 
  getTrendingHashtags,
  getPostsByHashtag
} = require('../controllers/hashtagController');

const router = express.Router();

router.get('/trending', getTrendingHashtags);
router.get('/:tag', getPostsByHashtag);

module.exports = router;