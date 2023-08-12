const PointDistribution = require('../../models/point_distribution');
const Logger = require('../../configs/log');
const logger = new Logger('leaderboard_configuration');
const moment = require('moment-timezone');

const getUserLeaderboardData = async (req, res, next) => {
  try {
    let organization = req.organization;
    let department = req.department;
    let leaderBoardType = req.body.leaderBoardType; // CAN BE ORGANIZATION, DEPARTMENT OR MANAGER
    let limit = req.body.limit || 10;
    let skip = req.body.skip || 0;
    let from = req.body.from;
    let to = req.body.to;
    let time_zone = req.timezone;
    let assigned_to = req.body.assigned_to;
    let performer_type = req.body.performer_type || 'TOP_PERFORMER'; // CAN BE ONLY TOP_PERFORMER & LOW_PERFORMER
    let searchType =
      req.body.searchType != undefined
        ? req.body.searchType.toUpperCase()
        : 'USERNAME'; // CAN BE ONLY USERNAME & RANK
    let searchValue = req.body.searchValue;

    leaderBoardType = leaderBoardType.toUpperCase();
    performer_type = performer_type.toUpperCase();

    // VALIDATIONS CHECK
    if (organization === undefined || organization === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Organization is required',
        field: 'organization',
      });
    }

    if (leaderBoardType === undefined || leaderBoardType === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'leaderBoardType is required',
        field: 'leaderBoardType',
      });
    }

    if (
      !leaderBoardType.includes('ORGANIZATION') &&
      !leaderBoardType.includes('DEPARTMENT') &&
      !leaderBoardType.includes('MANAGER')
    ) {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description:
          'allowed values are only DEPARTMENT, ORGANIZATION & MANAGER',
        field: 'leaderBoardType',
      });
    }

    if (
      leaderBoardType === 'DEPARTMENT' &&
      (department === undefined || department === '')
    ) {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Department is required',
        field: 'department',
      });
    }

    if (
      leaderBoardType === 'MANAGER' &&
      (assigned_to === undefined || assigned_to === '')
    ) {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'assigned_to is required',
        field: 'assigned_to',
      });
    }

    if (
      !performer_type.includes('TOP_PERFORMER') &&
      !performer_type.includes('LOW_PERFORMER')
    ) {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'allowed values are only top_performer and low_performer',
        field: 'performer_type',
      });
    }

    if (from === undefined || from === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'from is required',
        field: 'from',
      });
    }

    if (to === undefined || to === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'to is required',
        field: 'to',
      });
    }

    if (searchType != 'USERNAME' && searchType != 'RANK') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'searchType must be USERNAME or RANK',
        field: 'searchType',
      });
    }

    from = new Date(from);
    to = new Date(to);
    let time_zone_name = moment.tz(time_zone).format('Z');
    let time_zone_name_char = time_zone_name.charAt(0);
    let till;

    if ('+' === time_zone_name_char) {
      let local_date_from = moment(from).tz(time_zone);
      let local_date_till = moment(to).tz(time_zone);
      from = local_date_from.startOf('day').toDate();
      till = local_date_till.endOf('day').toDate();
    } else {
      from = moment(from).tz(time_zone).format('YYYY-MM-DDTHH:mm:ss.SSS[Z]');
      till = moment(to)
        .endOf('day')
        .tz(time_zone)
        .format('YYYY-MM-DDTHH:mm:ss.SSS[Z]');
    }

    logger.debug('From', from);
    logger.debug('Till', till);

    // QUERY
    // FOR ORGANIZATION LEVEL
    let matchQuery = {
      createdAt: {
        $gte: from,
        $lt: till,
      },
      organization: organization,
    };
    // FOR DEPARTMENT
    if (leaderBoardType === 'DEPARTMENT') {
      matchQuery = {
        createdAt: {
          $gte: from,
          $lt: till,
        },
        organization: organization,
        department: department,
      };
    } else if (leaderBoardType === 'MANAGER') {
      matchQuery = {
        createdAt: {
          $gte: from,
          $lt: till,
        },
        organization: organization,
        assigned_to: assigned_to,
      };
    }

    let pipeline = [
      {
        $match: matchQuery,
      },
      {
        $group: {
          _id: '$user_email',
          total_points: { $sum: '$total_points' },
          point_distribution_data: { $first: '$$ROOT' },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: 'user_email',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $setWindowFields: {
          // partitionBy: "$user",
          sortBy: { total_points: -1 },
          output: { rank: { $denseRank: {} } },
        },
      },
      {
        $project: {
          _id: 0,
          user_email: '$point_distribution_data.user_email',
          user_name: '$user.user_name',
          photo_url: '$user.photo_url',
          organization: '$point_distribution_data.organization',
          department: '$point_distribution_data.department',
          denotation: '$point_distribution_data.denotation',
          assigned_to: '$point_distribution_data.assigned_to',
          total_points: 1,
          rank: '$rank',
        },
      },
      { $sort: { total_points: -1, user_email: 1 } },
    ];

    let topThreePipeline = [
      {
        $match: matchQuery,
      },
      {
        $group: {
          _id: '$user_email',
          total_points: { $sum: '$total_points' },
          point_distribution_data: { $first: '$$ROOT' },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: 'user_email',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $setWindowFields: {
          // partitionBy: "$user",
          sortBy: { total_points: -1 },
          output: { rank: { $denseRank: {} } },
        },
      },
      {
        $project: {
          _id: 0,
          user_email: '$point_distribution_data.user_email',
          user_name: '$user.user_name',
          photo_url: '$user.photo_url',
          organization: '$point_distribution_data.organization',
          department: '$point_distribution_data.department',
          denotation: '$point_distribution_data.denotation',
          assigned_to: '$point_distribution_data.assigned_to',
          total_points: 1,
          rank: '$rank',
        },
      },
      { $sort: { total_points: -1, user_email: 1 } },
      { $skip: 0 },
      { $limit: 3 },
    ];

    // FOR LOW PERFORMER
    if (performer_type === 'LOW_PERFORMER') {
      pipeline[6] = {
        $sort: { total_points: 1, user_email: 1 },
      };
    }

    if (
      searchType === 'USERNAME' &&
      searchValue != undefined &&
      searchValue != ''
    ) {
      pipeline.splice(7, 0, {
        $match: {
          user_name: {
            $regex: RegExp(searchValue),
            $options: 'i',
          },
        },
      });
    }

    if (
      searchType === 'RANK' &&
      searchValue != undefined &&
      searchValue != ''
    ) {
      pipeline.splice(7, 0, {
        $match: { rank: +searchValue },
      });
    }

    const userCount = new Promise((resolve, reject) => {
      pipeline.push({ $count: 'totalCount' });
      let totalCount = PointDistribution.aggregate(pipeline);
      pipeline.pop();
      resolve(totalCount);
    });

    const userData = new Promise((resolve, reject) => {
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: limit });
      let users = PointDistribution.aggregate(pipeline);
      resolve(users);
    });

    let [users, totalCount, topThree] = await Promise.all([
      userData,
      userCount,
      PointDistribution.aggregate(topThreePipeline),
    ]);

    return res.status(200).json({
      message: 'Users Found',
      totalUser: totalCount.length ? totalCount[0].totalCount : 0,
      topThree: topThree,
      response: users,
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
  getUserLeaderboardData: getUserLeaderboardData,
};
