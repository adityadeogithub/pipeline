const Streaming = require('../../models/streaming');
const Users = require('../../models/users');
const Histories = require('../../models/history');
const ConnectEvents = require('../../models/connect_events');
const moment = require('moment-timezone');
const Logger = require('../../configs/log');
const logger = new Logger('streaming');
const const_config = require('../../utility/util');
const util = require('../../fwks/util');

const getMeetingDashboard = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;
    let assigned_to = req.assigned_to;

    let { from, to } = req.body;

    if (organization === undefined || organization === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Organization  is required',
        field: 'organization',
      });
    }

    if (department === undefined || department === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Department is required',
        field: 'department',
      });
    }

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
        description: 'To is required',
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
      organization,
      department,
      date: {
        $gte: from,
        $lt: till,
      },
    };

    let data = await Streaming.aggregate([
      {
        $match: query,
      },
      {
        $project: {
          _id: 0,
          _id: '$_id',
          participants: { $size: '$participants' },
        },
      },
    ]);

    let users = await Users.findOne({
      organization: organization,
      department: department,
    }).distinct('user_email');

    let query_chat = {
      'user.user': {
        $in: users,
      },
      createdAt: {
        $gte: from,
        $lt: till,
      },
      type: 'text',
    };

    let query_attachment = {
      'user.user': {
        $in: users,
      },
      createdAt: {
        $gte: from,
        $lt: till,
      },
      type: 'file',
    };

    let chat = await Histories.aggregate([
      {
        $match: query_chat,
      },
    ]);

    let attachment = await Histories.aggregate([
      {
        $match: query_attachment,
      },
    ]);

    let group = await Histories.aggregate([
      {
        $match: {
          'user.user': {
            $in: users,
          },
          createdAt: {
            $gte: from,
            $lt: till,
          },
        },
      },
      {
        $group: {
          _id: '$room',
        },
      },
    ]);

    let total_participants = 0;
    let reports = [];

    for (let i = 0; i < data.length; i++) {
      total_participants = total_participants + data[i].participants;
    }

    let event = await ConnectEvents.aggregate([
      {
        $match: {
          organization: organization,
          department: department,
          createdAt: {
            $gte: from,
            $lt: till,
          },
        },
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: '%m-%d-%Y',
                date: '$createdAt',
              },
            },
            event_type: '$event_type',
          },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: '$_id.date',
          eventType: {
            $push: {
              event_type: '$_id.event_type',
              count: '$count',
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    let screen_sharing_total = 0;
    let whiteboard_sharing_total = 0;

    for (let i = 0; i < event.length; i++) {
      for (let j = 0; j < event[i].eventType.length; j++) {
        if (event[i].eventType[j].event_type === 'SCREEN_SHARING') {
          screen_sharing_total =
            screen_sharing_total + event[i].eventType[j].count;
        }

        if (event[i].eventType[j].event_type === 'WHITEBOARD_SHARING') {
          whiteboard_sharing_total =
            whiteboard_sharing_total + event[i].eventType[j].count;
        }
      }
    }
    let entry = {
      total_meetings: data.length,
      total_participants: total_participants,
      video_sharing: 10,
      audio_sharing: 10,
      screen_sharing: screen_sharing_total,
      whiteboard_sharing: whiteboard_sharing_total,
      total_messages: 10,
      total_groups: group.length,
      chat: chat.length,
      attachment: attachment.length,
    };
    reports.push(entry);

    return res.status(200).json({
      message: 'Meeting fetched successfully',
      data: reports,
    });
  } catch (error) {
    logger.error(error);
    console.error(error);
    return res.status(500).json({
      code: 'SERVER_ERROR',
      description: 'something went wrong, Please try again',
    });
  }
};

const getChatGroupAttachments = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;
    let assigned_to = req.assigned_to;

    let { from, to } = req.body;

    if (organization === undefined || organization === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Organization  is required',
        field: 'organization',
      });
    }

    if (department === undefined || department === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Department is required',
        field: 'department',
      });
    }

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
        description: 'To is required',
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

    let users = await Users.findOne({
      organization: organization,
      department: department,
    }).distinct('user_email');

    let query = {
      'user.user': {
        $in: users,
      },
      createdAt: {
        $gte: from,
        $lt: till,
      },
      type: 'text',
    };

    let data = await Histories.aggregate([
      {
        $match: query,
      },
      {
        $group: {
          _id: {
            type: '$type',
            date: {
              $dateToString: {
                format: '%m-%d-%Y',
                date: '$createdAt',
                timezone: time_zone,
              },
            },
          },
          count: { $sum: 1 },
        },
      },
      {
        $addFields: {
          date: '$_id.date',
        },
      },
      {
        $addFields: {
          chats: '$count',
        },
      },
      {
        $project: {
          _id: 0,
          date: 1,
          chats: 1,
        },
      },
      { $sort: { date: 1 } },
      {
        $lookup: {
          from: 'histories',
          let: {
            date: '$date',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $gte: ['$createdAt', '$$date'] },
                    // { "$lt": ["$createdAt", "$$date"] },
                    { $eq: ['$type', 'file'] },
                  ],
                },
              },
            },
            {
              $group: {
                _id: {
                  type: '$type',
                  date: {
                    $dateToString: {
                      format: '%m-%d-%Y',
                      date: '$createdAt',
                      timezone: time_zone,
                    },
                  },
                },
                count: { $sum: 1 },
              },
            },
            {
              $addFields: {
                date: '$_id.date',
              },
            },
            {
              $addFields: {
                attachments: '$count',
              },
            },
            {
              $project: {
                _id: 0,
                date: 1,
                attachments: 1,
              },
            },
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$date', '$$date'] }],
                },
              },
            },
          ],
          as: 'attachment',
        },
      },
      {
        $unwind: {
          path: '$attachment',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'histories',
          let: {
            date: '$date',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $gte: ['$createdAt', '$$date'] },
                    // { "$lt": ["$createdAt", "$$date"] },
                    { $eq: ['$type', 'file'] },
                  ],
                },
              },
            },
            {
              $group: {
                _id: {
                  room: '$room',
                  date: {
                    $dateToString: {
                      format: '%m-%d-%Y',
                      date: '$createdAt',
                      timezone: time_zone,
                    },
                  },
                },
              },
            },

            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$_id.date', '$$date'] }],
                },
              },
            },
          ],
          as: 'groups',
        },
      },
      {
        $addFields: {
          groups: { $size: '$groups' },
        },
      },

      {
        $project: {
          _id: 0,
          date: 1,
          chats: {
            $cond: {
              if: '$chats',
              then: '$chats',
              else: 0,
            },
          },
          attachments: {
            $cond: {
              if: '$attachment.attachments',
              then: '$attachment.attachments',
              else: 0,
            },
          },
          groups: {
            $cond: {
              if: '$groups',
              then: '$groups',
              else: 0,
            },
          },
        },
      },
    ]);

    return res.status(200).json({
      message: 'Messaging summary fetched successfully',
      data: data,
    });
  } catch (error) {
    logger.error(error);
    console.error(error);
    return res.status(500).json({
      code: 'SERVER_ERROR',
      description: 'something went wrong, Please try again',
    });
  }
};

const getScreenWhiteboardSharing = async (req, res, next) => {
  try {
    let organization = req.organization;
    let department = req.department;

    let { from, to } = req.body;

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
      department: department,
      createdAt: {
        $gte: from,
        $lt: till,
      },
    };

    let event = await ConnectEvents.aggregate([
      {
        $match: query,
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: '%m-%d-%Y',
                date: '$createdAt',
              },
            },
            event_type: '$event_type',
          },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: '$_id.date',
          eventType: {
            $push: {
              event_type: '$_id.event_type',
              count: '$count',
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    let screen_sharing_total = 0;
    let whiteboard_sharing_total = 0;

    for (let i = 0; i < event.length; i++) {
      for (let j = 0; j < event[i].eventType.length; j++) {
        if (event[i].eventType[j].event_type === 'SCREEN_SHARING') {
          screen_sharing_total =
            screen_sharing_total + event[i].eventType[j].count;
        }

        if (event[i].eventType[j].event_type === 'WHITEBOARD_SHARING') {
          whiteboard_sharing_total =
            whiteboard_sharing_total + event[i].eventType[j].count;
        }
      }
    }

    return res.status(201).json({
      message: 'Event connection fetched successfully',
      data: event,
      screen_sharing_total: screen_sharing_total,
      whiteboard_sharing_total: whiteboard_sharing_total,
    });
  } catch (error) {
    logger.error('exception ' + error);
    return res.status(500).json({
      code: 'SERVER_ERROR',
      description: 'Something went wrong, please try again',
    });
  }
};

module.exports = {
  getMeetingDashboard: getMeetingDashboard,
  getChatGroupAttachments: getChatGroupAttachments,
  getScreenWhiteboardSharing: getScreenWhiteboardSharing,
};
