const Content = require('../../models/content');
const Courses = require('../../models/courses');
const Discussion = require('../../models/discussions');
const UserCourses = require('../../models/user_course');
const Logger = require('../../configs/log');
const logger = new Logger('guru service');
const const_config = require('../../utility/util');
const moment = require('moment-timezone');
const util = require('../../fwks/util');
const Uuid = require('uuid');
const { parse } = require('json2csv');
const Users = require('../../models/users');
const Question = require('../../models/question');
const Score = require('../../models/score');
const UserFeedback = require('../../models/userFeedback');
const jsonexport = require('jsonexport');

const totalData = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;

    let { from, to, report_type } = req.body;

    if (organization === undefined || organization === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Organization is required',
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
        description: 'From is required!!',
        field: 'to',
      });
    }

    let time_zone = req.timezone;
    let jDateToday = new Date(from);
    let jDateTill = new Date(to);

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

    let query = null;
    if (
      const_config.isAllowedRole(role, [
        'ADMIN',
        'SUPER_ADMIN',
        'AUDIT',
        'REPORT_MANAGER',
        'SUPER_AUDIT',
      ])
    ) {
      if (department === 'ALL') {
        query = {
          organization,
          createdAt: {
            $gte: from,
            $lt: till,
          },
        };
      } else {
        query = {
          organization,
          department,
          createdAt: {
            $gte: from,
            $lt: till,
          },
        };
      }
    } else if (const_config.isAllowedRole(role, ['MANAGER'])) {
      if (department === 'ALL') {
        query = {
          organization,
          assigned_to: user_email,
          createdAt: {
            $gte: from,
            $lt: till,
          },
        };
      } else {
        query = {
          organization,
          department,
          assigned_to: user_email,
          createdAt: {
            $gte: from,
            $lt: till,
          },
        };
      }
    }

    let data = 0;

    let [total_courses, total_conversation, total_user, content] =
      await Promise.all([
        Courses.countDocuments(query),
        Discussion.aggregate([
          {
            $match: query,
          },
          { $unwind: '$discussions' },
          {
            $project: {
              count: { $size: '$discussions.reply' },
            },
          },
        ]),

        UserCourses.find(query).distinct('user_email'),

        Content.aggregate([
          {
            $match: query,
          },
          {
            $group: {
              _id: {
                title: '$title',
              },
              count: { $sum: 1 },
            },
          },
        ]),
      ]);

    for (let i = 0; i < total_conversation.length; i++) {
      data = data + total_conversation[i].count;
    }
    let reports = [];
    if (report_type === 'csv') {
      try {
        let entry = {
          total_courses: total_courses,
          total_user: total_user.length,
          total_content: content.length > 0 ? content[0].count : 0,
          total_conversation: total_conversation.length + data,
        };
        reports.push(entry);

        const fields = [
          'total_courses',
          'total_user',
          'total_content',
          'total_conversation',
        ];
        const opts = { fields };
        const csv = parse(reports, opts);
        return res.status(200).send(csv);
      } catch (err) {
        logger.error(err);
        return res.status(500).json({
          code: 'SERVER_ERROR',
          description: 'something went wrong, Please try again',
        });
      }
    } else {
      return res.status(200).json({
        message: 'Guru dashboad data fetched successfully',
        total_courses: total_courses,
        total_user: total_user.length,
        total_content: content.length > 0 ? content[0].count : 0,
        total_conversation: total_conversation.length + data,
      });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      code: 'SERVER_ERROR',
      description: 'Something went wrong, please try again',
    });
  }
};

const courseEnrolledUser = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;

    let { from, to, report_type } = req.body;

    if (organization === undefined || organization === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Organization is required',
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
        description: 'From is required!!',
        field: 'to',
      });
    }

    let reports = [];
    let time_zone = req.timezone;
    let jDateToday = new Date(from);
    let jDateTill = new Date(to);

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
    let query = null;
    if (
      const_config.isAllowedRole(role, [
        'ADMIN',
        'SUPER_ADMIN',
        'AUDIT',
        'REPORT_MANAGER',
        'SUPER_AUDIT',
      ])
    ) {
      if (department === 'ALL') {
        query = {
          organization,
          createdAt: {
            $gte: from,
            $lt: till,
          },
        };
      } else {
        query = {
          organization,
          department,
          createdAt: {
            $gte: from,
            $lt: till,
          },
        };
      }
    } else if (const_config.isAllowedRole(role, ['MANAGER'])) {
      if (department === 'ALL') {
        query = {
          organization,
          assigned_to: user_email,
          createdAt: {
            $gte: from,
            $lt: till,
          },
        };
      } else {
        query = {
          organization,
          department,
          assigned_to: user_email,
          createdAt: {
            $gte: from,
            $lt: till,
          },
        };
      }
    }

    let course_user = await Courses.aggregate([
      {
        $match: query,
      },
      {
        $group: {
          _id: {
            uuid: '$uuid',
          },
        },
      },
      {
        $lookup: {
          from: 'user_courses',
          let: {
            uuid: '$_id.uuid',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    {
                      $eq: ['$course_uuid', '$$uuid'],
                    },
                  ],
                },
              },
            },
          ],
          as: 'data',
        },
      },
      {
        $addFields: {
          data: {
            $size: '$data',
          },
        },
      },
      {
        $group: {
          _id: '$_id.uuid',

          count: { $sum: '$data' },
        },
      },
    ]);
    for (let i = 0; i < course_user.length; i++) {
      let data = await Courses.find(
        { uuid: course_user[i]._id },
        'course_name'
      );
      logger.debug('data', data);
      let entry = {
        uuid: course_user[i]._id,
        CourseName: data[0].course_name,
        UserEnrolledCount: course_user[i].count,
      };
      reports.push(entry);
    }
    if (report_type === 'csv') {
      try {
        const fields = ['CourseName', 'UserEnrolledCount'];
        const opts = { fields };
        const csv = parse(reports, opts);
        return res.status(200).send(csv);
      } catch (err) {
        logger.error(err);
        return res.status(500).json({
          code: 'SERVER_ERROR',
          description: 'something went wrong, Please try again',
        });
      }
    } else {
      return res.status(200).json({
        message: 'Course wise enrolled user count fetched successfully',
        course_user: reports,
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

const totalDataMonthly = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;

    let { date, report_type } = req.body;

    if (organization === undefined || organization === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Organization is required',
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
    let jDateToday = new Date(date);
    let time_zone = req.timezone;
    let time_zone_name = moment.tz(time_zone).format('Z');
    let time_zone_name_char = time_zone_name.charAt(0);
    let from;
    let till;

    if ('+' === time_zone_name_char) {
      let local_date = moment(jDateToday).tz(time_zone);
      from = local_date.startOf('year').toDate();
      till = local_date.endOf('year').toDate();
    } else {
      let local_date = moment(jDateToday)
        .tz(time_zone)
        .format('YYYY-MM-DD[T]HH:mm:ss.SSS[Z]');
      from = local_date;
      till = moment(local_date)
        .add(23, 'hours')
        .add(59, 'minutes')
        .add(59, 'seconds')
        .add(999, 'ms')
        .format('YYYY-MM-DD[T]HH:mm:ss.SSS[Z]');
    }
    let query = null;
    logger.debug('fr', from);
    logger.debug('till', till);

    var dateStart = moment(from);
    var dateEnd = moment(till);
    var timeValues = [];

    for (var j = 0; j < 12; j++) {
      timeValues.push(dateStart.format('MM-DD-YYYY'));
      dateStart.add(1, 'month');
      logger.debug('dateStart', dateStart);
    }

    let response = [];
    let reports = [];
    for (var i = 0; i < timeValues.length; i++) {
      let jDateToday = new Date(timeValues[i]);
      let time_zone = req.timezone;
      let time_zone_name = moment.tz(time_zone).format('Z');
      let time_zone_name_char = time_zone_name.charAt(0);
      let from;
      let till;

      if ('+' === time_zone_name_char) {
        let local_date = moment(jDateToday).tz(time_zone);
        from = local_date.startOf('month').toDate();
        till = local_date.endOf('month').toDate();
      } else {
        let local_date = moment(jDateToday)
          .tz(time_zone)
          .format('YYYY-MM-DD[T]HH:mm:ss.SSS[Z]');
        from = local_date;
        till = moment(local_date)
          .add(23, 'hours')
          .add(59, 'minutes')
          .add(59, 'seconds')
          .add(999, 'ms')
          .format('YYYY-MM-DD[T]HH:mm:ss.SSS[Z]');
      }

      if (
        const_config.isAllowedRole(role, [
          'ADMIN',
          'SUPER_ADMIN',
          'AUDIT',
          'REPORT_MANAGER',
          'SUPER_AUDIT',
        ])
      ) {
        if (department === 'ALL') {
          query = {
            organization,
            createdAt: {
              $gte: from,
              $lt: till,
            },
          };
        } else {
          query = {
            organization,
            department,
            createdAt: {
              $gte: from,
              $lt: till,
            },
          };
        }
      } else if (const_config.isAllowedRole(role, ['MANAGER'])) {
        if (department === 'ALL') {
          query = {
            organization,
            assigned_to: user_email,
            createdAt: {
              $gte: from,
              $lt: till,
            },
          };
        } else {
          query = {
            organization,
            department,
            assigned_to: user_email,
            createdAt: {
              $gte: from,
              $lt: till,
            },
          };
        }
      }

      let [course_user, total_users, content, total_conversation] =
        await Promise.all([
          Courses.aggregate([
            {
              $match: query,
            },
            {
              $group: {
                _id: {
                  // course: "$uuid",
                  date: {
                    $dateToString: {
                      date: '$createdAt',
                      format: '%m-%Y',
                    },
                  },
                },
                count: {
                  $sum: 1,
                },
              },
            },
            {
              $project: {
                _id: 0,
                count: 1,
              },
            },
          ]),
          UserCourses.aggregate([
            {
              $match: query,
            },
            {
              $group: {
                _id: {
                  $dateToString: {
                    date: '$createdAt',
                    format: '%m-%Y',
                  },
                },
                total_users: { $addToSet: '$user_email' },
              },
            },
            { $sort: { _id: 1 } },
            {
              $project: {
                _id: 0,
                total_users: { $size: '$total_users' },
              },
            },
          ]),
          Content.aggregate([
            {
              $match: query,
            },
            {
              $group: {
                _id: {
                  title: '$title',
                  date: {
                    $dateToString: {
                      date: '$createdAt',
                      format: '%m-%Y',
                    },
                  },
                },
                count: {
                  $sum: 1,
                },
              },
            },
            {
              $group: {
                _id: '$_id.date',
                content: {
                  $push: {
                    content: '$_id.title',
                    count: '$count',
                  },
                },
              },
            },
            { $sort: { _id: 1 } },
            {
              $project: {
                _id: 0,
                content: { $size: '$content.count' },
              },
            },
          ]),
          Discussion.aggregate([
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
            { $unwind: '$discussions' },
            {
              $group: {
                _id: {
                  $dateToString: {
                    date: '$createdAt',
                    format: '%m-%Y',
                  },
                },
                discussions: {
                  $push: {
                    _id: '$projects._id',
                    discussion: {
                      $size: '$discussions.reply',
                    },
                  },
                },
              },
            },
            { $sort: { _id: 1 } },

            {
              $project: {
                _id: 0,
                totalConversation: {
                  $add: [
                    { $size: '$discussions' },
                    { $sum: '$discussions.discussion' },
                  ],
                },
              },
            },
          ]),
        ]);
      let entry = {
        date: timeValues[i],
        course_user: course_user[0] !== undefined ? course_user[0].count : 0,
        total_users:
          total_users[0] !== undefined ? total_users[0].total_users : 0,
        content: content[0] !== undefined ? content[0].content : 0,
        total_conversation:
          total_conversation[0] !== undefined
            ? total_conversation[0].totalConversation
            : 0,
      };
      response.push(entry);
      let entry1 = {
        month: moment(timeValues[i]).tz(time_zone).format('MM-YYYY'),
        course_user: course_user[0] !== undefined ? course_user[0].count : 0,
        total_users:
          total_users[0] !== undefined ? total_users[0].total_users : 0,
        content: content[0] !== undefined ? content[0].content : 0,
        total_conversation:
          total_conversation[0] !== undefined
            ? total_conversation[0].totalConversation
            : 0,
      };
      reports.push(entry1);
    }

    if (report_type === 'csv') {
      try {
        jsonexport(reports, function (err, csv) {
          if (err) return console.error(err);
          return res.status(200).send(csv);
        });

        // return res.status(200).send(csv);
      } catch (err) {
        console.error(err);

        return res.status(500).json({
          code: 'SERVER_ERROR',
          description: 'something went wrong, Please try again',
        });
      }
    } else {
      return res.status(200).json({
        message: 'Guru data by month and year fetched successfully',
        data: response,
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

const courseReportList = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;

    let { from, to, report_type } = req.body;

    if (organization === undefined || organization === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Organization is required',
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
        description: 'From is required!!',
        field: 'to',
      });
    }

    let reports = [];
    let time_zone = req.timezone;
    let jDateToday = new Date(from);
    let jDateTill = new Date(to);

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

    let query = null;

    if (
      const_config.isAllowedRole(role, [
        'ADMIN',
        'SUPER_ADMIN',
        'AUDIT',
        'REPORT_MANAGER',
        'SUPER_AUDIT',
      ])
    ) {
      if (department === 'ALL') {
        query = {
          organization,
          createdAt: {
            $gte: from,
            $lt: till,
          },
        };
      } else {
        query = {
          organization,
          department,
          createdAt: {
            $gte: from,
            $lt: till,
          },
        };
      }
    } else if (const_config.isAllowedRole(role, ['MANAGER'])) {
      if (department === 'ALL') {
        query = {
          organization,
          assigned_to: user_email,
          createdAt: {
            $gte: from,
            $lt: till,
          },
        };
      } else {
        query = {
          organization,
          department,
          assigned_to: user_email,
          createdAt: {
            $gte: from,
            $lt: till,
          },
        };
      }
    }

    let course = await Courses.aggregate([
      {
        $match: query,
      },
      {
        $group: {
          _id: {
            course_name: '$course_name',
            course_code: '$course_code',
            description: '$description',
            createdAt: '$createdAt',
            uuid: '$uuid',
            status: {
              $cond: {
                if: {
                  $lte: ['$end_date', new Date()],
                },
                then: 'ACTIVE',
                else: 'In-ACTIVE',
              },
            },
          },
        },
      },
    ]);
    if (report_type === 'csv') {
      try {
        for (let i = 0; i < course.length; i++) {
          let entry = {
            CourseName: course[i]._id.course_name,
            CourseCode: course[i]._id.course_code,
            Description: course[i]._id.description,
            CreatedOn: course[i]._id.createdAt,
            Status: course[i]._id.status,
          };
          reports.push(entry);
        }
        const fields = [
          'CourseName',
          'CourseCode',
          'Description',
          'CreatedOn',
          'Status',
        ];
        const opts = { fields };
        const csv = parse(reports, opts);
        return res.status(200).send(csv);
      } catch (err) {
        logger.error(err);
        return res.status(500).json({
          code: 'SERVER_ERROR',
          description: 'something went wrong, Please try again',
        });
      }
    } else {
      return res.status(200).json({
        message: 'Course data fetched successfully',
        course_user: course,
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

const courseAnalytics = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;
    let { uuid } = req.body;
    if (organization === undefined || organization === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Organization is required',
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
    let [
      totalUsers,
      enrolled_user,
      contentTypeData,
      totalQuestions,
      total_question_atqueryted,
      feedbackReceived,
    ] = await Promise.all([
      Users.countDocuments({
        organization: organization,
        department: department,
      }),
      UserCourses.countDocuments({
        course_uuid: uuid,
        organization: organization,
        department: department,
      }),
      Content.aggregate([
        {
          $match: {
            uuid: uuid,
            organization: organization,
            department: department,
          },
        },
        {
          $group: {
            _id: '$content_type',
            total_content: { $sum: 1 },
          },
        },
      ]),
      Question.countDocuments({
        courseId: uuid,
        organization: organization,
        department: department,
      }),
      Score.aggregate([
        {
          $match: {
            courseId: uuid,
            organization: organization,
            department: department,
          },
        },
        {
          $group: {
            _id: '$totalAtqueryted',
          },
        },
      ]),
      UserFeedback.countDocuments({
        courseId: uuid,
        organization: organization,
        department: department,
      }).distinct('user_email'),
    ]);

    let not_enrolled = totalUsers - enrolled_user;

    let total_content = 0;
    for (let i = 0; i < contentTypeData.length; i++) {
      total_content = total_content + contentTypeData[i].total_content;
    }

    let user_completed = 0;
    for (let i = 0; i < total_question_atqueryted.length; i++) {
      user_completed = user_completed + total_question_atqueryted[i]._id;
    }

    let user_pending = totalQuestions - user_completed;

    feedbackReceived = feedbackReceived.length;

    let feedback_pending = enrolled_user - feedbackReceived;
    if (feedback_pending > 0) {
      feedback_pending = feedback_pending;
    } else {
      feedback_pending = 0;
    }

    return res.status(200).json({
      message: 'Course data in detailed fetched successfully',
      totalUsers: totalUsers,
      not_enrolled: not_enrolled,
      enrolled_user: enrolled_user,
      content_type: contentTypeData,
      total_content: total_content,
      totalQuestions: totalQuestions,
      user_completed: user_completed,
      user_pending: user_pending,
      feedbackReceived: feedbackReceived,
      feedback_pending: feedback_pending,
      // 'rating_sum':rating_sum
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
  totalData: totalData,
  courseEnrolledUser: courseEnrolledUser,
  totalDataMonthly: totalDataMonthly,
  courseReportList: courseReportList,
  courseAnalytics: courseAnalytics,
};
