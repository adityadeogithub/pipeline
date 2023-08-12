const express = require('express');
const mongoose = require('mongoose');
const dashboard = require('../../models/dashboard');
const Activity = require('../../models/activity');
const WorkLocation = require('../../models/user_work_location');
const AuditOrganization = require('../../models/audit_organization');
const AdminOrganization = require('../../models/admin_organization');
const PrivacyBreach = require('../../models/privacy_breach');
const user_leave_model = require('../../models/users_leave');
const Task = require('../../models/task');
const Logger = require('../../configs/log');
const logger = new Logger('dashboard');
const util = require('util');
const const_config = require('../../utility/util');
const moment = require('moment-timezone');
const users = require('../../models/users');
const Configuration = require('../../models/configuration');
const ActiveAuxManagement = require('../../models/active_aux_management');
const AuxManagement = require('../../models/aux_management');
const { parse } = require('json2csv');
const Department = require('../../models/department');

function findFromCollection(name, query, cb) {
  mongoose.connection.db.collection(name, function (err, collection) {
    collection.find(query).toArray(cb);
  });
}

const getProductivityPercentage = async (req, res, next) => {
  //EXPECTED
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;
    let assigned_to = req.assigned_to;

    let { member_email, manager_name } = req.body;

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

    // TODO: check department is exist or not for Organization
    let time_zone = req.timezone;
    let jDateToday = new Date(from);
    let jDateTill = new Date(to);

    // from = moment(jDateToday).tz(time_zone).format('YYYY-MM-DDTHH:mm:ss.SSSZ')
    // let till = moment(jDateTill).endOf('day').tz(time_zone).format()
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
    logger.debug('from =', from);
    logger.debug('till =', till);
    let usersQuery = null;
    //ACTUAL

    let totalLoggedHours = null;
    let departmentName;
    let departmentsArray;
    let inDepartments = [];
    if (const_config.isAllowedRole(role, ['AGENT'])) {
      totalLoggedHours = {
        organization,
        department,
        user_email: user_email,
        date: {
          $gte: from,
          $lt: till,
        },
      };
    } else if (const_config.isAllowedRole(role, ['MANAGER'])) {
      if (!(member_email === undefined || member_email === '')) {
        totalLoggedHours = {
          assigned_to: user_email,
          organization,
          user_email: member_email,
          date: {
            $gte: from,
            $lt: till,
          },
        };
      } else {
        totalLoggedHours = {
          assigned_to: user_email,
          organization,
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
        'CLIENT',
        'SUPER_AUDIT',
      ])
    ) {
      if (department === 'ALL') {
        totalLoggedHours = {
          organization,
          date: {
            $gte: from,
            $lt: till,
          },
        };
      } else {
        if (!(member_email === undefined || member_email === '')) {
          totalLoggedHours = {
            organization,
            department,
            user_email: member_email,
            date: {
              $gte: from,
              $lt: till,
            },
          };
        } else if (!(manager_name === undefined || manager_name === '')) {
          totalLoggedHours = {
            organization,
            department,
            assigned_to: manager_name,
            date: {
              $gte: from,
              $lt: till,
            },
          };
        } else {
          totalLoggedHours = {
            organization,
            department,
            date: {
              $gte: from,
              $lt: till,
            },
          };
        }
      }
    } else if (const_config.isAllowedRole(role, ['AUDIT'])) {
      let tempDepartmentName = await AuditOrganization.findOne(
        { user_email },
        'organization_array.name organization_array.departments.name'
      );

      for (let j = 0; j < tempDepartmentName.organization_array.length; j++) {
        let orgName = tempDepartmentName.organization_array[j].name;
        if (orgName === organization) {
          for (
            let i = 0;
            i < tempDepartmentName.organization_array[j].departments.length;
            i++
          ) {
            let element =
              tempDepartmentName.organization_array[j].departments[i].name;
            inDepartments.push(element);
          }
          departmentsArray =
            tempDepartmentName.organization_array[j].departments;
        }
      }

      if (department === 'ALL') {
        totalLoggedHours = {
          organization: organization,
          department: { $in: inDepartments },
          date: {
            $gte: from,
            $lt: till,
          },
        };
      } else {
        if (!(member_email === undefined || member_email === '')) {
          totalLoggedHours = {
            organization,
            department: { $in: inDepartments },
            user_email: member_email,
            date: {
              $gte: from,
              $lt: till,
            },
          };
        } else if (!(manager_name === undefined || manager_name === '')) {
          totalLoggedHours = {
            organization,
            department: { $in: inDepartments },
            assigned_to: manager_name,
            date: {
              $gte: from,
              $lt: till,
            },
          };
        } else {
          totalLoggedHours = {
            organization,
            department: { $in: inDepartments },
            date: {
              $gte: from,
              $lt: till,
            },
          };
        }
      }
    }

    let total_users = await users
      .find({
        organization,
        department,
      })
      .countDocuments();

    let productivity = await Activity.aggregate([
      {
        $match: totalLoggedHours,
      },
      {
        $project: {
          _id: 0,
          user_email: 1,
          breaks: { $sum: '$breaks.minutes' },
          idleTime: 1,
          loginHours: 1,
          activeApps: { $setUnion: ['$activeApps', '$visitedWeb'] },
        },
      },
      {
        $group: {
          _id: null,
          break: {
            $push: {
              minutes: '$breaks',
            },
          },
          idle: {
            $push: {
              idleTime: '$idleTime',
            },
          },
          loginHours: {
            $push: {
              loginHours: '$loginHours',
            },
          },
          allAppWeb: {
            $push: {
              activeApps: '$activeApps',
            },
          },
        },
      },
      {
        $addFields: {
          loginHours: { $sum: '$loginHours.loginHours' },
        },
      },
      {
        $project: {
          _id: 0,
          idle: { $sum: '$idle.idleTime' },
          break: { $sum: '$break.minutes' },
          loginHours: {
            $round: [{ $divide: ['$loginHours', 60] }, 2],
          },
          allAppWeb: '$allAppWeb',
        },
      },
      {
        $project: {
          _id: 0,
          idle: 1,
          break: 1,
          desk_time: { minutes: { $round: ['$loginHours', 0] } },
        },
      },
      {
        $lookup: {
          from: 'configurations',
          let: {
            organization: organization,
            department: department,
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$organization', '$$organization'] },
                    { $eq: ['$department', '$$department'] },
                  ],
                },
              },
            },
            {
              $project: {
                _id: 0,
                productivity: 1,
              },
            },
            {
              $group: {
                _id: '$productivity.work_hours',
              },
            },
          ],
          as: 'config',
        },
      },
      {
        $unwind: {
          path: '$config',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          user: 1,
          department: 1,
          idle: {
            $cond: { if: '$idle', then: '$idle', else: 0 },
          },
          break: {
            $cond: { if: '$break', then: '$break', else: 0 },
          },
          desk_time: {
            $cond: {
              if: '$desk_time.minutes',
              then: '$desk_time.minutes',
              else: 0,
            },
          },
          work_hours: '$config._id',
          days: {
            $dateDiff: {
              startDate: from,
              endDate: till,
              unit: 'day',
            },
          },
        },
      },
      {
        $addFields: {
          expected_work_hours: { $multiply: ['$work_hours', '$days'] },
        },
      },
      {
        $project: {
          user: 1,
          department: 1,
          idle: 1,
          break: 1,
          desk_time: 1,
          work_hours: 1,
          days: 1,
          allAppWeb: 1,
          expected_work_hours_min: { $multiply: ['$expected_work_hours', 60] },
        },
      },
      {
        $addFields: {
          productivity: {
            $multiply: [
              { $divide: ['$desk_time', '$expected_work_hours_min'] },
              100,
            ],
          },
        },
      },
      {
        $project: {
          _id: 0,
          productivity: {
            $round: ['$productivity', 2],
          },
        },
      },
    ]);

    return res.status(200).json({
      message: 'Productivity percentage fetched successfully',
      data: {
        productivity_percentage:
          productivity.length !== 0 ? productivity[0].productivity : 0,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      code: 'SERVER_ERROR',
      description: 'something went wrong, Please try again',
    });
  }
  //END
};

const test = async (req, res, next) => {
  try {
    let { from, to } = req.query;
    let { organization, department } = req.body;

    if (organization === undefined || organization === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: ' Organization is required',
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
        description: 'TO is required',
        field: 'to',
      });
    }
    let time_zone = req.timezone;
    let jDateToday = new Date(from);
    let jDateTill = new Date(to);

    // from = moment(jDateToday).tz(time_zone).format('YYYY-MM-DDTHH:mm:ss.SSSZ')
    // let till = moment(jDateTill).endOf('day').tz(time_zone).format()
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

    activeUserQuery = {
      organization: organization,
      date: {
        $gte: from,
        $lt: till,
      },
    };
    userCountQuery = {
      organization: organization,
    };

    await Activity.aggregate([
      {
        $match: activeUserQuery,
      },
      {
        $group: {
          _id: {
            department: '$department',
            date: {
              $dateToString: {
                format: '%m-%d-%Y',
                date: '$date',
                timezone: time_zone,
              },
            },
          },
          active_count: {
            $sum: 1,
          },
        },
      },
      {
        $sort: {
          date: 1,
        },
      },
    ]).exec(async (err, count) => {
      if (err) throw err;
      let totalCount = count;
      let results = [];

      for (let i = 0; i < count.length; i++) {
        let userCountQuery = {
          department: count[i]._id.department,
        };

        let total_user = await users.find(userCountQuery).countDocuments();

        let data = {
          total_user: total_user,
          department: count[i]._id.department,
          absent_user: total_user - count[i].active_count,
          present_user: count[i].active_count,
        };
        results.push(data);
      }

      return res.status(200).json({
        message: 'Department data fetched successfully',
        userCount: results,
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

const getTotalHeadCount = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;
    let assigned_to = req.assigned_to;

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

    let userCountQuery = null;
    logger.debug(
      'Hello ' +
      const_config.isAllowedRole(role, [
        'ADMIN',
        'SUPER_ADMIN',
        'AUDIT',
        'MANAGER',
        'AUDIT',
        'SUPER_AUDIT',
      ])
    );
    if (const_config.isAllowedRole(role, ['MANAGER'])) {
      userCountQuery = {
        assigned_to: user_email,
        organization: organization,
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
        userCountQuery = {
          organization: organization,
        };
      } else {
        userCountQuery = {
          organization: organization,
          department: department,
        };
      }
    }

    findFromCollection('users', userCountQuery, function (err, users) {
      if (err) {
        logger.error(err);
        return res.status(500).json({
          code: 'SERVER_ERROR',
          description: 'something went wrong, Please try again',
        });
      }
      let head_count = users.length;
      logger.debug('Head Count ' + head_count);

      return res.status(200).json({
        message: 'Head Count fetched successfully',
        data: {
          head_count: head_count,
        },
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

const getExpectedWorkHours = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;
    let assigned_to = req.assigned_to;

    //NOTE: from and to date should be same
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

    // TODO: check department is exist or not for Organization

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
    }
    logger.debug('From', from);
    logger.debug('Till', till);

    let configQuery = null;
    let activityQuery = null;
    if (department === 'ALL') {
      configQuery = {
        organization,
      };
    } else {
      configQuery = {
        organization,
        department,
      };
    }

    if (const_config.isAllowedRole(role, ['MANAGER'])) {
      userCountQuery = {
        organization: organization,
        assigned_to: user_email,
      };
      activityQuery = {
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
        activityQuery = {
          organization: organization,
          date: {
            $gte: from,
            $lt: till,
          },
        };
        userCountQuery = {
          organization: organization,
        };
      } else {
        activityQuery = {
          organization: organization,
          department: department,
          date: {
            $gte: from,
            $lt: till,
          },
        };
        userCountQuery = {
          organization: organization,
          department: department,
        };
      }
    }

    let user_count = await users.find(userCountQuery).countDocuments();
    let Activity_count = await Activity.find(activityQuery).countDocuments();

    findFromCollection('configurations', configQuery, function (err, configs) {
      if (err) {
        logger.error(err);
        return res.status(500).json({
          code: 'SERVER_ERROR',
          description: 'something went wrong, Please try again',
        });
      }
      if (configs.length === 0) {
        return res.status(200).json({
          message: 'Expected Work Hours fetched successfully',
          data: {
            expected_work_hours: 0,
            expected_work_hours_activity: 0,
          },
        });
      }

      let expected_work_hours = 0;
      let expected_work_hours_activity = 0;

      if (department === 'ALL') {
        let work_hours = 0;
        for (var config of configs) {
          work_hours = work_hours + config.productivity.work_hours;
        }
        logger.debug('total work hours ', work_hours);
        //+1 is added include the start date at the end
        let days =
          moment(new Date(jDateTill)).diff(moment(jDateToday), 'days') + 1;
        logger.debug(days);
        logger.debug('work_hours ', work_hours);
        logger.debug('user_count ', user_count);

        expected_work_hours = days * work_hours * user_count;
        logger.debug('Expected Work Hours', expected_work_hours);
      } else {
        let work_hours = configs[0].productivity.work_hours;
        //+1 is added include the start date at the end
        let days =
          moment(new Date(jDateTill)).diff(moment(jDateToday), 'days') + 1;
        logger.debug(days);
        expected_work_hours = days * work_hours * user_count;
        expected_work_hours_activity = days * work_hours * Activity_count;
        logger.debug('Expected Work Hours', expected_work_hours);
      }
      return res.status(200).json({
        message: 'Expected Work Hours fetched successfully',
        data: {
          expected_work_hours: expected_work_hours,
          expected_work_hours_activity: expected_work_hours_activity,
        },
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

const getTotalAttendanceCount = async (req, res, next) => {
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
    }
    logger.debug('From', from);
    logger.debug('Till', till);

    let attendanceQuery = null;
    if (const_config.isAllowedRole(role, ['MANAGER'])) {
      attendanceQuery = {
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
        attendanceQuery = {
          organization: organization,
          date: {
            $gte: from,
            $lt: till,
          },
        };
      } else {
        attendanceQuery = {
          organization: organization,
          department: department,
          date: {
            $gte: from,
            $lt: till,
          },
        };
      }
    }

    // fetch attendance count
    let attendance_count = await Activity.find(
      attendanceQuery
    ).countDocuments();

    return res.status(200).json({
      message: 'Attendance count fetched successfully',
      data: {
        attendance_count: attendance_count,
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

const getAvgLoggedVsNonWork = async (req, res, next) => {
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
    from = new Date(from);
    till = new Date(till);
    from.setDate(from.getDate() + 1);
    till.setDate(till.getDate() + 1);

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

    let reports = [];
    let date_array = getDates(from, till);
    let response_array = [];
    for (var i = 0; i < date_array.length; i++) {
      let date = date_array[i];

      let time_zone = req.timezone;
      let jDateToday = new Date(date_array[i]);

      //let local_date = moment(jDateToday).tz(time_zone).format('YYYY-MM-DDTHH:mm:ss.SSSZ')
      //let start = local_date

      //let end = moment(local_date).add(23, 'hours').add(59, 'minutes').add(59, 'seconds').add(999, 'ms').tz(time_zone).format('YYYY-MM-DDTHH:mm:ss.SSSZ')
      let time_zone_name = moment.tz(time_zone).format('Z');

      let time_zone_name_char = time_zone_name.charAt(0);

      let start;
      let end;
      if ('+' === time_zone_name_char) {
        let local_date = moment(jDateToday).tz(time_zone);
        start = local_date.startOf('day').toDate();
        end = local_date.endOf('day').toDate();
      } else {
        let local_date = moment(jDateToday)
          .tz(time_zone)
          .format('YYYY-MM-DDTHH:mm:ss.SSS[Z]');
        start = local_date;

        end = moment(local_date)
          .add(23, 'hours')
          .add(59, 'minutes')
          .add(59, 'seconds')
          .add(999, 'ms')
          .format('YYYY-MM-DDTHH:mm:ss.SSS[Z]');
      }
      logger.debug('start-----', start);
      logger.debug('end-----', end);

      let totalLoggedHours = null;
      if (const_config.isAllowedRole(role, ['MANAGER'])) {
        totalLoggedHours = {
          assigned_to: user_email,
          organization,
          date: {
            $gte: start,
            $lt: end,
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
          totalLoggedHours = {
            organization,
            date: {
              $gte: start,
              $lt: end,
            },
          };
        } else if (!(manager_name === undefined || manager_name === '')) {
          totalLoggedHours = {
            organization,
            department,
            assigned_to: manager_name,
            date: {
              $gte: start,
              $lt: end,
            },
          };
        } else {
          totalLoggedHours = {
            organization,
            department,
            date: {
              $gte: start,
              $lt: end,
            },
          };
        }
      }

      let activities = await Activity.find(
        totalLoggedHours,
        'loginHours idleTime'
      );
      let total_logged_hours = 0;
      let total_idle_minutes = 0;

      let activities_count = 0;
      let avg_logged = 0;
      let avg_non_worked = 0;

      if (activities.length > 0) {
        for (let activity of activities) {
          let login_hours = activity.loginHours;
          total_logged_hours = total_logged_hours + login_hours;
          let idle_minutes = activity.idleTime;
          total_idle_minutes = total_idle_minutes + idle_minutes;
        }

        let total_logged_in_minutes = total_logged_hours / 60;
        activities_count = activities.length;
        avg_logged = total_logged_in_minutes / activities_count;
        avg_non_worked = total_idle_minutes / activities_count;
      }

      logger.debug('activities_count ', activities_count);
      logger.debug('avg_logged ', avg_logged);
      logger.debug('avg_non_worked ', avg_non_worked);

      let avg_logged_non_worked = {
        date: date,
        logged: avg_logged,
        non_worked: avg_non_worked,
      };

      response_array.push(avg_logged_non_worked);

      let entry = {
        organization: organization,
        department: department,
        date: date,
        average_logged_in_hours: avg_logged,
        idle_hours: avg_non_worked,
      };

      reports.push(entry);
    }

    if (report_type === 'csv') {
      try {
        const fields = [
          'organization',
          'department',
          'date',
          'average_logged_in_hours',
          'idle_hours',
        ];
        const opts = { fields };
        const csv = parse(reports, opts);
        return res.status(200).send(csv);
      } catch (err) {
        logger.error(err);
        return res.status(500).json({
          code: 'SERVER_ERROR',
          description: 'Something went wrong, please try again',
        });
      }
    } else {
      return res.status(200).json({
        message:
          'Average logged time and average non work time fetched successfully',
        data: response_array,
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

const getWorkLocationPercentage = async (req, res, next) => {
  try {
    let role = req.role;
    let user_email = req.user_email;
    let { organization, department, manager_name } = req.body;

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

    let time_zone = req.timezone;
    let jDateToday = new Date(from);
    let jDateTill = new Date(to);

    //from = moment(jDateToday).tz(time_zone).format('YYYY-MM-DDTHH:mm:ss.SSSZ')
    //let till = moment(jDateTill).endOf('day').tz(time_zone).format('YYYY-MM-DDTHH:mm:ss.SSSZ')
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
    logger.info('From', from);
    logger.info('Till', till);

    let query_home = null;
    let query_office = null;

    if (const_config.isAllowedRole(role, ['MANAGER'])) {
      query_home = {
        organization: organization,
        assigned_to: user_email,
        work_location: 'Home',
        date: {
          $gte: from,
          $lt: till,
        },
      };

      query_office = {
        organization: organization,
        assigned_to: user_email,
        work_location: 'Office',
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
        query_home = {
          organization: organization,
          work_location: 'Home',
          date: {
            $gte: from,
            $lt: till,
          },
        };

        query_office = {
          organization: organization,
          work_location: 'Office',
          date: {
            $gte: from,
            $lt: till,
          },
        };
      } else if (!(manager_name === undefined || manager_name === '')) {
        query_home = {
          organization: organization,
          department: department,
          assigned_to: manager_name,
          work_location: 'Home',
          date: {
            $gte: from,
            $lt: till,
          },
        };

        query_office = {
          organization: organization,
          department: department,
          assigned_to: manager_name,
          work_location: 'Office',
          date: {
            $gte: from,
            $lt: till,
          },
        };
      } else {
        query_home = {
          organization: organization,
          department: department,
          work_location: 'Home',
          date: {
            $gte: from,
            $lt: till,
          },
        };

        query_office = {
          organization: organization,
          department: department,
          work_location: 'Office',
          date: {
            $gte: from,
            $lt: till,
          },
        };
      }
    } else if (const_config.isAllowedRole(role, ['AGENT'])) {
      query_home = {
        organization: organization,
        department: department,
        user_email: user_email,
        work_location: 'Home',
        date: {
          $gte: from,
          $lt: till,
        },
      };

      query_office = {
        organization: organization,
        department: department,
        user_email: user_email,
        work_location: 'Office',
        date: {
          $gte: from,
          $lt: till,
        },
      };
    }

    let data_home_count = await WorkLocation.find(query_home).countDocuments();
    let data_office_count = await WorkLocation.find(
      query_office
    ).countDocuments();
    let total_count = data_home_count + data_office_count;
    let home_count_perc = (data_home_count * 100) / total_count;
    let office_count_perc = (data_office_count * 100) / total_count;

    let responce = {
      total: total_count,
      home_loc_count: data_home_count,
      home_location_perc: home_count_perc,
      ofc_loc_count: data_office_count,
      ofc_loc_perc: office_count_perc,
    };

    return res.status(200).json({
      message: 'Data fetch successfully .',
      responce: responce,
    });
  } catch (error) {
    logger.error(error);

    return res.status(500).json({
      code: 'SERVER_ERROR',
      description: 'something went wrong, Please try again',
    });
  }
};

const getUserLeaveAnalytics = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;
    let assigned_to = req.assigned_to;

    let { from, to } = req.query;

    let { manager_name, report_type } = req.body;

    logger.debug('Organization', organization);
    logger.debug('Department', department);
    logger.debug('From', from);
    logger.debug('To', to);

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
    let local_date_from = moment(jDateToday);
    let local_date_till = moment(jDateTill);
    from = local_date_from.startOf('day').toDate();
    let till = local_date_till.endOf('day').toDate();
    from.setDate(from.getDate());
    till.setDate(till.getDate());
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

    logger.debug('data array ', getDates(from, till));

    let date_array = getDates(from, till);

    let response_array = [];
    for (var i = 0; i < date_array.length; i++) {
      let date = date_array[i];

      let userLeaveQuery = null;
      let query_office = null;
      if (const_config.isAllowedRole(role, ['MANAGER'])) {
        userLeaveQuery = {
          organization: organization,
          assigned_to: user_email,
          application_status: 'ACCEPTED',
          date_array: date_array[i],
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
          userLeaveQuery = {
            organization: organization,
            application_status: 'ACCEPTED',
            date_array: date_array[i],
          };
        } else if (!(manager_name === undefined || manager_name === '')) {
          userLeaveQuery = {
            organization: organization,
            department: department,
            application_status: 'ACCEPTED',
            date_array: date_array[i],
            assigned_to: manager_name,
          };
        } else {
          userLeaveQuery = {
            organization: organization,
            department: department,
            application_status: 'ACCEPTED',
            date_array: date_array[i],
          };
        }
      } else if (const_config.isAllowedRole(role, ['AGENT'])) {
        userLeaveQuery = {
          organization: organization,
          department: department,
          user_email: user_email,
          application_status: 'ACCEPTED',
          date_array: date_array[i],
        };
      }

      let userleave = await user_leave_model
        .find(userLeaveQuery)
        .countDocuments();

      let response = {
        organization: organization,
        department: department,
        date: date,
        user_leave: userleave,
      };
      response_array.push(response);
    }
    if (report_type === 'csv') {
      try {
        const fields = ['organization', 'department', 'user_leave', 'date'];
        const opts = { fields };
        const csv = parse(response_array, opts);
        return res.status(200).send(csv);
      } catch (err) {
        logger.error(err);
        return res.status(500).json({
          code: 'SERVER_ERROR',
          description: 'Something went wrong, please try again',
        });
      }
    } else {
      return res.status(200).json({
        message: 'User leave report fetched successfully',
        data: response_array,
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

// const getProductivityPercentageLoggedIn = async (req, res, next) => {

//     try {

//         let role = req.role
//         let organization = req.organization
//         let department = req.department
//         let user_email = req.user_email
//         let assigned_to = req.assigned_to

//         let {
//             from,
//             to
//         } = req.query;

//         let {
//             manager_name
//         } = req.body

//         if (organization === undefined || organization === '') {
//             return res.status(422).json({
//                 'code': 'REQUIRED_FIELD_MISSING',
//                 'description': 'Organization is required',
//                 'field': 'organization'
//             });
//         }

//         if (department === undefined || department === '') {
//             return res.status(422).json({
//                 'code': 'REQUIRED_FIELD_MISSING',
//                 'description': 'Department is required',
//                 'field': 'department'
//             });
//         }

//         if (user_email === undefined || user_email === '') {
//             return res.status(422).json({
//                 'code': 'REQUIRED_FIELD_MISSING',
//                 'description': 'User Email is required',
//                 'field': 'user_email'
//             });
//         }

//         if (from === undefined || from === '') {
//             return res.status(422).json({
//                 'code': 'REQUIRED_FIELD_MISSING',
//                 'description': 'From is required',
//                 'field': 'from'
//             });
//         }

//         if (to === undefined || to === '') {
//             return res.status(422).json({
//                 'code': 'REQUIRED_FIELD_MISSING',
//                 'description': 'From is required',
//                 'field': 'to'
//             });
//         }

//         let time_zone = req.timezone
//         let jDateToday = new Date(from)
//         let jDateTill = new Date(to)
//         let time_zone_name = moment.tz(time_zone).format('Z')

//         let time_zone_name_char = time_zone_name.charAt(0);
//         let till
//         if ("+" === time_zone_name_char) {
//             let local_date_from = moment(jDateToday).tz(time_zone)
//             let local_date_till = moment(jDateTill).tz(time_zone)
//             from = local_date_from.startOf('day').toDate()
//             till = local_date_till.endOf('day').toDate()
//         } else {
//             from = moment(jDateToday).tz(time_zone).format('YYYY-MM-DDTHH:mm:ss.SSS[Z]')
//             till = moment(jDateTill).endOf('day').tz(time_zone).format('YYYY-MM-DDTHH:mm:ss.SSS[Z]')
//         }
//         logger.debug('from-', from)
//         logger.debug('till-', till)

//         let totalLoggedHours = null

//         if (const_config.isAllowedRole(role, ["MANAGER"])) {

//             totalLoggedHours = {
//                 assigned_to: user_email,
//                 organization,
//                 date: {
//                     "$gte": from,
//                     "$lt": till
//                 }
//             }
//         } else if (const_config.isAllowedRole(role, ["ADMIN", "SUPER_ADMIN", "AUDIT", "CLIENT", "SUPER_AUDIT"])) {

//             if (department === 'ALL') {

//                 totalLoggedHours = {
//                     organization,
//                     date: {
//                         "$gte": from,
//                         "$lt": till
//                     }
//                 }
//             } else if (!(manager_name === undefined || manager_name === '')) {

//                 totalLoggedHours = {
//                     organization,
//                     department,
//                     assigned_to: manager_name,
//                     date: {
//                         "$gte": from,
//                         "$lt": till
//                     }
//                 }
//             } else {

//                 totalLoggedHours = {
//                     organization,
//                     department,
//                     date: {
//                         "$gte": from,
//                         "$lt": till
//                     }
//                 }
//             }

//         }
//         let users_data = await Activity.aggregate([
//             {
//                 $match: totalLoggedHours
//             },
//             {
//                 $unwind: {
//                     path: "$breaks",
//                     preserveNullAndEmptyArrays: true
//                 }
//             },
//             {
//                 $project: {
//                     _id: 0,
//                     user_email: 1,
//                     breaks: 1,
//                     idleTime: 1,
//                     loginHours: 1
//                 }
//             },
//             {
//                 $group: {
//                     _id:null,
//                     loginHours: {
//                         $push: {
//                             'loginHours': "$loginHours",
//                         }
//                     },

//                 }
//             },
//             {
//                 $addFields: {
//                     loginHours: { $sum: "$loginHours.loginHours" }
//                 }
//             },
//             {
//                 $project: {
//                     _id: 0,
//                     loginHours: {
//                         $round: [{ "$divide": ["$loginHours", 60] }, 2]
//                     },
//                 }
//             },

//             {
//                 $lookup: {
//                     from: 'configurations',
//                     let: {
//                         organization: organization,
//                         department: department
//                     },
//                     pipeline: [
//                         {
//                             "$match": {
//                                 "$expr": {
//                                     "$and": [
//                                         { "$eq": ["$organization", "$$organization"] },
//                                         { "$eq": ["$department", "$$department"] }
//                                     ]
//                                 }
//                             }
//                         },
//                         {
//                             $project: {
//                                 _id: 0,
//                                 productivity: 1
//                             }
//                         },
//                         {
//                             $group: {
//                                 _id: "$productivity.work_hours"
//                             }
//                         },
//                     ],
//                     as: 'config'
//                 }
//             },
//             {
//                 $unwind: {
//                     path: "$config",
//                     preserveNullAndEmptyArrays: true
//                 }
//             },
//             {
//                 $project: {
//                     _id: 0,
//                     user: 1,
//                     loginHours: {
//                         $cond: { if: "$loginHours", then: "$loginHours", else: 0 }
//                     },
//                     work_hours: "$config._id",
//                     days: {
//                         $dateDiff:
//                         {
//                             startDate: from,
//                             endDate: till,
//                             unit: "day"
//                         }
//                     },
//                 }
//             },
//             {
//                 $lookup: {
//                     from: 'activities',
//                     let: {
//                         department: department,
//                         organization: organization,
//                         "startDate": from,
//                         "endDate": till
//                     },
//                     pipeline: [
//                         {
//                             "$match": {
//                                 "$expr": {
//                                     "$and": [
//                                         { "$eq": ["$user_email", "$$user_email"] },
//                                         { "$eq": ["$department", "$$department"] },
//                                         { "$eq": ["$organization", "$$organization"] },
//                                         { "$gte": ["$date", "$$startDate"] },
//                                         { "$lt": ["$date", "$$endDate"] }
//                                     ]
//                                 }
//                             }
//                         },
//                         {
//                             $project: {
//                                 _id: 0,
//                                 user_email: 1,
//                                 breaks: 1,
//                                 idleTime: 1,
//                                 loginHours: 1
//                             }
//                         },
//                         {
//                             $group: {
//                                 _id: null,
//                                 break: {
//                                     $push: {
//                                         'minutes': "$breaks.minutes",
//                                     }
//                                 },
//                                 idle: {
//                                     $push: {
//                                         idleTime: "$idleTime"
//                                     }
//                                 },
//                                 loginHours: {
//                                     $push: {
//                                         'loginHours': "$loginHours",
//                                     }
//                                 },

//                             }
//                         },
//                         {
//                             $addFields: {
//                                 loginHours: { $sum: "$loginHours.loginHours" }
//                             }
//                         },
//                         {
//                             $project: {
//                                 _id: 0,
//                                 idle: { $sum: "$idle.idleTime" },
//                                 break: { $sum: "$break.minutes" },
//                                 loginHours: {
//                                     $round: [{ "$divide": ["$loginHours", 60] }, 2]
//                                 },

//                             }
//                         },
//                         {
//                             $project: {
//                                 _id: 0,
//                                 idle: 1,
//                                 break: 1,
//                                 loginHours: 1,
//                             }
//                         },
//                     ],
//                     as: 'data'
//                 }
//             },
//             {
//                 $addFields: {
//                     expected_work_hours: { $multiply: ["$work_hours", "$days"] },
//                 }
//             },
//             // {
//             //     $sort: {
//             //         "user": 1
//             //     }
//             // },

//             // {
//             //     $project: {
//             //         user: 1,
//             //         loginHours: 1,
//             //         idle: 1,
//             //         break: 1,
//             //         desk_time: 1,
//             //         work_hours: 1,
//             //         days: 1,
//             //         actual_productive_minutes: 1,
//             //         expected_work_hours_min: { $multiply: ["$expected_work_hours", 60] },
//             //     }
//             // },
//             // {
//             //     $addFields: {
//             //         productivity: { "$multiply": [{ "$divide": ["$loginHours", "$expected_work_hours_min"] }, 100] }
//             //     }
//             // },
//             // {
//             //     $project: {
//             //         user: 1,
//             //         idle: 1,
//             //         break: 1,
//             //         desk_time: 1,
//             //         work_hours: 1,
//             //         days: 1,
//             //         expected_work_hours_min: 1,
//             //         productivity: {
//             //             $round: ["$productivity", 3]
//             //         }
//             //     }
//             // },
//             // { "$match": { "productivity": { "$ne": 0 } } }

//         ])

//         return res.status(200).json({
//             'message': 'Productivity percentage fetched successfully',
//             'data': users_data
//         });
//     } catch (error) {
//         logger.error(error);
//         return res.status(500).json({
//             'code': 'SERVER_ERROR',
//             'description': 'something went wrong, Please try again'
//         });

//     }
//     //END

// }

const getProductivityPercentageLoggedIn = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;
    let assigned_to = req.assigned_to;

    let { from, to } = req.query;
    let { manager_name } = req.body;

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
        .format('YYYY-MM-DDTHH:mm:ss.SSS[Z]');
      till = moment(jDateTill)
        .endOf('day')
        .tz(time_zone)
        .format('YYYY-MM-DDTHH:mm:ss.SSS[Z]');
    }
    logger.debug('from-', from);
    logger.debug('till-', till);

    let totalLoggedHours = null;
    if (const_config.isAllowedRole(role, ['MANAGER'])) {
      totalLoggedHours = {
        assigned_to: user_email,
        organization,
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
        totalLoggedHours = {
          organization,
          date: {
            $gte: from,
            $lt: till,
          },
        };
      } else if (!(manager_name === undefined || manager_name === '')) {
        totalLoggedHours = {
          organization,
          department,
          assigned_to: manager_name,
          date: {
            $gte: from,
            $lt: till,
          },
        };
      } else {
        totalLoggedHours = {
          organization,
          department,
          date: {
            $gte: from,
            $lt: till,
          },
        };
      }
    }

    let present = await Activity.find(totalLoggedHours, 'user_email').distinct(
      'user_email'
    );

    present = present.length;
    logger.debug('present', present);

    let productivity = await Activity.aggregate([
      {
        $match: totalLoggedHours,
      },
      {
        $project: {
          _id: 0,
          department: 1,
          loginHours: 1,
          idleTime: 1,
          breaks: 1,
          date: 1,
          user_email: 1,
        },
      },
      {
        $unwind: {
          path: '$breaks',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: null,
          loginHours: {
            $push: {
              loginHours: '$loginHours',
            },
          },
        },
      },
      {
        $addFields: {
          loginHours: { $sum: '$loginHours.loginHours' },
        },
      },
      {
        $project: {
          _id: 0,
          loginHours: {
            $round: [{ $divide: ['$loginHours', 60] }, 2],
          },
        },
      },
      {
        $lookup: {
          from: 'configurations',
          let: {
            organization: organization,
            department: department,
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$organization', '$$organization'] },
                    { $eq: ['$department', '$$department'] },
                  ],
                },
              },
            },
            {
              $project: {
                _id: 0,
                productivity: 1,
              },
            },
            {
              $group: {
                _id: '$productivity.work_hours',
              },
            },
          ],
          as: 'config',
        },
      },
      {
        $unwind: {
          path: '$config',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 0,
          loginHours: 1,
          work_hours: '$config._id',
          days: {
            $dateDiff: {
              startDate: from,
              endDate: till,
              unit: 'day',
            },
          },
        },
      },
      {
        $addFields: {
          expected_work_hours: { $multiply: [present, '$work_hours', '$days'] },
        },
      },
      {
        $project: {
          _id: 0,
          work_hours: 1,
          days: 1,
          loginHours: 1,
          expected_work_hours_min: { $multiply: ['$expected_work_hours', 60] },
        },
      },
      {
        $addFields: {
          productivity: {
            $multiply: [
              { $divide: ['$loginHours', '$expected_work_hours_min'] },
              100,
            ],
          },
        },
      },
      {
        $project: {
          _id: 0,
          loginHours: 1,
          expected_work_hours_min: 1,
          productivity: {
            $round: ['$productivity', 2],
          },
        },
      },
    ]);

    return res.status(200).json({
      message:
        'Productivity percentage of Logged in users fetched successfully',
      data: {
        productivity_percentage:
          productivity.length !== 0 ? productivity[0].productivity : 0,
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

const loginHoursIdleTimeBreak = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;
    let assigned_to = req.assigned_to;

    let { from, to } = req.query;
    let { member_email } = req.body;

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
    let usersQuery = null;
    for (let j = 0; j < date_array.length; j++) {
      let date = date_array[j];
      let jDateToday = new Date(date_array[j]);

      let time_zone_name = moment.tz(time_zone).format('Z');

      let time_zone_name_char = time_zone_name.charAt(0);

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
        query = {
          organization: organization,
          department: department,
          user_email: user_email,
          date: {
            $gte: from,
            $lt: till,
          },
        };
        usersQuery = {
          organization,
          department,
          user_email: user_email,
        };
      } else if (const_config.isAllowedRole(role, ['MANAGER'])) {
        if (!(member_email === undefined || member_email === '')) {
          query = {
            organization: organization,
            assigned_to: user_email,
            user_email: member_email,
            date: {
              $gte: from,
              $lt: till,
            },
          };
          usersQuery = {
            assigned_to: user_email,
            organization,
            user_email: member_email,
          };
        } else {
          query = {
            organization: organization,
            assigned_to: user_email,
            date: {
              $gte: from,
              $lt: till,
            },
          };
          usersQuery = {
            assigned_to: user_email,
            organization,
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
          query = {
            organization: organization,
            date: {
              $gte: from,
              $lt: till,
            },
          };
          usersQuery = {
            organization,
          };
        } else if (!(member_email === undefined || member_email === '')) {
          query = {
            organization: organization,
            user_email: member_email,
            department: department,
            date: {
              $gte: from,
              $lt: till,
            },
          };
          usersQuery = {
            organization,
            department,
            user_email: member_email,
          };
        } else {
          query = {
            organization: organization,
            department: department,
            date: {
              $gte: from,
              $lt: till,
            },
          };
          usersQuery = {
            organization,
            department,
          };
        }
      }

      let activities = await Activity.find(query, 'loginHours idleTime breaks');
      let total_logged_hours = 0;
      let idle_time_in_minutes = 0;
      let break_time_in_minutes = 0;

      for (let activity of activities) {
        let login_hours = activity.loginHours;
        total_logged_hours = total_logged_hours + login_hours;

        let idle_hours = activity.idleTime;
        idle_time_in_minutes = idle_time_in_minutes + idle_hours;

        let break_time = activity.breaks[0];
        if (break_time !== undefined || break_time > 0) {
          break_time_minutes = break_time = activity.breaks[0].minutes;
          logger.debug('Total Break time ', break_time);
          break_time_in_minutes = break_time_in_minutes + break_time;
        }
      }
      total_logged_hours = total_logged_hours / 60;

      let actual_productive_minutes = 0;

      if (
        total_logged_hours === 0 ||
        total_logged_hours < idle_time_in_minutes + break_time_in_minutes
      ) {
        actual_productive_minutes = 0;
      } else {
        actual_productive_minutes =
          total_logged_hours - idle_time_in_minutes - break_time_in_minutes;
      }
      let data = {
        date: date,
        actual_productive_minutes: actual_productive_minutes,
        total_logged_minutes: total_logged_hours,
        idleTime: idle_time_in_minutes,
        breaksMinutes: break_time_in_minutes,
      };
      response_array_main.push(data);
    }

    return res.status(200).json({
      message: 'Summary in Minutes fetched successfully',
      data: response_array_main,
    });
  } catch (error) {
    logger.error(error);
    return res.status(500).json({
      code: 'SERVER_ERROR',
      description: 'something went wrong, Please try again',
    });
  }
};

const getWorkHoursSummary = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;
    let assigned_to = req.assigned_to;

    let { from, to } = req.query;
    let { required_role, manager_name, report_type } = req.body;

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
        .format('YYYY-MM-DDTHH:mm:ss.SSS[Z]');
      till = moment(jDateTill)
        .endOf('day')
        .tz(time_zone)
        .format('YYYY-MM-DDTHH:mm:ss.SSS[Z]');
    }
    logger.debug('From', from);
    logger.debug('Till', till);

    let attendanceQuery = null;
    let userCountQuery = null;
    let configQuery = {
      organization,
      department,
    };

    if (const_config.isAllowedRole(role, ['MANAGER'])) {
      if (required_role === 'MANAGER') {
        userCountQuery = {
          assigned_to: user_email,
          organization: organization,
          is_manager: true,
        };
      } else if (required_role === 'ADMIN') {
        userCountQuery = {
          assigned_to: user_email,
          organization: organization,
          is_admin: true,
        };
      } else if (required_role === 'AGENT') {
        userCountQuery = {
          assigned_to: user_email,
          organization: organization,
          is_member: true,
        };
      } else if (required_role === 'AUDIT') {
        userCountQuery = {
          assigned_to: user_email,
          organization: organization,
          is_auditor: true,
        };
      } else if (required_role === 'SUPER_ADMIN') {
        userCountQuery = {
          assigned_to: user_email,
          organization: organization,
          is_superadmin: true,
        };
      } else if (required_role === 'MANAGER AGENT') {
        userCountQuery = {
          assigned_to: user_email,
          organization: organization,
          is_member: true,
          is_manager: true,
        };
      } else if (required_role === 'AGENT AUDIT') {
        userCountQuery = {
          assigned_to: user_email,
          organization: organization,
          is_auditor: true,
          is_member: true,
        };
      } else if (required_role === 'MANAGER AUDIT') {
        userCountQuery = {
          assigned_to: user_email,
          organization: organization,
          is_manager: true,
          is_auditor: true,
        };
      } else {
        userCountQuery = {
          assigned_to: user_email,
          organization: organization,
        };
      }
      attendanceQuery = {
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
        if (required_role === 'MANAGER') {
          userCountQuery = {
            organization: organization,
            is_manager: true,
          };
        } else if (required_role === 'ADMIN') {
          userCountQuery = {
            organization: organization,
            is_admin: true,
          };
        } else if (required_role === 'AGENT') {
          userCountQuery = {
            organization: organization,
            is_member: true,
          };
        } else if (required_role === 'AUDIT') {
          userCountQuery = {
            organization: organization,
            is_auditor: true,
          };
        } else if (required_role === 'SUPER_ADMIN') {
          userCountQuery = {
            organization: organization,
            is_superadmin: true,
          };
        } else if (required_role === 'MANAGER AGENT') {
          userCountQuery = {
            organization: organization,
            is_manager: true,
            is_member: true,
          };
        } else if (required_role === 'AGENT AUDIT') {
          userCountQuery = {
            organization: organization,
            is_auditor: true,
            is_member: true,
          };
        } else if (required_role === 'MANAGER AUDIT') {
          userCountQuery = {
            organization: organization,
            is_manager: true,
            is_auditor: true,
          };
        } else {
          userCountQuery = {
            organization: organization,
          };
        }
        attendanceQuery = {
          organization: organization,
          date: {
            $gte: from,
            $lt: till,
          },
        };
      } else if (!(manager_name === undefined || manager_name === '')) {
        if (required_role === 'MANAGER') {
          userCountQuery = {
            organization: organization,
            department: department,
            assigned_to: manager_name,
            is_manager: true,
          };
        } else if (required_role === 'ADMIN') {
          userCountQuery = {
            organization: organization,
            department: department,
            assigned_to: manager_name,
            is_admin: true,
          };
        } else if (required_role === 'AGENT') {
          userCountQuery = {
            organization: organization,
            department: department,
            assigned_to: manager_name,
            is_member: true,
          };
        } else if (required_role === 'AUDIT') {
          userCountQuery = {
            organization: organization,
            department: department,
            assigned_to: manager_name,
            is_auditor: true,
          };
        } else if (required_role === 'SUPER_ADMIN') {
          userCountQuery = {
            organization: organization,
            department: department,
            assigned_to: manager_name,
            is_superadmin: true,
          };
        } else if (required_role === 'MANAGER AGENT') {
          userCountQuery = {
            organization: organization,
            department: department,
            assigned_to: manager_name,
            is_manager: true,
            is_member: true,
          };
        } else if (required_role === 'AGENT AUDIT') {
          userCountQuery = {
            organization: organization,
            department: department,
            assigned_to: manager_name,
            is_auditor: true,
            is_member: true,
          };
        } else if (required_role === 'MANAGER AUDIT') {
          userCountQuery = {
            organization: organization,
            department: department,
            assigned_to: manager_name,
            is_manager: true,
            is_auditor: true,
          };
        } else {
          userCountQuery = {
            organization: organization,
            department: department,
            assigned_to: manager_name,
          };
        }
        attendanceQuery = {
          organization: organization,
          department: department,
          assigned_to: manager_name,
          date: {
            $gte: from,
            $lt: till,
          },
        };
      } else {
        if (required_role === 'MANAGER') {
          userCountQuery = {
            organization: organization,
            department: department,
            is_manager: true,
          };
        } else if (required_role === 'ADMIN') {
          userCountQuery = {
            organization: organization,
            department: department,
            is_admin: true,
          };
        } else if (required_role === 'AGENT') {
          userCountQuery = {
            organization: organization,
            department: department,
            is_member: true,
          };
        } else if (required_role === 'AUDIT') {
          userCountQuery = {
            organization: organization,
            department: department,
            is_auditor: true,
          };
        } else if (required_role === 'SUPER_ADMIN') {
          userCountQuery = {
            organization: organization,
            department: department,
            is_superadmin: true,
          };
        } else if (required_role === 'MANAGER AGENT') {
          userCountQuery = {
            organization: organization,
            department: department,
            is_manager: true,
            is_member: true,
          };
        } else if (required_role === 'AGENT AUDIT') {
          userCountQuery = {
            organization: organization,
            department: department,
            is_auditor: true,
            is_member: true,
          };
        } else if (required_role === 'MANAGER AUDIT') {
          userCountQuery = {
            organization: organization,
            department: department,
            is_manager: true,
            is_auditor: true,
          };
        } else {
          userCountQuery = {
            organization: organization,
            department: department,
          };
        }
        attendanceQuery = {
          organization: organization,
          department: department,
          date: {
            $gte: from,
            $lt: till,
          },
        };
      }
    }

    let idle_time_in_minutes = 0;
    let total_logged_hours = 0;
    let break_time_in_minutes = 0;
    let expected_work_hours = 0;
    let expected_work_hours_activity = 0;
    // let head_count = await users.find(userCountQuery).countDocuments();
    // let configs = await Configuration.findOne(configQuery);
    let [head_count, configs] = await Promise.all([
      users.find(userCountQuery).countDocuments(),
      Configuration.findOne(configQuery)
    ]);
    let activities = await Activity.find(
      attendanceQuery,
      'idleTime breaks loginHours'
    );
    let attendance_count = activities.length;
    for (let activity of activities) {
      let login_hours = activity.loginHours;
      total_logged_hours = total_logged_hours + login_hours;
      let idle_hours = activity.idleTime;

      idle_time_in_minutes = idle_time_in_minutes + idle_hours;
      let break_time = activity.breaks[0];

      if (break_time !== undefined || break_time > 0) {
        break_time_minutes = break_time = activity.breaks[0].minutes;

        break_time_in_minutes = break_time_in_minutes + break_time;
      }
    }

    //Converting into minutes
    total_logged_hours = total_logged_hours / 60;

    let actual_productive_minutes = 0;

    if (
      total_logged_hours === 0 ||
      total_logged_hours < idle_time_in_minutes + break_time_in_minutes
    ) {
      actual_productive_minutes = 0;
    } else {
      actual_productive_minutes =
        total_logged_hours - idle_time_in_minutes - break_time_in_minutes;
    }

    let work_hours = configs.productivity.work_hours;
    //+1 is added include the start date at the end
    let days = moment(new Date(jDateTill)).diff(moment(jDateToday), 'days') + 1;

    expected_work_hours = days * work_hours * head_count;
    expected_work_hours_activity = days * work_hours * attendance_count;

    let reports = [];

    if (report_type === 'csv') {
      try {
        let record = {
          organization: organization,
          department: department,
          head_count: head_count,
          attendance_count: attendance_count,
          expected_work_hours: expected_work_hours,
          expected_work_hours_activity: expected_work_hours_activity,
          idle_time_in_minutes: idle_time_in_minutes,
          total_logged_minutes: total_logged_hours,
          actual_productive_minutes: actual_productive_minutes,
          break_time_in_minutes: break_time_in_minutes,
        };
        reports.push(record);
        const fields = [
          'organization',
          'department',
          'head_count',
          'attendance_count',
          'expected_work_hours',
          'expected_work_hours_activity',
          'idle_time_in_minutes',
          'total_logged_minutes',
          'actual_productive_minutes',
          'break_time_in_minutes',
        ];
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
        message: 'Work hour Summary fetched successfully',
        data: {
          head_count: head_count,
          attendance_count: attendance_count,
          expected_work_hours: expected_work_hours,
          expected_work_hours_activity: expected_work_hours_activity,
          idle_time_in_minutes: idle_time_in_minutes,
          total_logged_minutes: total_logged_hours,
          actual_productive_minutes: actual_productive_minutes,
          break_time_in_minutes: break_time_in_minutes,
        },
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

const attendanceCountDepartment = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;

    let { from, to } = req.query;
    let { report_type } = req.body;
    const limit = parseInt(req.query.limit); // Make sure to parse the limit to number
    const skip = parseInt(req.query.skip);

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
    let reports = [];

    let time_zone = req.timezone;
    let jDateToday = new Date(from);
    let jDateTill = new Date(to);

    from = moment(jDateToday).tz(time_zone).toDate();
    let till = moment(jDateTill).endOf('day').tz(time_zone).toDate();
    logger.info('from =', from);
    logger.info('till =', till);

    let query = {
      organization: organization,
    };

    Activity.aggregate([
      {
        $match: query,
      },
      {
        $group: {
          _id: {
            department: '$department',
            date: {
              $dateToString: {
                format: '%m-%d-%Y',
                date: '$date',
                timezone: time_zone,
              },
            },
          },
          count: {
            $sum: 1,
          },
        },
      },
      {
        $sort: {
          '_id.date': 1,
        },
      },
    ]).exec((err, departmentCount) => {
      if (err) {
        return res.status(500).json({
          code: 'SERVER_ERROR',
          description: 'something went wrong, Please try again',
        });
      }

      if (report_type === 'csv') {
        for (let i = 0; i < departmentCount.length; i++) {
          let entry = {
            department: departmentCount[i]._id.department,
            date: departmentCount[i]._id.date,
            count: departmentCount[i].count,
          };
          reports.push(entry);
        }
        const fields = ['department', 'date', 'count'];
        const opts = {
          fields,
        };
        // console.log(csv);
        const csv = parse(reports, opts);
        return res.status(200).send(csv);
      } else {
        return res.status(200).json({
          message: `Department Count of ${organization} fetched successfully`,
          data: departmentCount,
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

const getDurationAgainstStatusCode = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let assigned_to = req.assigned_to;
    let user_email = req.user_email;

    let { from, to, report_type, manager_name, type } = req.body;

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

    let query = null
    let departmentName
    let departmentsArray
    let inDepartments = []
    if (type === "ORGANIZATION") {
      if (const_config.isAllowedRole(role, ['SUPER_ADMIN'])) {
        departmentName = await Department.findOne({ organization }, 'department_array.name')
        for (let i = 0; i < departmentName.department_array.length; i++) {
          let element = departmentName.department_array[i].name;
          inDepartments.push(element)
          logger.debug("element", element)

        }

        departmentsArray = departmentName.department_array
        query = {
          organization: organization,
          'department': { $in: inDepartments },
          date: {
            $gte: from,
            $lt: till,
          },
        };

      } else if (const_config.isAllowedRole(role, ['ADMIN'])) {
        let tempDepartmentName = await AdminOrganization.findOne({ user_email }, 'organization_array.name organization_array.departments.name')


        for (let j = 0; j < tempDepartmentName.organization_array.length; j++) {
          let orgName = tempDepartmentName.organization_array[j].name
          if (orgName === organization) {
            for (let i = 0; i < tempDepartmentName.organization_array[j].departments.length; i++) {
              let element = tempDepartmentName.organization_array[j].departments[i].name;
              inDepartments.push(element)
            }
            departmentsArray = tempDepartmentName.organization_array[j].departments
          }
        }
        query = {
          organization: organization,
          'department': { $in: inDepartments },
          date: {
            $gte: from,
            $lt: till,
          },
        };

      } else if (const_config.isAllowedRole(role, ['AUDIT'])) {

        let tempDepartmentName = await AuditOrganization.findOne({ user_email }, 'organization_array.name organization_array.departments.name')


        for (let j = 0; j < tempDepartmentName.organization_array.length; j++) {
          let orgName = tempDepartmentName.organization_array[j].name
          if (orgName === organization) {
            for (let i = 0; i < tempDepartmentName.organization_array[j].departments.length; i++) {
              let element = tempDepartmentName.organization_array[j].departments[i].name;
              inDepartments.push(element)
            }
            departmentsArray = tempDepartmentName.organization_array[j].departments
          }
        }

        query = {
          organization: organization,
          'department': { $in: inDepartments },
          date: {
            $gte: from,
            $lt: till,
          },
        };

      }
    
    } else if (type === "DEPARTMENT") {
      if (const_config.isAllowedRole(role, ['SUPER_ADMIN', 'ADMIN', 'AUDIT'])) {

        query = {
          organization: organization,
          'department': department,
          date: {
            $gte: from,
            $lt: till,
          },
        };

      } else if (const_config.isAllowedRole(role, ['MANAGER'])) {
        query = {
          organization: organization,
          assigned_to: user_email,
          department: department,
          date: {
            $gte: from,
            $lt: till,
          },
        };
      }

    } else if (type === "MANAGER") {
      if (const_config.isAllowedRole(role, ['SUPER_ADMIN', 'ADMIN', 'AUDIT'])) {

        query = {
          organization: organization,
          'department': department,
          assigned_to: manager_name,
          date: {
            $gte: from,
            $lt: till,
          },
        };


      } else if (const_config.isAllowedRole(role, ['MANAGER'])) {
        query = {
          organization: organization,
          department: department,
          assigned_to: user_email,
          date: {
            $gte: from,
            $lt: till,
          },
        };
      }

    }

  let aux_time = await ActiveAuxManagement.aggregate([
        {
          $match: query,
        },
        { $unwind: '$aux_management' },
        {
          $group: {
            _id: {
              name: '$aux_management.name',
            },
            count: { $sum: 1 },
            totalMinutes: {
              $sum: {
                $divide: [
                  {
                    $subtract: [
                      '$aux_management.endTime',
                      '$aux_management.startTime',
                    ],
                  },
                  1000 * 60,
                ],
              },
            },
          },
        },
        {
          $addFields: {
            totalMinutes: { $round: ["$totalMinutes", 0] },
          }
        },
        {
          '$match': { '_id.name': { '$ne': 'null' } }
        },
        {
          '$match': { '_id.name': { '$ne': null } }
        },
        {
          '$match': { '_id.name': { '$ne': '' } }
        },
        { $sort: { count: -1 } },
      ]);
      let response = []
      if (report_type === 'csv') {
        try {
          if (type === "ORGANIZATION") {
            for (let i = 0; i < aux_time.length; i++) {
              let entry = {
                Organization: organization,
                "Aux Code": aux_time[i]._id.name,
                "Total Minutes": aux_time[i].totalMinutes,
                "Date Range(from - to)": moment(from).tz(time_zone).format('DD-MMM-YYYY') + " - " + moment(to).tz(time_zone).format('DD-MMM-YYYY'),
              };
              response.push(entry);
            }
            const fields = [
              'Organization',
              'Aux Code',
              'Total Minutes',
              "Date Range(from - to)",
            ];
            const opts = {
              fields,
            };
            const csv = parse(response, opts);
            return res.status(200).send(csv);
          } else if (type === "DEPARTMENT") {
            for (let i = 0; i < aux_time.length; i++) {
              let entry = {
                Organization: organization,
                Department: department,
                "Aux Code": aux_time[i]._id.name,
                "Total Minutes": aux_time[i].totalMinutes,
                "Date Range(from - to)": moment(from).tz(time_zone).format('DD-MMM-YYYY') + " - " + moment(to).tz(time_zone).format('DD-MMM-YYYY'),
              };
              response.push(entry);
            }
            const fields = [
              'Organization',
              'Department',
              'Aux Code',
              'Total Minutes',
              "Date Range(from - to)",
            ];
            const opts = {
              fields,
            };
            const csv = parse(response, opts);
            return res.status(200).send(csv);
          } else if (type === "MANAGER") {
            for (let i = 0; i < aux_time.length; i++) {
              let entry = {
                Organization: organization,
                Department: department,
                Manager: manager_name,
                "Aux Code": aux_time[i]._id.name,
                "Total Minutes": aux_time[i].totalMinutes,
                "Date Range(from - to)": moment(from).tz(time_zone).format('DD-MMM-YYYY') + " - " + moment(to).tz(time_zone).format('DD-MMM-YYYY'),
              };
              response.push(entry);
            }
            const fields = [
              'Organization',
              'Department',
              'Manager',
              'Aux Code',
              'Total Minutes',
              "Date Range(from - to)",
            ];
            const opts = {
              fields,
            };
            const csv = parse(response, opts);
            return res.status(200).send(csv);
          }
        } catch (err) {
          logger.error(err);
          return res.status(500).json({
            code: 'SERVER_ERROR',
            description: 'something went wrong, Please try again',
          });
        }
      } else {
        let response = []
        for (let i = 0; i < aux_time.length; i++) {
          let entry = {
            organization: organization,
            status_code: aux_time[i]._id.name,
            total_minutes: aux_time[i].totalMinutes,
            count: aux_time[i].count,
          };
          response.push(entry);
        }

        return res.status(200).json({
          message: 'Duration against status code fetched successfully',
          data: response
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
const auxLive = async (req, res, next) => {
  try {

    let role = req.role
    let organization = req.organization
    let department = req.department
    let assigned_to = req.assigned_to
    let user_email = req.user_email

    let { report_type, type, manager_name } = req.body

    if (organization === undefined || organization === '') {
      return res.status(422).json({
        'code': 'REQUIRED_FIELD_MISSING',
        'description': 'Organization is required',
        'field': 'organization'
      });
    }

    let time_zone = req.timezone
    let date = moment.utc()
    date = moment(date).format('MM-DD-YYYY')
    let jDateToday = new Date(date)
    let time_zone_name = moment.tz(time_zone).format('Z')

    let time_zone_name_char = time_zone_name.charAt(0);

    let from
    let till
    if ("+" === time_zone_name_char) {
      let local_date = moment(jDateToday).tz(time_zone)
      from = local_date.startOf('day').toDate()
      till = local_date.endOf('day').toDate()
    } else {
      let local_date = moment(jDateToday).tz(time_zone).format('YYYY-MM-DDTHH:mm:ss.SSS[Z]')
      from = local_date
      till = moment(local_date).add(23, 'hours').add(59, 'minutes').add(59, 'seconds').add(999, 'ms').format('YYYY-MM-DDTHH:mm:ss.SSS[Z]')

    }


    let query = null
    let departmentName
    let departmentsArray
    let inDepartments = []
    if (type === "ORGANIZATION") {
      if (const_config.isAllowedRole(role, ['SUPER_ADMIN'])) {
        departmentName = await Department.findOne({ organization }, 'department_array.name')
        for (let i = 0; i < departmentName.department_array.length; i++) {
          let element = departmentName.department_array[i].name;
          inDepartments.push(element)
          logger.debug("element", element)

        }

        departmentsArray = departmentName.department_array
        query = {
          organization: organization,
          'department': { $in: inDepartments },
          "isAuxManagement": true,
          date: {
            $gte: from,
            $lt: till,
          },
        };

      } else if (const_config.isAllowedRole(role, ['ADMIN'])) {
        let tempDepartmentName = await AdminOrganization.findOne({ user_email }, 'organization_array.name organization_array.departments.name')


        for (let j = 0; j < tempDepartmentName.organization_array.length; j++) {
          let orgName = tempDepartmentName.organization_array[j].name
          if (orgName === organization) {
            for (let i = 0; i < tempDepartmentName.organization_array[j].departments.length; i++) {
              let element = tempDepartmentName.organization_array[j].departments[i].name;
              inDepartments.push(element)
            }
            departmentsArray = tempDepartmentName.organization_array[j].departments
          }
        }
        query = {
          organization: organization,
          'department': { $in: inDepartments },
          "isAuxManagement": true,
          date: {
            $gte: from,
            $lt: till,
          },
        };

      } else if (const_config.isAllowedRole(role, ['AUDIT'])) {

        let tempDepartmentName = await AuditOrganization.findOne({ user_email }, 'organization_array.name organization_array.departments.name')


        for (let j = 0; j < tempDepartmentName.organization_array.length; j++) {
          let orgName = tempDepartmentName.organization_array[j].name
          if (orgName === organization) {
            for (let i = 0; i < tempDepartmentName.organization_array[j].departments.length; i++) {
              let element = tempDepartmentName.organization_array[j].departments[i].name;
              inDepartments.push(element)
            }
            departmentsArray = tempDepartmentName.organization_array[j].departments
          }
        }

        query = {
          organization: organization,
          'department': { $in: inDepartments },
          "isAuxManagement": true,
          date: {
            $gte: from,
            $lt: till,
          },
        };

      } else if (const_config.isAllowedRole(role, ['MANAGER'])) {
        query = {
          organization: organization,
          assigned_to: user_email,
          "isAuxManagement": true,
          date: {
            $gte: from,
            $lt: till,
          },
        };
      }
    } else if (type === "DEPARTMENT") {
      if (const_config.isAllowedRole(role, ['SUPER_ADMIN', 'ADMIN', 'AUDIT'])) {

        query = {
          organization: organization,
          'department': department,
          "isAuxManagement": true,
          date: {
            $gte: from,
            $lt: till,
          },
        };

      } else if (const_config.isAllowedRole(role, ['MANAGER'])) {
        query = {
          organization: organization,
          assigned_to: user_email,
          department: department,
          "isAuxManagement": true,
          date: {
            $gte: from,
            $lt: till,
          },
        };
      }
    } else if (type === "MANAGER") {
      if (const_config.isAllowedRole(role, ['SUPER_ADMIN', 'ADMIN', 'AUDIT'])) {

        query = {
          organization: organization,
          'department': department,
          assigned_to: manager_name,
          "isAuxManagement": true,
          date: {
            $gte: from,
            $lt: till,
          },
        };

      } else if (const_config.isAllowedRole(role, ['MANAGER'])) {
        query = {
          organization: organization,
          department: department,
          assigned_to: user_email,
          "isAuxManagement": true,
          date: {
            $gte: from,
            $lt: till,
          },
        };
      }
    }

    let response = await Activity.aggregate([
      {
        $match: query
      },
      {
        $group: {
          _id: {
            'auxCode': "$auxCode",
          },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          'auxCode': "$_id.auxCode",
          count: "$count"
        }
      },
      { "$sort": { "count": -1 } }

    ])
    let reports = []

    if (report_type === "csv") {
      try {
        for (let i = 0; i < response.length; i++) {

          let entry = {
            Organization: organization,
            Department: department,
            AuxCode: response[i]._id.auxCode,
            UsersCount: response[i].count,
          }
          reports.push(entry)
        }
        const fields = ['Organization', 'Department', 'AuxCode', 'UsersCount'];
        const opts = {
          fields
        };
        const csv = parse(reports, opts);
        return res.status(200).send(csv);
      } catch (err) {
        logger.error(err);
        return res.status(500).json({
          'code': 'SERVER_ERROR',
          'description': 'something went wrong, Please try again'
        });
      }
    } else
      return res.status(200).json({
        'message': 'Duration against status code fetched successfully',
        'data': response,
      });

  } catch (error) {
    logger.error(error)
    return res.status(500).json({
      'code': 'SERVER_ERROR',
      'description': 'something went wrong, Please try again'
    });
  }

}

const getUserCountVsStatusCode = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let assigned_to = req.assigned_to;
    let user_email = req.user_email;

    let { from, to, manager_name, report_type, type } = req.body;

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
    let query = null
    let departmentName
    let departmentsArray
    let inDepartments = []
    let report = []
    let aux

    if (type === "ORGANIZATION") {
      if (const_config.isAllowedRole(role, ['SUPER_ADMIN'])) {

        departmentName = await Department.findOne({ organization }, 'department_array.name')
        for (let i = 0; i < departmentName.department_array.length; i++) {
          let element = departmentName.department_array[i].name;
          inDepartments.push(element)
        }

        //DON'T REMOVE THIS LOG BECAUSE IT IS GIVING GLOBAL AND DEPARTMENT DATA
        console.log("inDepartments", inDepartments.push('ALL'))
        logger.debug("inDepartments", inDepartments)

        query = {
          organization: organization,
          department: { $in: inDepartments }

        };

      } else if (const_config.isAllowedRole(role, ['ADMIN'])) {
        let tempDepartmentName = await AdminOrganization.findOne({ user_email }, 'organization_array.name organization_array.departments.name')


        for (let j = 0; j < tempDepartmentName.organization_array.length; j++) {
          let orgName = tempDepartmentName.organization_array[j].name
          if (orgName === organization) {
            for (let i = 0; i < tempDepartmentName.organization_array[j].departments.length; i++) {
              let element = tempDepartmentName.organization_array[j].departments[i].name;
              inDepartments.push(element)
            }
            departmentsArray = tempDepartmentName.organization_array[j].departments
          }
        }

        //DON'T REMOVE THIS LOG BECAUSE IT IS GIVING GLOBAL AND DEPARTMENT DATA
        console.log("inDepartments", inDepartments.push('ALL'))
        query = {
          organization: organization,
          department: { $in: inDepartments }

        };
      } else if (const_config.isAllowedRole(role, ['AUDIT'])) {

        let tempDepartmentName = await AuditOrganization.findOne({ user_email }, 'organization_array.name organization_array.departments.name')

        for (let j = 0; j < tempDepartmentName.organization_array.length; j++) {
          let orgName = tempDepartmentName.organization_array[j].name
          if (orgName === organization) {
            for (let i = 0; i < tempDepartmentName.organization_array[j].departments.length; i++) {
              let element = tempDepartmentName.organization_array[j].departments[i].name;
              inDepartments.push(element)
            }
            departmentsArray = tempDepartmentName.organization_array[j].departments
          }
        }

        //DON'T REMOVE THIS LOG BECAUSE IT IS GIVING GLOBAL AND DEPARTMENT DATA
        console.log("inDepartments", inDepartments.push('ALL'))
        query = {
          organization: organization,
          department: { $in: inDepartments }

        };
      }
      aux = await AuxManagement.aggregate([
        {
          $match: query,
        },
        { $unwind: '$management' },
        {
          $group: {
            _id: { aux_name: "$management.name", duration: "$management.duration" },
            aux_name: { $first: "$management.name" },
            duration: { $first: "$management.duration" },
          },
        },
        {
          $lookup: {
            from: 'active_aux_managements',
            let: {
              "organization": organization,
              "startDate": from,
              "endDate": till,
              duration: "$duration",
              aux_name: "$aux_name"
            },
            pipeline: [
              {
                "$match": {
                  "$expr": {
                    "$and": [
                      { "$eq": ["$organization", "$$organization"] },
                      { "$gte": ["$date", "$$startDate"] },
                      { "$lt": ["$date", "$$endDate"] },
                      { "$in": ["$department", inDepartments] },
                    ]
                  }
                }
              },
              {
                $unwind: {
                  path: "$aux_management",
                }
              },
              {
                "$match": {
                  "$expr": {
                    "$and": [
                      { "$eq": ["$aux_management.name", "$$aux_name"] },
                      { "$gt": ["$aux_management.minutes", "$$duration"] }
                    ]
                  }
                }
              },
              {
                $group: {
                  _id: {
                    user_email: "$user_email",
                    organization: "$organization",
                    department: "$department",
                    assigned_to: "$assigned_to"
                  }
                }
              },
            ],
            as: 'aux'
          }
        },
        {
          $project: {
            _id: 0,
            aux_name: 1,
            duration: 1,
            organization: organization,
            users_count: {
              $cond: {
                if: { $size: "$aux" },
                then: { $size: "$aux" },
                else: 0
              }
            }
          }
        },

      ])
      if (report_type === "csv") {
        try {
          logger.debug("from", from)
          for (let i = 0; i < aux.length; i++) {
            let entry = {
              Organization: organization,
              "Aux Code": aux[i].aux_name,
              "Aux Duration": aux[i].duration,
              "Users Count": aux[i].users_count,
              "Date Range(from - to)": moment(from).tz(time_zone).format('DD-MMM-YYYY') + " - " + moment(to).tz(time_zone).format('DD-MMM-YYYY')
            }
            report.push(entry)
          }
          const fields = ['Organization', 'Aux Code', 'Aux Duration', 'Users Count', 'Date Range(from - to)'];
          const opts = { fields };
          const csv = parse(report, opts);
          return res.status(200).send(csv);
        } catch (err) {
          logger.error(err);
          return res.status(500).json({
            'code': 'SERVER_ERROR',
            'description': 'Something went wrong, please try again'
          });
        }
      } else {
        return res.status(200).json({
          message: 'User count Vs Aux duration exceed data fetched successfully',
          data: aux,
        });
      }
    } else if (type === "DEPARTMENT") {


      const entry = [department, "ALL"]
      // let entry = { inputArray.map(item => item.department) }

      query = {
        organization: organization,
        department: { $in: entry }
      };
      aux = await AuxManagement.aggregate([
        {
          $match: query,
        },
        { $unwind: '$management' },
        {
          $project: {
            _id: 0,
            aux_name: "$management.name",
            duration: "$management.duration",
          }
        },
        {
          $lookup: {
            from: 'active_aux_managements',
            let: {
              "organization": organization,
              "startDate": from,
              "endDate": till,
              duration: "$duration",
              aux_name: "$aux_name"
            },
            pipeline: [
              {
                "$match": {
                  "$expr": {
                    "$and": [
                      { "$eq": ["$organization", "$$organization"] },
                      { "$gte": ["$date", "$$startDate"] },
                      { "$lt": ["$date", "$$endDate"] },
                      { "$in": ["$department", entry] },
                      // { "$eq": ["$$aux_name", "$aux_management.name"] },
                      // { "$gt": ["$$duration", "$aux_management.minutes"] },
                    ]
                  }
                }
              },
              {
                $unwind: {
                  path: "$aux_management",
                }
              },
              {
                "$match": {
                  "$expr": {
                    "$and": [
                      { "$eq": ["$aux_management.name", "$$aux_name"] },
                      { "$gt": ["$aux_management.minutes", "$$duration"] }
                    ]
                  }
                }
              },
              {
                $group: {
                  _id: {
                    user_email: "$user_email",
                    organization: "$organization",
                    department: "$department",
                    assigned_to: "$assigned_to"
                  }
                }
              },
            ],
            as: 'aux'
          }
        },
        {
          $project: {
            _id: 0,
            aux_name: 1,
            duration: 1,
            users_count: {
              $cond: {
                if: { $size: "$aux" },
                then: { $size: "$aux" },
                else: 0
              }
            }
          }
        },

      ])


      if (report_type === "csv") {
        try {
          logger.debug("from", from)
          for (let i = 0; i < aux.length; i++) {
            let entry = {
              Organization: organization,
              Department: department,
              "Aux Code": aux[i].aux_name,
              "Aux Duration": aux[i].duration,
              "Users Count": aux[i].users_count,
              "Date Range(from - to)": moment(from).tz(time_zone).format('DD-MMM-YYYY') + " - " + moment(to).tz(time_zone).format('DD-MMM-YYYY')
            }
            report.push(entry)
          }
          const fields = ['Organization', 'Department', 'Aux Code', 'Aux Duration', 'Users Count', 'Date Range(from - to)'];
          const opts = { fields };
          const csv = parse(report, opts);
          return res.status(200).send(csv);
        } catch (err) {
          logger.error(err);
          return res.status(500).json({
            'code': 'SERVER_ERROR',
            'description': 'Something went wrong, please try again'
          });
        }
      } else {
        return res.status(200).json({
          message: 'User count Vs Aux duration exceed data fetched successfully',
          data: aux,
        });
      }
    } else if (type === "MANAGER") {


      const entry = [department, "ALL"]

      query = {
        organization: organization,
        department: { $in: entry }
      };

      aux = await AuxManagement.aggregate([
        {
          $match: query,
        },
        { $unwind: '$management' },
        {
          $project: {
            _id: 0,
            aux_name: "$management.name",
            duration: "$management.duration",
          }
        },
        {
          $lookup: {
            from: 'active_aux_managements',
            let: {
              "organization": organization,
              "startDate": from,
              "endDate": till,
              duration: "$duration",
              aux_name: "$aux_name"
            },
            pipeline: [
              {
                "$match": {
                  "$expr": {
                    "$and": [
                      { "$eq": ["$organization", "$$organization"] },
                      { "$eq": ["$assigned_to", manager_name] },
                      { "$gte": ["$date", "$$startDate"] },
                      { "$lt": ["$date", "$$endDate"] },
                      { "$in": ["$department", entry] },
                    ]
                  }
                }
              },
              {
                $unwind: {
                  path: "$aux_management",
                }
              },
              {
                "$match": {
                  "$expr": {
                    "$and": [
                      { "$eq": ["$aux_management.name", "$$aux_name"] },
                      { "$gt": ["$aux_management.minutes", "$$duration"] }
                    ]
                  }
                }
              },
              {
                $group: {
                  _id: {
                    user_email: "$user_email",
                    organization: "$organization",
                    department: "$department",
                    assigned_to: "$assigned_to"
                  }
                }
              },
            ],
            as: 'aux'
          }
        },
        {
          $project: {
            _id: 0,
            aux_name: 1,
            duration: 1,
            users_count: {
              $cond: {
                if: { $size: "$aux" },
                then: { $size: "$aux" },
                else: 0
              }
            }
          }
        },

      ])

      if (report_type === "csv") {
        try {
          logger.debug("from", from)
          for (let i = 0; i < aux.length; i++) {
            let entry = {
              Organization: organization,
              Department: department,
              "Manager": manager_name,
              "Aux Code": aux[i].aux_name,
              "Aux Duration": aux[i].duration,
              "Users Count": aux[i].users_count,
              "Date Range(from - to)": moment(from).tz(time_zone).format('DD-MMM-YYYY') + " - " + moment(to).tz(time_zone).format('DD-MMM-YYYY')
            }
            report.push(entry)
          }
          const fields = ['Organization', 'Department', 'Manager', 'Aux Code', 'Aux Duration', 'Users Count', 'Date Range(from - to)'];
          const opts = { fields };
          const csv = parse(report, opts);
          return res.status(200).send(csv);
        } catch (err) {
          logger.error(err);
          return res.status(500).json({
            'code': 'SERVER_ERROR',
            'description': 'Something went wrong, please try again'
          });
        }
      } else {
        return res.status(200).json({
          message: 'User count Vs Aux duration exceed data fetched successfully',
          data: aux,
        });
      }
    }



  } catch (error) {
    console.error(error);
    return res.status(500).json({
      code: 'SERVER_ERROR',
      description: 'something went wrong, Please try again',
    });
  }
};
const getAuxCodeDuration = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let assigned_to = req.assigned_to;
    let user_email = req.user_email;

    let { date, manager_name, report_type, type } = req.body;

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



    let jDateToday = new Date(date)

    let time_zone = req.timezone
    let time_zone_name = moment.tz(time_zone).format('Z')

    let time_zone_name_char = time_zone_name.charAt(0);

    let from
    let till
    if ("+" === time_zone_name_char) {
      let local_date = moment(jDateToday).tz(time_zone)
      from = local_date.startOf('day').toDate()
      till = local_date.endOf('day').toDate()
    } else {
      let local_date = moment(jDateToday).tz(time_zone).format('YYYY-MM-DDTHH:mm:ss.SSS[Z]')
      from = local_date

      till = moment(jDateToday).endOf('day').tz(time_zone).format('YYYY-MM-DD[T]HH:mm:ss.SSS[Z]')//.add(23, 'hours').add(59, 'minutes').add(59, 'seconds').add(999, 'ms').format('YYYY-MM-DDTHH:mm:ss.SSS[Z]')

    }
    logger.info("From  == ", from)
    logger.info("To  == ", till)
    let query = null
    let departmentName
    let departmentsArray
    let inDepartments = []
    let report = []
    let aux

    if (type === "ORGANIZATION") {
      if (const_config.isAllowedRole(role, ['SUPER_ADMIN'])) {

        departmentName = await Department.findOne({ organization }, 'department_array.name')
        for (let i = 0; i < departmentName.department_array.length; i++) {
          let element = departmentName.department_array[i].name;
          inDepartments.push(element)
        }

        //DON'T REMOVE THIS LOG BECAUSE IT IS GIVING GLOBAL AND DEPARTMENT DATA
        console.log("inDepartments", inDepartments.push('ALL'))
        query = {
          organization: organization,
          department: { $in: inDepartments }

        };
        aux = await Department.aggregate([
          {
            $match: {
              organization: organization
            },
          },
          { $unwind: '$department_array' },
          {
            $lookup: {
              from: 'aux_managements',
              let: {
                "organization": organization,
                "department": "$department_array.name"

              },
              pipeline: [
                {
                  "$match": {
                    "$expr": {
                      "$and": [
                        { "$eq": ["$organization", "$$organization"] }
                      ]
                    }
                  }
                },
                {
                  "$match": {
                    "$expr": {
                      "$or": [
                        { "$eq": ["$department", "$$department"] },
                        { "$eq": ["$department", "ALL"] }
                      ]
                    }
                  }
                },
                {
                  $unwind: {
                    path: "$management",
                  }
                },
                // {
                //     $project: {
                //         _id: 0,
                //         code: "$management.name",
                //         department: "$$department"
                //     }
                // },
                {
                  $lookup: {
                    from: 'active_aux_managements',
                    let: {
                      "organization": organization,
                      "department": "$department",
                      "startDate": from,
                      "endDate": till,
                      code: "$management.name",
                    },
                    pipeline: [
                      {
                        "$match": {
                          "$expr": {
                            "$and": [
                              { "$eq": ["$organization", "$$organization"] },
                              { "$eq": ["$department", "$$department"] },
                              { "$gte": ["$date", "$$startDate"] },
                              { "$lt": ["$date", "$$endDate"] },
                              { "$in": ["$$code", "$aux_management.name"] },
                            ]
                          }
                        }
                      },
                      // {
                      //     $unwind: {
                      //         path: "$aux_management",
                      //     }
                      // },
                      // {
                      //     "$match": {
                      //         "$expr": {
                      //             "$and": [
                      //                 { "$eq": ["$aux_management.name", "$$code"] },
                      //             ]
                      //         }
                      //     }
                      // },
                      // {
                      //     $project: {
                      //         _id: 0,
                      //         aux_management: "$aux_management"
                      //     }
                      // }
                    ],
                    as: 'aux_count'
                  }
                },
                {
                  $project: {
                    _id: 0,
                    code: 1,
                    count: {
                      $cond: {
                        if: { $size: "$aux_count" },
                        then: { $size: "$aux_count" },
                        else: 0
                      }
                    }
                  }
                },
                {
                  $sort: {
                    count: 1
                  }
                }
              ],
              as: 'data'
            }
          },
        ])
      } else if (const_config.isAllowedRole(role, ['ADMIN'])) {
        let tempDepartmentName = await AdminOrganization.findOne({ user_email }, 'organization_array.name organization_array.departments.name')


        for (let j = 0; j < tempDepartmentName.organization_array.length; j++) {
          let orgName = tempDepartmentName.organization_array[j].name
          if (orgName === organization) {
            for (let i = 0; i < tempDepartmentName.organization_array[j].departments.length; i++) {
              let element = tempDepartmentName.organization_array[j].departments[i].name;
              inDepartments.push(element)
            }
            departmentsArray = tempDepartmentName.organization_array[j].departments
          }
        }

        //DON'T REMOVE THIS LOG BECAUSE IT IS GIVING GLOBAL AND DEPARTMENT DATA
        console.log("inDepartments", inDepartments.push('ALL'))

        console.log("user ema9l", user_email)

        query = {
          organization: organization,
          department: { $in: inDepartments }

        };
        aux = await AdminOrganization.aggregate([
          {
            $match: {
              user_email: user_email
            },
          },
          { $unwind: '$organization_array' },
          {
            $match: {
              'organization_array.name': organization
            },
          },
          { $unwind: '$organization_array.departments' },

          {
            $project: {
              _id: 0,
              name: "$organization_array.departments.name"
            }
          },
          {
            $lookup: {
              from: 'aux_managements',
              let: {
                "organization": organization,
                "department": "$name",

              },
              pipeline: [
                {
                  "$match": {
                    "$expr": {
                      "$and": [
                        { "$eq": ["$organization", "$$organization"] }
                      ]
                    }
                  }
                },
                {
                  "$match": {
                    "$expr": {
                      "$or": [
                        { "$eq": ["$department", "$$department"] },
                        { "$eq": ["$department", "ALL"] }
                      ]
                    }
                  }
                },
                {
                  $unwind: {
                    path: "$management",
                  }
                },
                {
                  $project: {
                    _id: 0,
                    code: "$management.name",
                    department: "$$department"
                  }
                },
                {
                  $lookup: {
                    from: 'active_aux_managements',
                    let: {
                      "organization": organization,
                      "department": "$department",
                      "startDate": from,
                      "endDate": till,
                      code: "$code",
                    },
                    pipeline: [
                      {
                        "$match": {
                          "$expr": {
                            "$and": [
                              { "$eq": ["$organization", "$$organization"] },
                              { "$eq": ["$department", "$$department"] },
                              { "$gte": ["$date", "$$startDate"] },
                              { "$lt": ["$date", "$$endDate"] },
                            ]
                          }
                        }
                      },
                      {
                        $unwind: {
                          path: "$aux_management",
                        }
                      },

                      {
                        "$match": {
                          "$expr": {
                            "$and": [
                              { "$eq": ["$aux_management.name", "$$code"] },
                            ]
                          }
                        }
                      },
                      {
                        $project: {
                          _id: 0,
                          aux_management: "$aux_management"
                        }
                      }
                    ],
                    as: 'aux_count'
                  }
                },
                {
                  $project: {
                    _id: 0,
                    code: 1,
                    count: {
                      $cond: {
                        if: { $size: "$aux_count" },
                        then: { $size: "$aux_count" },
                        else: 0
                      }
                    }
                  }
                },
                {
                  $sort: {
                    count: 1
                  }
                }
              ],
              as: 'data'
            }
          },
        ])

      } else if (const_config.isAllowedRole(role, ['AUDIT'])) {

        let tempDepartmentName = await AuditOrganization.findOne({ user_email }, 'organization_array.name organization_array.departments.name')

        for (let j = 0; j < tempDepartmentName.organization_array.length; j++) {
          let orgName = tempDepartmentName.organization_array[j].name
          if (orgName === organization) {
            for (let i = 0; i < tempDepartmentName.organization_array[j].departments.length; i++) {
              let element = tempDepartmentName.organization_array[j].departments[i].name;
              inDepartments.push(element)
            }
            departmentsArray = tempDepartmentName.organization_array[j].departments
          }
        }

        //DON'T REMOVE THIS LOG BECAUSE IT IS GIVING GLOBAL AND DEPARTMENT DATA
        console.log("inDepartments", inDepartments.push('ALL'))
        query = {
          organization: organization,
          department: { $in: inDepartments }

        };
        logger.debug("query", query)

        aux = await AuditOrganization.aggregate([
          {
            $match: {
              user_email: user_email
            },
          },
          { $unwind: '$organization_array' },
          {
            $match: {
              'organization_array.name': organization
            },
          },
          { $unwind: '$organization_array.departments' },

          {
            $project: {
              _id: 0,
              name: "$organization_array.departments.name"
            }
          },
          {
            $lookup: {
              from: 'aux_managements',
              let: {
                "organization": organization,
                "department": "$name",

              },
              pipeline: [
                {
                  "$match": {
                    "$expr": {
                      "$and": [
                        { "$eq": ["$organization", "$$organization"] }
                      ]
                    }
                  }
                },
                {
                  "$match": {
                    "$expr": {
                      "$or": [
                        { "$eq": ["$department", "$$department"] },
                        { "$eq": ["$department", "ALL"] }
                      ]
                    }
                  }
                },
                {
                  $unwind: {
                    path: "$management",
                  }
                },
                {
                  $project: {
                    _id: 0,
                    code: "$management.name",
                    department: "$$department"
                  }
                },
                {
                  $lookup: {
                    from: 'active_aux_managements',
                    let: {
                      "organization": organization,
                      "department": "$department",
                      "startDate": from,
                      "endDate": till,
                      code: "$code",
                    },
                    pipeline: [
                      {
                        "$match": {
                          "$expr": {
                            "$and": [
                              { "$eq": ["$organization", "$$organization"] },
                              { "$eq": ["$department", "$$department"] },
                              { "$gte": ["$date", "$$startDate"] },
                              { "$lt": ["$date", "$$endDate"] },
                            ]
                          }
                        }
                      },
                      {
                        $unwind: {
                          path: "$aux_management",
                        }
                      },

                      {
                        "$match": {
                          "$expr": {
                            "$and": [
                              { "$eq": ["$aux_management.name", "$$code"] },
                            ]
                          }
                        }
                      },
                      {
                        $project: {
                          _id: 0,
                          aux_management: "$aux_management"
                        }
                      }
                    ],
                    as: 'aux_count'
                  }
                },
                {
                  $project: {
                    _id: 0,
                    code: 1,
                    count: {
                      $cond: {
                        if: { $size: "$aux_count" },
                        then: { $size: "$aux_count" },
                        else: 0
                      }
                    }
                  }
                },
                {
                  $sort: {
                    count: 1
                  }
                }
              ],
              as: 'data'
            }
          },
        ])

      }
      if (report_type === "csv") {
        try {
          logger.debug("from", from)
          for (let i = 0; i < aux.length; i++) {
            for (let j = 0; j < aux[i].data.length; j++) {

              let entry = {
                Organization: organization,
                "Department": aux[i].name,
                "Aux Code": aux[i].data[j].code,
                "No. Of Times Aux Taken": aux[i].data[j].count,
                "Date": moment(date).tz(time_zone).format('DD-MMM-YYYY')
              }
              report.push(entry)
            }
          }
          const fields = ['Organization', 'Department', 'Aux Code', 'No. Of Times Aux Taken', 'Date'];
          const opts = { fields };
          const csv = parse(report, opts);
          return res.status(200).send(csv);
        } catch (err) {
          logger.error(err);
          return res.status(500).json({
            'code': 'SERVER_ERROR',
            'description': 'Something went wrong, please try again'
          });
        }
      } else {
        return res.status(200).json({
          message: 'Aux code Vs Number of times aux taken data fetched successfully.',
          data: aux,
        });
      }
    } else if (type === "DEPARTMENT") {

      const inputArray = [{ department: department }, { department: "ALL" }];
      let entry = { $in: inputArray.map(item => item.department) }
      logger.debug("entry", entry)
      query = {
        organization: organization,
        department: { $in: inputArray.map(item => item.department) },
      };
      aux = await users.aggregate([
        {
          $match: {
            organization: organization,
            department: department,
            is_manager: true,
            is_licensed: true
          },
        },
        {
          $group: {
            _id: null,
            name: { $addToSet: "$user_email" }
          }
        },
        {
          $unwind: "$name"
        },
        {
          $project: {
            _id: 0,
            name: "$name"
          }
        },
        {
          $lookup: {
            from: 'aux_managements',
            let: {
              "organization": organization,
              department: department,
              "assigned_to": "$name",

            },
            pipeline: [
              {
                "$match": {
                  "$expr": {
                    "$and": [
                      { "$eq": ["$organization", "$$organization"] },
                    ]
                  }
                }
              },
              {
                "$match": {
                  "$expr": {
                    "$or": [
                      { "$eq": ["$department", "$$department"] },
                      { "$eq": ["$department", "ALL"] }
                    ]
                  }
                }
              },
              {
                $unwind: {
                  path: "$management",
                }
              },
              {
                $project: {
                  _id: 0,
                  code: "$management.name",
                  department: "$$department",
                  assigned_to: "$$assigned_to"
                }
              },
              {
                $lookup: {
                  from: 'active_aux_managements',
                  let: {
                    "organization": organization,
                    "department": department,
                    "assigned_to": "$assigned_to",
                    "startDate": from,
                    "endDate": till,
                    code: "$code",
                  },
                  pipeline: [
                    {
                      "$match": {
                        "$expr": {
                          "$and": [
                            { "$eq": ["$organization", "$$organization"] },
                            { "$eq": ["$department", "$$department"] },
                            { "$eq": ["$assigned_to", "$$assigned_to"] },
                            { "$gte": ["$date", "$$startDate"] },
                            { "$lt": ["$date", "$$endDate"] },
                          ]
                        }
                      }
                    },
                    {
                      $unwind: {
                        path: "$aux_management",
                      }
                    },

                    {
                      "$match": {
                        "$expr": {
                          "$and": [
                            { "$eq": ["$aux_management.name", "$$code"] },
                          ]
                        }
                      }
                    },
                    {
                      $project: {
                        _id: 0,
                        aux_management: "$aux_management"
                      }
                    }
                  ],
                  as: 'aux_count'
                }
              },
              {
                $project: {
                  _id: 0,
                  code: 1,
                  count: {
                    $cond: {
                      if: { $size: "$aux_count" },
                      then: { $size: "$aux_count" },
                      else: 0
                    }
                  }
                }
              },
              {
                $sort: {
                  count: 1
                }
              }
            ],
            as: 'data'
          }
        },
      ])


      if (report_type === "csv") {
        try {
          logger.debug("from", from)
          for (let i = 0; i < aux.length; i++) {
            for (let j = 0; j < aux[i].data.length; j++) {

              let entry = {
                Organization: organization,
                Department: department,
                "Manager": aux[i].name,
                "Aux Code": aux[i].data[j].code,
                "No. Of Times Aux Taken": aux[i].data[j].count,
                "Date": moment(date).tz(time_zone).format('DD-MMM-YYYY')
              }
              report.push(entry)
            }
          }
          const fields = ['Organization', 'Department', 'Manager', 'Aux Code', 'No. Of Times Aux Taken', 'Date'];
          const opts = { fields };
          const csv = parse(report, opts);
          return res.status(200).send(csv);
        } catch (err) {
          logger.error(err);
          return res.status(500).json({
            'code': 'SERVER_ERROR',
            'description': 'Something went wrong, please try again'
          });
        }
      } else {
        return res.status(200).json({
          message: 'Aux code Vs Number of times aux taken data fetched successfully.',
          data: aux,
        });
      }
    } else if (type === "MANAGER") {
      aux = await users.aggregate([
        {
          $match: {
            organization: organization,
            department: department,
            assigned_to: manager_name,
            is_licensed: true
          },
        },
        {
          $group: {
            _id: "$user_email"
          }
        },
        {
          $project: {
            _id: 0,
            name: "$_id"
          }
        },
        {
          $lookup: {
            from: 'aux_managements',
            let: {
              "organization": organization,
              department: department,
              "user_email": "$name",

            },
            pipeline: [
              {
                "$match": {
                  "$expr": {
                    "$and": [
                      { "$eq": ["$organization", "$$organization"] },
                    ]
                  }
                }
              },
              {
                "$match": {
                  "$expr": {
                    "$or": [
                      { "$eq": ["$department", "$$department"] },
                      { "$eq": ["$department", "ALL"] }
                    ]
                  }
                }
              },
              {
                $unwind: {
                  path: "$management",
                }
              },
              {
                $project: {
                  _id: 0,
                  code: "$management.name",
                  department: "$$department",
                  user_email: "$$user_email"
                }
              },
              {
                $lookup: {
                  from: 'active_aux_managements',
                  let: {
                    "organization": organization,
                    "department": department,
                    "assigned_to": manager_name,
                    user_email: "$user_email",
                    "startDate": from,
                    "endDate": till,
                    code: "$code",
                  },
                  pipeline: [
                    {
                      "$match": {
                        "$expr": {
                          "$and": [
                            { "$eq": ["$organization", "$$organization"] },
                            { "$eq": ["$department", "$$department"] },
                            { "$eq": ["$assigned_to", "$$assigned_to"] },
                            { "$eq": ["$user_email", "$$user_email"] },
                            { "$gte": ["$date", "$$startDate"] },
                            { "$lt": ["$date", "$$endDate"] },
                          ]
                        }
                      }
                    },
                    {
                      $unwind: {
                        path: "$aux_management",
                      }
                    },

                    {
                      "$match": {
                        "$expr": {
                          "$and": [
                            { "$eq": ["$aux_management.name", "$$code"] },
                          ]
                        }
                      }
                    },
                    {
                      $project: {
                        _id: 0,
                        aux_management: "$aux_management"
                      }
                    }
                  ],
                  as: 'aux_count'
                }
              },
              {
                $project: {
                  _id: 0,
                  code: 1,
                  count: {
                    $cond: {
                      if: { $size: "$aux_count" },
                      then: { $size: "$aux_count" },
                      else: 0
                    }
                  }
                }
              },
              {
                $sort: {
                  count: 1
                }
              }
            ],
            as: 'data'
          }
        },
      ])

      if (report_type === "csv") {
        try {
          logger.debug("from", from)
          for (let i = 0; i < aux.length; i++) {
            for (let j = 0; j < aux[i].data.length; j++) {

              let entry = {
                Organization: organization,
                Department: department,
                "Manager": manager_name,
                "User": aux[i].name,
                "Aux Code": aux[i].data[j].code,
                "No. Of Times Aux Taken": aux[i].data[j].count,
                "Date": moment(date).tz(time_zone).format('DD-MMM-YYYY')
              }
              report.push(entry)
            }
          }
          const fields = ['Organization', 'Department', 'Manager', 'User', 'Aux Code', 'No. Of Times Aux Taken', 'Date'];
          const opts = { fields };
          const csv = parse(report, opts);
          return res.status(200).send(csv);
        } catch (err) {
          logger.error(err);
          return res.status(500).json({
            'code': 'SERVER_ERROR',
            'description': 'Something went wrong, please try again'
          });
        }
      } else {
        return res.status(200).json({
          message: 'Aux code Vs Number of times aux taken data fetched successfully.',
          data: aux,
        });
      }
    }


  } catch (error) {
    console.error(error);
    return res.status(500).json({
      code: 'SERVER_ERROR',
      description: 'something went wrong, Please try again',
    });
  }
};
module.exports = {
  getProductivityPercentage: getProductivityPercentage,
  getTotalHeadCount: getTotalHeadCount,
  getExpectedWorkHours: getExpectedWorkHours,
  getTotalAttendanceCount: getTotalAttendanceCount,
  getAvgLoggedVsNonWork: getAvgLoggedVsNonWork,
  getWorkLocationPercentage: getWorkLocationPercentage,
  getUserLeaveAnalytics: getUserLeaveAnalytics,
  getProductivityPercentageLoggedIn: getProductivityPercentageLoggedIn,
  loginHoursIdleTimeBreak: loginHoursIdleTimeBreak,
  test: test,
  getWorkHoursSummary: getWorkHoursSummary,
  attendanceCountDepartment: attendanceCountDepartment,
  getDurationAgainstStatusCode: getDurationAgainstStatusCode,
  auxLive: auxLive,
  getUserCountVsStatusCode: getUserCountVsStatusCode,
  getAuxCodeDuration: getAuxCodeDuration
};
