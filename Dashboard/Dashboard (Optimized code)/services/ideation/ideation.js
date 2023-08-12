const express = require('express');
const IdeationPost = require('../../models/ideation_post');
const IdeationLikeDislike = require('../../models/post_like_dislike');
const PostComment = require('../../models/post_comment');
const escapeHtml = require('escape-html');
const const_config = require('../../utility/util');
const Logger = require('../../configs/log');
const logger = new Logger('post');
const path = require('path');
const moment = require('moment-timezone');
const Uuid = require('uuid');

// Done
const TopFiveLikedPosts = async (req, res, next) => {
  try {
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;

    let { from, to } = req.query;

    if (from === undefined || from === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'From is required',
        field: 'from',
      });
    }

    if (to === undefined || to === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'From is required',
        field: 'to',
      });
    }

    let jDateToday = new Date(from);
    let jDateTill = new Date(to);
    let time_zone = req.timezone;

    let time_zone_name = moment.tz(time_zone).format('Z');

    let time_zone_name_char = time_zone_name.charAt(0);
    let till;
    if ('+' === time_zone_name_char) {
      let local_date_from = moment(jDateToday).tz(time_zone);
      let local_date_till = moment(jDateTill).tz(time_zone);
      from = local_date_from.startOf('day').toDate();
      till = local_date_till.endOf('day').toDate();
    } else {
      from = moment(jDateToday)
        .tz(time_zone)
        .format('YYYY-MM-DDTHH:mm:ss.SSS[Z]');
      till = moment(jDateTill)
        .endOf('day')
        .tz(time_zone)
        .format('YYYY-MM-DDTHH:mm:ss.SSS[Z]');
      from = new Date(from);
      till = new Date(till);
    }
    logger.debug('From', from);
    logger.debug('Till', till);

    let query = {
      organization: organization,
      createdAt: {
        $gte: from,
        $lt: till,
      },
    };

    let topLikedPosts = await IdeationPost.aggregate([
      {
        $match: query,
      },
      { $sort: { like_count: -1 } },
      { $limit: 10 },
    ]);
    if (topLikedPosts.length > 0) {
      return res.status(200).json({
        message: 'Top five liked comments fetched successfully',
        data: topLikedPosts,
      });
    } else {
      return res.status(404).json({
        code: 'BAD_REQUEST_ERROR',
        description: 'No data found in the system',
      });
    }
  } catch (error) {
    logger.error(error);
    return res.status(500).json({
      code: 'SERVER_ERROR',
      description: 'Something went wrong, please try again',
    });
  }
};
// Done
const TopFiveDislikedPosts = async (req, res, next) => {
  try {
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;

    let { from, to } = req.query;

    if (from === undefined || from === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'From is required',
        field: 'from',
      });
    }

    if (to === undefined || to === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'From is required',
        field: 'to',
      });
    }

    let jDateToday = new Date(from);
    let jDateTill = new Date(to);
    let time_zone = req.timezone;

    let time_zone_name = moment.tz(time_zone).format('Z');

    let time_zone_name_char = time_zone_name.charAt(0);
    let till;
    if ('+' === time_zone_name_char) {
      let local_date_from = moment(jDateToday).tz(time_zone);
      let local_date_till = moment(jDateTill).tz(time_zone);
      from = local_date_from.startOf('day').toDate();
      till = local_date_till.endOf('day').toDate();
    } else {
      from = moment(jDateToday)
        .tz(time_zone)
        .format('YYYY-MM-DDTHH:mm:ss.SSS[Z]');
      till = moment(jDateTill)
        .endOf('day')
        .tz(time_zone)
        .format('YYYY-MM-DDTHH:mm:ss.SSS[Z]');
      from = new Date(from);
      till = new Date(till);
    }
    logger.debug('From', from);
    logger.debug('Till', till);

    let query = {
      organization: organization,
      createdAt: {
        $gte: from,
        $lt: till,
      },
    };

    let topDislikedPosts = await IdeationPost.aggregate([
      {
        $match: query,
      },
      { $sort: { dislike_count: -1 } },
      { $limit: 10 },
    ]);
    if (topDislikedPosts.length > 0) {
      return res.status(200).json({
        message: 'Top five disliked comments fetched successfully',
        data: topDislikedPosts,
      });
    } else {
      return res.status(404).json({
        code: 'BAD_REQUEST_ERROR',
        description: 'No data found in the system',
      });
    }
  } catch (error) {
    logger.error(error);
    return res.status(500).json({
      code: 'SERVER_ERROR',
      description: 'Something went wrong, please try again',
    });
  }
};

const postAnalytics = async (req, res, next) => {
  try {
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;

    let { from, to } = req.query;

    if (from === undefined || from === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'From is required',
        field: 'from',
      });
    }

    if (to === undefined || to === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'From is required',
        field: 'to',
      });
    }

    let jDateToday = new Date(from);
    let jDateTill = new Date(to);
    let time_zone = req.timezone;

    let time_zone_name = moment.tz(time_zone).format('Z');

    let time_zone_name_char = time_zone_name.charAt(0);
    let till;
    if ('+' === time_zone_name_char) {
      let local_date_from = moment(jDateToday).tz(time_zone);
      let local_date_till = moment(jDateTill).tz(time_zone);
      from = local_date_from.startOf('day').toDate();
      till = local_date_till.endOf('day').toDate();
    } else {
      from = moment(jDateToday)
        .tz(time_zone)
        .format('YYYY-MM-DDTHH:mm:ss.SSS[Z]');
      till = moment(jDateTill)
        .endOf('day')
        .tz(time_zone)
        .format('YYYY-MM-DDTHH:mm:ss.SSS[Z]');
      from = new Date(from);
      till = new Date(till);
    }

    let query = {
      organization: organization,
      createdAt: {
        $gte: from,
        $lt: till,
      },
    };
    let imageQuery = {
      organization: organization,
      file_type: 'IMAGE',
      createdAt: {
        $gte: from,
        $lt: till,
      },
    };
    let videoQuery = {
      organization: organization,
      file_type: 'VIDEO',
      createdAt: {
        $gte: from,
        $lt: till,
      },
    };

    let [
      totalPosts,
      totalLikes,
      totalDislikes,
      imageCount,
      videoCount,
      totalComment,
    ] = await Promise.all([
      IdeationPost.countDocuments(query),
      IdeationPost.aggregate([
        {
          $match: query,
        },
        {
          $group: {
            _id: null,
            total_likes: {
              $sum: '$like_count',
            },
          },
        },
      ]),
      IdeationPost.aggregate([
        {
          $match: query,
        },
        {
          $group: {
            _id: null,
            total_likes: {
              $sum: '$dislike_count',
            },
          },
        },
      ]),
      IdeationPost.countDocuments(imageQuery),
      IdeationPost.countDocuments(videoQuery),
      PostComment.aggregate([
        {
          $match: query,
        },
        { $unwind: '$comment' },
        {
          $project: {
            count: { $size: '$comment.reply' },
          },
        },
      ]),
    ]);
    let likeCount = 0;
    let dislikeCount = 0;
    if (totalLikes.length === 0) {
    } else {
      likeCount = totalLikes[0].total_likes;
    }
    if (totalDislikes.length === 0) {
    } else {
      dislikeCount = totalDislikes[0].total_likes;
    }

    let data = 0;
    for (let i = 0; i < totalComment.length; i++) {
      data = data + totalComment[i].count;
    }

    return res.status(200).json({
      message: 'Posts analytics fetched successfully',
      totalPosts: totalPosts,
      totalLikes: likeCount,
      totalDislikes: dislikeCount,
      imageCount: imageCount,
      videoCount: videoCount,
      totalComment: totalComment.length + data,
    });
  } catch (error) {
    logger.error(error);
    return res.status(500).json({
      code: 'SERVER_ERROR',
      description: 'Something went wrong, please try again',
    });
  }
};

const postsWithMostComments = async (req, res, next) => {
  try {
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;

    let { from, to } = req.query;

    if (from === undefined || from === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'From is required',
        field: 'from',
      });
    }

    if (to === undefined || to === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'From is required',
        field: 'to',
      });
    }

    let jDateToday = new Date(from);
    let jDateTill = new Date(to);
    let time_zone = req.timezone;

    let time_zone_name = moment.tz(time_zone).format('Z');

    let time_zone_name_char = time_zone_name.charAt(0);
    let till;
    if ('+' === time_zone_name_char) {
      let local_date_from = moment(jDateToday).tz(time_zone);
      let local_date_till = moment(jDateTill).tz(time_zone);
      from = local_date_from.startOf('day').toDate();
      till = local_date_till.endOf('day').toDate();
    } else {
      from = moment(jDateToday)
        .tz(time_zone)
        .format('YYYY-MM-DDTHH:mm:ss.SSS[Z]');
      till = moment(jDateTill)
        .endOf('day')
        .tz(time_zone)
        .format('YYYY-MM-DDTHH:mm:ss.SSS[Z]');
      from = new Date(from);
      till = new Date(till);
    }
    logger.debug('From', from);
    logger.debug('Till', till);

    let query = {
      organization: organization,
      createdAt: {
        $gte: from,
        $lt: till,
      },
    };

    let postsWithMostComments = await IdeationPost.aggregate([
      {
        $match: query,
      },
      {
        $lookup: {
          from: 'ideationcomments',
          let: {
            uuid: '$uuid',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$uuid', '$$uuid'] }],
                },
              },
            },
            { $unwind: '$comment' },
          ],
          as: 'data',
        },
      },
      {
        $addFields: {
          commentCount: {
            $size: '$data',
          },
        },
      },
      { $sort: { commentCount: -1 } },
      { $limit: 10 },
    ]);

    return res.status(200).json({
      message: 'Posts with most comments fetched successfully',
      data: postsWithMostComments,
    });
  } catch (error) {
    logger.error(error);
    return res.status(500).json({
      code: 'SERVER_ERROR',
      description: 'Something went wrong, please try again',
    });
  }
};

const topLikeComments = async (req, res, next) => {
  try {
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;

    let { from, to } = req.query;

    if (from === undefined || from === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'From is required',
        field: 'from',
      });
    }

    if (to === undefined || to === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'From is required',
        field: 'to',
      });
    }

    let jDateToday = new Date(from);
    let jDateTill = new Date(to);
    let time_zone = req.timezone;

    let time_zone_name = moment.tz(time_zone).format('Z');

    let time_zone_name_char = time_zone_name.charAt(0);
    let till;
    if ('+' === time_zone_name_char) {
      let local_date_from = moment(jDateToday).tz(time_zone);
      let local_date_till = moment(jDateTill).tz(time_zone);
      from = local_date_from.startOf('day').toDate();
      till = local_date_till.endOf('day').toDate();
    } else {
      from = moment(jDateToday)
        .tz(time_zone)
        .format('YYYY-MM-DDTHH:mm:ss.SSS[Z]');
      till = moment(jDateTill)
        .endOf('day')
        .tz(time_zone)
        .format('YYYY-MM-DDTHH:mm:ss.SSS[Z]');
      from = new Date(from);
      till = new Date(till);
    }
    logger.debug('From', from);
    logger.debug('Till', till);

    let query = {
      organization: organization,
      createdAt: {
        $gte: from,
        $lt: till,
      },
    };

    let topLikeComments = await PostComment.aggregate([
      {
        $match: query,
      },
      { $unwind: '$comment' },
      { $sort: { 'comment.like_count': -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'ideationposts',
          let: {
            uuid: '$uuid',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$uuid', '$$uuid'] }],
                },
              },
            },
          ],
          as: 'post',
        },
      },
      { $unwind: '$post' },
    ]);

    return res.status(200).json({
      message: 'Top Like comments fetched successfully',
      data: topLikeComments,
    });
  } catch (error) {
    logger.error(error);
    return res.status(500).json({
      code: 'SERVER_ERROR',
      description: 'Something went wrong, please try again',
    });
  }
};

module.exports = {
  TopFiveLikedPosts: TopFiveLikedPosts,
  TopFiveDislikedPosts: TopFiveDislikedPosts,
  postsWithMostComments: postsWithMostComments,
  postAnalytics: postAnalytics,
  topLikeComments: topLikeComments,
};
