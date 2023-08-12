const express = require('express');
const Activity = require('../../models/activity');
const Task = require('../../models/task');
const Configuration = require('../../models/configuration');
const WorkLocation = require('../../models/user_work_location');
const ActiveAuxManagement = require('../../models/active_aux_management');

const Department = require('../../models/department');
const AdminOrganization = require('../../models/admin_organization');
const AuditOrganization = require('../../models/audit_organization');
const Logger = require('../../configs/log');
const logger = new Logger('productivity');
const util = require('util');
const const_config = require('../../utility/util');
const dummy_data = require('../../fwks/current_status_details');
const mongoose = require('mongoose');
const { parse } = require('json2csv');
const moment = require('moment-timezone');
const { response } = require('express');
const Users = require('../../models/users');
const DeviceInfo = require('../../models/device_info');
const DeviceBreach = require('../../models/device_breach');
const jsonexport = require('jsonexport');
const getTotalActiveUsers = async (req, res, next) => {
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
    //let local_date_from = moment(jDateToday).tz(time_zone)
    //let local_date_till = moment(jDateTill).tz(time_zone)

    //from = local_date_from.startOf('day').toDate()
    //let till = local_date_till.endOf('day').toDate()
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

    let activeUsersQuery = null;

    if (const_config.isAllowedRole(role, ['AGENT'])) {
      activeUsersQuery = {
        organization: organization,
        department: department,
        user_email: user_email,
        date: {
          $gte: from,
          $lt: till,
        },
      };
    } else if (const_config.isAllowedRole(role, ['MANAGER'])) {
      activeUsersQuery = {
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
        activeUsersQuery = {
          organization: organization,
          date: {
            $gte: from,
            $lt: till,
          },
        };
      } else {
        activeUsersQuery = {
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
        $match: activeUsersQuery,
      },
      { $project: { _id: 1, date: 1 } },
      {
        $group: {
          _id: {
            date: '$date',
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { date: -1 } },
    ]).exec((err, activities) => {
      if (err) throw err;
      return res.status(200).json({
        message: 'Total Active Users fetched successfully',
        data: activities,
      });
    });
  } catch (error) {
    logger.error(error);
  }
};

const getCurrentStatus = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;
    let assigned_to = req.assigned_to;

    let { date, required_role, manager_name } = req.body;
    let { current_status_type } = req.body;

    if (organization === undefined || organization === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: '12 Organization is required',
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

    if (date === undefined || date === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Date is required',
        field: 'date',
      });
    }

    let time_zone = req.timezone;
    let jDateToday = new Date(date);
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
    // let local_date = moment(jDateToday).tz(time_zone).format('YYYY-MM-DDTHH:mm:ss.SSSZ')
    // let from = local_date

    // let till = moment(local_date).add(23, 'hours').add(59, 'minutes').add(59, 'seconds').add(999, 'ms').tz(time_zone).format('YYYY-MM-DDTHH:mm:ss.SSSZ')

    logger.debug('From  == ', from);
    logger.debug('To  == ', till);

    let loggedInUserQuery = null;
    let loggedOutUserQuery = null;
    let activeUserQuery = null;
    let notLoggedInUser = null;
    let idleUserQuery = null;
    let userCountQuery = null;
    let isAuxManagementQuery = null;
    let isBreakQuery = null;
    //isBreak
    if (const_config.isAllowedRole(role, ['MANAGER'])) {
      loggedInUserQuery = {
        assigned_to: user_email,
        organization,
        date: {
          $gte: from,
          $lt: till,
        },
      };

      loggedOutUserQuery = {
        assigned_to: user_email,
        organization,
        date: {
          $gte: from,
          $lt: till,
        },
      };

      activeUserQuery = {
        assigned_to: user_email,
        organization,
        isIdle: false,
        date: {
          $gte: from,
          $lt: till,
        },
        logoutTime: { $exists: false },
      };
      if (required_role === 'MANAGER') {
        notLoggedInUser = {
          assigned_to: user_email,
          organization,
          $or: [
            {
              app_access_time: {
                $lt: from,
              },
            },
            { app_access_time: { $exists: false } },
          ],
          is_manager: true,
          is_licensed: true,
        };
      } else if (required_role === 'ADMIN') {
        notLoggedInUser = {
          assigned_to: user_email,
          organization,
          $or: [
            {
              app_access_time: {
                $lt: from,
              },
            },
            { app_access_time: { $exists: false } },
          ],
          is_admin: true,
          is_licensed: true,
        };
      } else if (required_role === 'AGENT') {
        notLoggedInUser = {
          assigned_to: user_email,
          organization,
          $or: [
            {
              app_access_time: {
                $lt: from,
              },
            },
            { app_access_time: { $exists: false } },
          ],
          is_member: true,
          is_licensed: true,
        };
      } else if (required_role === 'AUDIT') {
        notLoggedInUser = {
          assigned_to: user_email,
          organization,
          $or: [
            {
              app_access_time: {
                $lt: from,
              },
            },
            { app_access_time: { $exists: false } },
          ],
          is_auditor: true,
          is_licensed: true,
        };
      } else if (required_role === 'SUPER_ADMIN') {
        notLoggedInUser = {
          assigned_to: user_email,
          organization,
          $or: [
            {
              app_access_time: {
                $lt: from,
              },
            },
            { app_access_time: { $exists: false } },
          ],
          is_superadmin: true,
          is_licensed: true,
        };
      } else if (required_role === 'MANAGER AGENT') {
        notLoggedInUser = {
          assigned_to: user_email,
          organization,
          $or: [
            {
              app_access_time: {
                $lt: from,
              },
            },
            { app_access_time: { $exists: false } },
          ],
          is_manager: true,
          is_member: true,
          is_licensed: true,
        };
      } else if (required_role === 'AGENT AUDIT') {
        notLoggedInUser = {
          assigned_to: user_email,
          organization,
          $or: [
            {
              app_access_time: {
                $lt: from,
              },
            },
            { app_access_time: { $exists: false } },
          ],
          is_auditor: true,
          is_member: true,
          is_licensed: true,
        };
      } else if (required_role === 'MANAGER AUDIT') {
        notLoggedInUser = {
          assigned_to: user_email,
          is_licensed: true,
          organization,
          $or: [
            {
              app_access_time: {
                $lt: from,
              },
            },
            { app_access_time: { $exists: false } },
          ],
          is_manager: true,
          is_auditor: true,
        };
      } else {
        notLoggedInUser = {
          assigned_to: user_email,
          organization,
          is_licensed: true,
          $or: [
            {
              app_access_time: {
                $lt: from,
              },
            },
            { app_access_time: { $exists: false } },
          ],
        };
      }

      idleUserQuery = {
        assigned_to: user_email,
        organization,
        isIdle: true,
        date: {
          $gte: from,
          $lt: till,
        },
      };
      isAuxManagementQuery = {
        assigned_to: user_email,
        organization,
        isAuxManagement: true,
        date: {
          $gte: from,
          $lt: till,
        },
      };
      isBreakQuery = {
        assigned_to: user_email,
        organization,
        isBreak: true,
        date: {
          $gte: from,
          $lt: till,
        },
      };
      if (required_role === 'MANAGER') {
        userCountQuery = {
          assigned_to: user_email,
          organization: organization,
          is_manager: true,
          is_licensed: true,
        };
      } else if (required_role === 'ADMIN') {
        userCountQuery = {
          assigned_to: user_email,
          organization: organization,
          is_admin: true,
          is_licensed: true,
        };
      } else if (required_role === 'AGENT') {
        userCountQuery = {
          assigned_to: user_email,
          organization: organization,
          is_member: true,
          is_licensed: true,
        };
      } else if (required_role === 'AUDIT') {
        userCountQuery = {
          assigned_to: user_email,
          organization: organization,
          is_auditor: true,
          is_licensed: true,
        };
      } else if (required_role === 'SUPER_ADMIN') {
        userCountQuery = {
          assigned_to: user_email,
          organization: organization,
          is_superadmin: true,
          is_licensed: true,
        };
      } else if (required_role === 'MANAGER AGENT') {
        userCountQuery = {
          assigned_to: user_email,
          organization: organization,
          is_manager: true,
          is_member: true,
          is_licensed: true,
        };
      } else if (required_role === 'AGENT AUDIT') {
        userCountQuery = {
          assigned_to: user_email,
          organization: organization,
          is_auditor: true,
          is_member: true,
          is_licensed: true,
        };
      } else if (required_role === 'MANAGER AUDIT') {
        userCountQuery = {
          assigned_to: user_email,
          organization: organization,
          is_manager: true,
          is_auditor: true,
          is_licensed: true,
        };
      } else {
        userCountQuery = {
          assigned_to: user_email,
          organization: organization,
          is_licensed: true,
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
        loggedInUserQuery = {
          organization,
          date: {
            $gte: from,
            $lt: till,
          },
        };

        loggedOutUserQuery = {
          organization,
          date: {
            $gte: from,
            $lt: till,
          },
        };

        activeUserQuery = {
          organization,
          isIdle: false,
          date: {
            $gte: from,
            $lt: till,
          },
          logoutTime: { $exists: false },
        };
        if (required_role === 'MANAGER') {
          notLoggedInUser = {
            organization,
            is_licensed: true,
            $or: [
              {
                app_access_time: {
                  $lt: from,
                },
              },
              {
                app_access_time: { $exists: false },
              },
            ],
            is_manager: true,
          };
        } else if (required_role === 'ADMIN') {
          notLoggedInUser = {
            organization,
            is_licensed: true,
            $or: [
              {
                app_access_time: {
                  $lt: from,
                },
              },
              { app_access_time: { $exists: false } },
            ],
            is_admin: true,
          };
        } else if (required_role === 'AGENT') {
          notLoggedInUser = {
            organization,
            is_licensed: true,
            $or: [
              {
                app_access_time: {
                  $lt: from,
                },
              },
              { app_access_time: { $exists: false } },
            ],
            is_member: true,
          };
        } else if (required_role === 'AUDIT') {
          notLoggedInUser = {
            organization,
            is_licensed: true,
            $or: [
              {
                app_access_time: {
                  $lt: from,
                },
              },
              { app_access_time: { $exists: false } },
            ],
            is_auditor: true,
          };
        } else if (required_role === 'SUPER_ADMIN') {
          notLoggedInUser = {
            organization,
            is_licensed: true,
            $or: [
              {
                app_access_time: {
                  $lt: from,
                },
              },
              { app_access_time: { $exists: false } },
            ],
            is_superadmin: true,
          };
        } else {
          notLoggedInUser = {
            organization,
            is_licensed: true,
            $or: [
              {
                app_access_time: {
                  $lt: from,
                },
              },
              {
                app_access_time: { $exists: false },
              },
            ],
          };
        }

        idleUserQuery = {
          organization,
          isIdle: true,
          date: {
            $gte: from,
            $lt: till,
          },
        };
        if (required_role === 'MANAGER') {
          userCountQuery = {
            organization: organization,
            is_manager: true,
            is_licensed: true,
          };
        } else if (required_role === 'ADMIN') {
          userCountQuery = {
            organization: organization,
            is_admin: true,
            is_licensed: true,
          };
        } else if (required_role === 'AGENT') {
          userCountQuery = {
            organization: organization,
            is_member: true,
            is_licensed: true,
          };
        } else if (required_role === 'AUDIT') {
          userCountQuery = {
            organization: organization,
            is_auditor: true,
            is_licensed: true,
          };
        } else if (required_role === 'SUPER_ADMIN') {
          userCountQuery = {
            organization: organization,
            is_superadmin: true,
            is_licensed: true,
          };
        } else {
          userCountQuery = {
            organization: organization,
            is_licensed: true,
          };
        }
      } else if (!(manager_name === undefined || manager_name === '')) {
        loggedInUserQuery = {
          organization,
          department,
          assigned_to: manager_name,
          date: {
            $gte: from,
            $lt: till,
          },
        };

        loggedOutUserQuery = {
          organization,
          department,
          assigned_to: manager_name,
          date: {
            $gte: from,
            $lt: till,
          },
        };

        activeUserQuery = {
          organization,
          department,
          assigned_to: manager_name,
          isIdle: false,
          date: {
            $gte: from,
            $lt: till,
          },
          logoutTime: { $exists: false },
        };

        if (required_role === 'MANAGER') {
          notLoggedInUser = {
            organization,
            assigned_to: manager_name,
            department,
            is_licensed: true,
            $or: [
              {
                app_access_time: {
                  $lt: from,
                },
              },
              { app_access_time: { $exists: false } },
            ],
            is_manager: true,
          };
        } else if (required_role === 'ADMIN') {
          notLoggedInUser = {
            organization,
            department,
            assigned_to: manager_name,
            is_admin: true,
            is_licensed: true,
            $or: [
              {
                app_access_time: {
                  $lt: from,
                },
              },
              { app_access_time: { $exists: false } },
            ],
          };
        } else if (required_role === 'AGENT') {
          notLoggedInUser = {
            organization,
            department,
            assigned_to: manager_name,
            is_member: true,
            is_licensed: true,
            $or: [
              {
                app_access_time: {
                  $lt: from,
                },
              },
              { app_access_time: { $exists: false } },
            ],
          };
        } else if (required_role === 'AUDIT') {
          notLoggedInUser = {
            organization,
            department,
            assigned_to: manager_name,
            is_auditor: true,
            is_licensed: true,
            $or: [
              {
                app_access_time: {
                  $lt: from,
                },
              },
              { app_access_time: { $exists: false } },
            ],
          };
        } else if (required_role === 'SUPER_ADMIN') {
          notLoggedInUser = {
            organization,
            assigned_to: manager_name,
            department,
            is_superadmin: true,
            is_licensed: true,
            $or: [
              {
                app_access_time: {
                  $lt: from,
                },
              },
              { app_access_time: { $exists: false } },
            ],
          };
        } else if (required_role === 'MANAGER AGENT') {
          logger.debug('MANAGER AGENT');
          notLoggedInUser = {
            organization,
            assigned_to: manager_name,
            department,
            is_manager: true,
            is_member: true,
            is_licensed: true,
            $or: [
              {
                app_access_time: {
                  $lt: from,
                },
              },
              { app_access_time: { $exists: false } },
            ],
          };
        } else if (required_role === 'AGENT AUDIT') {
          notLoggedInUser = {
            organization,
            department,
            assigned_to: manager_name,
            is_auditor: true,
            is_member: true,
            is_licensed: true,
            $or: [
              {
                app_access_time: {
                  $lt: from,
                },
              },
              { app_access_time: { $exists: false } },
            ],
          };
        } else if (required_role === 'MANAGER AUDIT') {
          notLoggedInUser = {
            organization,
            department,
            assigned_to: manager_name,
            is_manager: true,
            is_auditor: true,
            is_licensed: true,
            $or: [
              {
                app_access_time: {
                  $lt: from,
                },
              },
              { app_access_time: { $exists: false } },
            ],
          };
        } else {
          notLoggedInUser = {
            organization,
            assigned_to: manager_name,
            department,
            is_licensed: true,
            $or: [
              {
                app_access_time: {
                  $lt: from,
                },
              },
              { app_access_time: { $exists: false } },
            ],
          };
        }

        idleUserQuery = {
          organization,
          assigned_to: manager_name,
          department,
          isIdle: true,
          date: {
            $gte: from,
            $lt: till,
          },
        };
        isAuxManagementQuery = {
          organization,
          assigned_to: manager_name,
          department,
          isAuxManagement: true,
          date: {
            $gte: from,
            $lt: till,
          },
        };
        isBreakQuery = {
          assigned_to: manager_name,
          organization,
          department,
          isBreak: true,
          date: {
            $gte: from,
            $lt: till,
          },
        };

        if (required_role === 'MANAGER') {
          userCountQuery = {
            organization: organization,
            department: department,
            assigned_to: manager_name,
            is_manager: true,
            is_licensed: true,
          };
        } else if (required_role === 'ADMIN') {
          userCountQuery = {
            organization: organization,
            department: department,
            assigned_to: manager_name,
            is_admin: true,
            is_licensed: true,
          };
        } else if (required_role === 'AGENT') {
          userCountQuery = {
            organization: organization,
            department: department,
            assigned_to: manager_name,
            is_member: true,
            is_licensed: true,
          };
        } else if (required_role === 'AUDIT') {
          userCountQuery = {
            organization: organization,
            department: department,
            assigned_to: manager_name,
            is_auditor: true,
            is_licensed: true,
          };
        } else if (required_role === 'SUPER_ADMIN') {
          userCountQuery = {
            organization: organization,
            department: department,
            assigned_to: manager_name,
            is_superadmin: true,
            is_licensed: true,
          };
        } else if (required_role === 'MANAGER AGENT') {
          userCountQuery = {
            organization: organization,
            department: department,
            assigned_to: manager_name,
            is_manager: true,
            is_member: true,
            is_licensed: true,
          };
        } else if (required_role === 'AGENT AUDIT') {
          userCountQuery = {
            organization: organization,
            department: department,
            assigned_to: manager_name,
            is_auditor: true,
            is_member: true,
            is_licensed: true,
          };
        } else if (required_role === 'MANAGER AUDIT') {
          userCountQuery = {
            organization: organization,
            department: department,
            assigned_to: manager_name,
            is_auditor: true,
            is_manager: true,
            is_licensed: true,
          };
        } else {
          userCountQuery = {
            organization: organization,
            department: department,
            assigned_to: manager_name,
            is_licensed: true,
          };
        }
      } else {
        loggedInUserQuery = {
          organization,
          department,
          date: {
            $gte: from,
            $lt: till,
          },
        };

        loggedOutUserQuery = {
          organization,
          department,
          date: {
            $gte: from,
            $lt: till,
          },
        };

        activeUserQuery = {
          organization,
          department,
          isIdle: false,
          date: {
            $gte: from,
            $lt: till,
          },
          logoutTime: { $exists: false },
        };

        if (required_role === 'MANAGER') {
          notLoggedInUser = {
            organization,
            department,
            is_licensed: true,
            $or: [
              {
                app_access_time: {
                  $lt: from,
                },
              },
              { app_access_time: { $exists: false } },
            ],
            is_manager: true,
          };
        } else if (required_role === 'ADMIN') {
          notLoggedInUser = {
            organization,
            department,
            is_admin: true,
            is_licensed: true,
            $or: [
              {
                app_access_time: {
                  $lt: from,
                },
              },
              { app_access_time: { $exists: false } },
            ],
          };
        } else if (required_role === 'AGENT') {
          notLoggedInUser = {
            organization,
            department,
            is_member: true,
            is_licensed: true,
            $or: [
              {
                app_access_time: {
                  $lt: from,
                },
              },
              { app_access_time: { $exists: false } },
            ],
          };
        } else if (required_role === 'AUDIT') {
          notLoggedInUser = {
            organization,
            department,
            is_auditor: true,
            is_licensed: true,
            $or: [
              {
                app_access_time: {
                  $lt: from,
                },
              },
              { app_access_time: { $exists: false } },
            ],
          };
        } else if (required_role === 'SUPER_ADMIN') {
          notLoggedInUser = {
            organization,
            department,
            is_superadmin: true,
            is_licensed: true,
            $or: [
              {
                app_access_time: {
                  $lt: from,
                },
              },
              { app_access_time: { $exists: false } },
            ],
          };
        } else if (required_role === 'MANAGER AGENT') {
          logger.debug('MANAGER AGENT');
          notLoggedInUser = {
            organization,
            department,
            is_manager: true,
            is_member: true,
            is_licensed: true,
            $or: [
              {
                app_access_time: {
                  $lt: from,
                },
              },
              { app_access_time: { $exists: false } },
            ],
          };
        } else if (required_role === 'AGENT AUDIT') {
          notLoggedInUser = {
            organization,
            department,
            is_auditor: true,
            is_member: true,
            is_licensed: true,
            $or: [
              {
                app_access_time: {
                  $lt: from,
                },
              },
              { app_access_time: { $exists: false } },
            ],
          };
        } else if (required_role === 'MANAGER AUDIT') {
          notLoggedInUser = {
            organization,
            department,
            is_manager: true,
            is_auditor: true,
            is_licensed: true,
            $or: [
              {
                app_access_time: {
                  $lt: from,
                },
              },
              { app_access_time: { $exists: false } },
            ],
          };
        } else {
          notLoggedInUser = {
            organization,
            department,
            is_licensed: true,
            $or: [
              {
                app_access_time: {
                  $lt: from,
                },
              },
              { app_access_time: { $exists: false } },
            ],
          };
        }

        idleUserQuery = {
          organization,
          department,
          isIdle: true,
          date: {
            $gte: from,
            $lt: till,
          },
        };
        isAuxManagementQuery = {
          organization,
          department,
          isAuxManagement: true,
          date: {
            $gte: from,
            $lt: till,
          },
        };
        isBreakQuery = {
          organization,
          department,
          isBreak: true,
          date: {
            $gte: from,
            $lt: till,
          },
        };
        if (required_role === 'MANAGER') {
          userCountQuery = {
            organization: organization,
            department: department,
            is_manager: true,
            is_licensed: true,
          };
        } else if (required_role === 'ADMIN') {
          userCountQuery = {
            organization: organization,
            department: department,
            is_admin: true,
            is_licensed: true,
          };
        } else if (required_role === 'AGENT') {
          userCountQuery = {
            organization: organization,
            department: department,
            is_member: true,
            is_licensed: true,
          };
        } else if (required_role === 'AUDIT') {
          userCountQuery = {
            organization: organization,
            department: department,
            is_auditor: true,
            is_licensed: true,
          };
        } else if (required_role === 'SUPER_ADMIN') {
          userCountQuery = {
            organization: organization,
            department: department,
            is_superadmin: true,
            is_licensed: true,
          };
        } else if (required_role === 'MANAGER AGENT') {
          userCountQuery = {
            organization: organization,
            department: department,
            is_manager: true,
            is_member: true,
            is_licensed: true,
          };
        } else if (required_role === 'AGENT AUDIT') {
          userCountQuery = {
            organization: organization,
            department: department,
            is_auditor: true,
            is_member: true,
            is_licensed: true,
          };
        } else if (required_role === 'MANAGER AUDIT') {
          userCountQuery = {
            organization: organization,
            department: department,
            is_auditor: true,
            is_manager: true,
            is_licensed: true,
          };
        } else {
          userCountQuery = {
            organization: organization,
            department: department,
            is_licensed: true,
          };
        }
      }
    }

    let active_user = await Activity.aggregate([
      {
        $match: loggedInUserQuery,
      },
      {
        $project: {
          _id: 0,
          department: 1,
          user_email: 1,
          lastSessionLogout: 1,
        },
      },
      {
        $match: {
          lastSessionLogout: { $exists: false },
        },
      },
    ]);

    let working_user = active_user.length;

    let logged_in_count = await Activity.find(
      loggedInUserQuery
    ).countDocuments();
    let not_logged = await Users.find(notLoggedInUser).countDocuments();
    let idle_count = await Activity.find(idleUserQuery).countDocuments();
    let active_count = await Activity.find(activeUserQuery).countDocuments();
    let head_count = await Users.find(userCountQuery).countDocuments();
    let logged_out_count = await Activity.find(
      loggedOutUserQuery,
      'lastSessionLogout subsequentLoginTime'
    );
    let auxManagement_count = await Activity.find(
      isAuxManagementQuery
    ).countDocuments();
    let break_count = await Activity.find(isBreakQuery).countDocuments();

    let active = 0;
    let logout = 0;
    for (let i = 0; i < logged_out_count.length; i++) {
      let element = logged_out_count[i];
      if (element.subsequentLoginTime > element.lastSessionLogout) {
        active = active + 1;
      } else if (element.subsequentLoginTime < element.lastSessionLogout) {
        logout = logout + 1;
      }
    }
    let response = {
      logged_in_count: logged_in_count,
      logged_out_count: logout,
      not_logged: not_logged,
      idle_count: idle_count,
      active_count: active + working_user,
      head_count: head_count,
      auxManagement_count: auxManagement_count,
      break_count: break_count,
    };

    return res.status(200).json({
      message: 'Current status count fetched successfully',
      data: response,
    });
  } catch (error) {
    logger.error(error);
    return res.status(500).json({
      code: 'SERVER_ERROR',
      description: 'something went wrong, Please try again',
    });
  }
};

const getLoggedInAndAbsentUsers = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;
    let assigned_to = req.assigned_to;

    return res.status(200).json({
      message: 'getLoggedInAndAbsentUsers fetched successfully',
      data: messages,
    });
  } catch (error) {
    logger.error(error);
    return res.status(500).json({
      code: 'SERVER_ERROR',
      description: 'something went wrong, Please try again',
    });
  }
};

const geIdleTimeDateWise = async (req, res, next) => {
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

    let idleTimeDateWiseQuery = null;
    if (const_config.isAllowedRole(role, ['AGENT'])) {
      idleTimeDateWiseQuery = {
        organization: organization,
        department: department,
        user_email: user_email,
        date: {
          $gte: from,
          $lt: till,
        },
      };
    } else if (const_config.isAllowedRole(role, ['MANAGER'])) {
      idleTimeDateWiseQuery = {
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
        idleTimeDateWiseQuery = {
          organization: organization,
          date: {
            $gte: from,
            $lt: till,
          },
        };
      } else {
        idleTimeDateWiseQuery = {
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
        $match: idleTimeDateWiseQuery,
      },
      {
        $group: {
          _id: {
            date: '$date',
          },
          total: {
            $sum: '$idleTime',
          },
        },
      },
      { $sort: { date: -1 } },
    ]).exec((err, breaks) => {
      if (err) throw err;
      return res.status(200).json({
        message: 'Idle Time Date wise in Minutes  fetched successfully',
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

const geIdleTimeDateWiseNew = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;
    let assigned_to = req.assigned_to;

    let { from, to } = req.query;
    let { manager_name, report_type, member_email } = req.body;

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
    let idleTimeDateWiseQuery;
    if (const_config.isAllowedRole(role, ['AGENT'])) {
      idleTimeDateWiseQuery = {
        organization: organization,
        department: department,
        user_email: user_email,
        date: {
          $gte: from,
          $lt: till,
        },
      };
    } else if (const_config.isAllowedRole(role, ['MANAGER'])) {
      if (!(member_email === undefined || member_email === '')) {
        idleTimeDateWiseQuery = {
          assigned_to: user_email,
          organization,
          user_email: member_email,
          date: {
            $gte: from,
            $lt: till,
          },
        };
      } else {
        idleTimeDateWiseQuery = {
          assigned_to: user_email,
          organization: organization,
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
        idleTimeDateWiseQuery = {
          organization: organization,
          date: {
            $gte: from,
            $lt: till,
          },
        };
      } else if (!(manager_name === undefined || manager_name === '')) {
        idleTimeDateWiseQuery = {
          organization: organization,
          department: department,
          assigned_to: manager_name,
          date: {
            $gte: from,
            $lt: till,
          },
        };
      } else if (!(member_email === undefined || member_email === '')) {
        idleTimeDateWiseQuery = {
          organization: organization,
          department: department,
          user_email: member_email,
          date: {
            $gte: from,
            $lt: till,
          },
        };
      } else {
        idleTimeDateWiseQuery = {
          organization: organization,
          department: department,
          date: {
            $gte: from,
            $lt: till,
          },
        };
      }
    }

    // function getDates(from, till) {
    //     var dateArray = [];
    //     var currentDate = moment(from);
    //     var stopDate = moment(till);
    //     while (currentDate <= stopDate) {
    //         dateArray.push(moment(currentDate).format('YYYY-MM-DD'))
    //         currentDate = moment(currentDate).add(1, 'days');
    //     }
    //     return dateArray;
    // }

    // let date_array = getDates(from, till)

    let idle_count = await Activity.aggregate([
      {
        $match: idleTimeDateWiseQuery,
      },
      {
        $project: {
          _id: 0,
          idleTime: 1,
          department: 1,
          date: 1,
        },
      },

      {
        $group: {
          _id: {
            department: '$department',
            date: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$date',
              },
            },
            idleTime: '$idleTime',
          },
        },
      },
      {
        $project: {
          _id: 0,
          Department: department,
          Organization: organization,
          date: '$_id.date',
          total: { $round: ['$_id.idleTime', 0] },
        },
      },
      {
        $sort: { date: 1 },
      },
    ]);
    // const totalMap = {};

    // for (const item of idle_count) {
    //     totalMap[item.date] = item.total;

    // }

    // const result = date_array.map(date => ({
    //     date,
    //     total: totalMap[date] || 0,
    //     Department: department,
    //     Organization: organization
    // }));

    if (report_type === 'csv') {
      try {
        let reports = [];

        for (let i = 0; i < idle_count.length; i++) {
          let entry = {
            Date: idle_count[i].date,
            'Total(min)': idle_count[i].total,
            Department: idle_count[i].Department,
            Organization: idle_count[i].Organization,
          };
          reports.push(entry);
        }
        const fields = ['Organization', 'Department', 'Date', 'Total(min)'];
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
        message: 'Idle Time Date wise in Minutes fetched successfully',
        data: idle_count,
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
const getTotalIdleTime = async (req, res, next) => {
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

    let totalIdleTime = 0;
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
    let idleTimeQuery = null;
    if (const_config.isAllowedRole(role, ['AGENT'])) {
      idleTimeQuery = {
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
        idleTimeQuery = {
          assigned_to: user_email,
          organization,
          user_email: member_email,
          date: {
            $gte: from,
            $lt: till,
          },
        };
      } else {
        idleTimeQuery = {
          assigned_to: user_email,
          organization,
          department,
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
        idleTimeQuery = {
          organization,
          date: {
            $gte: from,
            $lt: till,
          },
        };
      } else {
        if (!(member_email === undefined || member_email === '')) {
          idleTimeQuery = {
            organization,
            department,
            user_email: member_email,
            date: {
              $gte: from,
              $lt: till,
            },
          };
        } else if (!(manager_name === undefined || manager_name === '')) {
          idleTimeQuery = {
            organization,
            department,
            assigned_to: manager_name,
            date: {
              $gte: from,
              $lt: till,
            },
          };
        } else {
          idleTimeQuery = {
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

    let activities = await Activity.find(idleTimeQuery, 'idleTime');
    for (let activity of activities) {
      let idle_time = activity.idleTime;

      totalIdleTime = totalIdleTime + idle_time;
    }

    return res.status(200).json({
      message: 'Total Idle Time fetched successfully',
      data: {
        total_idle_time: totalIdleTime,
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

const getTotalLoggedHours = async (req, res, next) => {
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

    let totalLoggedHours = null;
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

    let activities = await Activity.find(totalLoggedHours, 'loginHours');
    let total_logged_hours = 0;
    if (activities.length > 0) {
      for (let activity of activities) {
        let login_hours = activity.loginHours;
        logger.debug('Login Hours ', login_hours);
        total_logged_hours = total_logged_hours + login_hours;
      }
      logger.debug('Total Logged Hours Time', total_logged_hours);
    }

    total_logged_hours = total_logged_hours / 60;

    return res.status(200).json({
      message: 'Total Logged Hours fetched successfully',
      data: {
        total_logged_hours: total_logged_hours,
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
//Need to add only authorized sites and authorized applications total hours
const getActualProductiveHours = async (req, res, next) => {
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

    let totalIdleTime = 0;
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

    let totalLoggedHours = null;
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

    let activities = await Activity.find(
      totalLoggedHours,
      'loginHours idleTime breaks'
    );
    let total_logged_hours = 0;
    for (let activity of activities) {
      let login_hours = activity.loginHours;

      logger.debug('Login Hours ', login_hours);
      total_logged_hours = total_logged_hours + login_hours;
    }
    logger.debug('Total Logged Time', total_logged_hours);

    //Converting into minutes
    total_logged_hours = total_logged_hours / 60;

    let idle_time_in_minutes = 0;
    for (let activity of activities) {
      let idle_hours = activity.idleTime;
      logger.debug('Total idle time ', idle_hours);

      idle_time_in_minutes = idle_time_in_minutes + idle_hours;
    }

    let break_time_in_minutes = 0;
    for (let activity of activities) {
      let break_time = activity.breaks[0];

      if (break_time !== undefined || break_time > 0) {
        break_time_minutes = break_time = activity.breaks[0].minutes;
        logger.debug('Total Break time ', break_time);
        break_time_in_minutes = break_time_in_minutes + break_time;
      }
    }

    let actual_productive_minutes = 0;

    logger.debug(
      'total_logged_hours ' +
      total_logged_hours +
      ' idle_time_in_minutes ' +
      idle_time_in_minutes +
      ' break_time_in_minutes ' +
      break_time_in_minutes
    );

    if (
      total_logged_hours === 0 ||
      total_logged_hours < idle_time_in_minutes + break_time_in_minutes
    ) {
      actual_productive_minutes = 0;
    } else {
      actual_productive_minutes =
        total_logged_hours - idle_time_in_minutes - break_time_in_minutes;
    }

    return res.status(200).json({
      message: 'Total Logged Hours fetched successfully',
      data: {
        total_logged_hours: actual_productive_minutes,
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

const getCurrentStatusDetails = async (req, res, next) => {
  try {
    let role = req.role;

    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;
    let assigned_to = req.assigned_to;
    let {
      date,
      required_role,
      type,
      current_status_type,
      report_type,
      manager,
      skip,
      limit
    } = req.body;

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

    if (date === undefined || date === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'date is required',
        field: 'date',
      });
    }

    let time_zone = req.timezone;
    let jDateToday = new Date(date);
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
    // let local_date = moment(jDateToday).tz(time_zone).format('YYYY-MM-DDTHH:mm:ss.SSSZ')
    // let from = local_date

    // let till = moment(local_date).add(23, 'hours').add(59, 'minutes').add(59, 'seconds').add(999, 'ms').tz(time_zone).format('YYYY-MM-DDTHH:mm:ss.SSSZ')

    logger.debug('role  == ', role);

    let currentStatusQuery = null;
    let userCountQuery = null;
    let departmentName;
    let loggedOutUserQuery;
    let departmentsArray;
    let inDepartments = [];
    if (const_config.isAllowedRole(role, ['MANAGER'])) {
      if (current_status_type === 'LOGGED_IN') {
        currentStatusQuery = {
          assigned_to: user_email,
          organization,
          date: {
            $gte: from,
            $lt: till,
          },
        };
      } else if (current_status_type === 'LOGGED_OUT') {
        currentStatusQuery = {
          assigned_to: user_email,
          organization,
          date: {
            $gte: from,
            $lt: till,
          },
          lastSessionLogout: {
            $gte: from,
            $lt: till,
          },
        };
      } else if (current_status_type === 'NOT_LOGGED_IN') {
        if (required_role === 'MANAGER') {
          userCountQuery = {
            assigned_to: user_email,
            organization,
            is_manager: true,
            is_licensed: true,
          };
        } else if (required_role === 'ADMIN') {
          userCountQuery = {
            assigned_to: user_email,
            organization,
            is_licensed: true,
            is_admin: true,
            $or: [
              {
                app_access_time: {
                  $lt: from,
                },
              },
              { app_access_time: { $exists: false } },
            ],
          };
        } else if (required_role === 'AGENT') {
          userCountQuery = {
            assigned_to: user_email,
            organization,
            is_member: true,
            is_licensed: true,
            $or: [
              {
                app_access_time: {
                  $lt: from,
                },
              },
              { app_access_time: { $exists: false } },
            ],
          };
        } else if (required_role === 'AUDIT') {
          userCountQuery = {
            assigned_to: user_email,
            organization,
            is_auditor: true,
            is_licensed: true,
            $or: [
              {
                app_access_time: {
                  $lt: from,
                },
              },
              { app_access_time: { $exists: false } },
            ],
          };
        } else if (required_role === 'SUPER_ADMIN') {
          userCountQuery = {
            assigned_to: user_email,
            organization,
            is_superadmin: true,
            is_licensed: true,
            $or: [
              {
                app_access_time: {
                  $lt: from,
                },
              },
              { app_access_time: { $exists: false } },
            ],
          };
        } else if (required_role === 'MANAGER AGENT') {
          userCountQuery = {
            assigned_to: user_email,
            organization,
            is_manager: true,
            is_member: true,
            is_licensed: true,
            $or: [
              {
                app_access_time: {
                  $lt: from,
                },
              },
              { app_access_time: { $exists: false } },
            ],
          };
        } else if (required_role === 'AGENT AUDIT') {
          userCountQuery = {
            assigned_to: user_email,
            organization,
            is_auditor: true,
            is_member: true,
            is_licensed: true,
            $or: [
              {
                app_access_time: {
                  $lt: from,
                },
              },
              { app_access_time: { $exists: false } },
            ],
          };
        } else if (required_role === 'MANAGER AUDIT') {
          userCountQuery = {
            assigned_to: user_email,
            organization,
            is_manager: true,
            is_auditor: true,
            is_licensed: true,
            $or: [
              {
                app_access_time: {
                  $lt: from,
                },
              },
              { app_access_time: { $exists: false } },
            ],
          };
        } else {
          userCountQuery = {
            assigned_to: user_email,
            department: department,
            organization,
            is_licensed: true,
          };
        }
      } else if (current_status_type === 'IDLE') {
        currentStatusQuery = {
          assigned_to: user_email,
          organization,
          isIdle: true,
          date: {
            $gte: from,
            $lt: till,
          },
        };
      } else if (current_status_type === 'ACTIVE') {
        currentStatusQuery = {
          assigned_to: user_email,
          organization,
          date: {
            $gte: from,
            $lt: till,
          },
        };
        loggedOutUserQuery = {
          assigned_to: user_email,
          organization,
          department: department,
          lastSessionLogout: {
            $gte: from,
            $lt: till,
          },
        };
      } else if (current_status_type === 'AUX_MANAGEMENT') {
        currentStatusQuery = {
          assigned_to: user_email,
          organization,
          isAuxManagement: true,
          date: {
            $gte: from,
            $lt: till,
          },
        };
      } else if (current_status_type === 'BREAK') {
        currentStatusQuery = {
          assigned_to: user_email,
          organization,
          isBreak: true,
          date: {
            $gte: from,
            $lt: till,
          },
        };
      } else if (current_status_type === 'TOTAL_USERS') {
        userCountQuery = {
          assigned_to: user_email,
          organization: organization,
          is_licensed: true,
        };
      }
    } else if (const_config.isAllowedRole(role, ['SUPER_ADMIN'])) {
      if (type === 'MANAGER') {
        if (current_status_type === 'LOGGED_IN') {
          currentStatusQuery = {
            organization,
            department,
            assigned_to: manager,
            date: {
              $gte: from,
              $lt: till,
            },
          };
        } else if (current_status_type === 'LOGGED_OUT') {
          currentStatusQuery = {
            organization,
            department,
            assigned_to: manager,
            date: {
              $gte: from,
              $lt: till,
            },
            lastSessionLogout: {
              $gte: from,
              $lt: till,
            },
          };
        } else if (current_status_type === 'NOT_LOGGED_IN') {
          if (required_role === 'MANAGER') {
            userCountQuery = {
              organization,
              department,
              assigned_to: manager,
              is_manager: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'ADMIN') {
            userCountQuery = {
              organization,
              department,
              assigned_to: manager,
              is_admin: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'AGENT') {
            userCountQuery = {
              organization,
              department,
              assigned_to: manager,
              is_member: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'AUDIT') {
            userCountQuery = {
              organization,
              department,
              assigned_to: manager,
              is_auditor: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'SUPER_ADMIN') {
            userCountQuery = {
              organization,
              department,
              assigned_to: manager,
              is_superadmin: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'MANAGER AGENT') {
            userCountQuery = {
              organization,
              department,
              assigned_to: manager,
              is_manager: true,
              is_member: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'AGENT AUDIT') {
            userCountQuery = {
              department,
              assigned_to: manager,
              is_auditor: true,
              is_member: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'MANAGER AUDIT') {
            userCountQuery = {
              organization,
              department,
              assigned_to: manager,
              is_manager: true,
              is_auditor: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else {
            currentStatusQuery = {
              organization,
              department,
              assigned_to: manager,
              date: {
                $gte: from,
                $lt: till,
              },
            };
            userCountQuery = {
              organization,
              department,
              assigned_to: manager,
              is_licensed: true,
            };
          }
        } else if (current_status_type === 'IDLE') {
          currentStatusQuery = {
            organization,
            department,
            assigned_to: manager,
            isIdle: true,
            date: {
              $gte: from,
              $lt: till,
            },
          };
        } else if (current_status_type === 'ACTIVE') {
          currentStatusQuery = {
            organization,
            department,
            assigned_to: manager,
            date: {
              $gte: from,
              $lt: till,
            },
          };
          loggedOutUserQuery = {
            organization,
            department,
            assigned_to: manager,
            lastSessionLogout: {
              $gte: from,
              $lt: till,
            },
          };
        } else if (current_status_type === 'AUX_MANAGEMENT') {
          currentStatusQuery = {
            organization,
            department,
            assigned_to: manager,
            isAuxManagement: true,
            date: {
              $gte: from,
              $lt: till,
            },
            logoutTime: { $exists: false },
          };
        } else if (current_status_type === 'BREAK') {
          currentStatusQuery = {
            organization,
            department,
            assigned_to: manager,
            isBreak: true,
            date: {
              $gte: from,
              $lt: till,
            },
            logoutTime: { $exists: false },
          };
        } else if (current_status_type === 'TOTAL_USERS') {
          userCountQuery = {
            organization: organization,
            department,
            assigned_to: manager,
            is_licensed: true,
          };
        }
      } else if (type === 'ORGANIZATION') {
        departmentName = await Department.findOne(
          { organization },
          'department_array.name'
        );
        for (let i = 0; i < departmentName.department_array.length; i++) {
          let element = departmentName.department_array[i].name;
          inDepartments.push(element);
          logger.debug('element', element);
        }

        departmentsArray = departmentName.department_array;
        if (current_status_type === 'LOGGED_IN') {
          currentStatusQuery = {
            organization,
            department: { $in: inDepartments },
            date: {
              $gte: from,
              $lt: till,
            },
          };
        } else if (current_status_type === 'LOGGED_OUT') {
          currentStatusQuery = {
            organization,
            department: { $in: inDepartments },
            date: {
              $gte: from,
              $lt: till,
            },
            lastSessionLogout: {
              $gte: from,
              $lt: till,
            },
          };
        } else if (current_status_type === 'NOT_LOGGED_IN') {
          if (required_role === 'MANAGER') {
            userCountQuery = {
              organization,
              department: { $in: inDepartments },
              is_manager: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'ADMIN') {
            userCountQuery = {
              organization,
              department: { $in: inDepartments },
              is_admin: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'AGENT') {
            userCountQuery = {
              organization,
              department: { $in: inDepartments },
              is_member: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'AUDIT') {
            userCountQuery = {
              organization,
              department: { $in: inDepartments },
              is_auditor: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'SUPER_ADMIN') {
            userCountQuery = {
              organization,
              department: { $in: inDepartments },
              is_superadmin: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'MANAGER AGENT') {
            userCountQuery = {
              organization,
              department: { $in: inDepartments },
              is_manager: true,
              is_member: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'AGENT AUDIT') {
            userCountQuery = {
              department: { $in: inDepartments },
              is_auditor: true,
              is_member: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'MANAGER AUDIT') {
            userCountQuery = {
              organization,
              department: { $in: inDepartments },
              is_manager: true,
              is_auditor: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else {
            logger.debug('querryyyyyyyy');
            currentStatusQuery = {
              organization,
              department: { $in: inDepartments },
              date: {
                $gte: from,
                $lt: till,
              },
            };
            userCountQuery = {
              organization,
              department: { $in: inDepartments },
              is_licensed: true,
            };
          }
        } else if (current_status_type === 'IDLE') {
          currentStatusQuery = {
            organization,
            department: { $in: inDepartments },
            isIdle: true,
            date: {
              $gte: from,
              $lt: till,
            },
          };
        } else if (current_status_type === 'ACTIVE') {
          currentStatusQuery = {
            organization,
            department: { $in: inDepartments },
            date: {
              $gte: from,
              $lt: till,
            },
          };

          loggedOutUserQuery = {
            organization,
            department: { $in: inDepartments },
            lastSessionLogout: {
              $gte: from,
              $lt: till,
            },
          };
        } else if (current_status_type === 'AUX_MANAGEMENT') {
          currentStatusQuery = {
            organization,
            department: { $in: inDepartments },
            isAuxManagement: true,
            date: {
              $gte: from,
              $lt: till,
            },
          };
        } else if (current_status_type === 'BREAK') {
          currentStatusQuery = {
            organization,
            department: { $in: inDepartments },
            isBreak: true,
            date: {
              $gte: from,
              $lt: till,
            },
            logoutTime: { $exists: false },
          };
        } else if (current_status_type === 'TOTAL_USERS') {
          userCountQuery = {
            organization: organization,
            department: { $in: inDepartments },
            is_licensed: true,
          };
        }
      } else if (type === 'DEPARTMENT') {
        if (current_status_type === 'LOGGED_IN') {
          currentStatusQuery = {
            organization,
            department,
            date: {
              $gte: from,
              $lt: till,
            },
          };
        } else if (current_status_type === 'LOGGED_OUT') {
          currentStatusQuery = {
            organization,
            department,
            date: {
              $gte: from,
              $lt: till,
            },
            lastSessionLogout: {
              $gte: from,
              $lt: till,
            },
          };
        } else if (current_status_type === 'NOT_LOGGED_IN') {
          if (required_role === 'MANAGER') {
            userCountQuery = {
              organization,
              department,
              is_manager: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'ADMIN') {
            userCountQuery = {
              organization,
              department,
              is_admin: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'AGENT') {
            userCountQuery = {
              organization,
              department,
              is_member: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'AUDIT') {
            userCountQuery = {
              organization,
              department,
              is_auditor: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'SUPER_ADMIN') {
            userCountQuery = {
              organization,
              department,
              is_superadmin: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'MANAGER AGENT') {
            userCountQuery = {
              organization,
              department,
              is_manager: true,
              is_member: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'AGENT AUDIT') {
            userCountQuery = {
              department,
              is_auditor: true,
              is_member: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'MANAGER AUDIT') {
            userCountQuery = {
              organization,
              department,
              is_manager: true,
              is_auditor: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else {
            userCountQuery = {
              organization: organization,
              department: department,
              is_licensed: true,
            };
            currentStatusQuery = {
              organization,
              department,
              date: {
                $gte: from,
                $lt: till,
              },
            };
          }
        } else if (current_status_type === 'IDLE') {
          currentStatusQuery = {
            organization,
            department,
            isIdle: true,
            date: {
              $gte: from,
              $lt: till,
            },
          };
        } else if (current_status_type === 'ACTIVE') {
          currentStatusQuery = {
            organization,
            department,
            date: {
              $gte: from,
              $lt: till,
            },
          };

          loggedOutUserQuery = {
            organization,
            department,
            lastSessionLogout: {
              $gte: from,
              $lt: till,
            },
          };
        } else if (current_status_type === 'AUX_MANAGEMENT') {
          currentStatusQuery = {
            organization,
            department,
            isAuxManagement: true,
            date: {
              $gte: from,
              $lt: till,
            },
            logoutTime: { $exists: false },
          };
        } else if (current_status_type === 'BREAK') {
          currentStatusQuery = {
            organization,
            department,
            isBreak: true,
            date: {
              $gte: from,
              $lt: till,
            },
            logoutTime: { $exists: false },
          };
        } else if (current_status_type === 'TOTAL_USERS') {
          userCountQuery = {
            organization: organization,
            department: department,
            is_licensed: true,
          };
        }
      }
    } else if (const_config.isAllowedRole(role, ['ADMIN'])) {
      if (type === 'MANAGER') {
        if (current_status_type === 'LOGGED_IN') {
          currentStatusQuery = {
            organization,
            department,
            assigned_to: manager,
            date: {
              $gte: from,
              $lt: till,
            },
          };
        } else if (current_status_type === 'LOGGED_OUT') {
          currentStatusQuery = {
            organization,
            department,
            assigned_to: manager,
            date: {
              $gte: from,
              $lt: till,
            },
            lastSessionLogout: {
              $gte: from,
              $lt: till,
            },
          };
        } else if (current_status_type === 'NOT_LOGGED_IN') {
          if (required_role === 'MANAGER') {
            userCountQuery = {
              organization,
              department,
              assigned_to: manager,
              is_manager: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'ADMIN') {
            userCountQuery = {
              organization,
              department,
              assigned_to: manager,
              is_admin: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'AGENT') {
            userCountQuery = {
              organization,
              department,
              assigned_to: manager,
              is_member: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'AUDIT') {
            userCountQuery = {
              organization,
              department,
              assigned_to: manager,
              is_auditor: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'SUPER_ADMIN') {
            userCountQuery = {
              organization,
              department,
              assigned_to: manager,
              is_superadmin: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'MANAGER AGENT') {
            userCountQuery = {
              organization,
              department,
              assigned_to: manager,
              is_manager: true,
              is_member: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'AGENT AUDIT') {
            userCountQuery = {
              department,
              assigned_to: manager,
              is_auditor: true,
              is_member: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'MANAGER AUDIT') {
            userCountQuery = {
              organization,
              department,
              assigned_to: manager,
              is_manager: true,
              is_auditor: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else {
            userCountQuery = {
              organization,
              department,
              assigned_to: manager,
              is_licensed: true,
            };
            currentStatusQuery = {
              organization,
              department,
              assigned_to: manager,
              date: {
                $gte: from,
                $lt: till,
              },
            };
          }
        } else if (current_status_type === 'IDLE') {
          currentStatusQuery = {
            organization,
            department,
            assigned_to: manager,
            isIdle: true,
            date: {
              $gte: from,
              $lt: till,
            },
          };
        } else if (current_status_type === 'ACTIVE') {
          currentStatusQuery = {
            organization,
            department,
            assigned_to: manager,
            date: {
              $gte: from,
              $lt: till,
            },
          };

          loggedOutUserQuery = {
            organization,
            department,
            assigned_to: manager,
            lastSessionLogout: {
              $gte: from,
              $lt: till,
            },
          };
        } else if (current_status_type === 'AUX_MANAGEMENT') {
          currentStatusQuery = {
            organization,
            department,
            assigned_to: manager,
            isAuxManagement: true,
            date: {
              $gte: from,
              $lt: till,
            },
            logoutTime: { $exists: false },
          };
        } else if (current_status_type === 'BREAK') {
          currentStatusQuery = {
            organization,
            department,
            assigned_to: manager,
            isBreak: true,
            date: {
              $gte: from,
              $lt: till,
            },
            logoutTime: { $exists: false },
          };
        } else if (current_status_type === 'TOTAL_USERS') {
          userCountQuery = {
            organization,
            department,
            assigned_to: manager,
            is_licensed: true,
          };
        }
      } else if (type === 'ORGANIZATION') {
        let tempDepartmentName = await AdminOrganization.findOne(
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

        if (current_status_type === 'LOGGED_IN') {
          currentStatusQuery = {
            organization,
            department: { $in: inDepartments },
            date: {
              $gte: from,
              $lt: till,
            },
          };
        } else if (current_status_type === 'LOGGED_OUT') {
          currentStatusQuery = {
            organization,
            date: {
              $gte: from,
              $lt: till,
            },
            department: { $in: inDepartments },
            lastSessionLogout: {
              $gte: from,
              $lt: till,
            },
          };
        } else if (current_status_type === 'NOT_LOGGED_IN') {
          if (required_role === 'MANAGER') {
            userCountQuery = {
              organization,
              department: { $in: inDepartments },
              is_manager: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'ADMIN') {
            userCountQuery = {
              organization,
              department: { $in: inDepartments },
              is_admin: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'AGENT') {
            userCountQuery = {
              organization,
              department: { $in: inDepartments },
              is_member: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'AUDIT') {
            userCountQuery = {
              organization,
              department: { $in: inDepartments },
              is_auditor: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'SUPER_ADMIN') {
            userCountQuery = {
              organization,
              department: { $in: inDepartments },
              is_superadmin: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'MANAGER AGENT') {
            userCountQuery = {
              organization,
              department: { $in: inDepartments },
              is_manager: true,
              is_member: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'AGENT AUDIT') {
            userCountQuery = {
              department: { $in: inDepartments },
              is_auditor: true,
              is_member: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'MANAGER AUDIT') {
            userCountQuery = {
              organization,
              department: { $in: inDepartments },
              is_manager: true,
              is_auditor: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else {
            userCountQuery = {
              organization,
              department: { $in: inDepartments },
              is_licensed: true,
            };
            currentStatusQuery = {
              organization,
              department: { $in: inDepartments },
              date: {
                $gte: from,
                $lt: till,
              },
            };
          }
        } else if (current_status_type === 'IDLE') {
          currentStatusQuery = {
            organization,
            department: { $in: inDepartments },
            isIdle: true,
            date: {
              $gte: from,
              $lt: till,
            },
          };
        } else if (current_status_type === 'ACTIVE') {
          currentStatusQuery = {
            organization,
            department: { $in: inDepartments },
            date: {
              $gte: from,
              $lt: till,
            },
          };
          loggedOutUserQuery = {
            organization,
            department: { $in: inDepartments },
            lastSessionLogout: {
              $gte: from,
              $lt: till,
            },
          };
        } else if (current_status_type === 'AUX_MANAGEMENT') {
          currentStatusQuery = {
            organization,
            department: { $in: inDepartments },
            isAuxManagement: true,
            date: {
              $gte: from,
              $lt: till,
            },
            logoutTime: { $exists: false },
          };
        } else if (current_status_type === 'BREAK') {
          currentStatusQuery = {
            organization,
            department: { $in: inDepartments },
            isBreak: true,
            date: {
              $gte: from,
              $lt: till,
            },
            logoutTime: { $exists: false },
          };
        } else if (current_status_type === 'TOTAL_USERS') {
          userCountQuery = {
            organization: organization,
            department: { $in: inDepartments },
            is_licensed: true,
          };
        }
      } else if (type === 'DEPARTMENT') {
        if (current_status_type === 'LOGGED_IN') {
          currentStatusQuery = {
            organization,
            department,
            date: {
              $gte: from,
              $lt: till,
            },
          };
        } else if (current_status_type === 'LOGGED_OUT') {
          currentStatusQuery = {
            organization,
            department,
            date: {
              $gte: from,
              $lt: till,
            },
            lastSessionLogout: {
              $gte: from,
              $lt: till,
            },
          };
        } else if (current_status_type === 'NOT_LOGGED_IN') {
          if (required_role === 'MANAGER') {
            userCountQuery = {
              organization,
              department,
              is_manager: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'ADMIN') {
            userCountQuery = {
              organization,
              department,
              is_admin: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'AGENT') {
            userCountQuery = {
              organization,
              department,
              is_member: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'AUDIT') {
            userCountQuery = {
              organization,
              department,
              is_auditor: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'SUPER_ADMIN') {
            userCountQuery = {
              organization,
              department,
              is_superadmin: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'MANAGER AGENT') {
            userCountQuery = {
              organization,
              department,
              is_manager: true,
              is_member: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'AGENT AUDIT') {
            userCountQuery = {
              department,
              is_auditor: true,
              is_member: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'MANAGER AUDIT') {
            userCountQuery = {
              organization,
              department,
              is_manager: true,
              is_auditor: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else {
            userCountQuery = {
              organization,
              department,
              is_licensed: true,
            };
            currentStatusQuery = {
              organization,
              department,
              date: {
                $gte: from,
                $lt: till,
              },
            };
          }
        } else if (current_status_type === 'IDLE') {
          currentStatusQuery = {
            organization,
            department,
            isIdle: true,
            date: {
              $gte: from,
              $lt: till,
            },
          };
        } else if (current_status_type === 'ACTIVE') {
          currentStatusQuery = {
            organization,
            department,
            date: {
              $gte: from,
              $lt: till,
            },
          };

          loggedOutUserQuery = {
            organization,
            department,
            lastSessionLogout: {
              $gte: from,
              $lt: till,
            },
          };
        } else if (current_status_type === 'AUX_MANAGEMENT') {
          currentStatusQuery = {
            organization,
            department,
            isAuxManagement: true,
            date: {
              $gte: from,
              $lt: till,
            },
            logoutTime: { $exists: false },
          };
        } else if (current_status_type === 'BREAK') {
          currentStatusQuery = {
            organization,
            department,
            isBreak: true,
            date: {
              $gte: from,
              $lt: till,
            },
            logoutTime: { $exists: false },
          };
        } else if (current_status_type === 'TOTAL_USERS') {
          userCountQuery = {
            organization,
            department: department,
            is_licensed: true,
          };
        }
      }
    } else if (const_config.isAllowedRole(role, ['AUDIT'])) {
      if (type === 'MANAGER') {
        if (current_status_type === 'LOGGED_IN') {
          currentStatusQuery = {
            organization,
            department,
            assigned_to: manager,
            date: {
              $gte: from,
              $lt: till,
            },
          };
        } else if (current_status_type === 'LOGGED_OUT') {
          currentStatusQuery = {
            organization,
            department,
            assigned_to: manager,
            date: {
              $gte: from,
              $lt: till,
            },
            lastSessionLogout: {
              $gte: from,
              $lt: till,
            },
          };
        } else if (current_status_type === 'NOT_LOGGED_IN') {
          if (required_role === 'MANAGER') {
            userCountQuery = {
              organization,
              department,
              assigned_to: manager,
              is_manager: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'ADMIN') {
            userCountQuery = {
              organization,
              department,
              assigned_to: manager,
              is_admin: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'AGENT') {
            userCountQuery = {
              organization,
              department,
              assigned_to: manager,
              is_member: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'AUDIT') {
            userCountQuery = {
              organization,
              department,
              assigned_to: manager,
              is_auditor: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'SUPER_ADMIN') {
            userCountQuery = {
              organization,
              department,
              assigned_to: manager,
              is_superadmin: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'MANAGER AGENT') {
            userCountQuery = {
              organization,
              department,
              assigned_to: manager,
              is_manager: true,
              is_member: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'AGENT AUDIT') {
            userCountQuery = {
              department,
              assigned_to: manager,
              is_auditor: true,
              is_member: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'MANAGER AUDIT') {
            userCountQuery = {
              organization,
              department,
              assigned_to: manager,
              is_manager: true,
              is_auditor: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else {
            userCountQuery = {
              organization,
              department,
              assigned_to: manager,
              is_licensed: true,
            };
            currentStatusQuery = {
              organization,
              department,
              assigned_to: manager,
              date: {
                $gte: from,
                $lt: till,
              },
            };
          }
        } else if (current_status_type === 'IDLE') {
          currentStatusQuery = {
            organization,
            department,
            assigned_to: manager,
            isIdle: true,
            date: {
              $gte: from,
              $lt: till,
            },
          };
        } else if (current_status_type === 'ACTIVE') {
          currentStatusQuery = {
            organization,
            department,
            assigned_to: manager,
            date: {
              $gte: from,
              $lt: till,
            },
          };

          loggedOutUserQuery = {
            organization,
            department,
            assigned_to: manager,
            lastSessionLogout: {
              $gte: from,
              $lt: till,
            },
          };
        } else if (current_status_type === 'AUX_MANAGEMENT') {
          currentStatusQuery = {
            organization,
            department,
            assigned_to: manager,
            isAuxManagement: true,
            date: {
              $gte: from,
              $lt: till,
            },
            logoutTime: { $exists: false },
          };
        } else if (current_status_type === 'BREAK') {
          currentStatusQuery = {
            organization,
            department,
            assigned_to: manager,
            isBreak: true,
            date: {
              $gte: from,
              $lt: till,
            },
            logoutTime: { $exists: false },
          };
        } else if (current_status_type === 'TOTAL_USERS') {
          userCountQuery = {
            organization,
            department,
            assigned_to: manager,
            is_licensed: true,
          };
        }
      } else if (type === 'ORGANIZATION') {
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
        if (current_status_type === 'LOGGED_IN') {
          currentStatusQuery = {
            organization,
            department: { $in: inDepartments },
            date: {
              $gte: from,
              $lt: till,
            },
          };
        } else if (current_status_type === 'LOGGED_OUT') {
          currentStatusQuery = {
            organization,
            date: {
              $gte: from,
              $lt: till,
            },
            department: { $in: inDepartments },
            lastSessionLogout: {
              $gte: from,
              $lt: till,
            },
          };
        } else if (current_status_type === 'NOT_LOGGED_IN') {
          if (required_role === 'MANAGER') {
            userCountQuery = {
              organization,
              department: { $in: inDepartments },
              is_manager: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'ADMIN') {
            userCountQuery = {
              organization,
              department: { $in: inDepartments },
              is_admin: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'AGENT') {
            userCountQuery = {
              organization,
              department: { $in: inDepartments },
              is_member: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'AUDIT') {
            userCountQuery = {
              organization,
              department: { $in: inDepartments },
              is_auditor: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'SUPER_ADMIN') {
            userCountQuery = {
              organization,
              department: { $in: inDepartments },
              is_superadmin: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'MANAGER AGENT') {
            userCountQuery = {
              organization,
              department: { $in: inDepartments },
              is_manager: true,
              is_member: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'AGENT AUDIT') {
            userCountQuery = {
              department: { $in: inDepartments },
              is_auditor: true,
              is_member: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'MANAGER AUDIT') {
            userCountQuery = {
              organization,
              department: { $in: inDepartments },
              is_manager: true,
              is_auditor: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else {
            userCountQuery = {
              organization,
              department: { $in: inDepartments },
              is_licensed: true,
            };
            currentStatusQuery = {
              organization,
              department: { $in: inDepartments },
              date: {
                $gte: from,
                $lt: till,
              },
            };
          }
        } else if (current_status_type === 'IDLE') {
          currentStatusQuery = {
            organization,
            department: { $in: inDepartments },
            isIdle: true,
            date: {
              $gte: from,
              $lt: till,
            },
          };
        } else if (current_status_type === 'ACTIVE') {
          currentStatusQuery = {
            organization,
            department: { $in: inDepartments },
            date: {
              $gte: from,
              $lt: till,
            },
          };
          loggedOutUserQuery = {
            organization,
            department: { $in: inDepartments },
            lastSessionLogout: {
              $gte: from,
              $lt: till,
            },
          };
        } else if (current_status_type === 'AUX_MANAGEMENT') {
          currentStatusQuery = {
            organization,
            department: { $in: inDepartments },
            isAuxManagement: true,
            date: {
              $gte: from,
              $lt: till,
            },
            logoutTime: { $exists: false },
          };
        } else if (current_status_type === 'BREAK') {
          currentStatusQuery = {
            organization,
            department: { $in: inDepartments },
            isBreak: true,
            date: {
              $gte: from,
              $lt: till,
            },
            logoutTime: { $exists: false },
          };
        } else if (current_status_type === 'TOTAL_USERS') {
          userCountQuery = {
            organization,
            department: { $in: inDepartments },
            is_licensed: true,
          };
        }
      } else if (type === 'DEPARTMENT') {
        if (current_status_type === 'LOGGED_IN') {
          currentStatusQuery = {
            organization,
            department,
            date: {
              $gte: from,
              $lt: till,
            },
          };
        } else if (current_status_type === 'LOGGED_OUT') {
          currentStatusQuery = {
            organization,
            department,
            date: {
              $gte: from,
              $lt: till,
            },
            lastSessionLogout: {
              $gte: from,
              $lt: till,
            },
          };
        } else if (current_status_type === 'NOT_LOGGED_IN') {
          if (required_role === 'MANAGER') {
            userCountQuery = {
              organization,
              department,
              is_manager: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'ADMIN') {
            userCountQuery = {
              organization,
              department,
              is_admin: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'AGENT') {
            userCountQuery = {
              organization,
              department,
              is_member: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'AUDIT') {
            userCountQuery = {
              organization,
              department,
              is_auditor: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'SUPER_ADMIN') {
            userCountQuery = {
              organization,
              department,
              is_superadmin: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'MANAGER AGENT') {
            userCountQuery = {
              organization,
              department,
              is_manager: true,
              is_member: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'AGENT AUDIT') {
            userCountQuery = {
              department,
              is_auditor: true,
              is_member: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else if (required_role === 'MANAGER AUDIT') {
            userCountQuery = {
              organization,
              department,
              is_manager: true,
              is_auditor: true,
              is_licensed: true,
              $or: [
                {
                  app_access_time: {
                    $lt: from,
                  },
                },
                { app_access_time: { $exists: false } },
              ],
            };
          } else {
            userCountQuery = {
              organization,
              department,
              is_licensed: true,
            };
            currentStatusQuery = {
              organization,
              department,
              date: {
                $gte: from,
                $lt: till,
              },
            };
          }
        } else if (current_status_type === 'IDLE') {
          currentStatusQuery = {
            organization,
            department,
            isIdle: true,
            date: {
              $gte: from,
              $lt: till,
            },
          };
        } else if (current_status_type === 'ACTIVE') {
          currentStatusQuery = {
            organization,
            department,
            date: {
              $gte: from,
              $lt: till,
            },
          };
          loggedOutUserQuery = {
            organization,
            department,
            lastSessionLogout: {
              $gte: from,
              $lt: till,
            },
          };
        } else if (current_status_type === 'AUX_MANAGEMENT') {
          currentStatusQuery = {
            organization,
            department,
            isAuxManagement: true,
            date: {
              $gte: from,
              $lt: till,
            },
            logoutTime: { $exists: false },
          };
        } else if (current_status_type === 'BREAK') {
          currentStatusQuery = {
            organization,
            department,
            isBreak: true,
            date: {
              $gte: from,
              $lt: till,
            },
            logoutTime: { $exists: false },
          };
        } else if (current_status_type === 'TOTAL_USERS') {
          userCountQuery = {
            organization,
            department,
            is_licensed: true,
          };
        }
      }
    }

    let activities_response = [];
    let activities;
    let users_data;
    let message = null;
    let response = null;
    let active = [];
    let logout = [];
    let reports = [];
    let total_count = 0;
    logger.debug('currentStatusQuery', currentStatusQuery);
    if (current_status_type === 'NOT_LOGGED_IN' && report_type === 'json') {
      let activities = await Activity.find(currentStatusQuery).distinct(
        'user_email'
      );

      [users_data, total_count] = await Promise.all([
        Users.aggregate([
          {
            $match: userCountQuery,
          },
          {
            $match: {
              user_email: {
                $nin: activities,
              },
            },
          },
          {
            $lookup: {
              from: 'users',
              let: {
                "organization": "$organization",
                "assigned_to": "$assigned_to",
                "department": "$department",
              },
              pipeline: [
                {
                  "$match": {
                    "$expr": {
                      "$and": [
                        { "$eq": ["$organization", "$$organization"] },
                        { "$eq": ["$user_email", "$$assigned_to"] },
                        { "$eq": ["$department", "$$department"] },
                      ]
                    }
                  }
                },
                {
                  $project: {
                    _id: 0,
                    manager_name: {
                      $concat: [
                        "$first_name",
                        " ",
                        "$last_name"
                      ]
                    }
                  },
                },
  
  
              ],
              as: 'manager_name'
            }
          },
          {
            $unwind: {
              path: "$manager_name",
              preserveNullAndEmptyArrays: true
            }
          },
          {
            $addFields: {
              manager_name: {
                $cond: { if: "$manager_name.manager_name", then: "$manager_name.manager_name", else: "" }
              },
            }
          },
          {$sort: {user_email: -1}},
          {$skip: skip},
          {$limit: limit}
        ]),
        Users.aggregate([
          {
            $match: userCountQuery,
          },
          {
            $match: {
              user_email: {
                $nin: activities,
              },
            },
          },
          {
            $lookup: {
              from: 'users',
              let: {
                "organization": "$organization",
                "assigned_to": "$assigned_to",
                "department": "$department",
              },
              pipeline: [
                {
                  "$match": {
                    "$expr": {
                      "$and": [
                        { "$eq": ["$organization", "$$organization"] },
                        { "$eq": ["$user_email", "$$assigned_to"] },
                        { "$eq": ["$department", "$$department"] },
                      ]
                    }
                  }
                },
                {
                  $project: {
                    _id: 0,
                    manager_name: {
                      $concat: [
                        "$first_name",
                        " ",
                        "$last_name"
                      ]
                    }
                  },
                },
  
  
              ],
              as: 'manager_name'
            }
          },
          {
            $unwind: {
              path: "$manager_name",
              preserveNullAndEmptyArrays: true
            }
          },
          {
            $addFields: {
              manager_name: {
                $cond: { if: "$manager_name.manager_name", then: "$manager_name.manager_name", else: "" }
              },
            }
          }
        ])
      ]);

      total_count = total_count.length;

      let user_arr = [];
      for (let user of users_data) {
        let not_logged = null;
        if (user.app_access_time === undefined || user.app_access_time === '') {
          not_logged = 'Not logged in';
        } else {
          not_logged = user.app_access_time;
        }

        let user_data = {
          user_email: user.user_email,
          app_access_time: not_logged,
          department: user.department,
          organization: user.organization,
          name: user.first_name + ' ' + user.last_name,
          manager_name: user.manager_name,
          manager: user.assigned_to,

        };
        user_arr.push(user_data);
      }
      response = user_arr;

      return res.status(200).json({
        message: message + ' users fetched successfully',
        data: response,
        total_count: total_count
      });

    } else {
      if (current_status_type === 'TOTAL_USERS') {
        message = 'TOTAL_USERS';

        let [users, total_count] = await Promise.all([
          Users.aggregate([
          {
            $match: userCountQuery,
          },
          // {
          //   $project: {
          //     _id: 0,
          //     organization: 1,
          //     department: 1,
          //     assigned_to: 1,
          //     user_email: 1,
          //     createdAt: 1,
          //     first_name: 1,
          //     last_name: 1,
          //   },
          // },
          {$sort: {user_email: -1}},
          {
            $group: {
              _id: {
                createdAt: {
                  $dateToString: {
                    format: '%m-%d-%Y',
                    date: '$createdAt',
                  },
                },
                organization: '$organization',
                department: '$department',
                assigned_to: '$assigned_to',
                user_email: '$user_email',
                first_name: '$first_name',
                last_name: '$last_name',
              },
            },
          },
          {
            $project: {
              _id: 0,
              organization: '$_id.organization',
              department: '$_id.department',
              user_email: '$_id.user_email',
              manager: '$_id.assigned_to',
              'created_at': '$_id.createdAt',
              name: {
                $concat: ['$_id.first_name', ' ', '$_id.last_name'],
              },
            },
          },
          {
            $lookup: {
              from: 'users',
              let: {
                "organization": "$organization",
                "assigned_to": "$manager",
                "department": "$department",
              },
              pipeline: [
                {
                  "$match": {
                    "$expr": {
                      "$and": [
                        { "$eq": ["$organization", "$$organization"] },
                        { "$eq": ["$user_email", "$$assigned_to"] },
                        { "$eq": ["$department", "$$department"] },
                      ]
                    }
                  }
                },
                {
                  $project: {
                    _id: 0,
                    manager_name: {
                      $concat: [
                        "$first_name",
                        " ",
                        "$last_name"
                      ]
                    }
                  },
                },


              ],
              as: 'manager_name'
            }
          },
          {
            $unwind: {
              path: "$manager_name",
              preserveNullAndEmptyArrays: true
            }
          },
          {
            $addFields: {
              'manager_name': {
                $cond: { if: "$manager_name.manager_name", then: "$manager_name.manager_name", else: "" }
              },
            }
          },
          {$skip: skip},
          {$limit: limit}
          ]),
          Users.countDocuments(userCountQuery),
        ])

        if (report_type === 'csv') {
          try {

            let users = await Users.aggregate([
              {
                $match: userCountQuery,
              },
              {
                $project: {
                  _id: 0,
                  organization: 1,
                  department: 1,
                  assigned_to: 1,
                  user_email: 1,
                  createdAt: 1,
                  first_name: 1,
                  last_name: 1,
                },
              },
              {
                $group: {
                  _id: {
                    createdAt: {
                      $dateToString: {
                        format: '%m-%d-%Y',
                        date: '$createdAt',
                      },
                    },
                    organization: '$organization',
                    department: '$department',
                    assigned_to: '$assigned_to',
                    user_email: '$user_email',
                    first_name: '$first_name',
                    last_name: '$last_name',
                  },
                },
              },
              {
                $project: {
                  _id: 0,
                  Organization: '$_id.organization',
                  Department: '$_id.department',
                  User: '$_id.user_email',
                  Manager: '$_id.assigned_to',
                  'Creation Date': '$_id.createdAt',
                  Name: {
                    $concat: ['$_id.first_name', ' ', '$_id.last_name'],
                  },
                },
              },
              {
                $lookup: {
                  from: 'users',
                  let: {
                    "organization": "$Organization",
                    "assigned_to": "$Manager",
                    "department": "$Department",
                  },
                  pipeline: [
                    {
                      "$match": {
                        "$expr": {
                          "$and": [
                            { "$eq": ["$organization", "$$organization"] },
                            { "$eq": ["$user_email", "$$assigned_to"] },
                            { "$eq": ["$department", "$$department"] },
                          ]
                        }
                      }
                    },
                    {
                      $project: {
                        _id: 0,
                        manager_name: {
                          $concat: [
                            "$first_name",
                            " ",
                            "$last_name"
                          ]
                        }
                      },
                    },


                  ],
                  as: 'manager_name'
                }
              },
              {
                $unwind: {
                  path: "$manager_name",
                  preserveNullAndEmptyArrays: true
                }
              },
              {
                $addFields: {
                  'Manager Name': {
                    $cond: { if: "$manager_name.manager_name", then: "$manager_name.manager_name", else: "" }
                  },
                }
              },
            ]);
            const fields = [
              'Organization',
              'Department',
              'User',
              'Name',
              'Manager',
              'Manager Name',
              'Creation Date',
            ];
            const opts = { fields };
            const csv = parse(users, opts);
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
            message: message + ' users fetched successfully',
            data: users,
            total_count: total_count
          });
        }
      } else {
        // activities = await Activity.find(
        //   currentStatusQuery,
        //   'user_email organization assigned_to assigned_to_name department name loginTime isIdle date createdAt updatedAt lastSessionLogout subsequentLoginTime logoutTime'
        // );
        
        [activities, total_count] = await Promise.all([
          Activity.aggregate([
            {
              $match: currentStatusQuery
            },
            {$sort: {date: -1}},
            {$skip: skip},
            {$limit: limit}
          ]),
          Activity.countDocuments(currentStatusQuery),
        ]);

        console.log(activities.length)
        users_data = await Users.find(
          userCountQuery,
          'user_email organization department first_name last_name app_access_time'
        );
        for (let i = 0; i < activities.length; i++) {
          let deviceInfo = await DeviceBreach.findOne(
            {
              user_email: activities[i].user_email,
              organization: activities[i].organization,
              department: activities[i].department,
              date: {
                $gte: from,
                $lt: till,
              },
              connectivityType: {
                $nin: ['Reconnected', 'Disconnected'],
              },
            },
            'status'
          ).sort({ date: -1 });
          let camera_value = 'NA';
          if (deviceInfo) {
            if (deviceInfo.status === true) {
              camera_value = 'OK';
            }
          }
          let entry = {
            organization: activities[i].organization,
            department: activities[i].department,
            loginTime: activities[i].loginTime,
            user_email: activities[i].user_email,
            name: activities[i].name,
            isIdle: activities[i].assigned_to,
            date: activities[i].date,
            createdAt: activities[i].createdAt,
            updatedAt: activities[i].updatedAt,
            lastSessionLogout: activities[i].lastSessionLogout,
            subsequentLoginTime: activities[i].subsequentLoginTime,
            logoutTime: activities[i].logoutTime,
            camera_status: camera_value,
            manager_name: activities[i].assigned_to_name,
            manager: activities[i].assigned_to,
          };
          activities_response.push(entry);
        }
      }
    }

    activities = activities_response;

    if (current_status_type === 'LOGGED_IN') {
      (message = 'logged in'), (response = activities);
    } else if (current_status_type === 'LOGGED_OUT') {
      message = 'logged out';
      response = activities;
      let response_array = [];
      for (let i = 0; i < activities.length; i++) {
        let element = activities[i];
        // if (element.logoutTime !== undefined) {
        //     response_array.push(element)
        // }
        logger.debug('element', element);
        let lastSessionLogout = element.lastSessionLogout.toString();
        let subsequentLoginTime = element.subsequentLoginTime.toString();
        lastSessionLogout = lastSessionLogout.split(' ');
        subsequentLoginTime = subsequentLoginTime.split(' ');

        if (subsequentLoginTime > lastSessionLogout) {
          active.push(element);
        } else if (subsequentLoginTime < lastSessionLogout) {
          logout.push(element);
        }
      }
      response = logout;
    } else if (current_status_type === 'NOT_LOGGED_IN') {
      message = 'Not logged';
      let activities = await Activity.find(currentStatusQuery).distinct(
        'user_email'
      );

      let user_arr = [];
      users_data = await Users.aggregate([
        {
          $match: userCountQuery,
        },
        {
          $match: {
            user_email: {
              $nin: activities,
            },
          },
        },
        {
          $lookup: {
            from: 'users',
            let: {
              "organization": "$organization",
              "assigned_to": "$assigned_to",
              "department": "$department",
            },
            pipeline: [
              {
                "$match": {
                  "$expr": {
                    "$and": [
                      { "$eq": ["$organization", "$$organization"] },
                      { "$eq": ["$user_email", "$$assigned_to"] },
                      { "$eq": ["$department", "$$department"] },
                    ]
                  }
                }
              },
              {
                $project: {
                  _id: 0,
                  manager_name: {
                    $concat: [
                      "$first_name",
                      " ",
                      "$last_name"
                    ]
                  }
                },
              },


            ],
            as: 'manager_name'
          }
        },
        {
          $unwind: {
            path: "$manager_name",
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $addFields: {
            manager_name: {
              $cond: { if: "$manager_name.manager_name", then: "$manager_name.manager_name", else: "" }
            },
          }
        }
      ]);
      for (let user of users_data) {
        let not_logged = null;
        if (user.app_access_time === undefined || user.app_access_time === '') {
          not_logged = 'Not logged in';
        } else {
          not_logged = user.app_access_time;
        }

        let user_data = {
          user_email: user.user_email,
          app_access_time: not_logged,
          department: user.department,
          organization: user.organization,
          name: user.first_name + ' ' + user.last_name,
          manager_name: user.manager_name,
          manager: user.assigned_to,

        };
        user_arr.push(user_data);
      }
      // response = user_arr;
      if (report_type === 'csv') {
        try {
          for (let i = 0; i < user_arr.length; i++) {
            let not_logged;
            if (user_arr[i].app_access_time === 'Not logged in') {
              not_logged;
            } else {
              not_logged = moment(user_arr[i].app_access_time)
                .tz(time_zone)
                .format('DD-MMM-YYYY');
            }

            let entry = {
              Organization: user_arr[i].organization,
              Department: user_arr[i].department,
              User: user_arr[i].user_email,
              Name: user_arr[i].name,
              'Manager Name': user_arr[i].manager_name,
              'Manager': user_arr[i].manager,
              LastLoginDate:
                user_arr[i].app_access_time === 'Not logged in'
                  ? user_arr[i].app_access_time
                  : (user_arr[i].app_access_time = moment(
                    user_arr[i].app_access_time
                  )
                    .tz(time_zone)
                    .format('DD-MMM-YYYY')),
              Time_zone: time_zone,
            };
            reports.push(entry);
          }
          const fields = [
            'Organization',
            'Department',
            'User',
            'Manager',
            'Manager Name',
            'Name',
            'LastLoginDate',
            'Time_zone',
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
      }
    } else if (current_status_type === 'IDLE') {
      (message = 'Idle'), (response = activities);
    } else if (current_status_type === 'ACTIVE') {
      message = 'Active';

      let active_user = await Activity.aggregate([
        {
          $match: currentStatusQuery,
        },
        {
          $project: {
            _id: 0,
            organization: 1,
            department: 1,
            user_email: 1,
            name: 1,
            lastSessionLogout: 1,
            loginTime: 1,
            subsequentLoginTime: 1,
            assigned_to: 1,
            assigned_to_name: 1
          },
        },
        {
          $match: {
            lastSessionLogout: { $exists: false },
          },
        },
        {
          $project: {
            _id: 0,
            organization: 1,
            department: 1,
            user_email: 1,
            name: 1,
            assigned_to: 1,
            assigned_to_name: 1,
            lastSessionLogout: {
              $cond: {
                if: '$lastSessionLogout',
                then: '$lastSessionLogout',
                else: '',
              },
            },
            subsequentLoginTime: {
              $cond: {
                if: '$subsequentLoginTime',
                then: '$subsequentLoginTime',
                else: '',
              },
            },
            loginTime: 1,
          },
        },
        {
          $project: {
            _id: 0,
            organization: 1,
            department: 1,
            user_email: 1,
            name: 1,
            manager: "$assigned_to",
            manager_name: "$assigned_to_name",
            lastSessionLogout: 1,
            subsequentLoginTime: 1,
            loginTime: 1,
          },
        },
      ]);

      let logged_out_count = await Activity.find(
        loggedOutUserQuery,
        'user_email lastSessionLogout subsequentLoginTime loginTime name organization department assigned_to assigned_to_name'
      );

      for (let i = 0; i < logged_out_count.length; i++) {
        let element = logged_out_count[i];

        if (element.subsequentLoginTime > element.lastSessionLogout) {
          logger.debug('element.subsequentLoginTime', element);

          let user_data = {
            user_email: element.user_email,
            department: element.department,
            organization: element.organization,
            name: element.name,
            manager_name: element.assigned_to_name,
            manager: element.assigned_to,
            lastSessionLogout: element.lastSessionLogout,
            subsequentLoginTime: element.subsequentLoginTime,
            loginTime: element.loginTime,
            _id: element._id
          };
          active.push(user_data);
        }
      }

      const uniqueEmailsSet = new Set();

      // Merge the arrays while ensuring uniqueness
      const mergedArray = active.concat(active_user).filter((obj) => {
        if (uniqueEmailsSet.has(obj.user_email)) {
          return false; // Skip duplicate objects
        } else {
          uniqueEmailsSet.add(obj.user_email);
          return true; // Include unique objects
        }
      });

      for (let i = 0; i < mergedArray.length; i++) {
        let deviceInfo = await DeviceBreach.findOne(
          {
            user_email: mergedArray[i].user_email,
            organization: mergedArray[i].organization,
            department: mergedArray[i].department,
            date: {
              $gte: from,
              $lt: till,
            },
            connectivityType: {
              $nin: ['Reconnected', 'Disconnected'],
            },
          },
          'status'
        ).sort({ date: -1 });
        let camera_value = 'NA';
        if (deviceInfo) {
          if (deviceInfo.status === true) {
            camera_value = 'OK';
          }
        }
        mergedArray[i].camera_status = camera_value
      }
      if (report_type === 'csv') {
        try {
          for (let i = 0; i < mergedArray.length; i++) {
            let entry = {
              Organization: mergedArray[i].organization,
              Department: mergedArray[i].department,
              User: mergedArray[i].user_email,
              Name: mergedArray[i].name,
              'Manager': mergedArray[i].manager,
              'Manager Name': mergedArray[i].manager_name,
              'Camera Status': mergedArray[i].camera_status,
              'Login Time(hh:mm)': moment(mergedArray[i].loginTime)
                .tz(time_zone)
                .format('HH:mm'),
            };
            reports.push(entry);
          }
          const fields = [
            'Organization',
            'Department',
            'User',
            'Manager',
            'Manager Name',
            'Name',
            'Camera Status',
            'Login Time(hh:mm)',
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
          message: message + ' users fetched successfully',
          data: mergedArray
        });
      }
    } else if (current_status_type === 'AUX_MANAGEMENT') {
      message = 'Aux management';
      response = activities;
    } else if (current_status_type === 'BREAK') {
      message = 'BREAK';
      response = activities;
    }
    if (report_type === 'csv') {
      try {
        let reports = [];
        response.forEach(async function (act) {
          if (current_status_type === 'LOGGED_OUT') {
            let logoutSession_date_time;
            if (
              act.lastSessionLogout === undefined ||
              act.lastSessionLogout === ''
            ) {
              logoutSession_date_time = 'NOT_LOGGED_OUT';
            } else {
              logoutSession_date_time = moment(act.lastSessionLogout)
                .tz(time_zone)
                .format('HH:mm');
            }
            let entry = {
              Organization: act.organization,
              Department: act.department,
              User: act.user_email,
              Name: act.name,
              'Manager Name': act.manager_name,
              Manager: act.manager,
              'Logout Time(hh:mm)': logoutSession_date_time,
            };
            reports.push(entry);
          } else if (current_status_type === 'LOGGED_IN') {
            let entry = {
              Organization: act.organization,
              Department: act.department,
              User: act.user_email,
              Name: act.name,
              'Manager Name': act.manager_name,
              Manager: act.manager,
              'Login Time(hh:mm)': moment(act.loginTime)
                .tz(time_zone)
                .format('HH:mm'),
            };
            reports.push(entry);
          } else if (current_status_type === 'IDLE') {
            let entry = {
              Organization: act.organization,
              Department: act.department,
              User: act.user_email,
              Name: act.name,
              'Manager Name': act.manager_name,
              Manager: act.manager,
              'Login Time(hh:mm)': moment(act.loginTime)
                .tz(time_zone)
                .format('HH:mm'),
            };
            reports.push(entry);
          } else if (current_status_type === 'BREAK') {
            let entry = {
              Organization: act.organization,
              Department: act.department,
              User: act.user_email,
              Name: act.name,
              'Manager Name': act.manager_name,
              Manager: act.manager,
            };
            reports.push(entry);
          } else if (current_status_type === 'AUX_MANAGEMENT') {
            let entry = {
              Organization: act.organization,
              Department: act.department,
              User: act.user_email,
              Name: act.name,
              'Manager Name': act.manager_name,
              Manager: act.manager,
            };
            reports.push(entry);
          } else {
            let logout_date_time = 'N/A';
            if (act.logoutTime === undefined || act.logoutTime === '') {
              logout_date_time = 'NOT_LOGGED_OUT';
            } else {
              logout_date_time = moment(act.logoutTime)
                .tz(time_zone)
                .format('DD-MMM-YYYY HH:mm:ss');
            }
            let logoutSession_date_time = 'N/A';
            if (
              act.lastSessionLogout === undefined ||
              act.lastSessionLogout === ''
            ) {
              logoutSession_date_time = 'NOT_LOGGED_OUT';
            } else {
              logoutSession_date_time = moment(act.lastSessionLogout)
                .tz(time_zone)
                .format('DD-MMM-YYYY HH:mm:ss');
            }
            let entry = {
              Organization: act.organization,
              Department: act.department,
              loginTime: moment(act.loginTime)
                .tz(time_zone)
                .format('DD-MMM-YYYY HH:mm:ss'),
              User: act.user_email,
              Name: act.name,
              isIdle: act.isIdle,
              lastSessionLogout: logoutSession_date_time,
              logoutTime: logout_date_time,
              //Camera_status: act.camera_status,
              Time_zone: time_zone,
            };
            reports.push(entry);
          }
        });

        if (current_status_type === 'NOT_LOGGED_IN') {
          const fields = [
            'Organization',
            'Department',
            'User',
            'Name',
            'LastLoginDate',
            'Time_zone',
          ];
          const opts = { fields };
          const csv = parse(reports, opts);
          return res.status(200).send(csv);
        } else if (current_status_type === 'LOGGED_OUT') {
          const fields = [
            'Organization',
            'Department',
            'User',
            'Name',
            'Manager',
            'Manager Name',
            'Logout Time(hh:mm)',
          ];
          const opts = { fields };
          const csv = parse(reports, opts);
          return res.status(200).send(csv);
        } else if (current_status_type === 'LOGGED_IN') {
          const fields = [
            'Organization',
            'Department',
            'User',
            'Name',
            'Manager',
            'Manager Name',
            'Login Time(hh:mm)',
          ];
          const opts = { fields };
          const csv = parse(reports, opts);
          return res.status(200).send(csv);
        } else if (current_status_type === 'IDLE') {
          const fields = [
            'Organization',
            'Department',
            'User',
            'Name',
            'Manager',
            'Manager Name',
            'Login Time(hh:mm)',
          ];
          const opts = { fields };
          const csv = parse(reports, opts);
          return res.status(200).send(csv);
        } else if (current_status_type === 'BREAK') {
          const fields = ['Organization', 'Department', 'User', 'Name', 'Manager', 'Manager Name'];
          const opts = { fields };
          const csv = parse(reports, opts);
          return res.status(200).send(csv);
        } else if (current_status_type === 'AUX_MANAGEMENT') {
          const fields = ['Organization', 'Department', 'User', 'Name', 'Manager', 'Manager Name'];
          const opts = { fields };
          const csv = parse(reports, opts);
          return res.status(200).send(csv);
        } else {
          const fields = [
            'Organization',
            'Department',
            'loginTime',
            'User',
            'Name',
            'Manager',
            'Manager Name',
            'lastSessionLogout',
            'logoutTime',
            'Camera_status',
            'Time_zone',
          ];
          const opts = { fields };
          const csv = parse(reports, opts);
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
      return res.status(200).json({
        message: message + ' users fetched successfully',
        data: response,
        total_count: total_count
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

const getActiveVsIdleDetails = async (req, res, next) => {
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
        description: '12 Organization is required',
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
        description: 'TO is required',
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

    let activeUserQuery = null;
    let idleUserQuery = null;
    if (const_config.isAllowedRole(role, ['MANAGER'])) {
      activeUserQuery = {
        assigned_to: user_email,
        organization,
        isIdle: false,
        date: {
          $gte: from,
          $lt: till,
        },
        logoutTime: { $exists: false },
      };

      idleUserQuery = {
        assigned_to: user_email,
        organization,
        isIdle: true,
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
        activeUserQuery = {
          organization,
          isIdle: false,
          date: {
            $gte: from,
            $lt: till,
          },
          logoutTime: { $exists: false },
        };

        idleUserQuery = {
          organization,
          isIdle: true,
          date: {
            $gte: from,
            $lt: till,
          },
        };
      } else {
        activeUserQuery = {
          organization,
          department,
          isIdle: false,
          date: {
            $gte: from,
            $lt: till,
          },
          logoutTime: { $exists: false },
        };

        idleUserQuery = {
          organization,
          department,
          isIdle: true,
          date: {
            $gte: from,
            $lt: till,
          },
        };
      }
    }

    let idle_users = await Activity.find(idleUserQuery).countDocuments();
    let active_user = await Activity.find(activeUserQuery).countDocuments();
    ///let idle_count = idle_users.length
    //let active_count = active_user.length

    let response = {
      total_active: idle_users,
      total_idle: active_user,
    };

    return res.status(200).json({
      message: 'Active vs Idle fetched successfully',
      data: response,
    });
  } catch (error) {
    logger.error(error);
    return res.status(500).json({
      code: 'SERVER_ERROR',
      description: 'something went wrong, Please try again',
    });
  }
};

const getDayWiseMacro = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;
    let assigned_to = req.assigned_to;

    let { from, to } = req.query;
    let { member_email, report_type, manager_name } = req.body;
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
    let response_array = [];

    let configQuery = null;

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

    let configs_work_hours = await Configuration.find(configQuery);
    let work_hours = 0;
    if (department === 'ALL') {
      for (var config of configs_work_hours) {
        work_hours = work_hours + config.productivity.work_hours;
      }
    } else {
      work_hours = configs_work_hours[0].productivity.work_hours;
      logger.debug(' Work Hours', work_hours);
    }

    //Convert hours to seconds

    let work_hours_in_seconds = work_hours * 60 * 60;
    let over_work_hours_with_extra_30min = work_hours_in_seconds + 1800;
    let under_work_hours_with_less_30min = work_hours_in_seconds - 1800;

    for (var i = 0; i < date_array.length; i++) {
      let date = date_array[i];
      logger.debug('date  ', date_array[i]);
      let time_zone = req.timezone;
      let jDateToday = new Date(date_array[i]);
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
      // let local_date = moment(jDateToday).tz(time_zone).format('YYYY-MM-DDTHH:mm:ss.SSSZ')
      // let start = local_date

      // let end = moment(local_date).add(23, 'hours').add(59, 'minutes').add(59, 'seconds').add(999, 'ms').tz(time_zone).format('YYYY-MM-DDTHH:mm:ss.SSSZ')

      let totalLoggedHours = null;
      if (const_config.isAllowedRole(role, ['MANAGER'])) {
        if (!(member_email === undefined || member_email === '')) {
          overWorkedQuery = {
            assigned_to: user_email,
            user_email: member_email,
            organization,

            date: {
              $gte: start,
              $lt: end,
            },
            loginHours: { $gte: over_work_hours_with_extra_30min },
          };

          underWorkedQuery = {
            assigned_to: user_email,
            user_email: member_email,
            organization,

            date: {
              $gte: start,
              $lt: end,
            },
            loginHours: { $lt: under_work_hours_with_less_30min },
          };
          adequateWorkedQuery = {
            assigned_to: user_email,
            user_email: member_email,
            organization,
            date: {
              $gte: start,
              $lt: end,
            },
            $and: [
              { loginHours: { $gte: under_work_hours_with_less_30min } },
              { loginHours: { $lt: over_work_hours_with_extra_30min } },
            ],
          };
        } else {
          overWorkedQuery = {
            assigned_to: user_email,
            organization,
            date: {
              $gte: start,
              $lt: end,
            },
            loginHours: { $gte: over_work_hours_with_extra_30min },
          };

          underWorkedQuery = {
            assigned_to: user_email,
            organization,
            date: {
              $gte: start,
              $lt: end,
            },
            loginHours: { $lt: under_work_hours_with_less_30min },
          };
          adequateWorkedQuery = {
            assigned_to: user_email,
            organization,
            date: {
              $gte: start,
              $lt: end,
            },
            $and: [
              { loginHours: { $gte: under_work_hours_with_less_30min } },
              { loginHours: { $lt: over_work_hours_with_extra_30min } },
            ],
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
        if (!(member_email === undefined || member_email === '')) {
          overWorkedQuery = {
            user_email: member_email,
            organization,
            department,
            date: {
              $gte: start,
              $lt: end,
            },
            loginHours: { $gte: over_work_hours_with_extra_30min },
          };
          underWorkedQuery = {
            user_email: member_email,
            organization,
            department,
            date: {
              $gte: start,
              $lt: end,
            },
            loginHours: { $lt: under_work_hours_with_less_30min },
          };
          adequateWorkedQuery = {
            user_email: member_email,
            organization,
            department,
            date: {
              $gte: start,
              $lt: end,
            },
            $and: [
              { loginHours: { $gte: under_work_hours_with_less_30min } },
              { loginHours: { $lt: over_work_hours_with_extra_30min } },
            ],
          };
        } else if (!(manager_name === undefined || manager_name === '')) {
          overWorkedQuery = {
            organization,
            department,
            assigned_to: manager_name,
            date: {
              $gte: start,
              $lt: end,
            },
            loginHours: { $gte: over_work_hours_with_extra_30min },
          };
          underWorkedQuery = {
            organization,
            department,
            assigned_to: manager_name,
            date: {
              $gte: start,
              $lt: end,
            },
            loginHours: { $lt: under_work_hours_with_less_30min },
          };
          adequateWorkedQuery = {
            organization,
            department,
            assigned_to: manager_name,
            date: {
              $gte: start,
              $lt: end,
            },
            $and: [
              { loginHours: { $gte: under_work_hours_with_less_30min } },
              { loginHours: { $lt: over_work_hours_with_extra_30min } },
            ],
          };
        } else {
          overWorkedQuery = {
            organization,
            department,
            date: {
              $gte: start,
              $lt: end,
            },
            loginHours: { $gte: over_work_hours_with_extra_30min },
          };
          underWorkedQuery = {
            organization,
            department,
            date: {
              $gte: start,
              $lt: end,
            },
            loginHours: { $lt: under_work_hours_with_less_30min },
          };
          adequateWorkedQuery = {
            organization,
            department,
            date: {
              $gte: start,
              $lt: end,
            },
            $and: [
              { loginHours: { $gte: under_work_hours_with_less_30min } },
              { loginHours: { $lt: over_work_hours_with_extra_30min } },
            ],
          };
        }
      }

      let activities_over_worked_user_count = await Activity.find(
        overWorkedQuery
      ).countDocuments();
      let activities_under_utilized_user_count = await Activity.find(
        underWorkedQuery
      ).countDocuments();
      let activities_adequate_user_count = await Activity.find(
        adequateWorkedQuery
      ).countDocuments();

      let total_user_count =
        activities_over_worked_user_count +
        activities_under_utilized_user_count +
        activities_adequate_user_count;

      let day_wise_macro_response = {
        organization: organization,
        department: department,
        date: date,
        over_work: (activities_over_worked_user_count / total_user_count) * 100,
        adequate: (activities_adequate_user_count / total_user_count) * 100,
        under_utilized:
          (activities_under_utilized_user_count / total_user_count) * 100,
      };

      response_array.push(day_wise_macro_response);
    }
    if (report_type === 'csv') {
      try {
        const fields = [
          'organization',
          'department',
          'date',
          'over_work',
          'adequate',
          'under_utilized',
        ];
        const opts = { fields };
        const csv = parse(response_array, opts);
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
        message: 'Day wise macro fetched successfully',
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

const getPresentVsAbsent = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;
    let assigned_to = req.assigned_to;

    let { from, to } = req.query;
    let { required_role, report_type, manager_name } = req.body;

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
        description: 'TO is required',
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
    logger.info('From', from);
    logger.info('Till', till);

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

    let response_array = [];
    for (var i = 0; i < date_array.length; i++) {
      let date = date_array[i];

      let time_zone = req.timezone;
      let jDateToday = new Date(date_array[i]);
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

      logger.debug('start-', start);
      logger.debug('end-', end);

      let activeUserQuery = null;
      let userCountQuery = null;
      console.log('Role received  ' + role);
      if (const_config.isAllowedRole(role, ['MANAGER'])) {
        activeUserQuery = {
          assigned_to: user_email,
          organization,
          date: {
            $gte: start,
            $lt: end,
          },
        };
        if (required_role === 'MANAGER') {
          userCountQuery = {
            assigned_to: user_email,
            organization,
            is_manager: true,
            is_licensed: true,
          };
        } else if (required_role === 'ADMIN') {
          userCountQuery = {
            assigned_to: user_email,
            organization,
            is_admin: true,
            is_licensed: true,
          };
        } else if (required_role === 'SUPER_ADMIN') {
          userCountQuery = {
            assigned_to: user_email,
            organization,
            is_superadmin: true,
            is_licensed: true,
          };
        } else if (required_role === 'AUDIT') {
          userCountQuery = {
            assigned_to: user_email,
            organization,
            is_auditor: true,
            is_licensed: true,
          };
        } else if (required_role === 'AGENT') {
          userCountQuery = {
            assigned_to: user_email,
            organization,
            is_member: true,
            is_licensed: true,
          };
        } else if (required_role === 'MANAGER AGENT') {
          userCountQuery = {
            assigned_to: user_email,
            organization,
            is_manager: true,
            is_member: true,
            is_licensed: true,
          };
        } else if (required_role === 'AGENT AUDIT') {
          userCountQuery = {
            assigned_to: user_email,
            organization,
            is_auditor: true,
            is_member: true,
            is_licensed: true,
          };
        } else if (required_role === 'MANAGER AUDIT') {
          userCountQuery = {
            assigned_to: user_email,
            organization,
            is_manager: true,
            is_auditor: true,
            is_licensed: true,
          };
        } else {
          userCountQuery = {
            assigned_to: user_email,
            organization,
            is_licensed: true,
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
          activeUserQuery = {
            organization,
            date: {
              $gte: start,
              $lt: end,
            },
          };

          if (required_role === 'MANAGER') {
            userCountQuery = {
              organization,
              is_manager: true,
              is_licensed: true,
            };
          } else if (required_role === 'ADMIN') {
            userCountQuery = {
              organization,
              is_admin: true,
              is_licensed: true,
            };
          } else if (required_role === 'SUPER_ADMIN') {
            userCountQuery = {
              organization,
              is_superadmin: true,
              is_licensed: true,
            };
          } else if (required_role === 'AUDIT') {
            userCountQuery = {
              organization,
              is_auditor: true,
              is_licensed: true,
            };
          } else if (required_role === 'AGENT') {
            userCountQuery = {
              organization,
              is_member: true,
              is_licensed: true,
            };
          } else if (required_role === 'MANAGER AGENT') {
            userCountQuery = {
              organization,
              is_manager: true,
              is_member: true,
              is_licensed: true,
            };
          } else if (required_role === 'AGENT AUDIT') {
            userCountQuery = {
              organization,
              is_auditor: true,
              is_member: true,
              is_licensed: true,
            };
          } else if (required_role === 'MANAGER AUDIT') {
            userCountQuery = {
              organization,
              is_manager: true,
              is_auditor: true,
              is_licensed: true,
            };
          } else {
            userCountQuery = {
              organization,
            };
          }
        } else if (!(manager_name === undefined || manager_name === '')) {
          activeUserQuery = {
            organization,
            department,
            assigned_to: manager_name,
            date: {
              $gte: start,
              $lt: end,
            },
          };
          if (required_role === 'MANAGER') {
            userCountQuery = {
              organization,
              department,
              assigned_to: manager_name,
              is_manager: true,
              is_licensed: true,
            };
          } else if (required_role === 'ADMIN') {
            userCountQuery = {
              organization,
              department,
              assigned_to: manager_name,
              is_admin: true,
              is_licensed: true,
            };
          } else if (required_role === 'SUPER_ADMIN') {
            userCountQuery = {
              organization,
              department,
              assigned_to: manager_name,
              is_superadmin: true,
              is_licensed: true,
            };
          } else if (required_role === 'AUDIT') {
            userCountQuery = {
              organization,
              department,
              assigned_to: manager_name,
              is_auditor: true,
              is_licensed: true,
            };
          } else if (required_role === 'AGENT') {
            userCountQuery = {
              organization,
              department,
              assigned_to: manager_name,
              is_member: true,
              is_licensed: true,
            };
          } else if (required_role === 'MANAGER AGENT') {
            userCountQuery = {
              organization,
              department,
              assigned_to: manager_name,
              is_manager: true,
              is_member: true,
              is_licensed: true,
            };
          } else if (required_role === 'AGENT AUDIT') {
            userCountQuery = {
              organization,
              department,
              assigned_to: manager_name,
              is_auditor: true,
              is_member: true,
              is_licensed: true,
            };
          } else if (required_role === 'MANAGER AUDIT') {
            userCountQuery = {
              organization,
              department,
              assigned_to: manager_name,
              is_manager: true,
              is_auditor: true,
              is_licensed: true,
            };
          } else {
            userCountQuery = {
              organization,
              assigned_to: manager_name,
              department,
              is_licensed: true,
            };
          }
        } else {
          activeUserQuery = {
            organization,
            department,
            date: {
              $gte: start,
              $lt: end,
            },
          };

          if (required_role === 'MANAGER') {
            userCountQuery = {
              organization,
              department,
              is_manager: true,
              is_licensed: true,
            };
          } else if (required_role === 'ADMIN') {
            userCountQuery = {
              organization,
              department,
              is_admin: true,
              is_licensed: true,
            };
          } else if (required_role === 'SUPER_ADMIN') {
            userCountQuery = {
              organization,
              department,
              is_superadmin: true,
              is_licensed: true,
            };
          } else if (required_role === 'AUDIT') {
            userCountQuery = {
              organization,
              department,
              is_auditor: true,
              is_licensed: true,
            };
          } else if (required_role === 'AGENT') {
            userCountQuery = {
              organization,
              department,
              is_member: true,
              is_licensed: true,
            };
          } else if (required_role === 'MANAGER AGENT') {
            userCountQuery = {
              organization,
              department,
              is_manager: true,
              is_member: true,
              is_licensed: true,
            };
          } else if (required_role === 'AGENT AUDIT') {
            userCountQuery = {
              organization,
              department,
              is_auditor: true,
              is_member: true,
              is_licensed: true,
            };
          } else if (required_role === 'MANAGER AUDIT') {
            userCountQuery = {
              organization,
              department,
              is_manager: true,
              is_auditor: true,
              is_licensed: true,
            };
          } else {
            userCountQuery = {
              organization,
              department,
              is_licensed: true,
            };
          }
        }
      }

      let users_count = await Users.find(userCountQuery).countDocuments();
      let active_count = await Activity.find(activeUserQuery).countDocuments();
      logger.info('users_count---', users_count);
      logger.info('active_count---', active_count);
      let total_absent = users_count - active_count;

      let response = {
        Organization: organization,
        Department: department,
        date: date,
        total_present: active_count,
        total_absent: total_absent,
      };
      response_array.push(response);
    }
    if (report_type === 'csv') {
      try {
        const fields = [
          'Organization',
          'Department',
          'date',
          'total_present',
          'total_absent',
        ];
        const opts = { fields };
        const csv = parse(response_array, opts);
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
        message: 'Present vs Absent data fetched successfully',
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

const getNumberOfHoursWithDates = async (req, res, next) => {
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
    return res.status(500).json({
      code: 'SERVER_ERROR',
      description: 'something went wrong, Please try again',
    });
  }
};

const getNumberOfHoursWithDatesPagination = async (req, res, next) => {
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
    let total_login_seconds = 0;
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
            user_email: users[i].user_email,
            organization: organization,
            assigned_to: user_email,
            date: {
              $gte: start,
              $lt: end,
            },
          };
        } else {
          activity_query = {
            user_email: users[i].user_email,
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
        total_login_seconds = parseInt(total_login_seconds);
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
        user_email: users[i].user_email,
        minutes: hours_array,
        total_login_seconds: total_login_seconds,
      };
      response_array_main.push(user_temp);
    }
    response_array_main.sort(
      (a, b) => a.total_login_seconds - b.total_login_seconds
    );
    {
      return res.status(200).json({
        message: 'minutes fetched successfully for users',
        data: response_array_main,
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

const hoursWithDates = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;

    let { from, to } = req.query;
    let { manager_name, report_type } = req.body;
    const limit = parseInt(req.query.limit); // Make sure to parse the limit to number
    const skip = parseInt(req.query.skip);

    if (
      !const_config.isAllowedRole(role, [
        'ADMIN',
        'MANAGER',
        'SUPER_ADMIN',
        'AUDIT',
        'CLIENT',
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
    let Query = null;
    let tomorrow = new Date(to);
    tomorrow.setDate(tomorrow.getDate() + 1);
    logger.debug('Tomorrow ', new Date(tomorrow));
    if (const_config.isAllowedRole(role, ['MANAGER'])) {
      Query = {
        organization: organization,
        assigned_to: user_email,
        date: { $gte: new Date(from), $lt: tomorrow },
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
        Query = {
          organization: organization,
          date: { $gte: new Date(from), $lt: tomorrow },
        };
      } else if (!(manager_name === undefined || manager_name === '')) {
        Query = {
          organization: organization,
          department: department,
          assigned_to: manager_name,
          date: { $gte: new Date(from), $lt: tomorrow },
        };
      } else {
        Query = {
          organization: organization,
          department: department,
          date: { $gte: new Date(from), $lt: tomorrow },
        };
      }
    }

    Activity.aggregate([
      {
        $match: Query,
      },
      {
        $group: {
          _id: {
            date: '$date',
            user_email: '$user_email',
          },
          total: {
            $sum: '$loginHours',
          },
        },
      },
      {
        $group: {
          _id: '$_id.user_email',
          minutes: {
            $push: {
              date: '$_id.date',
              count: '$total',
            },
          },
        },
      },
      {
        $unwind: '$minutes',
      },
      {
        $group: {
          _id: '$_id',
          total_login_seconds: { $sum: '$minutes.count' },
          minutes: { $push: '$minutes' },
        },
      },
      { $sort: { total_login_seconds: -1 } },
      // { $skip: skip },
      // { $limit: limit },
    ]).exec((err, count) => {
      if (err) throw err;

      let minutes = count.slice(skip, skip + limit);
      let response = [];
      let reports = [];
      for (let minute of minutes) {
        let allminutes = minute.minutes;
        allminutes = allminutes.map((el) => {
          el.date = moment(el.date).format('MM-DD-YYYY');
          let total_login_seconds = parseInt(el.count);
          let login_minutes = Math.floor(total_login_seconds / 60 / 60);
          let minutes =
            Math.floor(total_login_seconds / 60) - login_minutes * 60;
          let formatted =
            login_minutes.toString().padStart(2, '0') +
            ':' +
            minutes.toString().padStart(2, '0');
          el.count = formatted;
          return el;
        });

        const obj = { user_email: minute._id, minutes: allminutes };
        response.push(obj);
      }
      if (report_type === 'csv') {
        try {
          for (let i = 0; i < count.length; i++) {
            for (let j = 0; j < count[i].minutes.length; j++) {
              let entry = {
                user_email: count[i]._id,
                date: count[i].minutes[j].date,
                minutes: count[i].minutes[j].count,
              };
              reports.push(entry);
            }
          }
          const fields = ['user_email', 'date', 'minutes'];
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
          message: 'Hours with Date fetched successfully',
          data: response,
          usersCount: count.length,
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

const workFromHomeLocation = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;
    let assigned_to = req.assigned_to;

    let { from, to } = req.query;
    let { manager_name, report_type, type } = req.body;

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
        description: 'TO is required',
        field: 'to',
      });
    }

    logger.debug('role', role);

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
    logger.debug('date_array', date_array);

    let response_array = [];
    for (let i = 0; i < date_array.length; i++) {
      let date = date_array[i];
      let time_zone = req.timezone;
      let jDateToday = new Date(date_array[i]);
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

      let query_home = null;
      let query_office = null;
      let query_ood = null;
      let query_others = null;
      let departmentName;
      let departmentsArray;
      let inDepartments = [];

      if (const_config.isAllowedRole(role, ['SUPER_ADMIN'])) {
        if (type === 'MANAGER') {
          query_home = {
            organization: organization,
            assigned_to: manager_name,
            work_location: 'Home',
            date: {
              $gte: start,
              $lt: end,
            },
          };

          query_office = {
            organization: organization,
            assigned_to: manager_name,
            work_location: 'Office',
            date: {
              $gte: start,
              $lt: end,
            },
          };
          query_ood = {
            organization: organization,
            assigned_to: manager_name,
            work_location: 'OOD',
            date: {
              $gte: start,
              $lt: end,
            },
          };
          query_others = {
            organization: organization,
            assigned_to: manager_name,
            work_location: 'Others',
            date: {
              $gte: start,
              $lt: end,
            },
          };
        } else if (type === 'ORGANIZATION') {
          departmentName = await Department.findOne(
            { organization },
            'department_array.name'
          );
          for (let i = 0; i < departmentName.department_array.length; i++) {
            let element = departmentName.department_array[i].name;
            inDepartments.push(element);
          }

          departmentsArray = departmentName.department_array;

          query_home = {
            organization: organization,
            department: { $in: inDepartments },

            work_location: 'Home',
            date: {
              $gte: start,
              $lt: end,
            },
          };

          query_office = {
            organization: organization,
            department: { $in: inDepartments },

            work_location: 'Office',
            date: {
              $gte: start,
              $lt: end,
            },
          };
          query_ood = {
            organization: organization,
            department: { $in: inDepartments },

            work_location: 'OOD',
            date: {
              $gte: start,
              $lt: end,
            },
          };
          query_others = {
            organization: organization,
            department: { $in: inDepartments },

            work_location: 'Others',
            date: {
              $gte: start,
              $lt: end,
            },
          };
        } else if (type === 'DEPARTMENT') {
          query_home = {
            organization: organization,
            department: department,
            work_location: 'Home',
            date: {
              $gte: start,
              $lt: end,
            },
          };

          query_office = {
            organization: organization,
            department: department,
            work_location: 'Office',
            date: {
              $gte: start,
              $lt: end,
            },
          };
          query_ood = {
            organization: organization,
            department: department,
            work_location: 'OOD',
            date: {
              $gte: start,
              $lt: end,
            },
          };
          query_others = {
            organization: organization,
            department: department,
            work_location: 'Others',
            date: {
              $gte: start,
              $lt: end,
            },
          };
        }
      } else if (const_config.isAllowedRole(role, ['ADMIN'])) {
        if (type === 'MANAGER') {
          query_home = {
            organization: organization,
            assigned_to: manager_name,
            work_location: 'Home',
            date: {
              $gte: start,
              $lt: end,
            },
          };

          query_office = {
            organization: organization,
            assigned_to: manager_name,
            work_location: 'Office',
            date: {
              $gte: start,
              $lt: end,
            },
          };
          query_ood = {
            organization: organization,
            assigned_to: manager_name,
            work_location: 'OOD',
            date: {
              $gte: start,
              $lt: end,
            },
          };
          query_others = {
            organization: organization,
            assigned_to: manager_name,
            work_location: 'Others',
            date: {
              $gte: start,
              $lt: end,
            },
          };
        } else if (type === 'ORGANIZATION') {
          let tempDepartmentName = await AdminOrganization.findOne(
            { user_email },
            'organization_array.name organization_array.departments.name'
          );

          for (
            let j = 0;
            j < tempDepartmentName.organization_array.length;
            j++
          ) {
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

          query_home = {
            organization: organization,
            department: { $in: inDepartments },

            work_location: 'Home',
            date: {
              $gte: start,
              $lt: end,
            },
          };

          query_office = {
            organization: organization,
            department: { $in: inDepartments },

            work_location: 'Office',
            date: {
              $gte: start,
              $lt: end,
            },
          };
          query_ood = {
            organization: organization,
            department: { $in: inDepartments },

            work_location: 'OOD',
            date: {
              $gte: start,
              $lt: end,
            },
          };
          query_others = {
            organization: organization,
            department: { $in: inDepartments },

            work_location: 'Others',
            date: {
              $gte: start,
              $lt: end,
            },
          };
        } else if (type === 'DEPARTMENT') {
          query_home = {
            organization: organization,
            department: department,
            work_location: 'Home',
            date: {
              $gte: start,
              $lt: end,
            },
          };

          query_office = {
            organization: organization,
            department: department,
            work_location: 'Office',
            date: {
              $gte: start,
              $lt: end,
            },
          };
          query_ood = {
            organization: organization,
            department: department,
            work_location: 'OOD',
            date: {
              $gte: start,
              $lt: end,
            },
          };
          query_others = {
            organization: organization,
            department: department,
            work_location: 'Others',
            date: {
              $gte: start,
              $lt: end,
            },
          };
        }
      } else if (const_config.isAllowedRole(role, ['AUDIT'])) {
        if (type === 'MANAGER') {
          query_home = {
            organization: organization,
            assigned_to: manager_name,
            work_location: 'Home',
            date: {
              $gte: start,
              $lt: end,
            },
          };

          query_office = {
            organization: organization,
            assigned_to: manager_name,
            work_location: 'Office',
            date: {
              $gte: start,
              $lt: end,
            },
          };
          query_ood = {
            organization: organization,
            assigned_to: manager_name,
            work_location: 'OOD',
            date: {
              $gte: start,
              $lt: end,
            },
          };
          query_others = {
            organization: organization,
            assigned_to: manager_name,
            work_location: 'Others',
            date: {
              $gte: start,
              $lt: end,
            },
          };
        } else if (type === 'ORGANIZATION') {
          let tempDepartmentName = await AuditOrganization.findOne(
            { user_email },
            'organization_array.name organization_array.departments.name'
          );

          for (
            let j = 0;
            j < tempDepartmentName.organization_array.length;
            j++
          ) {
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

          query_home = {
            organization: organization,
            department: { $in: inDepartments },
            work_location: 'Home',
            date: {
              $gte: start,
              $lt: end,
            },
          };

          query_office = {
            organization: organization,
            department: { $in: inDepartments },
            work_location: 'Office',
            date: {
              $gte: start,
              $lt: end,
            },
          };
          query_ood = {
            organization: organization,
            department: { $in: inDepartments },
            work_location: 'OOD',
            date: {
              $gte: start,
              $lt: end,
            },
          };
          query_others = {
            organization: organization,
            department: { $in: inDepartments },
            work_location: 'Others',
            date: {
              $gte: start,
              $lt: end,
            },
          };
        } else if (type === 'DEPARTMENT') {
          query_home = {
            organization: organization,
            department: department,
            work_location: 'Home',
            date: {
              $gte: start,
              $lt: end,
            },
          };

          query_office = {
            organization: organization,
            department: department,
            work_location: 'Office',
            date: {
              $gte: start,
              $lt: end,
            },
          };
          query_ood = {
            organization: organization,
            department: department,
            work_location: 'OOD',
            date: {
              $gte: start,
              $lt: end,
            },
          };
          query_others = {
            organization: organization,
            department: department,
            work_location: 'Others',
            date: {
              $gte: start,
              $lt: end,
            },
          };
        }
      } else if (const_config.isAllowedRole(role, ['MANAGER'])) {
        query_home = {
          organization: organization,
          assigned_to: user_email,
          work_location: 'Home',
          date: {
            $gte: start,
            $lt: end,
          },
        };

        query_office = {
          organization: organization,
          assigned_to: user_email,
          work_location: 'Office',
          date: {
            $gte: start,
            $lt: end,
          },
        };
        query_ood = {
          organization: organization,
          assigned_to: user_email,
          work_location: 'OOD',
          date: {
            $gte: start,
            $lt: end,
          },
        };
        query_others = {
          organization: organization,
          assigned_to: user_email,
          work_location: 'Others',
          date: {
            $gte: start,
            $lt: end,
          },
        };
      }

      let userHome = await WorkLocation.find(query_home).countDocuments();
      let userOffice = await WorkLocation.find(query_office).countDocuments();
      let userOod = await WorkLocation.find(query_ood).countDocuments();
      let userOthers = await WorkLocation.find(query_others).countDocuments();

      let response = {
        organization: organization,
        department: department,
        date: date,
        userHome: userHome,
        userOffice: userOffice,
        userOod: userOod,
        userOthers: userOthers,
      };
      response_array.push(response);
    }
    if (report_type === 'csv') {
      try {
        const fields = [
          'organization',
          'department',
          'date',
          'userHome',
          'userOffice',
          'userOod',
          'userOthers',
        ];
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
        message: 'Home vs Office data fetched successfully',
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
const getUserLoggedInVsNotLoggedIn = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;

    let { date, report_type } = req.body;

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

    if (user_email === undefined || user_email === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'User Email is required',
        field: 'user_email',
      });
    }

    if (date === undefined || date === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Date is required',
        field: 'date',
      });
    }

    let jDateToday = new Date(date);
    let time_zone = req.timezone;
    let local_date = moment(jDateToday).tz(time_zone);
    let from = local_date.startOf('day').toDate();
    let till = local_date.endOf('day').toDate();
    logger.debug('From in Assigned To' + from);
    logger.debug('To in Assigned To' + till);

    let userCountQuery = null;

    if (
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
          organization,
          is_licensed: true,
        };
      } else {
        userCountQuery = {
          organization,
          department,
          is_licensed: true,
        };
      }
    }

    let data = await Users.aggregate([
      {
        $match: userCountQuery,
      },
      {
        $lookup: {
          from: 'activities',
          let: {
            user_email: '$user_email',
            startDate: from,
            endDate: till,
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$user_email', '$$user_email'] },
                    { $gte: ['$date', '$$startDate'] },
                    { $lt: ['$date', '$$endDate'] },
                  ],
                },
              },
            },
            {
              $project: {
                _id: 0,
                user_email: 1,
              },
            },
          ],
          as: 'data',
        },
      },
    ]);

    let reports = [];

    for (i = 0; i < data.length; i++) {
      let login_status = null;

      if (data[i].data.length === 0) {
        login_status = 'Not logged in';
      } else {
        login_status = 'Logged in';
      }

      let entry = {
        Organization: data[i].organization,
        Department: data[i].department,
        User: data[i].user_email,
        Login_status: login_status,
        Date: moment(date).tz(time_zone).format('DD-MMM-YYYY'),
      };
      reports.push(entry);
    }

    if (report_type === 'csv') {
      try {
        const fields = ['Organization', 'Department', 'User', 'Login_status'];
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
        message: 'Logged-in vs not-logged-in data fetched successfully',
        data: reports,
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

const topTenUserBreakData = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;
    let assigned_to = req.assigned_to;

    let { date, manager_name, report_type } = req.body;

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

    if (date === undefined || date === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Date is required',
        field: 'date',
      });
    }

    let time_zone = req.timezone;
    let jDateToday = new Date(date);
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

    let query = null;
    if (const_config.isAllowedRole(role, ['MANAGER'])) {
      query = {
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
        query = {
          organization: organization,
          date: {
            $gte: from,
            $lt: till,
          },
        };
      } else {
        if (!(manager_name === undefined || manager_name === '')) {
          query = {
            organization: organization,
            department: department,
            assigned_to: manager_name,
            date: {
              $gte: from,
              $lt: till,
            },
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
        }
      }
    }

    let break_data = await Activity.aggregate([
      {
        $match: query,
      },
      { $unwind: '$breaks' },
      {
        $group: {
          _id: {
            minutes: '$breaks.minutes',
            user_name: '$name',
            user_email: '$user_email',
          },
        },
      },
      {
        $group: {
          _id: {
            user_email: '$_id.user_email',
            user_name: '$_id.user_name',
          },
          content: {
            $push: {
              count: '$_id.minutes',
            },
          },
        },
      },
      {
        $project: {
          '_id.user_email': 1,
          '_id.user_name': 1,
          minutes: { $sum: '$content.count' },
        },
      },
      { $limit: 10 },
    ]);
    let reports = [];
    for (let i = 0; i < break_data.length; i++) {
      let entry = {
        user_email: break_data[i]._id.user_email,
        user_name: break_data[i]._id.user_name,
        minutes: break_data[i].minutes,
      };
      reports.push(entry);
    }

    if (report_type === 'csv') {
      try {
        const fields = ['user_email', 'user_name', 'minutes'];
        const opts = {
          fields,
        };
        const csv = parse(reports, opts);

        return res.status(200).send(csv);
      } catch (err) {
        console.error(err);

        return res.status(500).json({
          code: 'SERVER_ERROR',
          description: 'something went wrong, Please try again',
        });
      }
    } else {
      return res.status(200).json({
        message: 'Top 10 users who took more breaks fetched successfully',
        data: reports,
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

const getLoggedInUsersCountByHours = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let assigned_to = req.assigned_to;
    let user_email = req.user_email;

    let { date, manager_name, report_type } = req.body;

    if (date === undefined || date === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Date is required',
        field: 'date',
      });
    }

    let time_zone = req.timezone;
    let jDateToday = new Date(date);
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

    let query = null;
    if (const_config.isAllowedRole(role, ['MANAGER'])) {
      query = {
        organization: organization,
        assigned_to: user_email,
        loginTime: {
          $gte: from,
          $lt: till,
        },
      };
    } else if (
      const_config.isAllowedRole(role, [
        'ADMIN',
        'SUPER_ADMIN',
        'AUDIT',
        'SUPER_AUDIT',
      ])
    ) {
      if (department === 'ALL') {
        query = {
          organization: organization,
          user_email: member_email,
          loginTime: {
            $gte: from,
            $lt: till,
          },
        };
      } else {
        if (!(manager_name === undefined || manager_name === '')) {
          query = {
            organization: organization,
            department: department,
            assigned_to: manager_name,
            loginTime: {
              $gte: from,
              $lt: till,
            },
          };
        } else {
          query = {
            organization: organization,
            department: department,
            loginTime: {
              $gte: from,
              $lt: till,
            },
          };
        }
      }
    }

    let data = await Activity.aggregate([
      {
        $match: query,
      },
      {
        $project: {
          loginTime: 1,
        },
      },

      {
        $group: {
          _id: {
            loginTime: '$loginTime',
            hours: {
              $hour: '$loginTime',
            },
          },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: '$_id.hours',
          content: {
            $push: {
              count: '$count',
            },
          },
        },
      },
      {
        $project: {
          _id: 1,
          users_count: { $sum: '$content.count' },
        },
      },
      {
        $sort: {
          _id: 1,
        },
      },
    ]);
    let reports = [];
    if (report_type === 'csv') {
      try {
        for (let i = 0; i < data.length; i++) {
          let entry = {
            hours: data[i]._id,
            users_count: data[i].users_count,
          };
          reports.push(entry);
        }

        const fields = ['hours', 'users_count'];
        const opts = {
          fields,
        };
        const csv = parse(reports, opts);

        return res.status(200).send(csv);
      } catch (err) {
        console.error(err);

        return res.status(500).json({
          code: 'SERVER_ERROR',
          description: 'something went wrong, Please try again',
        });
      }
    } else {
      return res.status(200).json({
        message: 'Logged in users per hour count fetched successfully',
        data: data,
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

const topTenUserIdleData = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;
    let assigned_to = req.assigned_to;

    let { from, to, type, manager_name, report_type } = req.body;

    if (organization === undefined || organization === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Organization is required',
        field: 'organization',
      });
    }

    if (type === undefined || type === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Type is required',
        field: 'type',
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

    let query = null;
    let reports = [];
    let idle_data;
    if (const_config.isAllowedRole(role, ['MANAGER'])) {
      query = {
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
        query = {
          organization: organization,
          date: {
            $gte: from,
            $lt: till,
          },
        };
      } else {
        if (!(manager_name === undefined || manager_name === '')) {
          query = {
            organization: organization,
            department: department,
            assigned_to: manager_name,
            date: {
              $gte: from,
              $lt: till,
            },
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
        }
      }
    }
    if (type === 'IDLE_MORE') {
      idle_data = await Activity.aggregate([
        {
          $match: query,
        },
        {
          $project: {
            _id: 0,
            user_email: 1,
            idleTime: 1,
          },
        },
        {
          $group: {
            _id: {
              idleTime: '$idleTime',
              user_email: '$user_email',
            },
          },
        },
        {
          $group: {
            _id: '$_id.user_email',
            content: {
              $push: {
                count: '$_id.idleTime',
              },
            },
          },
        },
        {
          $project: {
            _id: 1,
            idleTime: { $sum: '$content.count' },
          },
        },
        { $sort: { idleTime: -1 } },

        { $limit: 10 },
      ]);
      let reports1 = [];
      let reports = [];

      for (let i = 0; i < idle_data.length; i++) {
        let Idle_Time_Hours = idle_data[i].idleTime;
        var num = Idle_Time_Hours;
        var hours = num / 60;
        var rhours = Math.floor(hours);
        var idleminutes = (hours - rhours) * 60;
        var rminutes = Math.round(idleminutes);
        Idle_Time_Hours =
          rhours.toString().padStart(2, '0') +
          ':' +
          rminutes.toString().padStart(2, '0');

        let name = await Activity.findOne(
          { user_email: idle_data[i]._id },
          'name'
        );

        let entry = {
          user_email: idle_data[i]._id,
          user_name: name.name,
          idle_time: idle_data[i].idleTime,
        };
        reports.push(entry);

        let entry1 = {
          user_email: idle_data[i]._id,
          user_name: name.name,
          idle_time: Idle_Time_Hours,
        };
        reports1.push(entry1);
      }

      if (report_type === 'csv') {
        try {
          jsonexport(reports1, function (err, csv) {
            if (err) return console.error(err);
            return res.status(200).send(csv);
          });
          return res.status(200).send(csv);
        } catch (err) {
          console.error(err);

          return res.status(500).json({
            code: 'SERVER_ERROR',
            description: 'something went wrong, Please try again',
          });
        }
      } else {
        return res.status(200).json({
          message:
            'Top 10 user users who took more idle time fetched successfully',
          data: reports,
        });
      }
    } else if (type === 'IDLE_LESS') {
      idle_data = await Activity.aggregate([
        {
          $match: query,
        },
        {
          $project: {
            _id: 0,
            idleTime: 1,
            user_email: 1,
          },
        },
        {
          $group: {
            _id: {
              idleTime: '$idleTime',
              user_email: '$user_email',
            },
          },
        },
        {
          $group: {
            _id: '$_id.user_email',
            content: {
              $push: {
                count: '$_id.idleTime',
              },
            },
          },
        },
        {
          $project: {
            _id: 1,
            idleTime: { $sum: '$content.count' },
          },
        },
        { $sort: { idleTime: 1 } },

        { $limit: 10 },
      ]);

      let reports1 = [];
      let reports = [];

      for (let i = 0; i < idle_data.length; i++) {
        let Idle_Time_Hours = idle_data[i].idleTime;
        var num = Idle_Time_Hours;
        var hours = num / 60;
        var rhours = Math.floor(hours);
        var idleminutes = (hours - rhours) * 60;
        var rminutes = Math.round(idleminutes);
        Idle_Time_Hours =
          rhours.toString().padStart(2, '0') +
          ':' +
          rminutes.toString().padStart(2, '0');

        let name = await Activity.findOne(
          { user_email: idle_data[i]._id },
          'name'
        );

        let entry = {
          user_email: idle_data[i]._id,
          user_name: name.name,
          idle_time: idle_data[i].idleTime,
        };
        reports.push(entry);

        let entry1 = {
          user_email: idle_data[i]._id,
          user_name: name.name,
          idle_time: Idle_Time_Hours,
        };
        reports1.push(entry1);
      }

      if (report_type === 'csv') {
        try {
          jsonexport(reports1, function (err, csv) {
            if (err) return console.error(err);
            return res.status(200).send(csv);
          });
        } catch (err) {
          console.error(err);

          return res.status(500).json({
            code: 'SERVER_ERROR',
            description: 'something went wrong, Please try again',
          });
        }
      } else {
        return res.status(200).json({
          message:
            'Top 10 user users who took less idle time fetched successfully',
          data: reports,
        });
      }
    }
  } catch (error) {
    logger.error(error);
    return res.status(500).json({
      code: 'SERVER_ERROR',
      description: 'something went wrong, Please try again',
    });
  }
};

const getWorkingPattern = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;
    let assigned_to = req.assigned_to;

    let { from, to, type, manager_name, report_type, member_email } = req.body;

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

    if (type === undefined || type === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Type is required',
        field: 'type',
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

    let query = null;
    if (const_config.isAllowedRole(role, ['MANAGER'])) {
      query = {
        organization: organization,
        assigned_to: user_email,
        user_email: member_email,
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
        query = {
          organization: organization,
          user_email: member_email,
          date: {
            $gte: from,
            $lt: till,
          },
        };
      } else {
        if (!(manager_name === undefined || manager_name === '')) {
          query = {
            organization: organization,
            department: department,
            user_email: member_email,
            assigned_to: manager_name,
            date: {
              $gte: from,
              $lt: till,
            },
          };
        } else {
          query = {
            organization: organization,
            department: department,
            user_email: member_email,
            date: {
              $gte: from,
              $lt: till,
            },
          };
        }
      }
    }

    if (type === 'GRAPH') {
      let [login_data, break_data, idle_data] = await Promise.all([
        Activity.aggregate([
          {
            $match: query,
          },
          {
            $project: {
              _id: 0,
              loginHours: 1,
              date: 1,
            },
          },
          {
            $group: {
              _id: {
                date: {
                  $dateToString: {
                    format: '%m-%d-%Y',
                    date: '$date',
                  },
                },
                loginHours: '$loginHours',
              },
            },
          },
          {
            $group: {
              _id: '$_id.date',
              loginHours: {
                $push: {
                  loginHours: '$_id.loginHours',
                },
              },
            },
          },
          {
            $project: {
              _id: '$_id',
              loginHours: { $sum: '$loginHours.loginHours' },
            },
          },
          { $sort: { _id: -1 } },
        ]),
        Activity.aggregate([
          {
            $match: query,
          },
          {
            $project: {
              _id: 0,
              breaks: 1,
              date: 1,
            },
          },
          {
            $unwind: '$breaks',
          },
          {
            $group: {
              _id: {
                date: {
                  $dateToString: {
                    format: '%m-%d-%Y',
                    date: '$date',
                  },
                },
                minutes: '$breaks.minutes',
              },
            },
          },
          {
            $group: {
              _id: '$_id.date',
              break: {
                $push: {
                  break: '$_id.minutes',
                },
              },
            },
          },
          {
            $project: {
              _id: '$_id',
              break: { $sum: '$break.break' },
            },
          },
          { $sort: { _id: -1 } },
        ]),
        Activity.aggregate([
          {
            $match: query,
          },
          {
            $project: {
              _id: 0,
              idleTime: 1,
              date: 1,
            },
          },
          {
            $group: {
              _id: {
                date: {
                  $dateToString: {
                    format: '%m-%d-%Y',
                    date: '$date',
                  },
                },
                idleTime: '$idleTime',
              },
            },
          },
          {
            $group: {
              _id: '$_id.date',
              idleTime: {
                $push: {
                  idleTime: '$_id.idleTime',
                },
              },
            },
          },
          {
            $project: {
              _id: '$_id',
              idleTime: { $sum: '$idleTime.idleTime' },
            },
          },
          { $sort: { _id: -1 } },
        ]),
      ]);

      let reports = [];

      for (let i = 0; i < login_data.length; i++) {
        let entry = {
          date: login_data[i]._id,
          loginHours: login_data[i].loginHours,
        };
        reports.push(entry);
      }

      let reports2 = [];

      for (let i = 0; i < break_data.length; i++) {
        let entry2 = {
          date: break_data[i]._id,
          break: break_data[i].break > 0 ? break_data[i].break : 0,
        };
        reports2.push(entry2);
      }

      let reports4 = [];

      for (let i = 0; i < idle_data.length; i++) {
        let entry4 = {
          date: idle_data[i]._id,
          idle_time: idle_data[i].idleTime,
        };
        reports4.push(entry4);
      }

      return res.status(200).json({
        message: 'Productivity in detailed fetched successfully',
        login_hours: reports,
        break: reports2,
        idle_time: reports4,
      });
    } else if (type === 'TABULAR') {
      const limit = parseInt(req.query.limit);
      const skip = parseInt(req.query.skip);

      let [data, total] = await Promise.all([
        Activity.aggregate([
          {
            $match: query,
          },
          {
            $project: {
              _id: 0,
              loginHours: 1,
              date: 1,
              idleTime: 1,
              breaks: 1,
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
              _id: {
                date: {
                  $dateToString: {
                    format: '%m-%d-%Y',
                    date: '$date',
                  },
                },
                loginHours: '$loginHours',
                idleTime: '$idleTime',
                minutes: '$breaks.minutes',
              },
            },
          },
          {
            $group: {
              _id: '$_id.date',
              data: {
                $push: {
                  loginHours: '$_id.loginHours',
                  break: '$_id.minutes',
                  idleTime: '$_id.idleTime',
                },
              },
            },
          },
          {
            $project: {
              _id: '$_id',
              break: { $sum: '$data.break' },
              loginHours: { $sum: '$data.loginHours' },
              idleTime: { $sum: '$data.idleTime' },
            },
          },
          { $sort: { _id: -1 } },
          { $skip: skip },
          { $limit: limit },
        ]),
        Activity.aggregate([
          {
            $match: query,
          },
          {
            $project: {
              _id: 0,
              loginHours: 1,
              date: 1,
              idleTime: 1,
              breaks: 1,
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
              _id: {
                date: {
                  $dateToString: {
                    format: '%m-%d-%Y',
                    date: '$date',
                  },
                },
                loginHours: '$loginHours',
                idleTime: '$idleTime',
                minutes: '$breaks.minutes',
              },
            },
          },
          {
            $group: {
              _id: '$_id.date',
              data: {
                $push: {
                  loginHours: '$_id.loginHours',
                  break: '$_id.minutes',
                  idleTime: '$_id.idleTime',
                },
              },
            },
          },
          {
            $project: {
              _id: '$_id',
              break: { $sum: '$data.break' },
              loginHours: { $sum: '$data.loginHours' },
              idleTime: { $sum: '$data.idleTime' },
            },
          },
          { $sort: { _id: -1 } },
        ]),
      ]);

      let reports = [];

      for (var i = 0; i < data.length; i++) {
        let login_minutes = Math.floor(data[i].loginHours / 60 / 60);
        let minutes = Math.floor(data[i].loginHours / 60) - login_minutes * 60;
        login_minutes =
          login_minutes.toString().padStart(2, '0') +
          ':' +
          minutes.toString().padStart(2, '0');

        let Break_Time_Minutes = data[i].break > 0 ? data[i].break : 0;
        var num = Break_Time_Minutes;
        var hours = num / 60;
        var rhours = Math.floor(hours);
        var idleminutes = (hours - rhours) * 60;
        var rminutes = Math.round(idleminutes);
        Break_Time_Minutes =
          rhours.toString().padStart(2, '0') +
          ':' +
          rminutes.toString().padStart(2, '0');

        let Idle_Time_Hours = data[i].idleTime;
        var num = Idle_Time_Hours;
        var hours = num / 60;
        var rhours = Math.floor(hours);
        var idleMinutes = (hours - rhours) * 60;
        var rMinutes = Math.round(idleMinutes);
        Idle_Time_Hours =
          rhours.toString().padStart(2, '0') +
          ':' +
          rMinutes.toString().padStart(2, '0');

        let entry = {
          date: data[i]._id,
          loginHours: login_minutes,
          break: Break_Time_Minutes,
          idleTime: Idle_Time_Hours,
        };
        reports.push(entry);
      }
      if (report_type === 'csv') {
        try {
          jsonexport(reports, function (err, csv) {
            if (err) return console.error(err);
            return res.status(200).send(csv);
          });
        } catch (err) {
          console.error(err);

          return res.status(500).json({
            code: 'SERVER_ERROR',
            description: 'something went wrong, Please try again',
          });
        }
      } else {
        return res.status(200).json({
          message: 'Productivity in tabular form fetched successfully',
          data: reports,
          total: total.length,
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

const getUserWiseProductivity = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let assigned_to = req.assigned_to;
    let user_email = req.user_email;

    let { from, to, manager_name, report_type, member_email } = req.body;

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

    let query = null;
    if (const_config.isAllowedRole(role, ['MANAGER'])) {
      query = {
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
        'SUPER_AUDIT',
      ])
    ) {
      if (department === 'ALL') {
        query = {
          organization: organization,
          user_email: member_email,
          date: {
            $gte: from,
            $lt: till,
          },
        };
      } else {
        if (!(manager_name === undefined || manager_name === '')) {
          query = {
            organization: organization,
            department: department,
            user_email: member_email,
            assigned_to: manager_name,
            date: {
              $gte: from,
              $lt: till,
            },
          };
        } else {
          query = {
            organization: organization,
            department: department,
            user_email: member_email,
            date: {
              $gte: from,
              $lt: till,
            },
          };
        }
      }
    }
    let data = await Activity.aggregate([
      {
        $match: query,
      },
      {
        $project: {
          _id: 0,
          loginHours: 1,
          date: 1,
          idleTime: 1,
          breaks: 1,
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
          _id: {
            loginHours_sec: '$loginHours',
            idleTime_minutes: '$idleTime',
            break_minutes: '$breaks.minutes',
          },
        },
      },
      {
        $group: {
          _id: {
            loginHours: '$_id.loginHours_sec',
            idleTime: '$_id.idleTime_minutes',
          },
          data: {
            $push: {
              break: '$_id.break_minutes',
            },
          },
        },
      },
      {
        $project: {
          '_id.loginHours': 1,
          '_id.idleTime': 1,
          break: { $sum: '$data.break' },
        },
      },
    ]);
    let reports = [];

    let total_hours = 0;
    let total_idle = 0;
    let total_break = 0;
    let unproductive;
    let productive_total;
    let productive_total_cal;

    for (let i = 0; i < data.length; i++) {
      total_hours = total_hours + data[i]._id.loginHours;
      total_idle = total_idle + data[i]._id.idleTime;
      total_break = total_break + data[i].break;

      productive_total = total_hours / 60;
      unproductive = total_idle + total_break;
      productive_total_cal = Math.abs(productive_total - unproductive);
    }

    let login_minutes = Math.floor(total_hours / 60 / 60);
    let minutes = Math.floor(total_hours / 60) - login_minutes * 60;
    login_minutes =
      login_minutes.toString().padStart(2, '0') +
      ':' +
      minutes.toString().padStart(2, '0');

    let Break_Time_Minutes = total_break > 0 ? total_break : 0;
    var num = Break_Time_Minutes;
    var hours = num / 60;
    var rhours = Math.floor(hours);
    var idleminutes = (hours - rhours) * 60;
    var rminutes = Math.round(idleminutes);
    Break_Time_Minutes =
      rhours.toString().padStart(2, '0') +
      ':' +
      rminutes.toString().padStart(2, '0');

    let Idle_Time_Hours = total_idle;
    var num = Idle_Time_Hours;
    var hours = num / 60;
    var rhours = Math.floor(hours);
    var idleMinutes = (hours - rhours) * 60;
    var rMinutes = Math.round(idleMinutes);
    Idle_Time_Hours =
      rhours.toString().padStart(2, '0') +
      ':' +
      rMinutes.toString().padStart(2, '0');

    let unproductive_cal = unproductive;
    var num2 = unproductive_cal;
    var hours2 = num2 / 60;
    var rhours2 = Math.floor(hours2);
    var idleMinutes2 = (hours2 - rhours2) * 60;
    var rMinutes2 = Math.round(idleMinutes2);
    unproductive_cal =
      rhours2.toString().padStart(2, '0') +
      ':' +
      rMinutes2.toString().padStart(2, '0');

    let productive_total_cal1 = productive_total_cal;
    var num3 = productive_total_cal1;
    var hours1 = num3 / 60;
    var rhours1 = Math.floor(hours1);
    var idleMinutes = (hours1 - rhours1) * 60;
    var rMinutes1 = Math.round(idleMinutes);
    productive_total_cal1 =
      rhours1.toString().padStart(2, '0') +
      ':' +
      rMinutes1.toString().padStart(2, '0');

    let entry = {
      user_email: member_email,
      logged_in_time: login_minutes,
      productive_time: productive_total_cal1,
      unproductive_time: unproductive_cal,
      idle_time: Idle_Time_Hours,
      break_time: Break_Time_Minutes,
    };
    reports.push(entry);

    if (report_type === 'csv') {
      try {
        jsonexport(reports, function (err, csv) {
          if (err) return console.error(err);
          return res.status(200).send(csv);
        });
      } catch (err) {
        console.error(err);

        return res.status(500).json({
          code: 'SERVER_ERROR',
          description: 'something went wrong, Please try again',
        });
      }
    } else {
      return res.status(200).json({
        message: 'Logged in users per hour count fetched successfully',
        data: reports,
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

const getDepartmentWiseProductivity = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let assigned_to = req.assigned_to;
    let user_email = req.user_email;

    let { from, to, manager_name } = req.body;

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

    let query = null;
    if (const_config.isAllowedRole(role, ['MANAGER'])) {
      query = {
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
      } else {
        if (!(manager_name === undefined || manager_name === '')) {
          query = {
            organization: organization,
            department: department,
            assigned_to: manager_name,
            date: {
              $gte: from,
              $lt: till,
            },
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
        }
      }
    }

    let [data, aux] = await Promise.all([
      Activity.aggregate([
        {
          $match: query,
        },
        {
          $project: {
            _id: 0,
            loginHours: 1,
            date: 1,
            idleTime: 1,
            breaks: 1,
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
            _id: {
              loginHours_sec: '$loginHours',
              idleTime_minutes: '$idleTime',
              break_minutes: '$breaks.minutes',
            },
          },
        },
        {
          $group: {
            _id: {
              loginHours: '$_id.loginHours_sec',
              idleTime: '$_id.idleTime_minutes',
            },
            data: {
              $push: {
                break: '$_id.break_minutes',
              },
            },
          },
        },
        {
          $project: {
            '_id.loginHours': 1,
            '_id.idleTime': 1,
            break: { $sum: '$data.break' },
          },
        },
      ]),

      await ActiveAuxManagement.aggregate([
        {
          $match: query,
        },
        {
          $project: {
            _id: 0,
            aux_management: 1,
            date: 1,
          },
        },
        {
          $unwind: {
            path: '$aux_management',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $group: {
            _id: {
              aux_management: '$aux_management.minutes',
            },
          },
        },
      ]),
    ]);

    let reports = [];

    let total_hours = 0;
    let total_idle = 0;
    let total_break = 0;
    let unproductive;
    let productive_total;
    let productive_total_cal;
    let aux_total = 0;

    for (let j = 0; j < aux.length; j++) {
      aux_total = aux_total + aux[j]._id.aux_management;
    }

    for (let i = 0; i < data.length; i++) {
      total_hours = total_hours + data[i]._id.loginHours;
      total_idle = total_idle + data[i]._id.idleTime;
      total_break = total_break + data[i].break;

      productive_total = total_hours / 60;
      unproductive = total_idle + total_break;
      productive_total_cal = Math.abs(productive_total - unproductive);
    }

    let login_minutes = Math.floor(total_hours / 60 / 60);
    let minutes = Math.floor(total_hours / 60) - login_minutes * 60;
    login_minutes =
      login_minutes.toString().padStart(2, '0') +
      ':' +
      minutes.toString().padStart(2, '0');

    let Break_Time_Minutes = total_break > 0 ? total_break : 0;
    var num = Break_Time_Minutes;
    var hours = num / 60;
    var rhours = Math.floor(hours);
    var idleminutes = (hours - rhours) * 60;
    var rminutes = Math.round(idleminutes);
    Break_Time_Minutes =
      rhours.toString().padStart(2, '0') +
      ':' +
      rminutes.toString().padStart(2, '0');

    let Idle_Time_Hours = total_idle;
    var num = Idle_Time_Hours;
    var hours = num / 60;
    var rhours = Math.floor(hours);
    var idleMinutes = (hours - rhours) * 60;
    var rMinutes = Math.round(idleMinutes);
    Idle_Time_Hours =
      rhours.toString().padStart(2, '0') +
      ':' +
      rMinutes.toString().padStart(2, '0');

    let productive_total_cal1 = productive_total_cal;
    var num3 = productive_total_cal1;
    var hours1 = num3 / 60;
    var rhours1 = Math.floor(hours1);
    var idleMinutes = (hours1 - rhours1) * 60;
    var rMinutes1 = Math.round(idleMinutes);
    productive_total_cal1 =
      rhours1.toString().padStart(2, '0') +
      ':' +
      rMinutes1.toString().padStart(2, '0');

    logger.debug('productive_total_cal1', productive_total_cal1);

    let unproductive_cal = unproductive;
    var num2 = unproductive_cal;
    var hours2 = num2 / 60;
    var rhours2 = Math.floor(hours2);
    var idleMinutes2 = (hours2 - rhours2) * 60;
    var rMinutes2 = Math.round(idleMinutes2);
    unproductive_cal =
      rhours2.toString().padStart(2, '0') +
      ':' +
      rMinutes2.toString().padStart(2, '0');

    let aux_cal = aux_total;
    var num4 = aux_cal;
    var hours4 = num4 / 60;
    var rhours4 = Math.floor(hours4);
    var idleMinutes4 = (hours4 - rhours4) * 60;
    var rMinutes4 = Math.round(idleMinutes4);
    aux_cal =
      rhours4.toString().padStart(2, '0') +
      ':' +
      rMinutes4.toString().padStart(2, '0');

    let entry = {
      department: department,
      logged_in_time: login_minutes,
      productive_time: productive_total_cal1,
      unproductive_time: unproductive_cal,
      idle_time: Idle_Time_Hours,
      break_time: Break_Time_Minutes,
      aux: aux_cal,
    };
    reports.push(entry);

    return res.status(200).json({
      message: 'Logged in users per hour count fetched successfully',
      data: reports,
    });
  } catch (error) {
    logger.error(error);
    return res.status(500).json({
      code: 'SERVER_ERROR',
      description: 'something went wrong, Please try again',
    });
  }
};

const topTenUserMoreLessBreakData = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;
    let assigned_to = req.assigned_to;

    let { from, to, type, manager_name, report_type } = req.body;

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

    if (type === undefined || type === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Type is required',
        field: 'type',
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

    let query = null;
    if (const_config.isAllowedRole(role, ['MANAGER'])) {
      query = {
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
        query = {
          organization: organization,
          date: {
            $gte: from,
            $lt: till,
          },
        };
      } else {
        if (!(manager_name === undefined || manager_name === '')) {
          query = {
            organization: organization,
            department: department,
            assigned_to: manager_name,
            date: {
              $gte: from,
              $lt: till,
            },
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
        }
      }
    }

    if (type === 'BREAK_MORE') {
      let break_data = await Activity.aggregate([
        {
          $match: query,
        },
        { $unwind: '$breaks' },
        {
          $group: {
            _id: {
              minutes: '$breaks.minutes',
              user_name: '$name',
              user_email: '$user_email',
            },
          },
        },
        {
          $group: {
            _id: {
              user_email: '$_id.user_email',
              user_name: '$_id.user_name',
            },
            content: {
              $push: {
                count: '$_id.minutes',
              },
            },
          },
        },
        {
          $project: {
            '_id.user_email': 1,
            '_id.user_name': 1,
            minutes: { $sum: '$content.count' },
          },
        },
        { $sort: { minutes: -1 } },
        { $limit: 10 },
      ]);
      let reports = [];
      for (let i = 0; i < break_data.length; i++) {
        let name = await Activity.findOne(
          { user_email: break_data[i]._id.user_email },
          'name'
        );
        let entry = {
          user_email: break_data[i]._id.user_email,
          user_name: name.name,
          break_minutes: break_data[i].minutes,
        };
        reports.push(entry);
      }

      if (report_type === 'csv') {
        try {
          jsonexport(reports, function (err, csv) {
            if (err) return console.error(err);
            return res.status(200).send(csv);
          });
        } catch (err) {
          console.error(err);

          return res.status(500).json({
            code: 'SERVER_ERROR',
            description: 'something went wrong, Please try again',
          });
        }
      } else {
        return res.status(200).json({
          message: 'Top 10 users who took more breaks fetched successfully',
          data: reports,
        });
      }
    } else if (type === 'BREAK_LESS') {
      let break_data = await Activity.aggregate([
        {
          $match: query,
        },
        { $unwind: '$breaks' },
        {
          $group: {
            _id: {
              minutes: '$breaks.minutes',
              user_email: '$user_email',
            },
          },
        },
        {
          $group: {
            _id: {
              user_email: '$_id.user_email',
            },
            content: {
              $push: {
                count: '$_id.minutes',
              },
            },
          },
        },
        {
          $project: {
            '_id.user_email': 1,
            minutes: { $sum: '$content.count' },
          },
        },
        { $sort: { minutes: 1 } },
        { $limit: 10 },
      ]);
      let reports = [];
      for (let i = 0; i < break_data.length; i++) {
        let name = await Activity.findOne(
          { user_email: break_data[i]._id.user_email },
          'name'
        );
        let entry = {
          user_email: break_data[i]._id.user_email,
          user_name: name.name,
          break_minutes: break_data[i].minutes,
        };
        reports.push(entry);
      }

      if (report_type === 'csv') {
        try {
          jsonexport(reports, function (err, csv) {
            if (err) return console.error(err);
            return res.status(200).send(csv);
          });
        } catch (err) {
          console.error(err);

          return res.status(500).json({
            code: 'SERVER_ERROR',
            description: 'something went wrong, Please try again',
          });
        }
      } else {
        return res.status(200).json({
          message: 'Top 10 users who took less breaks fetched successfully',
          data: reports,
        });
      }
    }
  } catch (error) {
    logger.error(error);
    return res.status(500).json({
      code: 'SERVER_ERROR',
      description: 'something went wrong, Please try again',
    });
  }
};
const getTopTenProductiveUsers = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let assigned_to = req.assigned_to;
    let user_email = req.user_email;

    let { from, to, manager_name, report_type } = req.body;

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

    let query = null;
    if (const_config.isAllowedRole(role, ['MANAGER'])) {
      query = {
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
      } else {
        if (!(manager_name === undefined || manager_name === '')) {
          query = {
            organization: organization,
            department: department,
            assigned_to: manager_name,
            date: {
              $gte: from,
              $lt: till,
            },
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
        }
      }
    }
    let data = await Activity.aggregate([
      {
        $match: query,
      },
      {
        $project: {
          _id: 0,
          loginHours: 1,
          user_email: 1,
          idleTime: 1,
          breaks: 1,
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
          _id: {
            user_email: '$user_email',
            loginHours_sec: '$loginHours',
            idleTime_minutes: '$idleTime',
            break_minutes: '$breaks.minutes',
          },
        },
      },
      {
        $group: {
          _id: '$_id.user_email',
          data: {
            $push: {
              loginHours: '$_id.loginHours_sec',
              idleTime: '$_id.idleTime_minutes',
              break: '$_id.break_minutes',
            },
          },
        },
      },
      {
        $project: {
          _id: 1,
          loginHours: { $sum: '$data.loginHours' },
          idleTime: { $sum: '$data.idleTime' },
          break: { $sum: '$data.break' },
        },
      },
      { $sort: { loginHours: 1 } },
      { $limit: 10 },
    ]);
    let reports = [];
    let reports1 = [];

    for (let i = 0; i < data.length; i++) {
      let login_minutes = Math.floor(data[i].loginHours / 60 / 60);
      let minutes = Math.floor(data[i].loginHours / 60) - login_minutes * 60;
      login_minutes =
        login_minutes.toString().padStart(2, '0') +
        ':' +
        minutes.toString().padStart(2, '0');

      let Break_Time_Minutes = data[i].break > 0 ? data[i].break : 0;
      var num = Break_Time_Minutes;
      var hours = num / 60;
      var rhours = Math.floor(hours);
      var idleminutes = (hours - rhours) * 60;
      var rminutes = Math.round(idleminutes);
      Break_Time_Minutes =
        rhours.toString().padStart(2, '0') +
        ':' +
        rminutes.toString().padStart(2, '0');

      let Idle_Time_Hours = data[i].idleTime;
      var num = Idle_Time_Hours;
      var hours = num / 60;
      var rhours = Math.floor(hours);
      var idleMinutes = (hours - rhours) * 60;
      var rMinutes = Math.round(idleMinutes);
      Idle_Time_Hours =
        rhours.toString().padStart(2, '0') +
        ':' +
        rMinutes.toString().padStart(2, '0');

      let entry = {
        user_email: data[i]._id,
        productivity: data[i].loginHours,
        idle_time: data[i].break > 0 ? data[i].break : 0,
        break_time: data[i].idleTime,
      };
      reports.push(entry);

      let entry1 = {
        user_email: data[i]._id,
        productivity: login_minutes,
        idle_time: Idle_Time_Hours,
        break_time: Break_Time_Minutes,
      };
      reports1.push(entry1);
    }

    if (report_type === 'csv') {
      try {
        jsonexport(reports1, function (err, csv) {
          if (err) return console.error(err);
          return res.status(200).send(csv);
        });
      } catch (err) {
        console.error(err);

        return res.status(500).json({
          code: 'SERVER_ERROR',
          description: 'something went wrong, Please try again',
        });
      }
    } else {
      return res.status(200).json({
        message: 'Top ten productive user fetched successfully',
        data: reports,
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
const getPresentVsAbsentNew = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;
    let assigned_to = req.assigned_to;

    let { from, to } = req.query;
    let { required_role, report_type, type, manager_name } = req.body;

    if (organization === undefined || organization === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: ' Organization is required',
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
        description: 'TO is required',
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
    logger.info('From', from);
    logger.info('Till', till);

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

    let response_array = [];
    for (var i = 0; i < date_array.length; i++) {
      let date = date_array[i];

      let time_zone = req.timezone;
      let jDateToday = new Date(date_array[i]);
      let time_zone_name = moment.tz(time_zone).format('Z');

      let time_zone_name_char = time_zone_name.charAt(0);
      let start;
      let end
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

      let activeUserQuery = null;
      let userCountQuery = null;
      let departmentName;
      let departmentsArray;
      let inDepartments = [];

      if (const_config.isAllowedRole(role, ['SUPER_ADMIN'])) {
        if (type === 'MANAGER') {
          activeUserQuery = {
            assigned_to: manager_name,
            organization,
            date: {
              $gte: start,
              $lt: end,
            },
          };
          userCountQuery = {
            assigned_to: manager_name,
            department: department,
            organization,
            is_licensed: true,
          };

        } else if (type === 'ORGANIZATION') {
          departmentName = await Department.findOne(
            { organization },
            'department_array.name'
          );
          for (let i = 0; i < departmentName.department_array.length; i++) {
            let element = departmentName.department_array[i].name;
            inDepartments.push(element);
            logger.debug('element', element);
          }

          departmentsArray = departmentName.department_array;

          activeUserQuery = {
            organization,
            department: { $in: inDepartments },
            date: {
              $gte: start,
              $lt: end,
            },
          };

          userCountQuery = {
            organization,
            department: { $in: inDepartments },
            is_licensed: true,
          };

        } else if (type === 'DEPARTMENT') {
          activeUserQuery = {
            organization,
            department,
            date: {
              $gte: start,
              $lt: end,
            },
          };

          userCountQuery = {
            organization,
            department,
            is_licensed: true,
          };

        }
      } else if (const_config.isAllowedRole(role, ['ADMIN'])) {
        if (type === 'MANAGER') {
          activeUserQuery = {
            assigned_to: manager_name,
            organization,
            date: {
              $gte: start,
              $lt: end,
            },
          };

          userCountQuery = {
            assigned_to: manager_name,
            department: department,
            organization,
            is_licensed: true,
          };

        } else if (type === 'ORGANIZATION') {
          let tempDepartmentName = await AdminOrganization.findOne(
            { user_email },
            'organization_array.name organization_array.departments.name'
          );

          for (
            let j = 0;
            j < tempDepartmentName.organization_array.length;
            j++
          ) {
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
          activeUserQuery = {
            organization,
            department: { $in: inDepartments },
            date: {
              $gte: start,
              $lt: end,
            },
          };

          userCountQuery = {
            organization,
            department: { $in: inDepartments },
            is_licensed: true,
          };

        } else if (type === 'DEPARTMENT') {
          activeUserQuery = {
            organization,
            department,
            date: {
              $gte: start,
              $lt: end,
            },
          };

          userCountQuery = {
            organization,
            department,
            is_licensed: true,
          };

        }
      } else if (const_config.isAllowedRole(role, ['AUDIT'])) {
        if (type === 'MANAGER') {
          activeUserQuery = {
            assigned_to: manager_name,
            organization,
            date: {
              $gte: start,
              $lt: end,
            },
          };

          userCountQuery = {
            assigned_to: manager_name,
            department: department,
            organization,
            is_licensed: true,
          };

        } else if (type === 'ORGANIZATION') {
          let tempDepartmentName = await AuditOrganization.findOne(
            { user_email },
            'organization_array.name organization_array.departments.name'
          );

          for (
            let j = 0;
            j < tempDepartmentName.organization_array.length;
            j++
          ) {
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

          activeUserQuery = {
            organization,
            department: { $in: inDepartments },
            date: {
              $gte: start,
              $lt: end,
            },
          };

          userCountQuery = {
            organization,
            department: { $in: inDepartments },
            is_licensed: true,
          };

        } else if (type === 'DEPARTMENT') {
          activeUserQuery = {
            organization,
            department,
            date: {
              $gte: start,
              $lt: end,
            },
          };


          userCountQuery = {
            organization,
            department,
            is_licensed: true,
          };

        }
      } else if (const_config.isAllowedRole(role, ['MANAGER'])) {
        activeUserQuery = {
          assigned_to: user_email,
          organization,
          date: {
            $gte: start,
            $lt: end,
          },
        };

        userCountQuery = {
          assigned_to: user_email,
          department: department,
          organization,
          is_licensed: true,
        };

      }
      let [users_count, active_count] = await Promise.all([
        Users.find(userCountQuery).countDocuments(),
        Activity.find(activeUserQuery).countDocuments()
      ])

      let total_absent = users_count - active_count;

      let response = {
        // Organization: organization,
        // Department: department,
        date: date,
        total_present: active_count,
        total_absent: total_absent < 0 ? 0 : total_absent,
      };
      response_array.push(response);
    }
    if (report_type === 'csv') {
      try {
        const fields = ['date', 'total_present', 'total_absent'];
        const opts = { fields };
        const csv = parse(response_array, opts);
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
        message: 'Present vs Absent data fetched successfully',
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
module.exports = {
  getTotalActiveUsers: getTotalActiveUsers, //Full Done
  getCurrentStatus: getCurrentStatus,
  getLoggedInAndAbsentUsers: getLoggedInAndAbsentUsers,
  geIdleTimeDateWise: geIdleTimeDateWise,
  getTotalIdleTime: getTotalIdleTime,
  getTotalLoggedHours: getTotalLoggedHours,
  getActualProductiveHours: getActualProductiveHours,
  getCurrentStatusDetails: getCurrentStatusDetails,
  getActiveVsIdleDetails: getActiveVsIdleDetails,
  getDayWiseMacro: getDayWiseMacro,
  getPresentVsAbsent: getPresentVsAbsent,
  getNumberOfHoursWithDates: getNumberOfHoursWithDates,
  getNumberOfHoursWithDatesPagination: getNumberOfHoursWithDatesPagination,
  workFromHomeLocation: workFromHomeLocation,
  geIdleTimeDateWiseNew: geIdleTimeDateWiseNew,
  hoursWithDates: hoursWithDates,
  getUserLoggedInVsNotLoggedIn: getUserLoggedInVsNotLoggedIn,
  topTenUserBreakData: topTenUserBreakData,
  getLoggedInUsersCountByHours: getLoggedInUsersCountByHours,
  topTenUserIdleData: topTenUserIdleData,
  getWorkingPattern: getWorkingPattern,
  getUserWiseProductivity: getUserWiseProductivity,
  topTenUserMoreLessBreakData: topTenUserMoreLessBreakData,
  getTopTenProductiveUsers: getTopTenProductiveUsers,
  getDepartmentWiseProductivity: getDepartmentWiseProductivity,
  getPresentVsAbsentNew: getPresentVsAbsentNew,
};
