const express = require('express');
const postService = require('../../services/ideation/ideation');
let router = express.Router();

router.post('/get-top-five-liked-posts', postService.TopFiveLikedPosts);

router.post('/get-top-five-disliked-posts', postService.TopFiveDislikedPosts);

router.post('/posts-with-most-comments', postService.postsWithMostComments);

router.post('/posts-analytics', postService.postAnalytics);

router.post('/top-like-comments', postService.topLikeComments);

module.exports = router;
