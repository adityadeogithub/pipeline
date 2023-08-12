const express = require('express');
const Activity = require('../../models/activity');
const PrivacyBreach = require('../../models/privacy_breach');
const Task = require('../../models/task');
const Logger = require('../../configs/log');
const logger = new Logger('breach_dashboard');
const util = require('../../fwks/util');
const const_config = require('../../utility/util');
const moment = require('moment-timezone');
const Users = require('../../models/users');
const constants = require('../../fwks/constants');
const Configuration = require('../../models/configuration');

const getNumberOfPrivacyBreaches = async (req, res, next) => {
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
    logger.debug('From', from);
    logger.debug('Till', till);

    let privacyBreachQuery = null;
    if (const_config.isAllowedRole(role, ['AGENT'])) {
      privacyBreachQuery = {
        organization,
        department,
        user_email: user_email,
        detected_at: {
          $gte: from,
          $lt: till,
        },
        breach_type: {
          $ne: 'RANDOM_IMAGE',
        },
      };
    } else if (const_config.isAllowedRole(role, ['MANAGER'])) {
      if (!(member_email === undefined || member_email === '')) {
        privacyBreachQuery = {
          organization,
          assigned_to: user_email,
          user_email: member_email,
          detected_at: {
            $gte: from,
            $lt: till,
          },
          breach_type: {
            $ne: 'RANDOM_IMAGE',
          },
        };
      } else {
        privacyBreachQuery = {
          organization,
          assigned_to: user_email,
          detected_at: {
            $gte: from,
            $lt: till,
          },
          breach_type: {
            $ne: 'RANDOM_IMAGE',
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
        privacyBreachQuery = {
          organization,
          detected_at: {
            $gte: from,
            $lt: till,
          },
          breach_type: {
            $ne: 'RANDOM_IMAGE',
          },
        };
      } else {
        if (!(member_email === undefined || member_email === '')) {
          privacyBreachQuery = {
            organization,
            department,
            user_email: member_email,
            detected_at: {
              $gte: from,
              $lt: till,
            },
            breach_type: {
              $ne: 'RANDOM_IMAGE',
            },
          };
        } else if (!(manager_name === undefined || manager_name === '')) {
          privacyBreachQuery = {
            organization,
            department,
            assigned_to: manager_name,
            detected_at: {
              $gte: from,
              $lt: till,
            },
            breach_type: {
              $ne: 'RANDOM_IMAGE',
            },
          };
        } else {
          privacyBreachQuery = {
            organization,
            department,
            detected_at: {
              $gte: from,
              $lt: till,
            },
            breach_type: {
              $ne: 'RANDOM_IMAGE',
            },
          };
        }
      }
    }

    let privacy_breach_count = await PrivacyBreach.find(
      privacyBreachQuery
    ).countDocuments();

    logger.debug('Logger Count', privacy_breach_count);

    return res.status(200).json({
      message: 'getNumberOfPrivacyBreaches fetched successfully',
      data: {
        privacy_breach_count: privacy_breach_count,
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

const getNumberOfPrivacyBreachesWithDates = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;

    let { from, to } = req.query;

    if (
      !const_config.isAllowedRole(role, [
        'ADMIN',
        'MANAGER',
        'SUPER_ADMIN',
        'AUDIT',
        'CLIENT',
        'SUPER_AUDIT',
      ])
    ) {
      return res.status(401).json({
        description: 'Unauthorized',
      });
    }

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
        is_licensed: true,
      };
    }

    let users = await Users.find(query).distinct('user_email');
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
            user_email: users[i],
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
            user_email: users[i],
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
        let privacy_breach_count = await PrivacyBreach.find(
          breach_query
        ).countDocuments();

        let temp_breach_array = {
          count: privacy_breach_count,
          date: moment(date).format('MM-DD-YYYY'),
        };

        breaches_array.push(temp_breach_array);
      }
      let user_temp = {
        user_email: users[i],
        breaches: breaches_array,
      };
      response_array_main.push(user_temp);
    }

    {
      return res.status(200).json({
        message: 'Breaches fetched successfully',
        breaches: response_array_main,
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

const breachesPercentage = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;

    let { from, to } = req.query;
    let { manager_name } = req.body;

    if (
      !const_config.isAllowedRole(role, [
        'ADMIN',
        'MANAGER',
        'SUPER_ADMIN',
        'AUDIT',
        'CLIENT',
        'SUPER_AUDIT',
      ])
    ) {
      return res.status(401).json({
        description: 'Unauthorized',
      });
    }

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
    logger.debug('From', from);
    logger.debug('Till', till);
    let notAtDeskQuery = null;
    let mobileDetectedQuery = null;
    let multiplePersonQuery = null;
    let unknownPersonQuery = null;
    if (const_config.isAllowedRole(role, ['MANAGER'])) {
      notAtDeskQuery = {
        organization: organization,
        breach_type: constants.NOT_AT_DESK,
        assigned_to: user_email,
        detected_at: {
          $gte: from,
          $lt: till,
        },
      };
      mobileDetectedQuery = {
        organization: organization,
        breach_type: constants.MOBILE_DETECTED,
        assigned_to: user_email,
        detected_at: {
          $gte: from,
          $lt: till,
        },
      };
      multiplePersonQuery = {
        organization: organization,
        breach_type: constants.MULTIPLE_PERSONS,
        assigned_to: user_email,
        detected_at: {
          $gte: from,
          $lt: till,
        },
      };
      unknownPersonQuery = {
        organization: organization,
        breach_type: constants.UNKNOWN_USER,
        assigned_to: user_email,
        detected_at: {
          $gte: from,
          $lt: till,
        },
      };
    } else {
      if (!(manager_name === undefined || manager_name === '')) {
        notAtDeskQuery = {
          organization: organization,
          department: department,
          assigned_to: manager_name,
          breach_type: constants.NOT_AT_DESK,
          detected_at: {
            $gte: from,
            $lt: till,
          },
        };
        mobileDetectedQuery = {
          organization: organization,
          department: department,
          assigned_to: manager_name,
          breach_type: constants.MOBILE_DETECTED,
          detected_at: {
            $gte: from,
            $lt: till,
          },
        };
        multiplePersonQuery = {
          organization: organization,
          department: department,
          assigned_to: manager_name,
          breach_type: constants.MULTIPLE_PERSONS,
          detected_at: {
            $gte: from,
            $lt: till,
          },
        };

        unknownPersonQuery = {
          organization: organization,
          department: department,
          assigned_to: manager_name,
          breach_type: constants.UNKNOWN_USER,
          detected_at: {
            $gte: from,
            $lt: till,
          },
        };
      } else {
        notAtDeskQuery = {
          organization: organization,
          department: department,
          breach_type: constants.NOT_AT_DESK,
          detected_at: {
            $gte: from,
            $lt: till,
          },
        };
        mobileDetectedQuery = {
          organization: organization,
          department: department,
          breach_type: constants.MOBILE_DETECTED,
          detected_at: {
            $gte: from,
            $lt: till,
          },
        };
        multiplePersonQuery = {
          organization: organization,
          department: department,
          breach_type: constants.MULTIPLE_PERSONS,
          detected_at: {
            $gte: from,
            $lt: till,
          },
        };

        unknownPersonQuery = {
          organization: organization,
          department: department,
          breach_type: constants.UNKNOWN_USER,
          detected_at: {
            $gte: from,
            $lt: till,
          },
        };
      }
    }

    let not_at_desk_count = await PrivacyBreach.find(
      notAtDeskQuery
    ).countDocuments();
    let mobile_detected_count = await PrivacyBreach.find(
      mobileDetectedQuery
    ).countDocuments();
    let multiple_persons_count = await PrivacyBreach.find(
      multiplePersonQuery
    ).countDocuments();
    let unknown_persons_count = await PrivacyBreach.find(
      unknownPersonQuery
    ).countDocuments();

    return res.status(200).json({
      message: 'Breach fetched successfully',
      not_at_desk_count: not_at_desk_count,
      mobile_detected_count: mobile_detected_count,
      multiple_persons_count: multiple_persons_count,
      unknown_persons_count: unknown_persons_count,
    });
  } catch (error) {
    logger.error(error);
    return res.status(500).json({
      code: 'SERVER_ERROR',
      description: 'something went wrong, Please try again',
    });
  }
};
const riskyUsers = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;

    if (
      !const_config.isAllowedRole(role, [
        'ADMIN',
        'MANAGER',
        'SUPER_ADMIN',
        'AUDIT',
        'CLIENT',
        'SUPER_AUDIT',
      ])
    ) {
      return res.status(401).json({
        description: 'Unauthorized',
      });
    }

    if (organization === undefined || organization === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Organization is required',
        field: 'organization',
      });
    }

    let risky_users = [];
    let medium_risk_users = [];
    let low_risk_users = [];
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
        is_licensed: true,
      };
    }
    let config_query = null;
    config_query = {
      organization: organization,
      department: department,
    };
    let configs = await Configuration.findOne(config_query);
    let threshold_risky_users = configs.high_range_risky_user;
    let threshold_low_risk_users = configs.low_range_risky_user;

    let users = await Users.find(query);
    for (let j = 0; j < users.length; j++) {
      let photo = users[j].photo_url;
      let user_organization = users[j].organization;
      let user_department = users[j].department;
      let user_user_email = users[j].user_email;
      let breaches_array = [];
      let breach_query = null;
      if (const_config.isAllowedRole(role, ['MANAGER'])) {
        breach_query = {
          user_email: user_user_email,
          organization: organization,
          assigned_to: user_email,
        };
      } else {
        breach_query = {
          user_email: user_user_email,
          organization: organization,
          department: department,
        };
      }
      let privacy_breach_count = await PrivacyBreach.find(
        breach_query
      ).countDocuments();

      let temp_breach_array = {
        count: privacy_breach_count,
      };
      if (privacy_breach_count >= threshold_risky_users) {
        breaches_array.push(temp_breach_array);
        let user_temp = {
          user_email: user_user_email,
          photo: photo,
          organization: user_organization,
          department: user_department,
          breaches: breaches_array,
        };
        risky_users.push(user_temp);
      }
      if (
        privacy_breach_count < threshold_risky_users &&
        privacy_breach_count > threshold_low_risk_users
      ) {
        breaches_array.push(temp_breach_array);
        let user_temp = {
          user_email: user_user_email,
          photo: photo,
          organization: user_organization,
          department: user_department,
          breaches: breaches_array,
        };
        medium_risk_users.push(user_temp);
      }
      if (privacy_breach_count <= threshold_low_risk_users) {
        breaches_array.push(temp_breach_array);
        let user_temp = {
          user_email: user_user_email,
          photo: photo,
          organization: user_organization,
          department: user_department,
          breaches: breaches_array,
        };
        low_risk_users.push(user_temp);
      }
    }

    {
      return res.status(200).json({
        message: 'Breaches fetched successfully',
        risky_users: risky_users,
        medium_risk: medium_risk_users,
        low_risk_users: low_risk_users,
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

const riskyUsers_remediation = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;

    if (
      !const_config.isAllowedRole(role, [
        'ADMIN',
        'MANAGER',
        'SUPER_ADMIN',
        'AUDIT',
        'CLIENT',
        'SUPER_AUDIT',
      ])
    ) {
      return res.status(401).json({
        description: 'Unauthorized',
      });
    }

    if (organization === undefined || organization === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Organization is required',
        field: 'organization',
      });
    }

    let risky_users = [];

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
        is_licensed: true,
      };
    }
    let config_query = null;
    config_query = {
      organization: organization,
      department: department,
    };
    let configs = await Configuration.findOne(config_query);
    let threshold_risky_users = configs.high_range_risky_user;

    let users = await Users.find(
      query,
      'photo_url organization department user_email'
    ); //.skip(i * limit).limit(limit);

    for (let j = 0; j < users.length; j++) {
      let photo = users[j].photo_url;
      let user_organization = users[j].organization;
      let user_department = users[j].department;
      let user_user_email = users[j].user_email;
      let breaches_array = [];
      let breach_query = null;
      if (const_config.isAllowedRole(role, ['MANAGER'])) {
        breach_query = {
          user_email: user_user_email,
          organization: organization,
          assigned_to: user_email,
          breach_type: {
            $ne: 'RANDOM_IMAGE',
          },
        };
        breach_query_remdiation = {
          user_email: user_user_email,
          organization: organization,
          assigned_to: user_email,
          remediation: { $exists: true },
        };
      } else {
        breach_query = {
          user_email: user_user_email,
          organization: organization,
          department: department,
          breach_type: {
            $ne: 'RANDOM_IMAGE',
          },
        };
        breach_query_remdiation = {
          user_email: user_user_email,
          organization: organization,
          department: department,
          remediation: { $exists: true },
        };
      }
      let privacy_breach_count = await PrivacyBreach.find(
        breach_query
      ).countDocuments();

      let privacy_breach_remed = await PrivacyBreach.find(
        breach_query_remdiation,
        'remediation'
      );
      privacy_breach_remed = privacy_breach_remed.reverse().slice(0, 3);
      let temp_breach_array = {
        count: privacy_breach_count,
      };
      if (privacy_breach_count >= threshold_risky_users) {
        breaches_array.push(temp_breach_array);
        let user_temp = {
          user_email: user_user_email,
          photo: photo,
          organization: user_organization,
          department: user_department,
          breaches: breaches_array,
          remediation: privacy_breach_remed,
        };
        risky_users.push(user_temp);
      }
    }

    {
      return res.status(200).json({
        message: 'Breaches fetched successfully',
        risky_users: risky_users,
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

const getNumberOfPrivacyBreachesWithDatesPagination = async (
  req,
  res,
  next
) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;

    let { from, to } = req.query;
    const limit = parseInt(req.query.limit); // Make sure to parse the limit to number
    const skip = parseInt(req.query.skip);

    if (
      !const_config.isAllowedRole(role, [
        'ADMIN',
        'MANAGER',
        'SUPER_ADMIN',
        'AUDIT',
        'CLIENT',
        'SUPER_AUDIT',
      ])
    ) {
      return res.status(401).json({
        description: 'Unauthorized',
      });
    }

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
        is_licensed: true,
      };
    }

    let users = await Users.find(query).skip(skip).limit(limit);
    let users_count = await Users.find(query);
    users_count = users_count.length;
    for (let i = 0; i < users.length; i++) {
      let breaches_array = [];
      let breach_query = null;
      let total_breach_query = null;
      let total_privacy_breach_count = null;
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
          total_breach_query = {
            user_email: users[i].user_email,
            organization: organization,
            assigned_to: user_email,
            date: {
              $gte: from,
              $lt: till,
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
          total_breach_query = {
            user_email: users[i].user_email,
            organization: organization,
            department: department,
            date: {
              $gte: from,
              $lt: till,
            },
            breach_type: {
              $ne: 'RANDOM_IMAGE',
            },
          };
        }
        let privacy_breach_count = await PrivacyBreach.find(
          breach_query
        ).countDocuments();
        total_privacy_breach_count = await PrivacyBreach.find(
          total_breach_query
        ).countDocuments();

        let temp_breach_array = {
          count: privacy_breach_count,
          date: moment(date).format('MM-DD-YYYY'),
        };

        breaches_array.push(temp_breach_array);
      }
      let user_temp = {
        user_email: users[i].user_email,
        breaches: breaches_array,
        total_privacy_breach_count: total_privacy_breach_count,
      };
      response_array_main.push(user_temp);
    }
    response_array_main.sort(
      (a, b) => b.total_privacy_breach_count - a.total_privacy_breach_count
    );
    {
      return res.status(200).json({
        message: 'Breaches fetched successfully',
        breaches: response_array_main,
        usersCount: users_count,
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

const breachesWithDates = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;

    let { from, to } = req.query;
    const limit = parseInt(req.query.limit); // Make sure to parse the limit to number
    const skip = parseInt(req.query.skip);

    if (
      !const_config.isAllowedRole(role, [
        'ADMIN',
        'MANAGER',
        'SUPER_ADMIN',
        'AUDIT',
        'CLIENT',
        'SUPER_AUDIT',
      ])
    ) {
      return res.status(401).json({
        description: 'Unauthorized',
      });
    }

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

    let query = null;
    let tomorrow = new Date(to);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (const_config.isAllowedRole(role, ['MANAGER'])) {
      query = {
        organization: organization,
        assigned_to: user_email,
        detected_at: { $gte: new Date(from), $lt: tomorrow },
      };
    } else {
      query = {
        organization: organization,
        department: department,
        detected_at: { $gte: new Date(from), $lt: tomorrow },
      };
    }

    logger.debug('Tomorrow ', new Date(tomorrow));

    PrivacyBreach.aggregate([
      {
        $match: query,
      },
      {
        $group: {
          _id: {
            date: '$date',
            user_email: '$user_email',
          },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: '$_id.user_email',
          breaches: {
            $push: {
              date: '$_id.date',
              count: '$count',
            },
          },
        },
      },
      {
        $unwind: '$breaches',
      },
      {
        $group: {
          _id: '$_id',
          total_privacy_breach_count: { $sum: '$breaches.count' },
          breaches: { $push: '$breaches' },
          //user_email: { "$project" : { "user_email": "$breaches.user_email", "_id.": 0 }} //"$_id.user_email"
        },
      },
      { $sort: { total_privacy_breach_count: -1 } },
    ]).exec((err, count) => {
      if (err) throw err;

      let breaches = count.slice(skip, skip + limit);
      let response = [];
      for (let breach of breaches) {
        let allbreaches = breach.breaches;
        allbreaches = allbreaches.map((el) => {
          el.date = moment(el.date).format('MM-DD-YYYY');
          return el;
        });

        const obj = { user_email: breach._id, breaches: allbreaches };
        response.push(obj);
      }
      return res.status(200).json({
        message: 'Breaches with Date fetched successfully',
        breaches: response,
        usersCount: count.length,
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

const breachesWithDatesTest = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;

    let { from, to } = req.query;
    let { manager_name, member_email } = req.body;

    const limit = parseInt(req.query.limit); // Make sure to parse the limit to number
    const skip = parseInt(req.query.skip);

    if (
      !const_config.isAllowedRole(role, [
        'ADMIN',
        'MANAGER',
        'SUPER_ADMIN',
        'AUDIT',
        'CLIENT',
        'SUPER_AUDIT',
      ])
    ) {
      return res.status(401).json({
        description: 'Unauthorized',
      });
    }

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

    let query = null;
    let tomorrow = new Date(to);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (const_config.isAllowedRole(role, ['MANAGER'])) {
      query = {
        organization: organization,
        assigned_to: user_email,
        detected_at: { $gte: new Date(from), $lt: tomorrow },
      };
    } else {
      if (!(manager_name === undefined || manager_name === '')) {
        logger.debug('entered in manager query');
        query = {
          organization: organization,
          department: department,
          assigned_to: manager_name,
          detected_at: { $gte: new Date(from), $lt: tomorrow },
        };
      } else if (!(member_email === undefined || member_email === '')) {
        query = {
          organization: organization,
          department: department,
          user_email: { $regex: member_email },
          detected_at: { $gte: new Date(from), $lt: tomorrow },
        };
      } else {
        query = {
          organization: organization,
          department: department,
          detected_at: { $gte: new Date(from), $lt: tomorrow },
        };
      }
    }

    let time_zone = req.timezone;
    logger.debug('Tomorrow ', new Date(tomorrow));

    PrivacyBreach.aggregate([
      {
        $match: query,
      },
      {
        $project: {
          _id: 0,
          detected_at: '$detected_at',
          user_email: '$user_email',
        },
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: '%m-%d-%Y',
                date: '$detected_at',
                timezone: time_zone,
              },
            },
            user_email: '$user_email',
          },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: '$_id.user_email',
          breaches: {
            $push: {
              date: '$_id.date',
              count: '$count',
            },
          },
        },
      },
      {
        $unwind: '$breaches',
      },
      {
        $group: {
          _id: '$_id',
          total_privacy_breach_count: { $sum: '$breaches.count' },
          breaches: { $push: '$breaches' },
          //user_email: { "$project" : { "user_email": "$breaches.user_email", "_id.": 0 }} //"$_id.user_email"
        },
      },
      { $sort: { total_privacy_breach_count: -1 } },
    ]).exec((err, count) => {
      if (err) throw err;

      let breaches = count.slice(skip, skip + limit);
      let response = [];
      for (let breach of breaches) {
        let allbreaches = breach.breaches;
        allbreaches = allbreaches.map((el) => {
          //el.date = moment(el.date).format('MM-DD-YYYY')
          el.date = el.date;
          return el;
        });

        const obj = { user_email: breach._id, breaches: allbreaches };
        response.push(obj);
      }
      return res.status(200).json({
        message: 'Breaches with Date fetched successfully',
        breaches: response,
        usersCount: count.length,
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

const riskyUsersRemediation = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;

    let { manager_name } = req.body;
    const limit = parseInt(req.query.limit);
    const skip = parseInt(req.query.skip);
    if (
      !const_config.isAllowedRole(role, [
        'ADMIN',
        'MANAGER',
        'SUPER_ADMIN',
        'AUDIT',
        'CLIENT',
        'SUPER_AUDIT',
      ])
    ) {
      return res.status(401).json({
        description: 'Unauthorized',
      });
    }

    if (organization === undefined || organization === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Organization is required',
        field: 'organization',
      });
    }

    if (skip === undefined || skip === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Skip is required',
        field: 'skip',
      });
    }

    if (limit === undefined || limit === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Limit is required',
        field: 'limit',
      });
    }

    let config_query = null;
    config_query = {
      organization: organization,
      department: department,
    };
    let configs = await Configuration.findOne(config_query);
    let threshold_risky_users = configs.high_range_risky_user;
    let breach_query = null;
    if (const_config.isAllowedRole(role, ['MANAGER'])) {
      breach_query = {
        organization: organization,
        assigned_to: user_email,
      };
    } else {
      if (!(manager_name === undefined || manager_name === '')) {
        breach_query = {
          organization: organization,
          department: department,
          assigned_to: manager_name,
        };
      } else {
        breach_query = {
          organization: organization,
          department: department,
        };
      }
    }

    await PrivacyBreach.aggregate([
      {
        $match: breach_query,
      },
      {
        $project: {
          _id: 0,
          user_email: '$user_email',
        },
      },
      {
        $group: {
          _id: {
            user_email: '$user_email',
          },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gte: threshold_risky_users } } },
      { $sort: { count: -1 } },
      {
        $lookup: {
          from: 'users',
          let: {
            department: department,
            organization: organization,
            user_email: '$_id.user_email',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$department', '$$department'] },
                    { $eq: ['$organization', '$$organization'] },
                    { $eq: ['$user_email', '$$user_email'] },
                  ],
                },
              },
            },
            {
              $project: { photo_url: { $ifNull: ['$photo_url', ''] }, _id: 0 },
            },
          ],
          as: 'data',
        },
      },
      {
        $project: {
          _id: {
            user_email: '$_id.user_email',
          },
          count: '$count',
          photo_url: '$data.photo_url',
        },
      },
    ]).exec(async (err, count) => {
      if (err) throw err;
      let totalCount = count.length;
      count = count.slice(skip, skip + limit);
      let results = [];

      for (let i = 0; i < count.length; i++) {
        // let breach_query_remdiation = {
        //     user_email: count[i]._id.user_email,
        //     organization: organization,
        //     department: department,
        //     remediation: { $exists: true }
        // }

        // let user_detail = await Users.findOne({ user_email: count[i]._id.user_email }, 'photo_url');
        // if (user_detail === null || user_detail === undefined || user_detail === '') {
        //     user_detail = { photo_url: '' };
        // }
        //let privacy_breach_remed = await PrivacyBreach.find(breach_query_remdiation, 'remediation').sort({ updatedAt: -1 }).skip(0).limit(3)

        let user_email = count[i]._id.user_email;

        let photo = count[i].photo_url[0];
        organization = organization;
        department = department;
        let breaches = [
          {
            count: count[i].count,
          },
        ];
        let data = {
          user_email: user_email,
          photo: photo,
          organization: organization,
          department: department,
          breaches: breaches,
          remediation: [],
        };
        results.push(data);
      }
      return res.status(200).json({
        message: ' Risky Users fetched successfully',
        risky_users: results,
        totalCount: totalCount,
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
const TATDashboard = async (req, res, next) => {
  try {
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
    let local_date_from = moment(jDateToday).tz(time_zone);
    let local_date_till = moment(jDateTill).tz(time_zone);

    from = local_date_from.startOf('day').toDate();
    let till = local_date_till.endOf('day').toDate();
    let reports = [];
    // let queryNotAudited = {
    //     audit_done: false,
    //     image_save: true,
    //     organization:organization,
    //     detected_at:{
    //         $gte: from,
    //         $lt: till
    //     }
    // }

    // let not_audited = await PrivacyBreach.find(queryNotAudited).countDocuments();

    let query = {
      audit_done: true,
      image_save: true,
      organization: organization,
      detected_at: {
        $gte: from,
        $lt: till,
      },
    };

    await PrivacyBreach.aggregate([
      {
        $match: query,
      },
      {
        $group: {
          _id: '$department',
          sum: { $sum: 1 },
          non_compliant: {
            $sum: {
              $cond: [
                {
                  $and: [
                    {
                      $eq: ['$non_compliance', true],
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },
          compliant: {
            $sum: {
              $cond: [
                {
                  $and: [
                    {
                      $eq: ['$compliance', true],
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },
          purge: {
            $sum: {
              $cond: [
                {
                  $and: [
                    {
                      $eq: ['$purge', true],
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },
          avg_time: {
            $avg: {
              $subtract: ['$updatedAt', '$createdAt'],
            },
          },
        },
      },

      {
        $project: {
          _id: 1,
          total_violation: {
            $add: ['$non_compliant', '$compliant', '$purge'],
          },
          compliant: 1,
          non_compliant: 1,
          purge: 1,
          averageInSec: {
            $divide: ['$avg_time', 1000],
          },
        },
      },
    ]).exec((err, response) => {
      if (err) throw err;

      for (let i = 0; i < response.length; i++) {
        let entry = {
          department: response[i]._id,
          total_violation: response[i].total_violation,
          compliant: response[i].compliant,
          non_compliant: response[i].non_compliant,
          purge: response[i].purge,
          // not_audited:response[i].not_audited,
          averageInSec: response[i].averageInSec,
        };
        reports.push(entry);
      }

      return res.status(200).json({
        message: 'Tat dashboard fetched successfully',
        data: reports,
      });
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
  getNumberOfPrivacyBreaches: getNumberOfPrivacyBreaches,
  getNumberOfPrivacyBreachesWithDates: getNumberOfPrivacyBreachesWithDates,
  breachesPercentage: breachesPercentage,
  riskyUsers: riskyUsers,
  riskyUsers_remediation: riskyUsers_remediation,
  getNumberOfPrivacyBreachesWithDatesPagination:
    getNumberOfPrivacyBreachesWithDatesPagination,
  breachesWithDates: breachesWithDates,
  riskyUsersRemediation: riskyUsersRemediation,
  breachesWithDatesTest: breachesWithDatesTest,
  tatDashboard: TATDashboard,
};
