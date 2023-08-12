const express = require('express');
const Activity = require('../../models/activity');
const Task = require('../../models/task');
const TasksList = require('../../models/tasklist');

const TaskProject = require('../../models/task_project');
const Department = require('../../models/department');
const AdminOrganization = require('../../models/admin_organization');
const AuditOrganization = require('../../models/audit_organization');
const Users = require('../../models/users');
const Logger = require('../../configs/log');
const logger = new Logger('dashboard');
const util = require('util');
const const_config = require('../../utility/util');
const moment = require('moment-timezone');
const { parse } = require('json2csv');

const getTotalCompletedTasks = async (req, res, next) => {
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

    let totaTasks = await Task.find({
      organization,
      department,
      createdAt: {
        $gte: from,
        $lt: till,
      },
    }).count();

    let resultProductivity = 0;
    let completeTasksQuery = null;
    if (const_config.isAllowedRole(role, ['AGENT'])) {
      completeTasksQuery = {
        status: 'DONE',
        user_email: user_email,
        organization,
        department,
        createdAt: {
          $gte: from,
          $lt: till,
        },
      };
    } else if (const_config.isAllowedRole(role, ['MANAGER'])) {
      if (!(member_email === undefined || member_email === '')) {
        completeTasksQuery = {
          status: 'DONE',
          assigned_by: user_email,
          user_email: member_email,
          organization,
          createdAt: {
            $gte: from,
            $lt: till,
          },
        };
      } else {
        completeTasksQuery = {
          status: 'DONE',
          assigned_by: user_email,
          organization,
          createdAt: {
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
        completeTasksQuery = {
          status: 'DONE',
          organization,
          createdAt: {
            $gte: from,
            $lt: till,
          },
        };
      } else {
        if (!(member_email === undefined || member_email === '')) {
          completeTasksQuery = {
            status: 'DONE',
            organization,
            department,
            user_email: member_email,
            createdAt: {
              $gte: from,
              $lt: till,
            },
          };
        } else {
          completeTasksQuery = {
            status: 'DONE',
            organization,
            department,
            createdAt: {
              $gte: from,
              $lt: till,
            },
          };
        }
      }
    }

    let doneTasks = await Task.find(completeTasksQuery).countDocuments();

    logger.debug('EMAIL Total Tasks ', totaTasks);
    logger.debug('EMAIL Done Tasks ', doneTasks);
    if (totaTasks > 0) {
      resultProductivity = (100 * doneTasks) / totaTasks;
    }

    return res.status(200).json({
      message: 'Tasks fetched successfully',
      data: {
        result_productivity: resultProductivity,
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

const getCompletedAndInProgressTasks = async (req, res, next) => {
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
    logger.debug('From-', from);
    logger.debug('Till-', till);

    let query = null;
    if (const_config.isAllowedRole(role, ['AGENT'])) {
      query = {
        organization,
        department,
        user_email: user_email,
        createdAt: {
          $gte: from,
          $lt: till,
        },
      };
    } else if (const_config.isAllowedRole(role, ['MANAGER'])) {
      query = {
        organization,
        assigned_by: user_email,
        createdAt: {
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
          organization,
          createdAt: {
            $gte: from,
            $lt: till,
          },
        };
      } else if (!(manager_name === undefined || manager_name === '')) {
        query = {
          organization,
          department,
          assigned_by: manager_name,
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
    }
    let tasks = await Task.find(query);

    if (report_type === 'csv') {
      let reports = [];
      tasks.forEach(function (task) {
        let entry = {
          User_email: task.user_email,
          Assigned_by: manager_name,
          Description: task.description,
          Organization: organization,
          Department: department,
          Completion_date: task.completion_date,
          Status: task.status,
          CreatedAt: moment(task.createdAt)
            .tz(time_zone)
            .format('DD-MMM-YYYY HH:mm:ss'),
        };
        reports.push(entry);
      });

      const fields = [
        'User_email',
        'Assigned_by',
        'Description',
        'Organization',
        'Department',
        'Completion_date',
        'Status',
        'CreatedAt',
      ];
      const opts = { fields };
      const csv = parse(reports, opts);
      return res.status(200).send(csv);
    } else {
      return res.status(200).json({
        message: 'Tasks fetched successfully',
        data: {
          tasks: tasks,
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

const getTotalPendingTasks = async (req, res, next) => {
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

    let resultProductivity = 0;
    let totalQuery = null;
    let pendingQuery = null;

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

    if (const_config.isAllowedRole(role, ['AGENT'])) {
      totalQuery = {
        organization,
        department,
        user_email: user_email,
        createdAt: {
          $gte: from,
          $lt: till,
        },
      };
      //Need to discuss user_email
      pendingQuery = {
        organization,
        department,
        user_email: user_email,
        status: 'PENDING',
        createdAt: {
          $gte: from,
          $lt: till,
        },
      };
    } else if (const_config.isAllowedRole(role, ['MANAGER'])) {
      if (!(member_email === undefined || member_email === '')) {
        totalQuery = {
          organization,
          $or: [
            {
              assigned_by: user_email,
            },
            {
              assigned_by: member_email,
            },
          ],
          user_email: member_email,
          createdAt: {
            $gte: from,
            $lt: till,
          },
        };
        pendingQuery = {
          organization,
          $or: [
            {
              assigned_by: user_email,
            },
            {
              assigned_by: member_email,
            },
          ],
          user_email: member_email,
          status: 'PENDING',
          createdAt: {
            $gte: from,
            $lt: till,
          },
        };
      } else {
        totalQuery = {
          organization,
          assigned_by: user_email,
          createdAt: {
            $gte: from,
            $lt: till,
          },
        };
        pendingQuery = {
          organization,
          assigned_by: user_email,
          status: 'PENDING',
          createdAt: {
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
        totalQuery = {
          organization,
          createdAt: {
            $gte: from,
            $lt: till,
          },
        };
        pendingQuery = {
          organization,
          status: 'PENDING',
          createdAt: {
            $gte: from,
            $lt: till,
          },
        };
      } else {
        if (!(member_email === undefined || member_email === '')) {
          totalQuery = {
            organization,
            department,
            user_email: member_email,
            createdAt: {
              $gte: from,
              $lt: till,
            },
          };
          pendingQuery = {
            organization,
            department,
            user_email: member_email,
            status: 'PENDING',
            createdAt: {
              $gte: from,
              $lt: till,
            },
          };
        } else if (!(manager_name === undefined || manager_name === '')) {
          totalQuery = {
            organization,
            department,
            assigned_by: manager_name,
            createdAt: {
              $gte: from,
              $lt: till,
            },
          };
          pendingQuery = {
            organization,
            department,
            assigned_by: manager_name,
            status: 'PENDING',
            createdAt: {
              $gte: from,
              $lt: till,
            },
          };
        } else {
          totalQuery = {
            organization,
            department,
            createdAt: {
              $gte: from,
              $lt: till,
            },
          };
          pendingQuery = {
            organization,
            department,
            status: 'PENDING',
            createdAt: {
              $gte: from,
              $lt: till,
            },
          };
        }
      }
    }

    let totalTasks = await Task.find(totalQuery).countDocuments();
    let pendingTasks = await Task.find(pendingQuery).countDocuments();

    if (totalTasks > 0) {
      resultProductivity = (100 * pendingTasks) / totalTasks;
    }

    //TODO:This should show the PENDING percentage instead of result_productivity
    return res.status(200).json({
      message: 'Tasks fetched successfully',
      data: {
        result_productivity: resultProductivity,
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

const getTaskProductivity = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;

    let { from, to, manager_name } = req.body;

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
    let local_date_from = moment(jDateToday);
    let local_date_till = moment(jDateTill);
    from = local_date_from.startOf('day').toDate();
    let till = local_date_till.endOf('day').toDate();
    from = new Date(from);
    till = new Date(till);
    from.setDate(from.getDate() + 1);
    till.setDate(till.getDate() + 1);

    let query = null;

    if (const_config.isAllowedRole(role, ['AGENT'])) {
      query = {
        organization: organization,
        department: department,
        user_email: user_email,
        createdAt: {
          $gte: from,
          $lt: till,
        },
      };
    } else if (const_config.isAllowedRole(role, ['MANAGER'])) {
      query = {
        organization: organization,
        assigned_to: user_email,
        createdAt: {
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
          createdAt: {
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
            createdAt: {
              $gte: from,
              $lt: till,
            },
          };
        } else {
          query = {
            organization: organization,
            department: department,
            createdAt: {
              $gte: from,
              $lt: till,
            },
          };
        }
      }
    }

    await Task.aggregate([
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
          },
          completed: {
            $sum: {
              $cond: [
                {
                  $eq: ['$task_status', 'COMPLETE'],
                },
                1,
                0,
              ],
            },
          },
          inProgress: {
            $sum: {
              $cond: [
                {
                  $eq: ['$task_status', 'IN-PROGRESS'],
                },
                1,
                0,
              ],
            },
          },
          todo: {
            $sum: {
              $cond: [
                {
                  $eq: ['$task_status', 'TO-DO'],
                },
                1,
                0,
              ],
            },
          },
          delayed: {
            $sum: {
              $cond: [
                {
                  $eq: ['$task_status', 'DELAYED'],
                },
                1,
                0,
              ],
            },
          },
          testing: {
            $sum: {
              $cond: [
                {
                  $eq: ['$task_status', 'TESTING'],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $sort: {
          '_id.date': -1,
        },
      },
    ]).exec((err, response) => {
      if (err) throw err;
      let total_delayed = 0;
      let total_completed_task = 0;
      let total_in_progress = 0;
      let total_todo = 0;

      for (let i = 0; i < response.length; i++) {
        total_delayed = total_delayed + response[i].delayed;
        total_completed_task = total_completed_task + response[i].completed;
        total_in_progress = total_in_progress + response[i].inProgress;
        total_todo = total_todo + response[i].todo;
      }
      return res.status(200).json({
        message: 'Tasks data fetched successfully',
        data: response,
        total_tasks:
          total_todo + total_in_progress + total_completed_task + total_delayed,
        total_completed_task: total_completed_task,
        total_in_progress: total_in_progress,
        total_todo: total_todo,
        total_delayed: total_delayed,
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

const topMostDelayedTasks = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;

    let { from, to, manager_name } = req.body;

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

    let query = null;

    if (const_config.isAllowedRole(role, ['AGENT'])) {
      query = {
        organization: organization,
        department: department,
        user_email: user_email,
      };
    } else if (const_config.isAllowedRole(role, ['MANAGER'])) {
      query = {
        organization: organization,
        assigned_to: user_email,
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
        };
      } else {
        if (!(manager_name === undefined || manager_name === '')) {
          query = {
            organization: organization,
            department: department,
            assigned_to: manager_name,
          };
        } else {
          query = {
            organization: organization,
            department: department,
          };
        }
      }
    }

    let response = await Task.aggregate([
      {
        $match: query,
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: '%m-%d-%Y',
                date: '$completion_date',
              },
            },
            task_status: '$task_status',
            assigned_members: '$assigned_members',
            title: '$title',
            task_uniqueId: '$taskUniqueID',
            delayed_by_days: {
              $round: {
                $divide: [
                  {
                    $subtract: ['$$NOW', '$completion_date'],
                  },
                  86400000,
                ],
              },
            },
          },
        },
      },
      {
        $sort: {
          delayed_by_days: 1,
        },
      },
      { $limit: 10 },
    ]);

    let reports = [];
    for (let i = 0; i < response.length; i++) {
      let today_date = moment(new Date()).format('MM-DD-YYYY');

      if (
        today_date > response[i]._id.date &&
        response[i]._id.task_status !== 'COMPLETE'
      ) {
        let entry = {
          date: response[i]._id.date,
          task_status: response[i]._id.task_status,
          title: response[i]._id.title,
          taskUniqueID: response[i]._id.task_uniqueId,
          delayed_by_days: response[i]._id.delayed_by_days,
          assigned_members: response[i]._id.assigned_members,
        };
        reports.push(entry);
      }
    }

    return res.status(200).json({
      message: 'List of delayed task fetched successfully',
      data: reports,
      total: reports.length,
    });
  } catch (error) {
    logger.error(error);
    return res.status(500).json({
      code: 'SERVER_ERROR',
      description: 'Something went wrong, please try again',
    });
  }
};

const getTaskDistribution = async (req, res, next) => {
  try {
    let user_email = req.user_email;

    let { organization, department, member_email, from, to, report_type } =
      req.body;

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
    let local_date_from = moment(jDateToday);
    let local_date_till = moment(jDateTill);
    from = local_date_from.startOf('day').toDate();
    let till = local_date_till.endOf('day').toDate();
    from = new Date(from);
    till = new Date(till);
    from.setDate(from.getDate() + 1);
    till.setDate(till.getDate() + 1);

    if (!(member_email === undefined || memeber_email === '')) {
      query = {
        organization: organization,
        department: department,
        assigned_to: member_email,
        createdAt: {
          $gte: from,
          $lt: till,
        },
      };
    } else {
      query = {
        organization: organization,
        department: department,
        createdAt: {
          $gte: from,
          $lt: till,
        },
      };
    }

    const limit = parseInt(req.query.limit);
    const skip = parseInt(req.query.skip);

    let [response, total] = await Promise.all([
      Task.aggregate([
        {
          $match: query,
        },
        {
          $unwind: '$assigned_members',
        },
        {
          $group: {
            _id: {
              assigned_members: '$assigned_members.assigned_to_member',
              date: {
                $dateToString: {
                  format: '%m-%d-%Y',
                  date: '$createdAt',
                },
              },
            },
            tasks: {
              $push: {
                date: '$_id.date',
                task: '$title',
                priority: '$priority',
                taskID: '$_id',
                start_time: '$start_time',
                completion_date: '$completion_date',
                taskUniqueID: '$taskUniqueID',
                task_status: '$task_status',
              },
            },
          },
        },
        {
          $group: {
            _id: '$_id.assigned_members',
            tasks: {
              $push: {
                date: '$_id.date',
                task: '$tasks',
              },
            },
          },
        },
        {
          $unwind: '$tasks',
        },
        {
          $group: {
            _id: '$_id',
            task: {
              $push: '$tasks',
            },
          },
        },
        {
          $sort: {
            _id: 1,
          },
        },
        { $skip: skip },
        { $limit: limit },
      ]),

      Task.aggregate([
        {
          $match: query,
        },
        {
          $unwind: '$assigned_members',
        },
        {
          $group: {
            _id: {
              assigned_members: '$assigned_members.assigned_to_member',
              date: {
                $dateToString: {
                  format: '%m-%d-%Y',
                  date: '$createdAt',
                },
              },
            },
            tasks: {
              $push: {
                date: '$_id.date',
                task: '$title',
                priority: '$priority',
                taskID: '$_id',
                taskUniqueID: '$taskUniqueID',
                task_status: '$task_status',
              },
            },
          },
        },
        {
          $sort: {
            '_id.date': 1,
          },
        },
        {
          $group: {
            _id: '$_id.assigned_members',
            tasks: {
              $push: {
                date: '$_id.date',
                task: '$tasks',
              },
            },
          },
        },
        {
          $unwind: '$tasks',
        },
        {
          $group: {
            _id: '$_id',
            task: {
              $push: '$tasks',
            },
          },
        },
      ]),
    ]);
    let reports = [];
    if (report_type === 'csv') {
      try {
        for (let i = 0; i < response.length; i++) {
          for (let j = 0; j < response[i].task.length; j++) {
            for (let k = 0; k < response[i].task[j].task.length; k++) {
              let record = {
                Organization: organization,
                Department: department,
                Assigned_Members: response[i]._id,
                Date: response[i].task[j].date,
                Task_Title: response[i].task[j].task[k].task,
                Priority: response[i].task[j].task[k].priority,
                Start_Time: moment(response[i].task[j].task[k].start_time)
                  .tz(time_zone)
                  .format('DD-MMM-YYYY'),
                Completion_Date: moment(
                  response[i].task[j].task[k].completion_date
                )
                  .tz(time_zone)
                  .format('DD-MMM-YYYY'),
                Task_Status: response[i].task[j].task[k].task_status,
              };
              reports.push(record);
            }
          }
        }
        const fields = [
          'Organization',
          'Department',
          'Assigned_Members',
          'Date',
          'Task_Title',
          'Priority',
          'Start_Time',
          'Completion_Date',
          'Task_Status',
        ];
        const opts = { fields };
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
        message: 'Tasks fetched successfully',
        data: response,
        total: total.length,
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

const completePercentage = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;

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

    let jDateToday = new Date(from);
    let jDateTill = new Date(to);
    let time_zone = req.timezone;
    let local_date_from = moment(jDateToday);
    let local_date_till = moment(jDateTill);
    from = local_date_from.startOf('day').toDate();
    let till = local_date_till.endOf('day').toDate();
    from = new Date(from);
    till = new Date(till);
    from.setDate(from.getDate() + 1);
    till.setDate(till.getDate() + 1);

    let queryTotal = {
      organization: organization,
      department: department,
      start_time: {
        $gte: from,
        $lt: till,
      },
    };
    let total_task = await Task.find(queryTotal).countDocuments();

    let queryComplete = {
      organization: organization,
      department: department,
      task_status: 'COMPLETE',
      progress: 100,
      start_time: {
        $gte: from,
        $lt: till,
      },
      completion_date: {
        $gte: from,
        $lt: till,
      },
    };
    let complete_task = await Task.find(queryComplete).countDocuments();

    let complete_percentage = (complete_task * 100) / total_task;

    return res.status(200).json({
      message: 'Completed tasks percentage fetched successfully',
      total_task: total_task,
      complete_task: complete_task,
      complete_percentage: complete_percentage,
    });
  } catch (error) {
    logger.error(error);
    return res.status(500).json({
      code: 'SERVER_ERROR',
      description: 'Something went wrong, please try again',
    });
  }
};

const getTaskProductivityInDetail = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;

    let { from, to, manager_name, type } = req.body;

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

    if (type === undefined || type === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Type is required',
        field: 'type',
      });
    }

    let jDateToday = new Date(from);
    let jDateTill = new Date(to);
    let time_zone = req.timezone;
    let local_date_from = moment(jDateToday);
    let local_date_till = moment(jDateTill);
    from = local_date_from.startOf('day').toDate();
    let till = local_date_till.endOf('day').toDate();
    from = new Date(from);
    till = new Date(till);
    from.setDate(from.getDate() + 1);
    till.setDate(till.getDate() + 1);
    let query = null;

    if (const_config.isAllowedRole(role, ['AGENT'])) {
      query = {
        organization: organization,
        department: department,
        user_email: user_email,
        task_status: type,
        createdAt: {
          $gte: from,
          $lt: till,
        },
      };
    } else if (const_config.isAllowedRole(role, ['MANAGER'])) {
      query = {
        organization: organization,
        assigned_to: user_email,
        task_status: type,
        createdAt: {
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
          task_status: type,
          createdAt: {
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
            task_status: type,
            createdAt: {
              $gte: from,
              $lt: till,
            },
          };
        } else {
          query = {
            organization: organization,
            department: department,
            task_status: type,
            createdAt: {
              $gte: from,
              $lt: till,
            },
          };
        }
      }
    }

    if (type == 'IN-PROGRESS') {
      let inprogress = await Task.find(query);
      return res.status(200).json({
        message: 'In progress tasks fetched successfully',
        data: inprogress,
      });
    } else if (type == 'COMPLETE') {
      let complete = await Task.find(query);
      return res.status(200).json({
        message: 'Complete tasks fetched successfully',
        data: complete,
      });
    } else if (type == 'TO-DO') {
      let todo = await Task.find(query);
      return res.status(200).json({
        message: 'Todo tasks fetched successfully',
        data: todo,
      });
    } else if (type == 'DELAYED') {
      let delayed = await Task.find(query);
      return res.status(200).json({
        message: 'Delayed tasks fetched successfully',
        data: delayed,
      });
    } else if (type == 'TESTING') {
      let testing = await Task.find(query);
      return res.status(200).json({
        message: 'Testing tasks fetched successfully',
        data: testing,
      });
    } else if (type == 'ALL') {
      let query = {
        organization: organization,
        department: department,
        createdAt: {
          $gte: from,
          $lt: till,
        },
      };
      let allTasks = await Task.find(query);
      return res.status(200).json({
        message: 'All tasks fetched successfully',
        data: allTasks,
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

const workLoadGraph = async (req, res, next) => {
  try {
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;

    let query = {
      organization: organization,
      department: department,
      task_status: {
        $ne: 'COMPLETE',
      },
    };

    let [userTasks] = await Promise.all([
      Task.aggregate([
        {
          $match: query,
        },
        { $unwind: '$assigned_members' },
        {
          $group: {
            _id: {
              user: '$assigned_members.assigned_to_member',
            },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);
    for (let i = 0; i < userTasks.length; i++) {
      userTasks[i].percentage = (userTasks[i].count / userTasks.length) * 100;
    }
    return res.status(200).json({
      message: 'Work Load fetched successfully',
      data: userTasks,
    });
  } catch (error) {
    logger.error(error);
    return res.status(500).json({
      code: 'SERVER_ERROR',
      description: 'Something went wrong, please try again',
    });
  }
};

const projectOverview = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;
    let { manager_name, member_email, report_type } = req.body;

    if (const_config.isAllowedRole(role, ['MANAGER'])) {
      query = {
        organization: organization,
        department: department,
        assigned_to: user_email,
      };
    } else if (const_config.isAllowedRole(role, ['SUPER_ADMIN'])) {
      if (department === 'ALL') {
        departmentName = await Department.findOne(
          { organization },
          'department_array.name'
        );
        for (let i = 0; i < departmentName.department_array.length; i++) {
          let element = departmentName.department_array[i].name;
          inDepartments.push(element);
        }
        departmentsArray = departmentName.department_array;
        query = {
          organization: organization,
          department: { $in: inDepartments },
        };
      } else if (!(member_email === undefined || member_email === '')) {
        query = {
          organization: organization,
          department: department,
          user_email: member_email,
        };
      } else if (!(manager_name === undefined || manager_name === '')) {
        query = {
          organization: organization,
          department: department,
          assigned_to: manager_name,
        };
      } else {
        query = {
          organization: organization,
          department: department,
        };
      }
    } else if (const_config.isAllowedRole(role, ['ADMIN'])) {
      if (department === 'ALL') {
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
        query = {
          organization: organization,
          department: { $in: inDepartments },
        };
      } else if (!(member_email === undefined || member_email === '')) {
        query = {
          organization: organization,
          department: department,
          user_email: member_email,
        };
      } else if (!(manager_name === undefined || manager_name === '')) {
        query = {
          organization: organization,
          department: department,
          assigned_to: manager_name,
        };
      } else {
        query = {
          organization: organization,
          department: department,
        };
      }
    } else if (const_config.isAllowedRole(role, ['AUDIT'])) {
      if (department === 'ALL') {
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
        query = {
          organization: organization,
          department: { $in: inDepartments },
        };
      } else if (!(member_email === undefined || member_email === '')) {
        query = {
          organization: organization,
          department: department,
          user_email: member_email,
        };
      } else if (!(manager_name === undefined || manager_name === '')) {
        query = {
          organization: organization,
          department: department,
          assigned_to: manager_name,
        };
      } else {
        query = {
          organization: organization,
          department: department,
        };
      }
    }

    let project_task_status_list = await TasksList.aggregate([
      {
        $match: query,
      },
      {
        $group: {
          _id: '$task_status',
          task_status: { $first: '$task_status' },
        },
      },
      {
        $project: {
          _id: 0,
          task_status: '$task_status',
        },
      },
    ]);

    let project_status = [];
    project_task_status_list.forEach((item) => {
      project_status.push(item.task_status);
    });

    let [tasks] = await Promise.all([
      TaskProject.aggregate([
        {
          $match: query,
        },
        {
          $lookup: {
            from: 'tasks',
            let: {
              project_id: '$project_id',
              task_status: project_status,
              // task_status: ["TO-DO", "IN-PROGRESS", "COMPLETE", "DELAYED", "TESTING"]
              organization: '$organization',
              department: '$department',
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$project_id', '$$project_id'] },
                      { $in: ['$task_status', '$$task_status'] },
                      { $eq: ['$organization', '$$organization'] },
                      { $eq: ['$department', '$$department'] },
                    ],
                  },
                },
              },
              {
                $group: {
                  _id: '$task_status',
                  count: { $sum: 1 },
                },
              },
            ],
            as: 'count',
          },
        },
        {
          $lookup: {
            from: 'tasks',
            let: {
              project_id: '$project_id',
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [{ $eq: ['$project_id', '$$project_id'] }],
                  },
                },
              },
              {
                $group: {
                  _id: '$priority',
                  count: { $sum: 1 },
                },
              },
            ],
            as: 'priority',
          },
        },
      ]),
    ]);

    for (let i = 0; i < tasks.length; i++) {
      let totalCount = 0;
      for (let j = 0; j < tasks[i].count.length; j++) {
        totalCount = totalCount + tasks[i].count[j].count;
      }
      for (let j = 0; j < tasks[i].count.length; j++) {
        tasks[i].count[j].percentage =
          (tasks[i].count[j].count / totalCount) * 100;

        if (tasks[i].count[j]._id === 'COMPLETE') {
          tasks[i].progress = (tasks[i].count[j].count / totalCount) * 100;
          tasks[i].completeCount = tasks[i].count[j].count;
        }
      }
      tasks[i].total = totalCount;
      let priorityTotalCount = 0;
      for (let k = 0; k < tasks[i].priority.length; k++) {
        priorityTotalCount = priorityTotalCount + tasks[i].priority[k].count;
      }

      for (let k = 0; k < tasks[i].priority.length; k++) {
        tasks[i].priority[k].percentage =
          (tasks[i].priority[k].count / priorityTotalCount) * 100;
      }
    }

    if (report_type === 'csv') {
      let reports = [];

      for (let i = 0; i < tasks.length; i++) {
        let task = tasks[i];
        let entry = {
          Organization: organization,
          Department: department,
          Project_title: task.project_name,
          Start_date: moment(task.start_date).format('YYYY-MM-DD'),
          Completion_date: moment(task.end_date).format('YYYY-MM-DD'),
          Progress: task.progress
            ? parseFloat(task.progress).toFixed(2) + '%'
            : '0.00%',
        };
        reports.push(entry);
      }

      const fields = [
        'Organization',
        'Department',
        'Project_title',
        'Start_date',
        'Completion_date',
        'Progress',
      ];
      const opts = { fields };
      const csv = parse(reports, opts);
      return res.status(200).send(csv);
    } else {
      return res.status(200).json({
        message: 'Overview fetched successfully',
        data: tasks,
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

const upcomingTasks = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;

    let { manager_name, member_email, project_id, report_type } = req.body;

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

    let date = moment.utc();

    date = moment(date).format('MM-DD-YYYY');

    let jDateToday = new Date(date);

    let local_date = moment(jDateToday);

    let local_date_back = moment(local_date).add(10, 'days');

    let from = local_date_back.startOf('day').toDate();

    let till = local_date.endOf('day').toDate();

    logger.debug('from', from);
    logger.debug('till', till);

    // let query = {
    //     'organization': organization,
    //     'department': department,
    //     project_id:project_id,
    //     'completion_date': {
    //         "$gte": till,
    //         "$lt": from
    //     }
    // }
    let query = null;
    let departmentName;
    let departmentsArray;
    let inDepartments = [];

    if (const_config.isAllowedRole(role, ['MANAGER'])) {
      query = {
        organization: organization,
        department: department,
        assigned_to: user_email,
        project_id: project_id,
        completion_date: {
          $gte: till,
          $lt: from,
        },
      };
    } else if (const_config.isAllowedRole(role, ['SUPER_ADMIN'])) {
      if (department === 'ALL') {
        departmentName = await Department.findOne(
          { organization },
          'department_array.name'
        );
        for (let i = 0; i < departmentName.department_array.length; i++) {
          let element = departmentName.department_array[i].name;
          inDepartments.push(element);
        }
        departmentsArray = departmentName.department_array;
        query = {
          organization: organization,
          department: { $in: inDepartments },
          project_id: project_id,
          completion_date: {
            $gte: till,
            $lt: from,
          },
        };
      } else if (!(member_email === undefined || member_email === '')) {
        query = {
          organization: organization,
          department: department,
          user_email: member_email,
          project_id: project_id,
          completion_date: {
            $gte: till,
            $lt: from,
          },
        };
      } else if (!(manager_name === undefined || manager_name === '')) {
        query = {
          organization: organization,
          department: department,
          assigned_to: manager_name,
          project_id: project_id,
          completion_date: {
            $gte: till,
            $lt: from,
          },
        };
      } else {
        query = {
          organization: organization,
          department: department,
          project_id: project_id,
          completion_date: {
            $gte: till,
            $lt: from,
          },
        };
      }
    } else if (const_config.isAllowedRole(role, ['ADMIN'])) {
      if (department === 'ALL') {
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
        query = {
          organization: organization,
          department: { $in: inDepartments },
          project_id: project_id,
          completion_date: {
            $gte: till,
            $lt: from,
          },
        };
      } else if (!(member_email === undefined || member_email === '')) {
        query = {
          organization: organization,
          department: department,
          user_email: member_email,
          project_id: project_id,
          completion_date: {
            $gte: till,
            $lt: from,
          },
        };
      } else if (!(manager_name === undefined || manager_name === '')) {
        query = {
          organization: organization,
          department: department,
          assigned_to: manager_name,
          project_id: project_id,
          completion_date: {
            $gte: till,
            $lt: from,
          },
        };
      } else {
        query = {
          organization: organization,
          department: department,
          project_id: project_id,
          completion_date: {
            $gte: till,
            $lt: from,
          },
        };
      }
    } else if (const_config.isAllowedRole(role, ['AUDIT'])) {
      if (department === 'ALL') {
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
        query = {
          organization: organization,
          department: { $in: inDepartments },
          project_id: project_id,
          completion_date: {
            $gte: till,
            $lt: from,
          },
        };
      } else if (!(member_email === undefined || member_email === '')) {
        query = {
          organization: organization,
          department: department,
          user_email: member_email,
          project_id: project_id,
          completion_date: {
            $gte: till,
            $lt: from,
          },
        };
      } else if (!(manager_name === undefined || manager_name === '')) {
        query = {
          organization: organization,
          department: department,
          assigned_to: manager_name,
          project_id: project_id,
          completion_date: {
            $gte: till,
            $lt: from,
          },
        };
      } else {
        query = {
          organization: organization,
          department: department,
          project_id: project_id,
          completion_date: {
            $gte: till,
            $lt: from,
          },
        };
      }
    }

    let upcoming_tasks = await Task.aggregate([
      {
        $match: query,
      },
      {
        $sort: { completion_date: 1 },
      },
      { $limit: 10 },
    ]);

    if (report_type === 'csv') {
      let reports = [];

      for (let i = 0; i < upcoming_tasks.length; i++) {
        let task = upcoming_tasks[i];
        let entry = {
          Organization: organization,
          Department: department,
          Task_title: task.title,
          Created_on: task.createdAt
            ? new Date(task.createdAt).toISOString().slice(0, 10)
            : 'N/A',
          Timeline: task.completion_date
            ? new Date(task.completion_date).toISOString().slice(0, 10)
            : 'N/A',
        };
        reports.push(entry);
      }

      const fields = [
        'Organization',
        'Department',
        'Task_title',
        'Created_on',
        'Timeline',
      ];
      const opts = { fields };
      const csv = parse(reports, opts);
      return res.status(200).send(csv);
    } else {
      return res.status(200).json({
        message: `Upcoming tasks fetched successfully`,
        data: upcoming_tasks,
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

const taskCreatedCompletedByDates = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;

    let { from, to } = req.body;

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

    let createResponse = [];
    let completeResponse = [];

    for (var j = 0; j < date_array.length; j++) {
      let date = date_array[j];

      let jDateToday = new Date(date_array[j]);
      let time_zone = req.timezone;
      let local_date = moment(jDateToday).tz(time_zone);
      let start = local_date.startOf('day').toDate();
      let end = local_date.endOf('day').toDate();

      let createdQuery;
      let completeQuery;
      if (const_config.isAllowedRole(role, ['MANAGER'])) {
        createdQuery = {
          organization: organization,
          assigned_to: user_email,
          createdAt: {
            $gte: start,
            $lt: end,
          },
        };
        completeQuery = {
          organization: organization,
          assigned_to: user_email,
          task_status: 'COMPLETE',
          updatedAt: {
            $gte: start,
            $lt: end,
          },
        };
      } else {
        createdQuery = {
          organization: organization,
          department: department,
          createdAt: {
            $gte: start,
            $lt: end,
          },
        };
        completeQuery = {
          organization: organization,
          department: department,
          task_status: 'COMPLETE',
          updatedAt: {
            $gte: start,
            $lt: end,
          },
        };
      }

      let [createCount, completeCount] = await Promise.all([
        Task.countDocuments(createdQuery),
        Task.countDocuments(completeQuery),
      ]);

      let createTemp = {
        value: createCount,
        name: moment(date).format('MM-DD-YYYY'),
      };
      let completeTemp = {
        value: completeCount,
        name: moment(date).format('MM-DD-YYYY'),
      };

      createResponse.push(createTemp);
      completeResponse.push(completeTemp);
    }

    {
      return res.status(200).json({
        message: 'Tasks successfully',
        createResponse: createResponse,
        completeResponse: completeResponse,
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

//overview summary
const projectLists = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;

    let { member_email, manager_name } = req.body;

    let departmentName;
    let departmentsArray;
    let inDepartments = [];
    if (const_config.isAllowedRole(role, ['MANAGER'])) {
      query = {
        organization: organization,
        department: department,
        assigned_to: user_email,
      };
    } else if (const_config.isAllowedRole(role, ['SUPER_ADMIN'])) {
      if (department === 'ALL') {
        departmentName = await Department.findOne(
          { organization },
          'department_array.name'
        );
        for (let i = 0; i < departmentName.department_array.length; i++) {
          let element = departmentName.department_array[i].name;
          inDepartments.push(element);
        }
        departmentsArray = departmentName.department_array;
        query = {
          organization: organization,
          department: { $in: inDepartments },
        };
      } else if (!(member_email === undefined || member_email === '')) {
        query = {
          organization: organization,
          department: department,
          user_email: member_email,
        };
      } else if (!(manager_name === undefined || manager_name === '')) {
        query = {
          organization: organization,
          department: department,
          assigned_to: manager_name,
        };
      } else {
        query = {
          organization: organization,
          department: department,
        };
      }
    } else if (const_config.isAllowedRole(role, ['ADMIN'])) {
      if (department === 'ALL') {
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
        query = {
          organization: organization,
          department: { $in: inDepartments },
        };
      } else if (!(member_email === undefined || member_email === '')) {
        query = {
          organization: organization,
          department: department,
          user_email: member_email,
        };
      } else if (!(manager_name === undefined || manager_name === '')) {
        query = {
          organization: organization,
          department: department,
          assigned_to: manager_name,
        };
      } else {
        query = {
          organization: organization,
          department: department,
        };
      }
    } else if (const_config.isAllowedRole(role, ['AUDIT'])) {
      if (department === 'ALL') {
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
        query = {
          organization: organization,
          department: { $in: inDepartments },
        };
      } else if (!(member_email === undefined || member_email === '')) {
        query = {
          organization: organization,
          department: department,
          user_email: member_email,
        };
      } else if (!(manager_name === undefined || manager_name === '')) {
        query = {
          organization: organization,
          department: department,
          assigned_to: manager_name,
        };
      } else {
        query = {
          organization: organization,
          department: department,
        };
      }
    }

    let lists = await TaskProject.aggregate([
      {
        $match: query,
      },
    ]);

    return res.status(200).json({
      message: 'Projects list successfully',
      data: lists,
    });
  } catch (error) {
    logger.error(error);
    return res.status(500).json({
      code: 'SERVER_ERROR',
      description: 'Something went wrong, please try again',
    });
  }
};

const projectStatics = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;

    let { member_email, manager_name, report_type } = req.body;

    let departmentName;
    let departmentsArray;
    let inDepartments = [];
    let agentQuery = {};

    if (const_config.isAllowedRole(role, ['MANAGER'])) {
      query = {
        organization: organization,
        department: department,
        assigned_to: user_email,
      };
      agentQuery = {
        "$and": [{ $eq: ["$organization", "$$organization"] },
        { $eq: ["$department", department] }
        ]
      }
    } else if (const_config.isAllowedRole(role, ['SUPER_ADMIN'])) {
      if (department === 'ALL') {
        departmentName = await Department.findOne(
          { organization },
          'department_array.name'
        );
        for (let i = 0; i < departmentName.department_array.length; i++) {
          let element = departmentName.department_array[i].name;
          inDepartments.push(element);
        }
        departmentsArray = departmentName.department_array;
        query = {
          organization: organization,
          department: { $in: inDepartments },
        };
        agentQuery = {
          "$and": [{ $eq: ["$organization", "$$organization"] },
          { "$in": ["$department", inDepartments] }]
        }
      } else if (!(member_email === undefined || member_email === '')) {
        query = {
          organization: organization,
          department: department,
          user_email: member_email,
        };
        agentQuery = {
          "$and": [{ $eq: ["$organization", "$$organization"] },
          { $eq: ["$department", department] }
          ]
        }
      } else if (!(manager_name === undefined || manager_name === '')) {
        query = {
          organization: organization,
          department: department,
          assigned_to: manager_name,
        };
        agentQuery = {
          "$and": [{ $eq: ["$organization", "$$organization"] },
          { $eq: ["$department", department] }
          ]
        }
      } else {
        query = {
          organization: organization,
          department: department,
        };
        agentQuery = {
          "$and": [{ $eq: ["$organization", "$$organization"] },
          { $eq: ["$department", department] }]
        }
      }
    } else if (const_config.isAllowedRole(role, ['ADMIN'])) {
      if (department === 'ALL') {
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
        query = {
          organization: organization,
          department: { $in: inDepartments },
        };
        agentQuery = {
          "$and": [{ $eq: ["$organization", "$$organization"] },
          { "$in": ["$department", inDepartments] }]
        }
      } else if (!(member_email === undefined || member_email === '')) {
        query = {
          organization: organization,
          department: department,
          user_email: member_email,
        };
        agentQuery = {
          "$and": [{ $eq: ["$organization", "$$organization"] },
          { $eq: ["$department", department] }
          ]
        };
      } else if (!(manager_name === undefined || manager_name === '')) {
        query = {
          organization: organization,
          department: department,
          assigned_to: manager_name,
        };
        agentQuery = {
          "$and": [{ $eq: ["$organization", "$$organization"] },
          { $eq: ["$department", department] }
          ]
        };
      } else {
        query = {
          organization: organization,
          department: department,
        };
        agentQuery = {
          "$and": [{ $eq: ["$organization", "$$organization"] },
          { $eq: ["$department", department] }]
        };
      }
    } else if (const_config.isAllowedRole(role, ['AUDIT'])) {
      if (department === 'ALL') {
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
        query = {
          organization: organization,
          department: { $in: inDepartments },
        };
        agentQuery = {
          "$and": [{ $eq: ["$organization", "$$organization"] },
          { "$in": ["$department", inDepartments] }]
        }
      } else if (!(member_email === undefined || member_email === '')) {
        query = {
          organization: organization,
          department: department,
          user_email: member_email,
        };
        agentQuery = {
          "$and": [{ $eq: ["$organization", "$$organization"] },
          { $eq: ["$department", department] }
          ]
        };
      } else if (!(manager_name === undefined || manager_name === '')) {
        query = {
          organization: organization,
          department: department,
          assigned_to: manager_name,
        };
        agentQuery = {
          "$and": [{ $eq: ["$organization", "$$organization"] },
          { $eq: ["$department", department] }
          ]
        };
      } else {
        query = {
          organization: organization,
          department: department,
        };
        agentQuery = {
          "$and": [{ $eq: ["$organization", "$$organization"] },
          { $eq: ["$department", department] }]
        };
      }
    }

    let statics = await TaskProject.aggregate([
      {
        $match: query,
      },
      {
        $project: {
          _id: 0,
          project_name: '$project_name',
          project_id: '$project_id',
          organization: "$organization"
        },
      },
      {
        $lookup: {
          from: 'tasks',
          let: {
            project_id: '$project_id',
            organization: "$organization",
            // task_status: ["TO-DO", "IN-PROGRESS", "COMPLETE", "DELAYED", "TESTING"],
            task_status: ['TO-DO', 'IN-PROGRESS', 'COMPLETE', 'DELAYED'],
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$project_id', '$$project_id'] },
                    { $in: ['$task_status', '$$task_status'] },
                    agentQuery
                  ],
                },
              },
            },
            {
              $group: {
                _id: null,
                completed: {
                  $sum: {
                    $cond: [
                      {
                        $eq: ['$task_status', 'COMPLETE'],
                      },
                      1,
                      0,
                    ],
                  },
                },
                inProgress: {
                  $sum: {
                    $cond: [
                      {
                        $eq: ['$task_status', 'IN-PROGRESS'],
                      },
                      1,
                      0,
                    ],
                  },
                },
                todo: {
                  $sum: {
                    $cond: [
                      {
                        $eq: ['$task_status', 'TO-DO'],
                      },
                      1,
                      0,
                    ],
                  },
                },
                delayed: {
                  $sum: {
                    $cond: [
                      {
                        $eq: ['$task_status', 'DELAYED'],
                      },
                      1,
                      0,
                    ],
                  },
                },
                testing: {
                  $sum: {
                    $cond: [
                      {
                        $eq: ['$task_status', 'TESTING'],
                      },
                      1,
                      0,
                    ],
                  },
                },
              },
            },
            {
              $project: {
                _id: 0,
                completed: 1,
                inProgress: 1,
                todo: 1,
                delayed: 1,
                // testing: 1
              },
            },
            {
              $sort: {
                _id: 1,
              },
            },
          ],
          as: 'status',
        },
      },
      {
        $addFields: {
          status_size: { $size: '$status' },
        },
      },
      {
        $project: {
          _id: 0,
          project_name: '$project_name',
          project_id: '$project_id',
          status: {
            $cond: {
              if: {
                $eq: ['$status_size', 0],
              },
              then: [
                {
                  inProgress: 0,
                  todo: 0,
                  delayed: 0,
                  completed: 0,
                },
              ],
              else: '$status',
            },
          },
        },
      },
    ]);

    if (report_type === 'csv') {
      let reports = [];

      for (let i = 0; i < statics.length; i++) {
        let data = statics[i];
        let entry = {
          Organization: organization,
          Department: department,
          Project_title: data.project_name,
          Completed_status_count: data.status[0].completed,
          InProgress_status_count: data.status[0].inProgress,
          Todo_status_count: data.status[0].todo,
          Delayed_status_count: data.status[0].delayed,
        };
        reports.push(entry);
      }

      const fields = [
        'Organization',
        'Department',
        'Project_title',
        'Completed_status_count',
        'InProgress_status_count',
        'Todo_status_count',
        'Delayed_status_count',
      ];
      const opts = { fields };
      const csv = parse(reports, opts);
      return res.status(200).send(csv);
    } else {
      return res.status(200).json({
        message: 'Overview fetched successfully',
        data: statics,
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

const delayedTasks = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;

    let { manager_name, member_email, report_type } = req.body;

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

    let query = null;
    let departmentName;
    let departmentsArray;
    let inDepartments = [];

    if (const_config.isAllowedRole(role, ['MANAGER'])) {
      query = {
        organization: organization,
        department: department,
        assigned_to: user_email,
        task_status: {
          $ne: 'COMPLETE',
        },
      };
    } else if (const_config.isAllowedRole(role, ['SUPER_ADMIN'])) {
      if (department === 'ALL') {
        departmentName = await Department.findOne(
          { organization },
          'department_array.name'
        );
        for (let i = 0; i < departmentName.department_array.length; i++) {
          let element = departmentName.department_array[i].name;
          inDepartments.push(element);
        }
        departmentsArray = departmentName.department_array;
        query = {
          organization: organization,
          department: { $in: inDepartments },
          task_status: {
            $ne: 'COMPLETE',
          },
        };
      } else if (!(member_email === undefined || member_email === '')) {
        query = {
          organization: organization,
          department: department,
          user_email: member_email,
          task_status: {
            $ne: 'COMPLETE',
          },
        };
      } else if (!(manager_name === undefined || manager_name === '')) {
        query = {
          organization: organization,
          department: department,
          assigned_to: manager_name,
          task_status: {
            $ne: 'COMPLETE',
          },
        };
      } else {
        query = {
          organization: organization,
          department: department,
          task_status: {
            $ne: 'COMPLETE',
          },
        };
      }
    } else if (const_config.isAllowedRole(role, ['ADMIN'])) {
      if (department === 'ALL') {
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
        query = {
          organization: organization,
          department: { $in: inDepartments },
          task_status: {
            $ne: 'COMPLETE',
          },
        };
      } else if (!(member_email === undefined || member_email === '')) {
        query = {
          organization: organization,
          department: department,
          user_email: member_email,
          task_status: {
            $ne: 'COMPLETE',
          },
        };
      } else if (!(manager_name === undefined || manager_name === '')) {
        query = {
          organization: organization,
          department: department,
          assigned_to: manager_name,
          task_status: {
            $ne: 'COMPLETE',
          },
        };
      } else {
        query = {
          organization: organization,
          department: department,
          task_status: {
            $ne: 'COMPLETE',
          },
        };
      }
    } else if (const_config.isAllowedRole(role, ['AUDIT'])) {
      if (department === 'ALL') {
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
        query = {
          organization: organization,
          department: { $in: inDepartments },
          task_status: {
            $ne: 'COMPLETE',
          },
        };
      } else if (!(member_email === undefined || member_email === '')) {
        query = {
          organization: organization,
          department: department,
          user_email: member_email,
          task_status: {
            $ne: 'COMPLETE',
          },
        };
      } else if (!(manager_name === undefined || manager_name === '')) {
        query = {
          organization: organization,
          department: department,
          assigned_to: manager_name,
          task_status: {
            $ne: 'COMPLETE',
          },
        };
      } else {
        query = {
          organization: organization,
          department: department,
          task_status: {
            $ne: 'COMPLETE',
          },
        };
      }
    }

    let response = await Task.aggregate([
      {
        $match: query,
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: '%m-%d-%Y',
                date: '$completion_date',
              },
            },
            priority: '$priority',
            task_status: '$task_status',
            assigned_members: '$assigned_members',
            title: '$title',
            task_uniqueId: '$taskUniqueID',
            project_id: '$project_id',
            created_on: {
              $dateToString: {
                format: '%m-%d-%Y',
                date: '$createdAt',
              },
            },
            delayed_by_days: {
              $round: {
                $divide: [
                  {
                    $subtract: ['$$NOW', '$completion_date'],
                  },
                  86400000,
                ],
              },
            },
          },
        },
      },
      {
        $lookup: {
          from: 'task_projects',
          let: {
            project_id: '$_id.project_id',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$project_id', '$$project_id'] }],
                },
              },
            },
            {
              $group: {
                _id: '$project_name',
              },
            },
          ],
          as: 'project_name',
        },
      },
      {
        $unwind: '$project_name',
      },
      {
        $addFields: {
          project_name: '$project_name._id',
        },
      },
      // {
      //     "$sort": {
      //         "delayed_by_days": 1
      //     }
      // },
      {
        $project: {
          _id: 0,
          date: '$_id.date',
          project_name: '$project_name',
          priority: '$_id.priority',
          task_status: '$_id.task_status',
          assigned_members: '$_id.assigned_members',
          title: '$_id.title',
          task_uniqueId: '$_id.task_uniqueId',
          project_id: '$_id.project_id',
          created_on: '$_id.created_on',
          delayed_by_days: '$_id.delayed_by_days',
        },
      },
    ]);

    let reports = [];
    for (let i = 0; i < response.length; i++) {
      let today_date = moment(new Date()).format('MM-DD-YYYY');

      logger.debug('today_date', today_date);
      logger.debug('response[i].date ', response[i].date);

      // if (today_date > response[i].date && response[i].task_status !== "COMPLETE") {
      if (today_date > response[i].date) {
        let entry = {
          organization: organization,
          department: department,
          date: response[i].date,
          task_status: response[i].task_status,
          title: response[i].title,
          taskUniqueID: response[i].task_uniqueId,
          delayed_by_days: response[i].delayed_by_days,
          assigned_members: response[i].assigned_members,
          priority: response[i].priority,
          created_on: response[i].created_on,
          project: response[i].project_name,
          project_id: response[i].project_id,
        };
        reports.push(entry);
      }
    }

    if (report_type === 'csv') {
      let csv_data = [];
      for (let i = 0; i < reports.length; i++) {
        let assigned_members = reports[i].assigned_members;
        let members = '';
        for (let j = 0; j < assigned_members.length; j++) {
          members += assigned_members[j].assigned_to_member;
          if (j < assigned_members.length - 1) {
            members += ' ,';
          }
        }
        let entry = {
          organization: organization,
          department: department,
          date: reports[i].date,
          task_status: reports[i].task_status,
          title: reports[i].title,
          taskUniqueID: reports[i].taskUniqueID,
          delayed_by_days: reports[i].delayed_by_days,
          assigned_member: members,
          priority: reports[i].priority,
          created_on: reports[i].created_on,
          project: reports[i].project,
          project_id: reports[i].project_id,
        };
        csv_data.push(entry);
      }

      const fields = [
        'organization',
        'department',
        'title',
        'created_on',
        'project',
        'priority',
        'assigned_member',
      ];
      const opts = { fields };
      const csv = parse(csv_data, opts);
      return res.status(200).send(csv);
    } else {
      return res.status(200).json({
        message: 'List of delayed task fetched successfully',
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

const getWorkLoad = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;
    let {
      from,
      to,
      manager_name,
      member_email,
      project_id,
      skip,
      limit,
      report_type,
    } = req.body;
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
    let query = null;
    let departmentName;
    let departmentsArray;
    let inDepartments = [];
    if (const_config.isAllowedRole(role, ['MANAGER'])) {
      query = {
        organization: organization,
        department: department,
        assigned_to: user_email,
        task_status: {
          $ne: 'COMPLETE',
        },
        project_id: project_id,
        createdAt: {
          $gte: from,
          $lt: till,
        },
      };
    } else if (const_config.isAllowedRole(role, ['SUPER_ADMIN'])) {
      if (department === 'ALL') {
        departmentName = await Department.findOne(
          { organization },
          'department_array.name'
        );
        for (let i = 0; i < departmentName.department_array.length; i++) {
          let element = departmentName.department_array[i].name;
          inDepartments.push(element);
        }
        departmentsArray = departmentName.department_array;
        query = {
          organization: organization,
          department: { $in: inDepartments },
          project_id: project_id,
        };
      } else if (!(member_email === undefined || member_email === '')) {
        query = {
          organization: organization,
          department: department,
          user_email: member_email,
          task_status: {
            $ne: 'COMPLETE',
          },
          project_id: project_id,
          createdAt: {
            $gte: from,
            $lt: till,
          },
        };
      } else if (!(manager_name === undefined || manager_name === '')) {
        query = {
          organization: organization,
          department: department,
          assigned_to: manager_name,
          task_status: {
            $ne: 'COMPLETE',
          },
          project_id: project_id,
          createdAt: {
            $gte: from,
            $lt: till,
          },
        };
      } else {
        query = {
          organization: organization,
          department: department,
          task_status: {
            $ne: 'COMPLETE',
          },
          project_id: project_id,
          createdAt: {
            $gte: from,
            $lt: till,
          },
        };
      }
    } else if (const_config.isAllowedRole(role, ['ADMIN'])) {
      if (department === 'ALL') {
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
        query = {
          organization: organization,
          department: { $in: inDepartments },
          task_status: {
            $ne: 'COMPLETE',
          },
          project_id: project_id,
          createdAt: {
            $gte: from,
            $lt: till,
          },
        };
      } else if (!(member_email === undefined || member_email === '')) {
        query = {
          organization: organization,
          department: department,
          user_email: member_email,
          task_status: {
            $ne: 'COMPLETE',
          },
          project_id: project_id,
          createdAt: {
            $gte: from,
            $lt: till,
          },
        };
      } else if (!(manager_name === undefined || manager_name === '')) {
        query = {
          organization: organization,
          department: department,
          assigned_to: manager_name,
          task_status: {
            $ne: 'COMPLETE',
          },
          project_id: project_id,
          createdAt: {
            $gte: from,
            $lt: till,
          },
        };
      } else {
        query = {
          organization: organization,
          department: department,
          task_status: {
            $ne: 'COMPLETE',
          },
          project_id: project_id,
          createdAt: {
            $gte: from,
            $lt: till,
          },
        };
      }
    } else if (const_config.isAllowedRole(role, ['AUDIT'])) {
      if (department === 'ALL') {
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
        query = {
          organization: organization,
          department: { $in: inDepartments },
          task_status: {
            $ne: 'COMPLETE',
          },
          project_id: project_id,
          createdAt: {
            $gte: from,
            $lt: till,
          },
        };
      } else if (!(member_email === undefined || member_email === '')) {
        query = {
          organization: organization,
          department: department,
          user_email: member_email,
          task_status: {
            $ne: 'COMPLETE',
          },
          project_id: project_id,
          createdAt: {
            $gte: from,
            $lt: till,
          },
        };
      } else if (!(manager_name === undefined || manager_name === '')) {
        query = {
          organization: organization,
          department: department,
          assigned_to: manager_name,
          task_status: {
            $ne: 'COMPLETE',
          },
          project_id: project_id,
          createdAt: {
            $gte: from,
            $lt: till,
          },
        };
      } else {
        query = {
          organization: organization,
          department: department,
          task_status: {
            $ne: 'COMPLETE',
          },
          project_id: project_id,
          createdAt: {
            $gte: from,
            $lt: till,
          },
        };
      }
    }

    // let userTasks = await Task.aggregate([
    //     {
    //         $match: query
    //     },
    //     { $unwind: '$assigned_members' },
    //     {
    //         $group: {
    //             _id: {
    //                 'user': "$assigned_members.assigned_to_member"
    //             },
    //             count: { $sum: 1 },
    //         }
    //     },
    //     {
    //         $project: {
    //             _id: 0,
    //             'user': "$_id.user",
    //             count: "$count"
    //         }
    //     },
    //     {
    //         $sort: {
    //             "count": -1
    //         }
    //     }
    // ])

    let [userTasks, total] = await Promise.all([
      Task.aggregate([
        {
          $match: query,
        },
        { $unwind: '$assigned_members' },
        {
          $group: {
            _id: {
              user: '$assigned_members.assigned_to_member',
            },
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            user: '$_id.user',
            count: '$count',
          },
        },
        {
          $sort: {
            count: -1,
          },
        },
        { $skip: skip },
        { $limit: limit },
      ]),

      Task.aggregate([
        {
          $match: query,
        },
        { $unwind: '$assigned_members' },
        {
          $group: {
            _id: {
              user: '$assigned_members.assigned_to_member',
            },
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            user: '$_id.user',
            count: '$count',
          },
        },
        {
          $sort: {
            count: -1,
          },
        },
      ]),
    ]);

    if (report_type === 'csv') {
      let reports = [];

      for (let i = 0; i < userTasks.length; i++) {
        let data = userTasks[i];
        let entry = {
          Organization: organization,
          Department: department,
          User_email: data.user,
          Count: data.count,
        };
        reports.push(entry);
      }

      const fields = ['Organization', 'Department', 'User_email', 'Count'];
      const opts = { fields };
      const csv = parse(reports, opts);
      return res.status(200).send(csv);
    } else {
      return res.status(200).json({
        message: 'Work Load fetched successfully',
        data: userTasks,
        total: total.length,
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

//project wise
const overviewByProject = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;
    let { manager_name, member_email, project_id, report_type } = req.body;

    if (const_config.isAllowedRole(role, ['MANAGER'])) {
      query = {
        organization: organization,
        department: department,
        assigned_to: user_email,
        project_id: project_id,
      };
    } else if (const_config.isAllowedRole(role, ['SUPER_ADMIN'])) {
      if (department === 'ALL') {
        departmentName = await Department.findOne(
          { organization },
          'department_array.name'
        );
        for (let i = 0; i < departmentName.department_array.length; i++) {
          let element = departmentName.department_array[i].name;
          inDepartments.push(element);
        }
        departmentsArray = departmentName.department_array;
        query = {
          organization: organization,
          department: { $in: inDepartments },
          project_id: project_id,
        };
      } else if (!(member_email === undefined || member_email === '')) {
        query = {
          organization: organization,
          department: department,
          user_email: member_email,
          project_id: project_id,
        };
      } else if (!(manager_name === undefined || manager_name === '')) {
        query = {
          organization: organization,
          department: department,
          assigned_to: manager_name,
          project_id: project_id,
        };
      } else {
        query = {
          organization: organization,
          department: department,
          project_id: project_id,
        };
      }
    } else if (const_config.isAllowedRole(role, ['ADMIN'])) {
      if (department === 'ALL') {
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
        query = {
          organization: organization,
          department: { $in: inDepartments },
          project_id: project_id,
        };
      } else if (!(member_email === undefined || member_email === '')) {
        query = {
          organization: organization,
          department: department,
          user_email: member_email,
          project_id: project_id,
        };
      } else if (!(manager_name === undefined || manager_name === '')) {
        query = {
          organization: organization,
          department: department,
          assigned_to: manager_name,
          project_id: project_id,
        };
      } else {
        query = {
          organization: organization,
          department: department,
          project_id: project_id,
        };
      }
    } else if (const_config.isAllowedRole(role, ['AUDIT'])) {
      if (department === 'ALL') {
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
        query = {
          organization: organization,
          department: { $in: inDepartments },
          project_id: project_id,
        };
      } else if (!(member_email === undefined || member_email === '')) {
        query = {
          organization: organization,
          department: department,
          user_email: member_email,
          project_id: project_id,
        };
      } else if (!(manager_name === undefined || manager_name === '')) {
        query = {
          organization: organization,
          department: department,
          assigned_to: manager_name,
          project_id: project_id,
        };
      } else {
        query = {
          organization: organization,
          department: department,
          project_id: project_id,
        };
      }
    }
    let project_task_status_list = await TasksList.aggregate([
      {
        $match: query,
      },
      {
        $group: {
          _id: '$task_status',
          task_status: { $first: '$task_status' },
        },
      },
      {
        $project: {
          _id: 0,
          task_status: '$task_status',
        },
      },
    ]);

    let tasks_count = await Task.aggregate([
      {
        $match: query,
      },
      {
        $group: {
          _id: '$task_status',
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          task_status: '$_id',
          count: '$count',
        },
      },
    ]);

    const matchedData = project_task_status_list.map((status) => {
      const matchedItem = tasks_count.find(
        (item) => item.task_status === status.task_status
      );
      if (matchedItem) {
        return matchedItem;
      } else {
        return {
          task_status: status.task_status,
          count: 0,
        };
      }
    });

    let total = 0;

    for (let i = 0; i < matchedData.length; i++) {
      total = total + matchedData[i].count;
    }

    if (report_type === 'csv') {
      let reports = [];
      for (let i = 0; i < matchedData.length; i++) {
        let task = matchedData[i];
        let project = await TaskProject.findOne({ project_id: project_id });
        let entry = {
          Organization: organization,
          Department: department,
          Project_title: project ? project.project_name : 'N/A',
          Task_list_name: task.task_status,
          Task_list_tasks_count: task.count,
        };
        reports.push(entry);
      }

      const fields = [
        'Organization',
        'Department',
        'Project_title',
        'Task_list_name',
        'Task_list_tasks_count',
      ];
      const opts = { fields };
      const csv = parse(reports, opts);
      return res.status(200).send(csv);
    } else {
      return res.status(200).json({
        message: 'Overview fetched successfully',
        data: matchedData,
        total: total,
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

const getWorkLoadByProject = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;
    let {
      from,
      to,
      manager_name,
      member_email,
      project_id,
      users,
      report_type,
    } = req.body;
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
    let query = null;
    let departmentName;
    let departmentsArray;
    let inDepartments = [];
    if (const_config.isAllowedRole(role, ['MANAGER'])) {
      query = {
        organization: organization,
        department: department,
        assigned_to: user_email,
        task_status: {
          $ne: 'COMPLETE',
        },
        project_id: project_id,
        createdAt: {
          $gte: from,
          $lt: till,
        },
      };
    } else if (const_config.isAllowedRole(role, ['SUPER_ADMIN'])) {
      if (department === 'ALL') {
        departmentName = await Department.findOne(
          { organization },
          'department_array.name'
        );
        for (let i = 0; i < departmentName.department_array.length; i++) {
          let element = departmentName.department_array[i].name;
          inDepartments.push(element);
        }
        departmentsArray = departmentName.department_array;
        query = {
          organization: organization,
          department: { $in: inDepartments },
          project_id: project_id,
          user_email: {
            $in: users,
          },
          task_status: {
            $ne: 'COMPLETE',
          },
        };
      } else if (!(member_email === undefined || member_email === '')) {
        query = {
          organization: organization,
          department: department,
          user_email: member_email,
          project_id: project_id,
          user_email: {
            $in: users,
          },
          task_status: {
            $ne: 'COMPLETE',
          },
          createdAt: {
            $gte: from,
            $lt: till,
          },
        };
      } else if (!(manager_name === undefined || manager_name === '')) {
        query = {
          organization: organization,
          department: department,
          assigned_to: manager_name,
          task_status: {
            $ne: 'COMPLETE',
          },
          project_id: project_id,
          user_email: {
            $in: users,
          },
          createdAt: {
            $gte: from,
            $lt: till,
          },
        };
      } else {
        logger.debug('dataaaaaa');
        query = {
          organization: organization,
          department: department,
          task_status: {
            $ne: 'COMPLETE',
          },
          project_id: project_id,
          // user_email: {
          //     $in: users
          // },
          createdAt: {
            $gte: from,
            $lt: till,
          },
        };
      }
    } else if (const_config.isAllowedRole(role, ['ADMIN'])) {
      if (department === 'ALL') {
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
        query = {
          organization: organization,
          department: { $in: inDepartments },
          task_status: {
            $ne: 'COMPLETE',
          },
          project_id: project_id,
          createdAt: {
            $gte: from,
            $lt: till,
          },
        };
      } else if (!(member_email === undefined || member_email === '')) {
        query = {
          organization: organization,
          department: department,
          user_email: member_email,
          task_status: {
            $ne: 'COMPLETE',
          },
          project_id: project_id,
          createdAt: {
            $gte: from,
            $lt: till,
          },
        };
      } else if (!(manager_name === undefined || manager_name === '')) {
        query = {
          organization: organization,
          department: department,
          assigned_to: manager_name,
          task_status: {
            $ne: 'COMPLETE',
          },
          project_id: project_id,
          createdAt: {
            $gte: from,
            $lt: till,
          },
        };
      } else {
        query = {
          organization: organization,
          department: department,
          task_status: {
            $ne: 'COMPLETE',
          },
          project_id: project_id,
          createdAt: {
            $gte: from,
            $lt: till,
          },
        };
      }
    } else if (const_config.isAllowedRole(role, ['AUDIT'])) {
      if (department === 'ALL') {
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
        query = {
          organization: organization,
          department: { $in: inDepartments },
          task_status: {
            $ne: 'COMPLETE',
          },
          project_id: project_id,
          createdAt: {
            $gte: from,
            $lt: till,
          },
        };
      } else if (!(member_email === undefined || member_email === '')) {
        query = {
          organization: organization,
          department: department,
          user_email: member_email,
          task_status: {
            $ne: 'COMPLETE',
          },
          project_id: project_id,
          createdAt: {
            $gte: from,
            $lt: till,
          },
        };
      } else if (!(manager_name === undefined || manager_name === '')) {
        query = {
          organization: organization,
          department: department,
          assigned_to: manager_name,
          task_status: {
            $ne: 'COMPLETE',
          },
          project_id: project_id,
          createdAt: {
            $gte: from,
            $lt: till,
          },
        };
      } else {
        query = {
          organization: organization,
          department: department,
          task_status: {
            $ne: 'COMPLETE',
          },
          project_id: project_id,
          createdAt: {
            $gte: from,
            $lt: till,
          },
        };
      }
    }

    // let userTasks = await Task.aggregate([
    //     {
    //         $match: query
    //     },
    //     { $unwind: '$assigned_members' },
    //     {
    //         $group: {
    //             _id: {
    //                 date: {
    //                     '$dateToString': {
    //                         'format': "%m-%d-%Y",
    //                         'date': "$createdAt"
    //                     },
    //                 },
    //                 user: "$assigned_members.assigned_to_member",
    //             },
    //             task: {
    //                 $push: {
    //                     title: "$title"
    //                 }
    //             }

    //         },
    //     },
    //     {
    //         $match: {

    //             "_id.user": { "$in": users }
    //         },
    //     },
    //     {
    //         $project: {
    //             _id: 0,
    //             date: "$_id.date",
    //             user: "$_id.user",
    //             task: { $size: "$task" },
    //         },
    //     },
    //     {
    //         $group: {
    //             _id: "$date",
    //             tasks: {
    //                 $push: {
    //                     user: "$user",
    //                     count: "$task",
    //                 },
    //             }
    //         }
    //     },

    // ])

    let userTasks = await Task.aggregate([
      {
        $match: query,
      },
      { $unwind: '$assigned_members' },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: '%m-%d-%Y',
                date: '$createdAt',
              },
            },
            user: '$assigned_members.assigned_to_member',
          },
          task: {
            $push: {
              title: '$title',
            },
          },
        },
      },
      {
        $match: {
          '_id.user': { $in: users },
        },
      },
      {
        $group: {
          _id: '$_id.user',
          response: {
            $push: {
              name: '$_id.date',
              value: { $size: '$task' },
            },
          },
        },
      },
    ]);

    const startDate = moment(from, "MM-DD-YYYY").utc().startOf('day');
    const endDate = moment(to, "MM-DD-YYYY").utc().startOf('day');
    const dateArray = [];
    let currentDate = startDate.add(1, 'day'); // Exclude the starting date

    while (currentDate <= endDate) {
      dateArray.push(currentDate.utc().format("MM-DD-YYYY"));
      currentDate = currentDate.add(1, 'day');
    }

    const response = userTasks.map((obj) => {
      const emailId = obj._id;
      const emailResponse = obj.response;
      return {
        username: emailId,
        response: dateArray.map((name) => {
          const match = emailResponse.find((entry) => entry.name === name);
          const value = match ? match.value : 0;
          return { name, value };
        }),
      };
    });

    if (report_type === 'csv') {
      let reports = [];
      for (let i = 0; i < response.length; i++) {
        let task = response[i].response;
        for (let j = 0; j < task.length; j++) {
          let item = task[j];
          let entry = {
            Organization: organization,
            Department: department,
            User_email: response[i].username,
            Date: item.name,
            Count: item.value,
          };
          reports.push(entry);
        }
      }

      const fields = [
        'Organization',
        'Department',
        'User_email',
        'Date',
        'Count',
      ];
      const opts = { fields };
      const csv = parse(reports, opts);
      return res.status(200).send(csv);
    } else {
      return res.status(200).json({
        message: 'Work Load fetched successfully',
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

const getCreatedVsCompletedTasksByProject = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;

    let { manager_name, member_email, from, to, project_id, report_type } =
      req.body;

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

    let createResponse = [];
    let completeResponse = [];
    let reports = [];

    for (var j = 0; j < date_array.length; j++) {
      let date = date_array[j];

      let jDateToday = new Date(date_array[j]);
      let time_zone = req.timezone;
      let local_date = moment(jDateToday).tz(time_zone);
      let start = local_date.startOf('day').toDate();
      let end = local_date.endOf('day').toDate();

      let createdQuery;
      let completeQuery;
      let departmentName;
      let departmentsArray;
      let inDepartments = [];

      if (const_config.isAllowedRole(role, ['MANAGER'])) {
        createdQuery = {
          organization: organization,
          assigned_to: user_email,
          project_id: project_id,
          createdAt: {
            $gte: start,
            $lt: end,
          },
        };
        completeQuery = {
          organization: organization,
          assigned_to: user_email,
          project_id: project_id,
          task_status: 'COMPLETE',
          updatedAt: {
            $gte: start,
            $lt: end,
          },
        };
      } else if (const_config.isAllowedRole(role, ['SUPER_ADMIN'])) {
        if (department === 'ALL') {
          departmentName = await Department.findOne(
            { organization },
            'department_array.name'
          );
          for (let i = 0; i < departmentName.department_array.length; i++) {
            let element = departmentName.department_array[i].name;
            inDepartments.push(element);
          }
          departmentsArray = departmentName.department_array;

          createdQuery = {
            organization: organization,
            department: { $in: inDepartments },
            project_id: project_id,
            createdAt: {
              $gte: start,
              $lt: end,
            },
          };
          completeQuery = {
            organization: organization,
            department: { $in: inDepartments },
            project_id: project_id,
            task_status: 'COMPLETE',
            updatedAt: {
              $gte: start,
              $lt: end,
            },
          };
        } else if (!(member_email === undefined || member_email === '')) {
          createdQuery = {
            organization: organization,
            department: department,
            project_id: project_id,
            user_email: member_email,
            createdAt: {
              $gte: start,
              $lt: end,
            },
          };
          completeQuery = {
            organization: organization,
            department: department,
            project_id: project_id,
            user_email: member_email,
            task_status: 'COMPLETE',
            updatedAt: {
              $gte: start,
              $lt: end,
            },
          };
        } else if (!(manager_name === undefined || manager_name === '')) {
          createdQuery = {
            organization: organization,
            department: department,
            project_id: project_id,
            assigned_to: manager_name,
            createdAt: {
              $gte: start,
              $lt: end,
            },
          };
          completeQuery = {
            organization: organization,
            department: department,
            project_id: project_id,
            assigned_to: manager_name,
            task_status: 'COMPLETE',
            updatedAt: {
              $gte: start,
              $lt: end,
            },
          };
        } else {
          createdQuery = {
            organization: organization,
            department: department,
            project_id: project_id,
            createdAt: {
              $gte: start,
              $lt: end,
            },
          };
          completeQuery = {
            organization: organization,
            department: department,
            project_id: project_id,
            task_status: 'COMPLETE',
            updatedAt: {
              $gte: start,
              $lt: end,
            },
          };
        }
      } else if (const_config.isAllowedRole(role, ['ADMIN'])) {
        if (department === 'ALL') {
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

          createdQuery = {
            organization: organization,
            department: { $in: inDepartments },
            project_id: project_id,
            createdAt: {
              $gte: start,
              $lt: end,
            },
          };
          completeQuery = {
            organization: organization,
            department: { $in: inDepartments },
            project_id: project_id,
            task_status: 'COMPLETE',
            updatedAt: {
              $gte: start,
              $lt: end,
            },
          };
        } else if (!(member_email === undefined || member_email === '')) {
          createdQuery = {
            organization: organization,
            department: department,
            project_id: project_id,
            user_email: member_email,
            createdAt: {
              $gte: start,
              $lt: end,
            },
          };
          completeQuery = {
            organization: organization,
            department: department,
            project_id: project_id,
            user_email: member_email,
            task_status: 'COMPLETE',
            updatedAt: {
              $gte: start,
              $lt: end,
            },
          };
        } else if (!(manager_name === undefined || manager_name === '')) {
          createdQuery = {
            organization: organization,
            department: department,
            project_id: project_id,
            assigned_to: manager_name,
            createdAt: {
              $gte: start,
              $lt: end,
            },
          };
          completeQuery = {
            organization: organization,
            department: department,
            project_id: project_id,
            assigned_to: manager_name,
            task_status: 'COMPLETE',
            updatedAt: {
              $gte: start,
              $lt: end,
            },
          };
        } else {
          createdQuery = {
            organization: organization,
            department: department,
            project_id: project_id,
            createdAt: {
              $gte: start,
              $lt: end,
            },
          };
          completeQuery = {
            organization: organization,
            department: department,
            project_id: project_id,
            task_status: 'COMPLETE',
            updatedAt: {
              $gte: start,
              $lt: end,
            },
          };
        }
      } else if (const_config.isAllowedRole(role, ['AUDIT'])) {
        if (department === 'ALL') {
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

          createdQuery = {
            organization: organization,
            department: { $in: inDepartments },
            project_id: project_id,
            createdAt: {
              $gte: start,
              $lt: end,
            },
          };
          completeQuery = {
            organization: organization,
            department: { $in: inDepartments },
            project_id: project_id,
            task_status: 'COMPLETE',
            updatedAt: {
              $gte: start,
              $lt: end,
            },
          };
        } else if (!(member_email === undefined || member_email === '')) {
          createdQuery = {
            organization: organization,
            department: department,
            project_id: project_id,
            user_email: member_email,
            createdAt: {
              $gte: start,
              $lt: end,
            },
          };
          completeQuery = {
            organization: organization,
            department: department,
            project_id: project_id,
            user_email: member_email,
            task_status: 'COMPLETE',
            updatedAt: {
              $gte: start,
              $lt: end,
            },
          };
        } else if (!(manager_name === undefined || manager_name === '')) {
          createdQuery = {
            organization: organization,
            department: department,
            project_id: project_id,
            assigned_to: manager_name,
            createdAt: {
              $gte: start,
              $lt: end,
            },
          };
          completeQuery = {
            organization: organization,
            department: department,
            project_id: project_id,
            assigned_to: manager_name,
            task_status: 'COMPLETE',
            updatedAt: {
              $gte: start,
              $lt: end,
            },
          };
        } else {
          createdQuery = {
            organization: organization,
            department: department,
            project_id: project_id,
            createdAt: {
              $gte: start,
              $lt: end,
            },
          };
          completeQuery = {
            organization: organization,
            department: department,
            project_id: project_id,
            task_status: 'COMPLETE',
            updatedAt: {
              $gte: start,
              $lt: end,
            },
          };
        }
      }

      // else {
      //     createdQuery = {
      //         organization: organization,
      //         department: department,
      //         project_id: project_id,
      //         createdAt: {
      //             "$gte": start,
      //             "$lt": end
      //         }
      //     }
      //     completeQuery = {
      //         organization: organization,
      //         department: department,
      //         project_id: project_id,
      //         task_status: "COMPLETE",
      //         updatedAt: {
      //             "$gte": start,
      //             "$lt": end
      //         }
      //     }
      // }

      let [createCount, completeCount] = await Promise.all([
        Task.countDocuments(createdQuery),
        Task.countDocuments(completeQuery),
      ]);

      let createTemp = {
        value: createCount,
        name: moment(date).format('MM-DD-YYYY'),
      };
      let completeTemp = {
        value: completeCount,
        name: moment(date).format('MM-DD-YYYY'),
      };

      createResponse.push(createTemp);
      completeResponse.push(completeTemp);

      reports.push({
        Organization: organization,
        Department: department,
        Date: moment(date).format('MM-DD-YYYY'),
        Task_created_count: createCount,
        Task_completed_count: completeCount,
      });
    }

    if (report_type === 'csv') {
      const fields = [
        'Organization',
        'Department',
        'Date',
        'Task_created_count',
        'Task_completed_count',
      ];
      const opts = { fields };
      const csv = parse(reports, opts);
      return res.status(200).send(csv);
    } else {
      return res.status(200).json({
        message: 'Tasks successfully',
        createResponse: createResponse,
        completeResponse: completeResponse,
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

const delayedTasksByProjects = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;

    let { manager_name, member_email, project_id, report_type } = req.body;

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

    let query = null;
    let departmentName;
    let departmentsArray;
    let inDepartments = [];

    if (const_config.isAllowedRole(role, ['MANAGER'])) {
      query = {
        organization: organization,
        department: department,
        assigned_to: user_email,
        project_id: project_id,
      };
    } else if (const_config.isAllowedRole(role, ['SUPER_ADMIN'])) {
      if (department === 'ALL') {
        departmentName = await Department.findOne(
          { organization },
          'department_array.name'
        );
        for (let i = 0; i < departmentName.department_array.length; i++) {
          let element = departmentName.department_array[i].name;
          inDepartments.push(element);
        }
        departmentsArray = departmentName.department_array;
        query = {
          organization: organization,
          department: { $in: inDepartments },
          project_id: project_id,
        };
      } else if (!(member_email === undefined || member_email === '')) {
        query = {
          organization: organization,
          department: department,
          user_email: member_email,
          project_id: project_id,
        };
      } else if (!(manager_name === undefined || manager_name === '')) {
        query = {
          organization: organization,
          department: department,
          assigned_to: manager_name,
          project_id: project_id,
        };
      } else {
        query = {
          organization: organization,
          department: department,
          project_id: project_id,
        };
      }
    } else if (const_config.isAllowedRole(role, ['ADMIN'])) {
      if (department === 'ALL') {
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
        query = {
          organization: organization,
          department: { $in: inDepartments },
          project_id: project_id,
        };
      } else if (!(member_email === undefined || member_email === '')) {
        query = {
          organization: organization,
          department: department,
          user_email: member_email,
          project_id: project_id,
        };
      } else if (!(manager_name === undefined || manager_name === '')) {
        query = {
          organization: organization,
          department: department,
          assigned_to: manager_name,
          project_id: project_id,
        };
      } else {
        query = {
          organization: organization,
          department: department,
          project_id: project_id,
        };
      }
    } else if (const_config.isAllowedRole(role, ['AUDIT'])) {
      if (department === 'ALL') {
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
        query = {
          organization: organization,
          department: { $in: inDepartments },
          project_id: project_id,
        };
      } else if (!(member_email === undefined || member_email === '')) {
        query = {
          organization: organization,
          department: department,
          user_email: member_email,
          project_id: project_id,
        };
      } else if (!(manager_name === undefined || manager_name === '')) {
        query = {
          organization: organization,
          department: department,
          assigned_to: manager_name,
          project_id: project_id,
        };
      } else {
        query = {
          organization: organization,
          department: department,
          project_id: project_id,
        };
      }
    }

    let response = await Task.aggregate([
      {
        $match: query,
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: '%m-%d-%Y',
                date: '$completion_date',
              },
            },
            priority: '$priority',
            task_status: '$task_status',
            assigned_members: '$assigned_members',
            title: '$title',
            task_uniqueId: '$taskUniqueID',
            project_id: '$project_id',
            created_on: {
              $dateToString: {
                format: '%m-%d-%Y',
                date: '$createdAt',
              },
            },
            delayed_by_days: {
              $round: {
                $divide: [
                  {
                    $subtract: ['$$NOW', '$completion_date'],
                  },
                  86400000,
                ],
              },
            },
          },
        },
      },
      {
        $lookup: {
          from: 'task_projects',
          let: {
            project_id: '$_id.project_id',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$project_id', '$$project_id'] }],
                },
              },
            },
            {
              $group: {
                _id: '$project_name',
              },
            },
          ],
          as: 'project_name',
        },
      },
      {
        $unwind: '$project_name',
      },
      {
        $addFields: {
          project_name: '$project_name._id',
        },
      },
      {
        $sort: {
          delayed_by_days: 1,
        },
      },
      {
        $project: {
          _id: 0,
          date: '$_id.date',
          project_name: '$project_name',
          priority: '$_id.priority',
          task_status: '$_id.task_status',
          assigned_members: '$_id.assigned_members',
          title: '$_id.title',
          task_uniqueId: '$_id.task_uniqueId',
          project_id: '$_id.project_id',
          created_on: '$_id.created_on',
          delayed_by_days: '$_id.delayed_by_days',
        },
      },
      // { "$limit": 10 }
    ]);

    let reports = [];
    for (let i = 0; i < response.length; i++) {
      let today_date = moment(new Date()).format('MM-DD-YYYY');

      if (
        today_date > response[i].date &&
        response[i].task_status !== 'COMPLETE'
      ) {
        let entry = {
          organization: organization,
          department: department,
          date: response[i].date,
          task_status: response[i].task_status,
          title: response[i].title,
          taskUniqueID: response[i].task_uniqueId,
          delayed_by_days: response[i].delayed_by_days,
          assigned_members: response[i].assigned_members,
          priority: response[i].priority,
          created_on: response[i].created_on,
          project: response[i].project_name,
          project_id: response[i].project_id,
        };
        reports.push(entry);
      }
    }

    if (report_type === 'csv') {
      const fields = [
        'organization',
        'department',
        'title',
        'created_on',
        'date',
      ];
      const opts = { fields };
      const csv = parse(reports, opts);
      return res.status(200).send(csv);
    } else {
      return res.status(200).json({
        message: 'List of delayed task fetched successfully',
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

module.exports = {
  getTotalCompletedTasks: getTotalCompletedTasks,
  getCompletedAndInProgressTasks: getCompletedAndInProgressTasks,
  getTotalPendingTasks: getTotalPendingTasks,
  getTaskProductivity: getTaskProductivity,
  topMostDelayedTasks: topMostDelayedTasks,
  getTaskDistribution: getTaskDistribution,
  completePercentage: completePercentage,
  getTaskProductivityInDetail: getTaskProductivityInDetail,
  getTaskProductivityInDetail: getTaskProductivityInDetail,
  workLoadGraph: workLoadGraph,
  projectOverview: projectOverview, //updated
  upcomingTasks: upcomingTasks,
  taskCreatedCompletedByDates: taskCreatedCompletedByDates,

  projectLists: projectLists, //new apis
  projectStatics: projectStatics,
  delayedTasks: delayedTasks,
  getWorkLoad: getWorkLoad,
  overviewByProject: overviewByProject,
  getWorkLoadByProject: getWorkLoadByProject,
  getCreatedVsCompletedTasksByProject: getCreatedVsCompletedTasksByProject,
  delayedTasksByProjects: delayedTasksByProjects,
};
