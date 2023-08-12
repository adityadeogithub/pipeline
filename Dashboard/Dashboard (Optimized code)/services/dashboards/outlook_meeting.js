const express = require('express');
const mongoose = require('mongoose');
const dashboard = require('../../models/dashboard');
const Activity = require('../../models/activity');
const WorkLocation = require('../../models/user_work_location');
const PrivacyBreach = require('../../models/privacy_breach');
const user_leave_model = require('../../models/users_leave');
const Task = require('../../models/task');
const Logger = require('../../configs/log');
const logger = new Logger('outlook Meeting');
const util = require('util');
const const_config = require('../../utility/util');
const moment = require('moment-timezone');
const users = require('../../models/users');
const OutlookMeeting = require('../../models/outlookMeetings');

const getMeetingRecord = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;
    let assigned_to = req.assigned_to;

    let { date } = req.body;

    logger.debug('role', role);
    if (date === undefined || date === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Date is required',
        field: 'date',
      });
    }
    if (!moment(date, 'MM-DD-YYYY').isValid()) {
      return res.status(400).json({
        code: 'INVALID_DATE',
        description: 'Date is invalid',
      });
    }
    const limit = parseInt(req.body.limit); // Make sure to parse the limit to number
    const skip = parseInt(req.body.skip);

    if (limit === undefined || limit === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Limit is required',
        field: 'limit',
      });
    }
    if (skip === undefined || skip === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Skip is required',
        field: 'skip',
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
      from = local_date.startOf('day').toDate();
      till = local_date.endOf('day').toDate();
    } else {
      let local_date = moment(jDateToday)
        .tz(time_zone)
        .format('YYYY-MM-DD[T]HH:mm:ss.SSS[Z]');
      from = new Date(local_date);

      till = moment(local_date)
        .add(23, 'hours')
        .add(59, 'minutes')
        .add(59, 'seconds')
        .add(999, 'ms')
        .format('YYYY-MM-DD[T]HH:mm:ss.SSS[Z]');
      till = new Date(till);
    }
    logger.debug('from-', from);
    logger.debug('till-', till);
    let query;

    if (const_config.isAllowedRole(role, ['AGENT'])) {
      query = {
        organization,
        department,
        user_name: user_email,
        start: {
          $gte: from,
          $lt: till,
        },
      };
    } else if (const_config.isAllowedRole(role, ['MANAGER'])) {
      query = {
        organization,
        assigned_to: user_email,
        start: {
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
      query = {
        organization,
        department,
        start: {
          $gte: from,
          $lt: till,
        },
      };
    }

    OutlookMeeting.aggregate([
      {
        $match: query,
      },
      {
        $group: {
          _id: {
            user_email: '$user_email',
            name: '$name',
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]).exec((err, no_of_employees) => {
      if (err) {
        logger.error(err);
      } else {
        let employeeData = no_of_employees.slice(skip, skip + limit);

        return res.status(200).json({
          message: 'Meeting data fetched successfully !!',
          data: {
            data: employeeData,
            no_of_employees: no_of_employees.length,
          },
        });
      }
    });
  } catch (error) {
    logger.error(error);
    return res.status(500).json({
      code: 'SERVER_ERROR',
      description: 'something went wrong, Please try again',
    });
  }
};

const getMeetingDetails = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;
    let assigned_to = req.assigned_to;

    let { date, member_email } = req.body;
    const limit = parseInt(req.body.limit); // Make sure to parse the limit to number
    const skip = parseInt(req.body.skip);

    if (date === undefined || date === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Date is required',
        field: 'date',
      });
    }
    if (limit === undefined || limit === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Limit is required',
        field: 'limit',
      });
    }
    if (skip === undefined || skip === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Skip is required',
        field: 'skip',
      });
    }

    if (member_email === undefined || member_email === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Member_email is required',
        field: 'member_email',
      });
    }
    if (!moment(date, 'MM-DD-YYYY').isValid()) {
      return res.status(400).json({
        code: 'INVALID_DATE',
        description: 'Date is invalid',
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
      from = local_date.startOf('day').toDate();
      till = local_date.endOf('day').toDate();
    } else {
      let local_date = moment(jDateToday)
        .tz(time_zone)
        .format('YYYY-MM-DD[T]HH:mm:ss.SSS[Z]');
      from = new Date(local_date);

      till = moment(local_date)
        .add(23, 'hours')
        .add(59, 'minutes')
        .add(59, 'seconds')
        .add(999, 'ms')
        .format('YYYY-MM-DD[T]HH:mm:ss.SSS[Z]');
      till = new Date(till);
    }
    logger.debug('from-', from);
    logger.debug('till-', till);
    let query = {
      start: {
        $gte: from,
        $lt: till,
      },
      user_email: member_email,
    };

    let meetingDetails = await OutlookMeeting.find(query)
      .sort({ start: -1 })
      .skip(skip)
      .limit(limit);
    let meetingCount = await OutlookMeeting.find(query).countDocuments();

    return res.status(200).json({
      message: 'Meeting data fetched successfully !!',
      data: {
        meetingDetails: meetingDetails,
        meetingCount: meetingCount,
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

const getMeetingCount = async (req, res, next) => {
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
        .format('YYYY-MM-DD[T]HH:mm:ss.SSS[Z]');
      till = moment(jDateTill)
        .endOf('day')
        .tz(time_zone)
        .format('YYYY-MM-DD[T]HH:mm:ss.SSS[Z]');
    }
    logger.debug('from =', from);
    logger.debug('till =', till);

    let meetingExternalQuery = null;
    let meetingInternalQuery = null;
    //ACTUAL
    if (const_config.isAllowedRole(role, ['AGENT'])) {
      meetingExternalQuery = {
        organization,
        department,
        meetingType: 'EXTERNAL',
        user_name: user_email,
        start: {
          $gte: from,
          $lt: till,
        },
      };
      meetingInternalQuery = {
        organization,
        department,
        meetingType: 'INTERNAL',
        user_name: user_email,
        start: {
          $gte: from,
          $lt: till,
        },
      };
    } else if (const_config.isAllowedRole(role, ['MANAGER'])) {
      meetingExternalQuery = {
        organization,
        meetingType: 'EXTERNAL',
        assigned_to: user_email,
        start: {
          $gte: from,
          $lt: till,
        },
      };
      meetingInternalQuery = {
        organization,
        meetingType: 'INTERNAL',
        assigned_to: user_email,
        start: {
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
      meetingExternalQuery = {
        organization,
        department,
        meetingType: 'EXTERNAL',
        start: {
          $gte: from,
          $lt: till,
        },
      };
      meetingInternalQuery = {
        organization,
        department,
        meetingType: 'INTERNAL',
        start: {
          $gte: from,
          $lt: till,
        },
      };
    }

    let internalCount = await OutlookMeeting.find(
      meetingExternalQuery
    ).countDocuments();
    let externalCount = await OutlookMeeting.find(
      meetingInternalQuery
    ).countDocuments();

    return res.status(200).json({
      message: 'Meeting Count fetched successfully',
      data: {
        internalCount: internalCount,
        externalCount: externalCount,
        totalCount: internalCount + externalCount,
      },
    });
  } catch (error) {
    logger.error(error);
    return res.status(500).json({
      code: 'SERVER_ERROR',
      description: 'something went wrong, Please try again',
    });
  }
  //END
};

module.exports = {
  getMeetingRecord: getMeetingRecord,
  getMeetingDetails: getMeetingDetails,
  getMeetingCount: getMeetingCount,
};
