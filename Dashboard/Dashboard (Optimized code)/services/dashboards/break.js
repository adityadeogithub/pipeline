const express = require('express');
const Activity = require('../../models/activity');
const Task = require('../../models/task');
const Logger = require('../../configs/log');
const logger = new Logger('dashboard');
const util = require('util');
const const_config = require('../../utility/util');
const moment = require('moment-timezone');
const { parse } = require('json2csv');
const getTotalTimeOnBreaks = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;
    let assigned_to = req.assigned_to;

    let { from, to } = req.query;

    let { member_email, manager_name } = req.body;

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

    if (user_email === undefined || user_email === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'User Email is required',
        field: 'user_email',
      });
    }

    if (user_email === undefined || user_email === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'User Email is required',
        field: 'user_email',
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
        description: 'From is required',
        field: 'to',
      });
    }

    let time_zone = req.timezone;
    let jDateToday = new Date(from);
    let jDateTill = new Date(to);

    // from = moment(jDateToday).tz(time_zone).format('YYYY-MM-DDTHH:mm:ss.SSSZ')
    // let till = moment(jDateTill).endOf('day').tz(time_zone).format('YYYY-MM-DDTHH:mm:ss.SSSZ')
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
    }

    let totalBreakTime = 0;
    let breakTimeQuery = null;
    if (const_config.isAllowedRole(role, ['AGENT'])) {
      breakTimeQuery = {
        user_email: user_email,
        organization,
        department,
        date: { $gte: from, $lt: till },
      };
    } else if (const_config.isAllowedRole(role, ['MANAGER'])) {
      if (!(member_email === undefined || member_email === '')) {
        breakTimeQuery = {
          organization,
          assigned_to: user_email,
          user_email: member_email,
          date: { $gte: from, $lt: till },
        };
      } else {
        breakTimeQuery = {
          organization,
          assigned_to: user_email,
          date: {
            $gte: from,
            $lt: till,
          },
        };
      }
    } else if (
      const_config.isAllowedRole(role, [
        'ADMIN',
        'SUPER_ADMIN',
        'AUDIT',
        'CLIENT',
        'SUPER_AUDIT',
      ])
    ) {
      if (department === 'ALL') {
        breakTimeQuery = {
          organization,
          date: { $gte: from, $lt: till },
        };
      } else {
        if (!(member_email === undefined || member_email === '')) {
          breakTimeQuery = {
            organization,
            department,
            user_email: member_email,
            date: {
              $gte: from,
              $lt: till,
            },
          };
        } else if (!(manager_name === undefined || manager_name === '')) {
          breakTimeQuery = {
            organization,
            department,
            assigned_to: manager_name,
            date: {
              $gte: from,
              $lt: till,
            },
          };
        } else {
          breakTimeQuery = {
            organization,
            department,
            date: {
              $gte: from,
              $lt: till,
            },
          };
        }
      }
    }

    let activity_breaks = await Activity.find(breakTimeQuery).select('breaks');

    for (var i = 0, len = activity_breaks.length; i < len; i++) {
      let breaks = activity_breaks[i].breaks;

      if (breaks.length > 0) {
        let break_minutes = breaks[0].minutes;

        totalBreakTime = totalBreakTime + break_minutes;
      }
    }

    return res.status(200).json({
      message: 'Total Break Time fetched successfully',
      data: {
        total_break_time: totalBreakTime,
      },
    });
  } catch (error) {
    logger.error(error);
    return res.status(500).json({
      code: 'SERVER_ERROR',
      description: 'something went wrong, Please try again',
    });
  }
};

const getTotalTimeOnBreaksDateWise = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;
    let assigned_to = req.assigned_to;

    let { from, to } = req.query;

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

    if (user_email === undefined || user_email === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'User Email is required',
        field: 'user_email',
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
        description: 'From is required',
        field: 'to',
      });
    }

    let jDateToday = new Date(from);
    let jDateTill = new Date(to);
    let time_zone = req.timezone;
    // let local_date_from = moment(jDateToday).tz(time_zone)
    // let local_date_till = moment(jDateTill).tz(time_zone)

    // from = local_date_from.startOf('day').toDate()
    // let till = local_date_till.endOf('day').toDate()
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
    }
    logger.debug('From', from);
    logger.debug('Till', till);

    let totalBreakTime = 0;
    let totalBreakDateWiseQuery = null;
    if (const_config.isAllowedRole(role, ['AGENT'])) {
      totalBreakDateWiseQuery = {
        organization: organization,
        department: department,
        user_email: user_email,
        date: {
          $gte: from,
          $lt: till,
        },
      };
    } else if (const_config.isAllowedRole(role, ['MANAGER'])) {
      totalBreakDateWiseQuery = {
        organization: organization,
        assigned_to: user_email,
        date: {
          $gte: from,
          $lt: till,
        },
      };
    } else if (
      const_config.isAllowedRole(role, [
        'ADMIN',
        'SUPER_ADMIN',
        'AUDIT',
        'CLIENT',
        'SUPER_AUDIT',
      ])
    ) {
      if (department === 'ALL') {
        totalBreakDateWiseQuery = {
          organization: organization,
          date: {
            $gte: from,
            $lt: till,
          },
        };
      } else {
        totalBreakDateWiseQuery = {
          organization: organization,
          department: department,
          date: {
            $gte: from,
            $lt: till,
          },
        };
      }
    }

    Activity.aggregate([
      {
        $match: totalBreakDateWiseQuery,
      },
      { $unwind: '$breaks' },
      {
        $group: {
          _id: {
            date: '$date',
          },
          total: {
            $sum: '$breaks.minutes',
          },
        },
      },
      { $sort: { date: -1 } },
    ]).exec((err, breaks) => {
      if (err) throw err;
      return res.status(200).json({
        message: 'Total Break in Minutes  fetched successfully',
        data: breaks,
      });
    });
  } catch (error) {
    logger.error(error);
    return res.status(500).json({
      code: 'SERVER_ERROR',
      description: 'something went wrong, Please try again',
    });
  }
};

const getTotalTimeOnBreaksDateWiseNew = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;
    let assigned_to = req.assigned_to;

    let { from, to } = req.query;
    let { manager_name, report_type } = req.body;

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

    if (user_email === undefined || user_email === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'User Email is required',
        field: 'user_email',
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
        description: 'From is required',
        field: 'to',
      });
    }

    let jDateToday = new Date(from);
    let jDateTill = new Date(to);
    let time_zone = req.timezone;
    let local_date_from = moment(jDateToday).tz(time_zone);
    let local_date_till = moment(jDateTill).tz(time_zone);

    from = local_date_from.startOf('day').toDate();
    let till = local_date_till.endOf('day').toDate();
    from.setDate(from.getDate() + 1);
    till.setDate(till.getDate() + 1);
    logger.debug('From', from);
    logger.debug('Till', till);

    function getDates(from, till) {
      var dateArray = [];
      var currentDate = moment(from);
      var stopDate = moment(till);
      while (currentDate <= stopDate) {
        dateArray.push(moment(currentDate).format('YYYY-MM-DD'));
        currentDate = moment(currentDate).add(1, 'days');
      }
      return dateArray;
    }
    let date_array = getDates(from, till);

    let response_array_main = [];

    let query = null;

    let totalBreakTime = 0;
    let totalBreakDateWiseQuery = null;
    let reports = [];
    for (let j = 0; j < date_array.length; j++) {
      let date = date_array[j];

      let time_zone = req.timezone;
      let jDateToday = new Date(date_array[j]);
      // let local_date = moment(jDateToday).tz(time_zone).format('YYYY-MM-DDTHH:mm:ss.SSS[Z]')
      // let from = local_date

      // let till = moment(local_date).add(23, 'hours').add(59, 'minutes').add(59, 'seconds').add(999, 'ms').tz(time_zone).format('YYYY-MM-DDTHH:mm:ss.SSSZ')
      let time_zone_name = moment.tz(time_zone).format('Z');

      let time_zone_name_char = time_zone_name.charAt(0);

      let from;
      let till;
      if ('+' === time_zone_name_char) {
        let local_date = moment(jDateToday).tz(time_zone);
        from = local_date.startOf('day').toDate();
        till = local_date.endOf('day').toDate();
      } else {
        let local_date = moment(jDateToday)
          .tz(time_zone)
          .format('YYYY-MM-DDTHH:mm:ss.SSS[Z]');
        from = local_date;

        till = moment(local_date)
          .add(23, 'hours')
          .add(59, 'minutes')
          .add(59, 'seconds')
          .add(999, 'ms')
          .format('YYYY-MM-DDTHH:mm:ss.SSS[Z]');
      }

      if (const_config.isAllowedRole(role, ['AGENT'])) {
        totalBreakDateWiseQuery = {
          organization: organization,
          department: department,
          user_email: user_email,
          date: {
            $gte: from,
            $lt: till,
          },
        };
      } else if (const_config.isAllowedRole(role, ['MANAGER'])) {
        totalBreakDateWiseQuery = {
          organization: organization,
          assigned_to: user_email,
          date: {
            $gte: from,
            $lt: till,
          },
        };
      } else if (
        const_config.isAllowedRole(role, [
          'ADMIN',
          'SUPER_ADMIN',
          'AUDIT',
          'CLIENT',
          'SUPER_AUDIT',
        ])
      ) {
        if (department === 'ALL') {
          totalBreakDateWiseQuery = {
            organization: organization,
            date: {
              $gte: from,
              $lt: till,
            },
          };
        } else if (!(manager_name === undefined || manager_name === '')) {
          totalBreakDateWiseQuery = {
            organization: organization,
            department: department,
            assigned_to: manager_name,
            date: {
              $gte: from,
              $lt: till,
            },
          };
        } else {
          totalBreakDateWiseQuery = {
            organization: organization,
            department: department,
            date: {
              $gte: from,
              $lt: till,
            },
          };
        }
      }
      let activity_data = await Activity.find(
        totalBreakDateWiseQuery,
        'date breaks.minutes'
      );
      let total = 0;

      for (adf in activity_data) {
        if (activity_data[adf].breaks.length != 0) {
          total = total + activity_data[adf].breaks[0].minutes;
        } else {
          total = total + 0;
        }
      }

      response_array_main.push({ date: date, total: total });

      reports.push({
        organization: organization,
        department: department,
        date: date,
        total_breaks: total,
      });
    }
    if (report_type === 'csv') {
      try {
        const fields = ['organization', 'department', 'date', 'total_breaks'];
        const opts = {
          fields,
        };
        const csv = parse(reports, opts);
        //console.log(csv);
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
        message: 'Total Break in Minutes fetched successfully',
        data: response_array_main,
      });
    }
  } catch (error) {
    logger.error(error);
    return res.status(500).json({
      code: 'SERVER_ERROR',
      description: 'something went wrong, Please try again',
    });
  }
};

module.exports = {
  getTotalTimeOnBreaks: getTotalTimeOnBreaks,
  getTotalTimeOnBreaksDateWise: getTotalTimeOnBreaksDateWise,
  getTotalTimeOnBreaksDateWiseNew: getTotalTimeOnBreaksDateWiseNew,
};
