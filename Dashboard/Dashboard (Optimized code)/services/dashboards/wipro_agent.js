const express = require('express');
const Activity = require('../../models/activity');
const privacy_breach_module = require('../../models/privacy_breach');
const configurations_model = require('../../models/configuration');
const Users = require('../../models/users');

const Task = require('../../models/task');
const Logger = require('../../configs/log');
const logger = new Logger('dashboard');
const util = require('util');
const const_config = require('../../utility/util');
const moment = require('moment-timezone');
const { config } = require('winston');

function findFromCollection(name, query, cb) {
  mongoose.connection.db.collection(name, function (err, collection) {
    collection.find(query).toArray(cb);
  });
}
const getIdleTimeByDateRange = async (req, res, next) => {
  try {
    let role = req.role;

    let { organization, department, user_email } = req.body;

    let { from, to } = req.query;

    if (organization === undefined || organization === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Organization is required',
        field: 'organization',
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
    from = new Date(from);
    till = new Date(till);
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
    if (const_config.isAllowedRole(role, ['MANAGER'])) {
      query = {
        organization: organization,
        assigned_to: user_email,
        is_licensed: true,
      };
    } else {
      query = {
        organization: organization,
        department: department,
        user_email: user_email,
        is_licensed: true,
      };
    }

    let users = await Users.find(query).distinct('user_email');
    for (let i = 0; i < users.length; i++) {
      let hours_array = [];
      let activity_query = null;
      for (var j = 0; j < date_array.length; j++) {
        let date = date_array[j];
        logger.debug('date  ', date_array[j]);
        let jDateToday = new Date(date_array[j]);
        let time_zone = req.timezone;
        let local_date = moment(jDateToday).tz(time_zone);
        let start = local_date.startOf('day').toDate();
        let end = local_date.endOf('day').toDate();

        logger.debug('start', start);
        logger.debug('end', end);
        if (const_config.isAllowedRole(role, ['MANAGER'])) {
          activity_query = {
            user_email: users[i],
            organization: organization,
            assigned_to: user_email,
            date: {
              $gte: start,
              $lt: end,
            },
          };
        } else {
          activity_query = {
            user_email: users[i],
            organization: organization,
            department: department,
            date: {
              $gte: start,
              $lt: end,
            },
          };
        }

        let login_seconds_count = await Activity.find(activity_query).distinct(
          'idleTime'
        );
        login_seconds_count = login_seconds_count * 60;
        let login_minutes = Math.floor(login_seconds_count / 60 / 60);
        let minutes = Math.floor(login_seconds_count / 60) - login_minutes * 60;
        let formatted =
          login_minutes.toString().padStart(2, '0') +
          ':' +
          minutes.toString().padStart(2, '0');

        if (formatted === '00:00') {
          formatted = '0';
        }
        let temp_hour_array = {
          count: formatted,
          date: moment(date).format('MM-DD-YYYY'),
        };

        hours_array.push(temp_hour_array);
      }
      let user_temp = {
        user_email: users[i],
        minutes: hours_array,
      };
      response_array_main.push(user_temp);
    }

    {
      return res.status(200).json({
        message: 'minutes fetched successfully for users',
        data: response_array_main,
      });
    }
  } catch (error) {
    logger.error(error);
    console.error(error);
    return res.status(500).json({
      code: 'SERVER_ERROR',
      description: 'something went wrong, Please try again',
    });
  }
};

const getPrivacyBreachByDateRange = async (req, res, next) => {
  try {
    let role = req.role;

    let { from, to } = req.query;
    let { organization, department, user_email } = req.body;

    if (organization === undefined || organization === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Organization is required',
        field: 'organization',
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
    from = new Date(from);
    till = new Date(till);
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

    query = {
      organization: organization,
      department: department,
      user_email: user_email,
      is_licensed: true,
    };

    let users = await Users.find(query);
    let users_count = await Users.find(query);
    users_count = users_count.length;
    for (let i = 0; i < users.length; i++) {
      let breaches_array = [];
      let breach_query = null;
      for (var j = 0; j < date_array.length; j++) {
        let date = date_array[j];
        logger.debug('date  ', date_array[j]);
        let jDateToday = new Date(date_array[j]);
        let time_zone = req.timezone;
        let local_date = moment(jDateToday).tz(time_zone);
        let start = local_date.startOf('day').toDate();
        let end = local_date.endOf('day').toDate();

        logger.debug('start', start);
        logger.debug('end', end);
        if (const_config.isAllowedRole(role, ['MANAGER'])) {
          breach_query = {
            user_email: users[i].user_email,
            organization: organization,
            assigned_to: user_email,
            date: {
              $gte: start,
              $lt: end,
            },
            breach_type: {
              $ne: 'RANDOM_IMAGE',
            },
          };
        } else {
          breach_query = {
            user_email: users[i].user_email,
            organization: organization,
            department: department,
            date: {
              $gte: start,
              $lt: end,
            },
            breach_type: {
              $ne: 'RANDOM_IMAGE',
            },
          };
        }
        let privacy_breach_count = await privacy_breach_module
          .find(breach_query)
          .countDocuments();

        let temp_breach_array = {
          count: privacy_breach_count,
          date: moment(date).format('MM-DD-YYYY'),
        };

        breaches_array.push(temp_breach_array);
      }
      let user_temp = {
        user_email: users[i].user_email,
        breaches: breaches_array,
      };
      response_array_main.push(user_temp);
    }

    {
      return res.status(200).json({
        message: 'Breaches fetched successfully',
        breaches: response_array_main,
        usersCount: users_count,
      });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      code: 'SERVER_ERROR',
      description: 'something went wrong, Please try again',
    });
  }
};

const getBreakTimeDateRange = async (req, res, next) => {
  console.log('Pending Called');
  try {
    let role = req.role;
    // let organization = req.organization
    // let department = req.department
    // let user_email = req.user_email
    // let assigned_to = req.assigned_to

    let { from, to } = req.query;
    let { organization, department, user_email } = req.body;

    logger.info('Organization', organization);
    logger.info('Department', department);
    logger.info('From', from);
    logger.info('To', to);
    logger.info('Email', user_email);

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
    logger.debug('From', from);
    logger.debug('Till', till);

    let totalBreakTime = 0;
    let totalBreakDateWiseQuery = null;

    totalBreakDateWiseQuery = {
      organization: organization,
      department: department,
      user_email: user_email,
      date: {
        $gte: from,
        $lt: till,
      },
    };

    let config_query = null;
    config_query = {
      organization: organization,
      department: department,
    };
    let configs = await configurations_model.findOne(config_query);

    let allowed_min = configs.breaks[0].minutes;

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
        user_email: user_email,
        allow_minutes: allowed_min,
      });
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      code: 'SERVER_ERROR',
      description: 'something went wrong, Please try again',
    });
  }
};

const getProductiveHoursByDateRange = async (req, res, next) => {
  try {
    let role = req.role;

    let { organization, department, user_email } = req.body;

    let { from, to } = req.query;

    if (organization === undefined || organization === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Organization is required',
        field: 'organization',
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
    from = new Date(from);
    till = new Date(till);
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
    if (const_config.isAllowedRole(role, ['MANAGER'])) {
      query = {
        organization: organization,
        assigned_to: user_email,
        is_licensed: true,
      };
    } else {
      query = {
        organization: organization,
        department: department,
        user_email: user_email,
        is_licensed: true,
      };
    }

    let users = await Users.find(query).distinct('user_email');
    for (let i = 0; i < users.length; i++) {
      let hours_array = [];
      let activity_query = null;
      for (var j = 0; j < date_array.length; j++) {
        let date = date_array[j];
        logger.debug('date  ', date_array[j]);
        let jDateToday = new Date(date_array[j]);
        let time_zone = req.timezone;
        let local_date = moment(jDateToday).tz(time_zone);
        let start = local_date.startOf('day').toDate();
        let end = local_date.endOf('day').toDate();

        logger.debug('start', start);
        logger.debug('end', end);
        if (const_config.isAllowedRole(role, ['MANAGER'])) {
          activity_query = {
            user_email: users[i],
            organization: organization,
            assigned_to: user_email,
            date: {
              $gte: start,
              $lt: end,
            },
          };
        } else {
          activity_query = {
            user_email: users[i],
            organization: organization,
            department: department,
            date: {
              $gte: start,
              $lt: end,
            },
          };
        }
        let login_seconds_count = await Activity.find(activity_query).distinct(
          'loginHours'
        );
        let login_minutes = Math.floor(login_seconds_count / 60 / 60);
        let minutes = Math.floor(login_seconds_count / 60) - login_minutes * 60;
        let formatted =
          login_minutes.toString().padStart(2, '0') +
          ':' +
          minutes.toString().padStart(2, '0');

        if (formatted === '00:00') {
          formatted = '0';
        }
        let temp_hour_array = {
          count: formatted,
          date: moment(date).format('MM-DD-YYYY'),
        };

        hours_array.push(temp_hour_array);
      }
      let user_temp = {
        user_email: users[i],
        minutes: hours_array,
      };
      response_array_main.push(user_temp);
    }

    {
      return res.status(200).json({
        message: 'minutes fetched successfully for users',
        data: response_array_main,
      });
    }
  } catch (error) {
    logger.error(error);
    console.error(error);
    return res.status(500).json({
      code: 'SERVER_ERROR',
      description: 'something went wrong, Please try again',
    });
  }
};

module.exports = {
  getIdleTimeByDateRange: getIdleTimeByDateRange, //Fully Done
  getPrivacyBreachByDateRange: getPrivacyBreachByDateRange, //Fully Done.
  getBreakTimeDateRange: getBreakTimeDateRange, //Fully Done
  getProductiveHoursByDateRange: getProductiveHoursByDateRange,
};
