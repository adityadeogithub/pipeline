const express = require('express');
const mongoose = require('mongoose');
const Activity = require('../../../models/activity');
const Users = require('../../../models/users');
const WorkLocation = require('../../../models/user_work_location');
const Logger = require('../../../configs/log');
const logger = new Logger('organization');
const moment = require('moment-timezone');
const Configuration = require('../../../models/configuration');
const ActiveAuxManagement = require('../../../models/active_aux_management');
const AuxManagement = require('../../../models/aux_management');
const { parse } = require('json2csv');
const Department = require('../../../models/department');
const AdminOrganization = require('../../../models/admin_organization');
const AuditOrganization = require('../../../models/audit_organization');
const const_config = require('../../../utility/util');

const getPresentVsAbsentByOrganization = async (req, res, next) => {
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

    let userCountQuery = {
      organization: organization,
    };

    let users = await Users.aggregate([
      {
        $match: userCountQuery,
      },
      {
        $group: {
          _id: '$department',

          users: {
            $push: {
              user_email: '$user_email',
            },
          },
        },
      },
      {
        $project: {
          department: '$_id',
          total_users: { $size: '$users' },
        },
      },
      {
        $lookup: {
          from: 'activities',
          let: {
            department: '$department',
            startDate: from,
            endDate: till,
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$department', '$$department'] },
                    { $gte: ['$date', '$$startDate'] },
                    { $lt: ['$date', '$$endDate'] },
                  ],
                },
              },
            },
            {
              $project: {
                _id: 0,
                user_email: '$user_email',
              },
            },
            {
              $group: {
                _id: null,
                users: { $addToSet: '$user_email' },
              },
            },
            {
              $project: {
                _id: 0,
                total_present: { $size: '$users' },
              },
            },
          ],
          as: 'data',
        },
      },
      {
        $unwind: {
          path: '$data',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          count: '$data.total_present',
        },
      },
      {
        $project: {
          department: 1,
          total_users: 1,
          total_present: {
            $cond: { if: '$count', then: '$count', else: 0 },
          },
        },
      },
      {
        $addFields: {
          total_absent: { $subtract: ['$total_users', '$total_present'] },
        },
      },
    ]);

    return res.status(200).json({
      message: 'Present Vs Absent count fetched successfully',
      data: users,
    });
  } catch (error) {
    logger.error(error);

    return res.status(500).json({
      code: 'SERVER_ERROR',
      description: 'something went wrong, Please try again',
    });
  }
};

const getWfhVsWfoByOrganization = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let assigned_to = req.assigned_to;
    let user_email = req.user_email;

    let { from, to } = req.body;

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
      date: {
        $gte: from,
        $lt: till,
      },
    };

    let home_office_count = await WorkLocation.aggregate([
      {
        $match: query,
      },
      {
        $group: {
          _id: {
            department: '$department',
            user_email: '$user_email',
            home: '$work_location',
          },
        },
      },
      {
        $group: {
          _id: '$_id.department',
          home: {
            $push: {
              $cond: [
                {
                  $and: [
                    {
                      $eq: ['$_id.home', 'Home'],
                    },
                  ],
                },
                {
                  user_email: '$_id.user_email',
                },
                '$$REMOVE',
              ],
            },
          },
          office: {
            $push: {
              $cond: [
                {
                  $and: [
                    {
                      $eq: ['$_id.home', 'Office'],
                    },
                  ],
                },
                {
                  user_email: '$_id.user_email',
                },
                '$$REMOVE',
              ],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          department: '$_id',
          home: { $size: '$home' },
          office: { $size: '$office' },
        },
      },
    ]);

    return res.status(200).json({
      message: 'WFH and WFO data fetched successfully',
      data: home_office_count,
    });
  } catch (error) {
    logger.error(error);

    return res.status(500).json({
      code: 'SERVER_ERROR',
      description: 'something went wrong, Please try again',
    });
  }
};

const getIdleTimeByOrganization = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let assigned_to = req.assigned_to;
    let user_email = req.user_email;

    let { from, to } = req.body;

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
    role = 'ADMIN';
    let query = {
      organization: organization,
      date: {
        $gte: from,
        $lt: till,
      },
    };
    let departmentName;
    let departmentsArray;
    let inDepartments = [];
    if (const_config.isAllowedRole(role, ['SUPER_ADMIN'])) {
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
        date: {
          $gte: from,
          $lt: till,
        },
      };
    } else if (const_config.isAllowedRole(role, ['ADMIN'])) {
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
        date: {
          $gte: from,
          $lt: till,
        },
      };
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

      query = {
        organization: organization,
        department: { $in: inDepartments },
        date: {
          $gte: from,
          $lt: till,
        },
      };
    }

    let idle_count = await Activity.aggregate([
      {
        $match: query,
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
                format: '%m-%d-%Y',
                date: '$date',
              },
            },
          },
          idle: {
            $push: {
              idleTime: '$idleTime',
            },
          },
        },
      },
      {
        $addFields: {
          idle: { $sum: '$idle.idleTime' },
        },
      },
      {
        $group: {
          _id: '$_id.date',
          series: {
            $push: {
              name: '$_id.department',
              value: {
                $round: [{ $divide: ['$idle', 60] }, 2],
              },
            },
          },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    for (let i = 0; i < idle_count.length; i++) {
      let series = idle_count[i].series;

      departmentsArray.map((item) => {
        let departmentFound = false;
        for (let i = 0; i < series.length; i++) {
          let element = series[i];
          departmentFound = element['name'] === item.name;
          if (departmentFound) {
            break;
          }
        }
        if (!departmentFound) {
          series.push({ name: item.name, value: 0 });
        }
      });
    }
    return res.status(200).json({
      message: 'Idle time fetched successfully',
      data: idle_count,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      code: 'SERVER_ERROR',
      description: 'something went wrong, Please try again',
    });
  }
};

const getBreakTimeByOrganization = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let assigned_to = req.assigned_to;
    let user_email = req.user_email;

    let { from, to } = req.body;

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
      date: {
        $gte: from,
        $lt: till,
      },
    };

    let break_data = await Activity.aggregate([
      {
        $match: query,
      },
      {
        $project: {
          _id: 0,
          breaks: 1,
          department: 1,
          date: 1,
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
            department: '$department',
            date: {
              $dateToString: {
                format: '%m-%d-%Y',
                date: '$date',
              },
            },
          },
          break: {
            $push: {
              minutes: '$breaks.minutes',
            },
          },
        },
      },

      {
        $group: {
          _id: '$_id.department',
          users: {
            $push: {
              name: '$_id.date',
              value: { $sum: '$break.minutes' },
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          name: '$_id',
          series: '$users',
        },
      },
      {
        $sort: {
          _id: 1,
        },
      },
    ]);

    return res.status(200).json({
      message: 'Breaks time fetched successfully',
      data: break_data,
    });
  } catch (error) {
    logger.error(error);

    return res.status(500).json({
      code: 'SERVER_ERROR',
      description: 'something went wrong, Please try again',
    });
  }
};

const summarizedDataOrganization = async (req, res, next) => {
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

    let userCountQuery = {
      organization: organization,
    };

    let users = await Users.aggregate([
      {
        $match: userCountQuery,
      },
      {
        $group: {
          _id: '$department',

          users: {
            $push: {
              user_email: '$user_email',
            },
          },
        },
      },
      {
        $project: {
          department: '$_id',
          total_users: { $size: '$users' },
        },
      },
      {
        $lookup: {
          from: 'activities',
          let: {
            department: '$department',
            startDate: from,
            endDate: till,
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$department', '$$department'] },
                    { $gte: ['$date', '$$startDate'] },
                    { $lt: ['$date', '$$endDate'] },
                  ],
                },
              },
            },
            {
              $unwind: {
                path: '$breaks',
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $project: {
                _id: 0,
                user_email: 1,
                breaks: 1,
                idleTime: 1,
              },
            },

            {
              $group: {
                _id: null,
                users: {
                  $push: {
                    user_email: '$user_email',
                  },
                },
                break: {
                  $push: {
                    minutes: '$breaks.minutes',
                  },
                },
                idle: {
                  $push: {
                    idleTime: '$idleTime',
                  },
                },
              },
            },
            {
              $project: {
                _id: 0,
                total_present: { $size: '$users' },
                idle: { $sum: '$idle.idleTime' },
                break: { $sum: '$break.minutes' },
              },
            },
          ],
          as: 'data',
        },
      },
      {
        $unwind: {
          path: '$data',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          break: '$data.break',
        },
      },
      {
        $addFields: {
          idle: '$data.idle',
        },
      },
      {
        $addFields: {
          count: '$data.total_present',
        },
      },
      {
        $lookup: {
          from: 'user_work_location',
          let: {
            department: '$department',
            startDate: from,
            endDate: till,
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$department', '$$department'] },
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
                work_location: 1,
              },
            },
            {
              $group: {
                _id: {
                  department: '$department',
                  user_email: '$user_email',
                  home: '$work_location',
                },
              },
            },
            {
              $group: {
                _id: null,
                home: {
                  $push: {
                    $cond: [
                      {
                        $and: [
                          {
                            $eq: ['$_id.home', 'Home'],
                          },
                        ],
                      },
                      {
                        user_email: '$_id.user_email',
                      },
                      '$$REMOVE',
                    ],
                  },
                },
                office: {
                  $push: {
                    $cond: [
                      {
                        $and: [
                          {
                            $eq: ['$_id.home', 'Office'],
                          },
                        ],
                      },
                      {
                        user_email: '$_id.user_email',
                      },
                      '$$REMOVE',
                    ],
                  },
                },
              },
            },
            {
              $project: {
                _id: 0,
                department: '$_id',
                home: { $size: '$home' },
                office: { $size: '$office' },
              },
            },
          ],
          as: 'wfh_wfo_data',
        },
      },
      {
        $unwind: {
          path: '$wfh_wfo_data',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          home_count: '$wfh_wfo_data.home',
        },
      },
      {
        $addFields: {
          office_count: '$wfh_wfo_data.office',
        },
      },
      {
        $project: {
          department: 1,
          total_users: 1,
          total_absent: 1,
          total_present: {
            $cond: { if: '$count', then: '$count', else: 0 },
          },
          break: {
            $cond: { if: '$break', then: '$break', else: 0 },
          },
          idle: {
            $cond: { if: '$idle', then: '$idle', else: 0 },
          },
          home_count: {
            $cond: { if: '$home_count', then: '$home_count', else: 0 },
          },
          office_count: {
            $cond: { if: '$office_count', then: '$office_count', else: 0 },
          },
        },
      },
      {
        $addFields: {
          total_absent: { $subtract: ['$total_users', '$total_present'] },
        },
      },
      {
        $lookup: {
          from: 'configurations',
          let: {
            department: '$department',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$department', '$$department'] }],
                },
              },
            },
            {
              $group: {
                _id: {
                  productivity: '$productivity.work_hours',
                  work_hrs_in_sec: {
                    $multiply: ['$productivity.work_hours', 60, 60],
                  },
                },
              },
            },
            {
              $project: {
                _id: 0,
                productivity: '$_id.productivity',
                work_hrs_in_sec: '$_id.work_hrs_in_sec',
                over_work_30_min: { $add: ['$_id.work_hrs_in_sec', 1800] },
                under_work_30_min: {
                  $subtract: ['$_id.work_hrs_in_sec', 1800],
                },
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
          department: 1,
          total_users: 1,
          total_present: 1,
          total_absent: 1,
          break: 1,
          idle: 1,
          home_count: 1,
          office_count: 1,
          work_hrs_in_sec: {
            $cond: {
              if: '$config.work_hrs_in_sec',
              then: '$config.work_hrs_in_sec',
              else: 0,
            },
          },
          over_work_30_min: {
            $cond: {
              if: '$config.over_work_30_min',
              then: '$config.over_work_30_min',
              else: 0,
            },
          },
          under_work_30_min: {
            $cond: {
              if: '$config.under_work_30_min',
              then: '$config.under_work_30_min',
              else: 0,
            },
          },
        },
      },
      {
        $lookup: {
          from: 'activities',
          let: {
            department: '$department',
            startDate: from,
            endDate: till,
            over_work_30_min: '$over_work_30_min',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$department', '$$department'] },
                    { $gte: ['$date', '$$startDate'] },
                    { $lt: ['$date', '$$endDate'] },
                    { $gt: ['$loginHours', '$$over_work_30_min'] },
                  ],
                },
              },
            },
            {
              $project: {
                _id: 0,
                user_email: 1,
                loginHours: 1,
              },
            },

            {
              $group: {
                _id: null,
                users: {
                  $push: {
                    user_email: '$user_email',
                  },
                },
              },
            },
            {
              $project: {
                _id: 0,
                over: { $size: '$users' },
              },
            },
          ],
          as: 'over',
        },
      },
      {
        $unwind: {
          path: '$over',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'activities',
          let: {
            department: '$department',
            startDate: from,
            endDate: till,
            under_work_30_min: '$under_work_30_min',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$department', '$$department'] },
                    { $gte: ['$date', '$$startDate'] },
                    { $lt: ['$date', '$$endDate'] },
                    { $lt: ['$loginHours', '$$under_work_30_min'] },
                  ],
                },
              },
            },
            {
              $project: {
                _id: 0,
                user_email: 1,
                loginHours: 1,
              },
            },

            {
              $group: {
                _id: null,
                users: {
                  $push: {
                    user_email: '$user_email',
                  },
                },
              },
            },
            {
              $project: {
                _id: 0,
                under: { $size: '$users' },
              },
            },
          ],
          as: 'under',
        },
      },
      {
        $unwind: {
          path: '$under',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'activities',
          let: {
            department: '$department',
            startDate: from,
            endDate: till,
            over_work_30_min: '$over_work_30_min',
            under_work_30_min: '$under_work_30_min',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$department', '$$department'] },
                    { $gte: ['$date', '$$startDate'] },
                    { $lt: ['$date', '$$endDate'] },
                    { $lt: ['$loginHours', '$$over_work_30_min'] },
                    { $gte: ['$loginHours', '$$under_work_30_min'] },
                  ],
                },
              },
            },
            {
              $project: {
                _id: 0,
                user_email: 1,
                loginHours: 1,
              },
            },

            {
              $group: {
                _id: null,
                users: {
                  $push: {
                    user_email: '$user_email',
                  },
                },
              },
            },
            {
              $project: {
                _id: 0,
                adequate: { $size: '$users' },
              },
            },
          ],
          as: 'adequate',
        },
      },
      {
        $unwind: {
          path: '$adequate',
          preserveNullAndEmptyArrays: true,
        },
      },

      {
        $project: {
          _id: 0,
          department: 1,
          total_users: 1,
          total_present: 1,
          total_absent: 1,
          break: 1,
          idle: 1,
          home_count: 1,
          office_count: 1,
          over_work: {
            $cond: { if: '$over.over', then: '$over.over', else: 0 },
          },
          under_work: {
            $cond: { if: '$under.under', then: '$under.under', else: 0 },
          },
          adequate_work: {
            $cond: {
              if: '$adequate.adequate',
              then: '$adequate.adequate',
              else: 0,
            },
          },
        },
      },
      {
        $addFields: {
          total_for_over_under: {
            $add: ['$over_work', '$under_work', '$adequate_work'],
          },
        },
      },
      {
        $project: {
          _id: 0,
          department: 1,
          total_users: 1,
          total_present: 1,
          total_absent: 1,
          break: 1,
          idle: 1,
          home_count: 1,
          office_count: 1,
          over_work_percentage: {
            $round: [
              {
                $cond: {
                  if: '$over_work',
                  then: {
                    $multiply: [
                      { $divide: ['$over_work', '$total_for_over_under'] },
                      100,
                    ],
                  },
                  else: 0,
                },
              },
              1,
            ],
          },
          under_work_percentage: {
            $round: [
              {
                $cond: {
                  if: '$under_work',
                  then: {
                    $multiply: [
                      { $divide: ['$under_work', '$total_for_over_under'] },
                      100,
                    ],
                  },
                  else: 0,
                },
              },
              0,
            ],
          },
          adequate_work_percentage: {
            $cond: {
              if: '$adequate_work',
              then: {
                $multiply: [
                  { $divide: ['$adequate_work', '$total_for_over_under'] },
                  100,
                ],
              },
              else: 0,
            },
          },
        },
      },
    ]);

    return res.status(200).json({
      message: 'Present Vs Absent count fetched successfully',
      data: users,
    });
  } catch (error) {
    logger.error(error);

    return res.status(500).json({
      code: 'SERVER_ERROR',
      description: 'something went wrong, Please try again',
    });
  }
};
module.exports = {
  getPresentVsAbsentByOrganization: getPresentVsAbsentByOrganization,
  getWfhVsWfoByOrganization: getWfhVsWfoByOrganization,
  getIdleTimeByOrganization: getIdleTimeByOrganization,
  getBreakTimeByOrganization: getBreakTimeByOrganization,
  summarizedDataOrganization: summarizedDataOrganization,
};
