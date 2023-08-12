const express = require('express');
const mongoose = require('mongoose');
const Activity = require('../../../models/activity');
const Category = require('../../../models/app_web_category');
const Department = require('../../../models/department');
const AdminOrganization = require('../../../models/admin_organization');
const AuditOrganization = require('../../../models/audit_organization');
const Users = require('../../../models/users');
const WorkLocation = require('../../../models/user_work_location');
const Configuration = require('../../../models/configuration');
const const_config = require('../../../utility/util');
const Logger = require('../../../configs/log');
const logger = new Logger('organization');
const moment = require('moment-timezone');
const { parse } = require('json2csv');

const getProductivityByOrganization = async (req, res, next) => {
  try {

    let role = req.role
    let organization = req.organization
    let department = req.department
    let assigned_to = req.assigned_to
    let user_email = req.user_email

    let {
      from,
      to, report_type
    } = req.body;

    if (from === undefined || from === '') {
      return res.status(422).json({
        'code': 'REQUIRED_FIELD_MISSING',
        'description': 'From is required',
        'field': 'from'
      });
    }

    if (to === undefined || to === '') {
      return res.status(422).json({
        'code': 'REQUIRED_FIELD_MISSING',
        'description': 'TO is required',
        'field': 'to'
      });
    }


    let jDateToday = new Date(from)
    let jDateTill = new Date(to)
    let time_zone = req.timezone
    let time_zone_name = moment.tz(time_zone).format('Z')

    let time_zone_name_char = time_zone_name.charAt(0);
    let till
    if ("+" === time_zone_name_char) {
      let local_date_from = moment(jDateToday).tz(time_zone)
      let local_date_till = moment(jDateTill).tz(time_zone)
      from = local_date_from.startOf('day').toDate()
      till = local_date_till.endOf('day').toDate()
    } else {
      from = moment(jDateToday).tz(time_zone).format('YYYY-MM-DDTHH:mm:ss.SSS[Z]')
      till = moment(jDateTill).endOf('day').tz(time_zone).format('YYYY-MM-DDTHH:mm:ss.SSS[Z]')
      from = new Date(from)
      till = new Date(till)
    }

    let query = null
    let departmentName
    let departmentsArray
    let inDepartments = []

    if (const_config.isAllowedRole(role, ["SUPER_ADMIN", "MANAGER"])) {
      departmentName = await Department.findOne({ organization }, 'department_array.name')
      for (let i = 0; i < departmentName.department_array.length; i++) {
        let element = departmentName.department_array[i].name;
        inDepartments.push(element)
        logger.debug("element", element)

      }

      departmentsArray = departmentName.department_array

      query = {
        'organization': organization,
        'department': { $in: inDepartments },
        'date': {
          "$gte": from,
          "$lt": till
        }
      }

    } else if (const_config.isAllowedRole(role, ["ADMIN"])) {

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
        'organization': organization,
        'department': { $in: inDepartments },
        'date': {
          "$gte": from,
          "$lt": till
        }
      }
    } else if (const_config.isAllowedRole(role, ["AUDIT"])) {

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
        'organization': organization,
        'department': { $in: inDepartments },
        'date': {
          "$gte": from,
          "$lt": till
        }
      }
    }

    let productivity = await Activity.aggregate([
      {
        $match: query
      },
      {
        $group: {
          _id: "$department",
          loginHours: {
            $sum: {
              $round: [{ "$divide": ["$loginHours", 60] }, 2]
            }
          },
        }
      },
      {
        $addFields: {
          days: {
            $dateDiff:
            {
              startDate: from,
              endDate: till,
              unit: "day"
            }
          },
        }
      },
      {
        $lookup: {
          from: 'users',
          let: {
            "department": "$_id",
            organization: organization,
            is_licensed: true
          },
          pipeline: [
            {
              "$match": {
                "$expr": {
                  "$and": [
                    { "$eq": ["$department", "$$department"] },
                    { "$eq": ["$organization", "$$organization"] },
                    { "$eq": ["$is_licensed", "$$is_licensed"] }
                  ]
                }
              }
            },
            {
              $project: {
                _id: 0,
                user_email: "$user_email",
              }
            },
            {
              $group: {
                _id: null,
                users: {
                  $push: {
                    user_email: "$user_email"
                  }
                }
              }
            },
            {
              $project: {
                _id: 0,
                total_users: { $size: "$users" },
              }
            },
          ],
          as: 'total_users'
        }
      },
      {
        $unwind: {
          path: "$total_users",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: 'configurations',
          let: {
            "department": "$_id",
            organization: organization
          },
          pipeline: [
            {
              "$match": {
                "$expr": {
                  "$and": [
                    { "$eq": ["$department", "$$department"] },
                    { "$eq": ["$organization", "$$organization"] }
                  ]
                }
              }
            },
            {
              $project: {
                _id: 0,
                productivity: 1
              }
            },
            {
              $group: {
                _id: "$productivity.work_hours"
              }
            },
          ],
          as: 'config'
        }
      },
      {
        $unwind: {
          path: "$config",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $addFields: {
          productivity: { $round: [{ "$multiply": [{ "$divide": ["$loginHours", { $multiply: [{ $multiply: ["$total_users.total_users", "$config._id", "$days"] }, 60] }] }, 100] }, 2] }
        }
      },
      {
        $project: {
          _id: 0,
          name: "$_id",
          productivity: "$productivity"
        }
      },
      {
        $sort: { name: 1 }
      },
      { "$match": { "productivity": { "$ne": 0 } } },
      { "$match": { "productivity": { "$ne": null } } },

    ]);

    if (report_type === "csv") {
      try {
        let reports = []
        for (let i = 0; i < productivity.length; i++) {

          let entry = {
            Organization: organization,
            Department: productivity[i].name,
            'Productivity Percentage': productivity[i].productivity,
            "Date Range(from - to)": moment(from).tz(time_zone).format('DD-MMM-YYYY') + " - " + moment(to).tz(time_zone).format('DD-MMM-YYYY')

          }
          reports.push(entry)
        }
        const fields = ['Organization', 'Department', 'Date Range(from - to)', 'Productivity Percentage'];
        const opts = { fields };
        const csv = parse(reports, opts);
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
        'message': 'Productivity fetched successfully',
        data: productivity
      });

    }

  } catch (error) {
    logger.error(error)

    return res.status(500).json({
      'code': 'SERVER_ERROR',
      'description': 'something went wrong, Please try again'
    });
  }
}

const getPresentVsAbsentByOrganization = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let assigned_to = req.assigned_to;
    let user_email = req.user_email;

    let { from, to, report_type, manager_name } = req.body;

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
    let departmentName;
    let departmentsArray;
    let inDepartments = [];

    if (const_config.isAllowedRole(role, ['SUPER_ADMIN', 'MANAGER'])) {
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

      query = {
        organization: organization,
        department: { $in: inDepartments },
        is_licensed: true,
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
        is_licensed: true,
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
        is_licensed: true,
      };
    }
    let reports = [];

    let users = await Users.aggregate([
      {
        $match: query,
      },
      {
        $group: {
          _id: '$department',
          users: {
            $sum: 1
          },
        },
      },
    ]);

    for (let i = 0; i < users.length; i++) {
      let active = await Activity.find({
        organization: organization,
        department: users[i]._id,
        date: {
          $gte: from,
          $lt: till,
        },
      }).distinct('user_email');;
      console.log("active", active)
      active = active.length

      let entry = {
        "_id": users[i]._id,
        "department": users[i]._id,
        "total_users": users[i].users,
        "total_present": active,
        "total_absent": users[i].users - active < 0 ? 0 : users[i].users - active
      }
      reports.push(entry)
    }
    if (report_type === 'csv') {
      try {

        const fields = [
          'department',
          'total_users',
          'total_present',
          'total_absent',
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
        message: 'Present Vs Absent count fetched successfully',
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


const getWfhVsWfoByOrganization = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let assigned_to = req.assigned_to;
    let user_email = req.user_email;

    let { from, to, report_type } = req.body;

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

    let query = null;
    let departmentName;
    let departmentsArray;
    let inDepartments = [];

    if (const_config.isAllowedRole(role, ['SUPER_ADMIN', 'MANAGER'])) {
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

    let home_office_count = await WorkLocation.aggregate([
      {
        $match: query,
      },
      {
        $group: {
          _id: '$department',
          home: {
            $sum: {
              $cond: [
                { $eq: ['$work_location', 'Home'] }, 1, 0
              ]
            }
          },

          office: {
            $sum: {
              $cond: [
                { $eq: ['$work_location', 'Office'] }, 1, 0
              ]
            }
          }

        },
      },
      {
        $project: {
          _id: 0,
          department: '$_id',
          home: '$home',
          office: '$office'
        },
      },
      {
        $match: {
          $expr: {
            $or: [{ $ne: ['$office', 0] }, { $ne: ['$home', 0] }],
          },
        },
      },
      {
        $sort: {
          department: 1,
        },
      },
    ]);
    let reports = [];

    if (report_type === 'csv') {
      try {
        for (let i = 0; i < home_office_count.length; i++) {
          let entry = {
            Organization: organization,
            Department: home_office_count[i].department,
            "Home Count": home_office_count[i].home,
            "Office count": home_office_count[i].office,
          };
          reports.push(entry);
        }

        const fields = ['Organization', 'Department', 'Home Count', 'Office count'];
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
        message: 'WFH and WFO data fetched successfully',
        data: home_office_count,
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
//done
const getIdleTimeByOrganization = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let assigned_to = req.assigned_to;
    let user_email = req.user_email;

    let { from, to, report_type } = req.body;

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

    let query = null;
    let departmentName;
    let departmentsArray;
    let inDepartments = [];


    if (const_config.isAllowedRole(role, ['SUPER_ADMIN', 'MANAGER'])) {
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

      query = {
        organization: organization,
        department: { $in: inDepartments },
        idleTime: { $ne: 0 },
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
        idleTime: { $ne: 0 },
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
        idleTime: { $ne: 0 },
        date: {
          $gte: from,
          $lt: till,
        },
      };
    }

    const startDate = moment(from, "MM-DD-YYYY").utc().startOf('day');
    const endDate = moment(to, "MM-DD-YYYY").utc().startOf('day');

    const date_array = [];
    let currentDate = startDate.add(1, 'day'); // Exclude the starting date

    while (currentDate <= endDate) {
      date_array.push(currentDate.utc().format("MM-DD-YYYY"));
      currentDate = currentDate.add(1, 'day');
    }


    logger.debug("date_array", date_array)
    //TODO: remove project
    let idle_count = await Activity.aggregate([
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
                timezone: time_zone
              },
            },
          },
          idle: {
            $sum: {
              $round: ['$idleTime', 0],
            },
          },
        },
      },
      {
        $group: {
          _id: '$_id.date',
          series: {
            $push: {
              name: '$_id.department',
              value: '$idle'
            },
          },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);
    let reports = []
    if (idle_count.length) {
      function addMissingDatesWithZero(date_array, data) {
        const result = date_array.map(date => {
          const existingEntry = data.find(item => item._id === date);
          return existingEntry
            ? existingEntry
            : { _id: date, series: data[0].series.map(series => ({ ...series, value: 0 })) };
        });

        return result;
      }

      const result = addMissingDatesWithZero(date_array, idle_count);


      function fillMissingValues(data, inDepartments) {
        const newData = [];

        data.forEach(entry => {
          const missingDepartments = inDepartments.filter(dep => !entry.series.some(item => item.name === dep));

          const newEntry = {
            _id: entry._id,
            series: [...entry.series]
          };

          missingDepartments.forEach(dep => {
            newEntry.series.push({
              name: dep,
              value: 0
            });
          });

          newData.push(newEntry);
        });

        return newData;
      }

      const updatedData = fillMissingValues(result, inDepartments);
      if (report_type === 'csv') {
        try {
          for (let i = 0; i < idle_count.length; i++) {
            for (let j = 0; j < idle_count[i].series.length; j++) {
              let entry = {
                Date: idle_count[i]._id,
                Name: idle_count[i].series[j].name,
                "Idle Minutes": idle_count[i].series[j].value,
                Organization: organization
              };
              reports.push(entry);
            }
          }

          const fields = ['Organization', 'Date', 'Name', 'Idle Minutes'];
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
          message: 'Idle time fetched successfully',
          data: updatedData.sort((a, b) => { return a._id - b._id; })
        });
      }
    } else {
      if (report_type === 'csv') {
        try {
          let reports = [];

          for (let i = 0; i < idle_count.length; i++) {
            for (let j = 0; j < idle_count[i].series.length; j++) {
              let entry = {
                Date: idle_count[i]._id,
                Name: idle_count[i].series[j].name,
                "Idle Minutes": idle_count[i].series[j].value,
                Organization: organization
              };
              reports.push(entry);
            }
          }

          const fields = ['Organization', 'Date', 'Name', 'Idle Minutes'];
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
          message: 'Idle time fetched successfully',
          data: []
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
//done
const getBreakTimeByOrganization = async (req, res, next) => {
  try {

    let role = req.role
    let organization = req.organization
    let department = req.department
    let assigned_to = req.assigned_to
    let user_email = req.user_email


    let {
      from,
      to, report_type
    } = req.body;

    if (from === undefined || from === '') {
      return res.status(422).json({
        'code': 'REQUIRED_FIELD_MISSING',
        'description': 'From is required',
        'field': 'from'
      });
    }

    if (to === undefined || to === '') {
      return res.status(422).json({
        'code': 'REQUIRED_FIELD_MISSING',
        'description': 'TO is required',
        'field': 'to'
      });
    }


    let jDateToday = new Date(from)
    let jDateTill = new Date(to)
    let time_zone = req.timezone
    let time_zone_name = moment.tz(time_zone).format('Z')

    let time_zone_name_char = time_zone_name.charAt(0);
    let till
    if ("+" === time_zone_name_char) {
      let local_date_from = moment(jDateToday).tz(time_zone)
      let local_date_till = moment(jDateTill).tz(time_zone)
      from = local_date_from.startOf('day').toDate()
      till = local_date_till.endOf('day').toDate()
    } else {
      from = moment(jDateToday).tz(time_zone).format('YYYY-MM-DDTHH:mm:ss.SSS[Z]')
      till = moment(jDateTill).endOf('day').tz(time_zone).format('YYYY-MM-DDTHH:mm:ss.SSS[Z]')
      from = new Date(from)
      till = new Date(till)
    }


    let query = null
    let departmentName
    let departmentsArray
    let inDepartments = []

    if (const_config.isAllowedRole(role, ["SUPER_ADMIN", "MANAGER"])) {
      departmentName = await Department.findOne({ organization }, 'department_array.name')
      for (let i = 0; i < departmentName.department_array.length; i++) {
        let element = departmentName.department_array[i].name;
        inDepartments.push(element)
      }
      departmentsArray = departmentName.department_array
      query = {
        'organization': organization,
        'department': { $in: inDepartments },
        breaks: { $exists: true, $ne: [] },
        'date': {
          "$gte": from,
          "$lt": till
        }
      }

    } else if (const_config.isAllowedRole(role, ["ADMIN"])) {

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
        'organization': organization,
        'department': { $in: inDepartments },
        breaks: { $exists: true, $ne: [] },
        'date': {
          "$gte": from,
          "$lt": till
        }
      }
    }
    else if (const_config.isAllowedRole(role, ["AUDIT"])) {

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
        'organization': organization,
        'department': { $in: inDepartments },
        breaks: { $exists: true, $ne: [] },
        'date': {
          "$gte": from,
          "$lt": till
        }
      }
    }

    logger.debug("departmentsArray", inDepartments)


    let break_data = await Activity.aggregate([
      {
        $match: query
      },
      {
        $unwind: {
          path: "$breaks",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $group: {
          _id: {
            department: "$department",
            date: {
              '$dateToString': {
                'format': "%m-%d-%Y",
                'date': "$date",
                timezone: time_zone

              }
            },
          },
          break: {
            $sum: {
              $round: ["$breaks.minutes", 0],
            },
          },
        }
      },
      {
        $group: {
          _id: "$_id.date",
          series: {
            $push: {
              name: "$_id.department",
              value: "$break"
            }
          }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ])

    const startDate = moment(from, "MM-DD-YYYY").utc().startOf('day');
    const endDate = moment(to, "MM-DD-YYYY").utc().startOf('day');

    const date_array = [];
    let currentDate = startDate.add(1, 'day'); // Exclude the starting date

    while (currentDate <= endDate) {
      date_array.push(currentDate.utc().format("MM-DD-YYYY"));
      currentDate = currentDate.add(1, 'day');
    }
    if (break_data.length) {
      function addMissingDatesWithZero(date_array, data) {
        const result = date_array.map(date => {
          const existingEntry = data.find(item => item._id === date);
          return existingEntry
            ? existingEntry
            : { _id: date, series: data[0].series.map(series => ({ ...series, value: 0 })) };
        });

        return result;
      }

      const result = addMissingDatesWithZero(date_array, break_data);



      function fillMissingValues(data, inDepartments) {
        const newData = [];

        data.forEach(entry => {
          const missingDepartments = inDepartments.filter(dep => !entry.series.some(item => item.name === dep));

          const newEntry = {
            _id: entry._id,
            series: [...entry.series]
          };

          missingDepartments.forEach(dep => {
            newEntry.series.push({
              name: dep,
              value: 0
            });
          });

          newData.push(newEntry);
        });

        return newData;
      }

      const updatedData = fillMissingValues(result, inDepartments);
      if (report_type === "csv") {

        try {

          let break_data = await Activity.aggregate([
            {
              $match: query
            }, {
              $project: {
                _id: 0,
                breaks: 1,
                department: 1,
                date: 1
              }
            },
            {
              $unwind: {
                path: "$breaks",
                preserveNullAndEmptyArrays: true
              }
            },
            {
              $group: {
                _id: {
                  department: "$department",
                  date: {
                    '$dateToString': {
                      'format': "%m-%d-%Y",
                      'date': "$date",
                      timezone: time_zone

                    }
                  },
                },
                break: {
                  $push: {
                    'minutes': "$breaks.minutes",
                  }
                }
              }
            },
            {
              $addFields: {
                break: { $sum: "$break.minutes" },
              }
            },
            {
              '$match': { 'break': { '$ne': 0 } }
            },
            {
              $sort: {
                '_id.date': 1
              }
            }

          ])

          let reports = []

          for (let i = 0; i < break_data.length; i++) {

            let entry = {
              Date: break_data[i]._id.date,
              Name: break_data[i]._id.department,
              "Break Minutes": break_data[i].break,
              Organization: organization
            };
            reports.push(entry);
          }

          const fields = ['Organization', 'Date', 'Name', 'Break Minutes'];
          const opts = { fields };
          const csv = parse(reports, opts);
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
          'message': 'Breaks time fetched successfully',
          data: updatedData.sort((a, b) => { return a._id - b._id; })
        });
      }

    } else {
      if (report_type === "csv") {

        try {
          let reports = []

          for (let i = 0; i < break_data.length; i++) {
            for (let j = 0; j < break_data[i].series.length; j++) {

              let entry = {
                Date: break_data[i]._id,
                Name: break_data[i].series[j].name,
                "Break Minutes": break_data[i].series[j].value,
                Organization: organization
              };
              reports.push(entry);
            }
          }

          const fields = ['Organization', 'Date', 'Name', 'Break Minutes'];
          const opts = { fields };
          const csv = parse(reports, opts);
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
          'message': 'Breaks time fetched successfully',
          data: [],
        });
      }

    }




  } catch (error) {
    logger.error(error)

    return res.status(500).json({
      'code': 'SERVER_ERROR',
      'description': 'something went wrong, Please try again'
    });
  }
}


const summarizedDataOrganization = async (req, res, next) => {
  try {

    let role = req.role

    let organization = req.organization
    let department = req.department
    let assigned_to = req.assigned_to
    let user_email = req.user_email

    let {
      from,
      to,
      skip,
      limit,
      manager_name,
      department_name,
      report_type
    } = req.body;

    if (from === undefined || from === '') {
      return res.status(422).json({
        'code': 'REQUIRED_FIELD_MISSING',
        'description': 'From is required',
        'field': 'from'
      });
    }
    if (to === undefined || to === '') {
      return res.status(422).json({
        'code': 'REQUIRED_FIELD_MISSING',
        'description': 'TO is required',
        'field': 'to'
      });
    }

    if (skip === undefined || skip === '') {
      return res.status(422).json({
        'code': 'REQUIRED_FIELD_MISSING',
        'description': 'Skip is required',
        'field': 'skip'
      });
    }
    if (limit === undefined || limit === '') {
      return res.status(422).json({
        'code': 'REQUIRED_FIELD_MISSING',
        'description': 'Limit is required',
        'field': 'limit'
      });
    }

    let time_zone = req.timezone
    let jDateToday = new Date(from)
    let jDateTill = new Date(to)
    let time_zone_name = moment.tz(time_zone).format('Z')
    let time_zone_name_char = time_zone_name.charAt(0);
    let till
    if ("+" === time_zone_name_char) {
      let local_date_from = moment(jDateToday).tz(time_zone)
      let local_date_till = moment(jDateTill).tz(time_zone)
      from = local_date_from.startOf('day').toDate()
      till = local_date_till.endOf('day').toDate()
    } else {
      from = moment(jDateToday).tz(time_zone).format('YYYY-MM-DDTHH:mm:ss.SSS[Z]')
      till = moment(jDateTill).endOf('day').tz(time_zone).format('YYYY-MM-DDTHH:mm:ss.SSS[Z]')
    }

    let query = null
    let departmentName
    let departmentsArray
    let inDepartments = []

    if (const_config.isAllowedRole(role, ["SUPER_ADMIN", "MANAGER"])) {
      departmentName = await Department.findOne({ organization }, 'department_array.name')
      for (let i = 0; i < departmentName.department_array.length; i++) {
        let element = departmentName.department_array[i].name;
        inDepartments.push(element)
        logger.debug("element", element)

      }

      departmentsArray = departmentName.department_array

      if (department_name === department_name) {
        query = {
          organization: organization,
          is_licensed: true,
          "$and": [
            {
              department: { $regex: department_name, $options: 'i' }
            },
            {
              'department': { $in: inDepartments }
            }
          ]
        }
      } else {
        query = {
          organization: organization,
          is_licensed: true,
          'department': { $in: inDepartments },
        }
      }

    } else if (const_config.isAllowedRole(role, ["ADMIN"])) {

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

      logger.debug("departmentsArray", inDepartments)

      if (department_name === department_name) {
        query = {
          organization: organization,
          is_licensed: true,
          "$and": [
            {
              department: { $regex: department_name, $options: 'i' }
            },
            {
              'department': { $in: inDepartments }
            }
          ]
        }
      } else {
        query = {
          organization: organization,
          'department': { $in: inDepartments },
          is_licensed: true
        }
      }
    } else if (const_config.isAllowedRole(role, ["AUDIT"])) {

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
        'organization': organization,
        'department': { $in: inDepartments },
        is_licensed: true
      }
    }

    let [users, total] = await Promise.all([
      Users.aggregate([
        {
          $match: query
        },
        {
          $group: {
            _id: "$department",
            users: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $lookup: {
            from: 'activities',
            let: {
              "department": "$_id",
              organization: organization,
              "startDate": from,
              "endDate": till
            },
            pipeline: [
              {
                "$match": {
                  "$expr": {
                    "$and": [
                      { "$eq": ["$organization", "$$organization"] },
                      { "$eq": ["$department", "$$department"] },
                      { "$gte": ["$date", "$$startDate"] },
                      { "$lt": ["$date", "$$endDate"] }
                    ]
                  }
                }
              },
              {
                $unwind: {
                  path: "$breaks",
                  preserveNullAndEmptyArrays: true
                }
              },
              {
                $group: {
                  _id: null,
                  users: { $addToSet: "$user_email" },
                  break: {
                    $sum: {
                      $round: ["$breaks.minutes", 0],
                    },
                  },
                  idle: {
                    $sum: {
                      $round: ['$idleTime', 0],
                    },
                  },
                  loginHours: {
                    $sum: {
                      $round: [{ "$divide": ["$loginHours", 60] }, 2],
                    },
                  },
                }
              },
              {
                $addFields: {
                  total_present: { $size: "$users" },
                }
              }
            ],
            as: 'data'
          }
        },
        {
          $unwind: {
            path: "$data",
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $lookup: {
            from: 'user_work_location',
            let: {
              "department": "$_id",
              organization: organization,
              "startDate": from,
              "endDate": till
            },
            pipeline: [
              {
                "$match": {
                  "$expr": {
                    "$and": [
                      { "$eq": ["$department", "$$department"] },
                      { "$eq": ["$organization", "$$organization"] },
                      { "$gte": ["$date", "$$startDate"] },
                      { "$lt": ["$date", "$$endDate"] }

                    ]
                  }
                }
              },
              {
                $group: {
                  _id: "$department",
                  home: {
                    $sum: {
                      $cond: [
                        { $eq: ['$work_location', 'Home'] }, 1, 0
                      ]
                    }
                  },
                  office: {
                    $sum: {
                      $cond: [
                        { $eq: ['$work_location', 'Office'] }, 1, 0
                      ]
                    }
                  }
                }
              },
              {
                $project: {
                  _id: 0,
                  department: "$_id",
                  home: "$home",
                  office: "$office"
                }
              },
            ],
            as: 'wfh_wfo_data'
          }
        },
        {
          $unwind: {
            path: "$wfh_wfo_data",
            preserveNullAndEmptyArrays: true
          }
        },

        {
          $lookup: {
            from: 'configurations',
            let: {
              "department": "$_id",
              organization: organization
            },
            pipeline: [
              {
                "$match": {
                  "$expr": {
                    "$and": [
                      { "$eq": ["$organization", "$$organization"] },
                      { "$eq": ["$department", "$$department"] },
                      { "$eq": ["$organization", "$$organization"] }
                    ]
                  }
                }
              },
              {
                $group: {
                  _id: {
                    productivity: "$productivity.work_hours",
                    work_hrs_in_sec: { $multiply: ["$productivity.work_hours", 60, 60] },
                  },
                },
              },
              {
                $project: {
                  _id: 0,
                  productivity: "$_id.productivity",
                  work_hrs_in_sec: "$_id.work_hrs_in_sec",
                  over_work_30_min: { $add: ["$_id.work_hrs_in_sec", 1800] },
                  under_work_30_min: { $subtract: ["$_id.work_hrs_in_sec", 1800] }
                }
              }
            ],
            as: 'config'
          }
        },
        {
          $unwind: {
            path: "$config",
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $project: {
            _id: 0,
            department: "$_id",
            loginHours: {
              $cond: { if: "$data.loginHours", then: "$data.loginHours", else: 0 }
            },
            total_users: "$users",
            total_absent: {
              $cond: { if: { $subtract: ["$total_users", "$total_present"] }, then: { $subtract: ["$total_users", "$total_present"] }, else: 0 }
            },
            total_present: {
              $cond: { if: "$data.total_present", then: "$data.total_present", else: 0 }
            },
            break: {
              $cond: { if: "$data.break", then: "$data.break", else: 0 }
            },
            idle: {
              $cond: { if: "$data.idle", then: "$data.idle", else: 0 }
            },
            home_count: {
              $cond: { if: "$wfh_wfo_data.home", then: "$wfh_wfo_data.home", else: 0 }
            },
            office_count: {
              $cond: { if: "$wfh_wfo_data.office", then: "$wfh_wfo_data.office", else: 0 }
            },
            work_hrs_in_sec: {
              $cond: { if: "$config.work_hrs_in_sec", then: "$config.work_hrs_in_sec", else: 0 }
            },
            over_work_30_min: {
              $cond: { if: "$config.over_work_30_min", then: "$config.over_work_30_min", else: 0 }
            },
            under_work_30_min: {
              $cond: { if: "$config.under_work_30_min", then: "$config.under_work_30_min", else: 0 }
            },
            days: {
              $dateDiff:
              {
                startDate: from,
                endDate: till,
                unit: "day"
              }
            },
            work_hours: "$config.productivity"
          }
        },
        {
          $lookup: {
            from: 'activities',
            let: {
              "department": "$department",
              organization: organization,
              "startDate": from,
              "endDate": till,
              "over_work_30_min": "$over_work_30_min"
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
                      { "$gt": ["$loginHours", "$$over_work_30_min"] },
                    ]
                  }
                }
              },
              {
                $group: {
                  _id: null,
                  users: { $addToSet: '$user_email' },
                }
              },
              {
                $project: {
                  _id: 0,
                  over: { $size: "$users" }
                }
              },
            ],
            as: 'over'
          }
        },
        {
          $unwind: {
            path: "$over",
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $lookup: {
            from: 'activities',
            let: {
              "department": "$department",
              organization: organization,
              "startDate": from,
              "endDate": till,
              "under_work_30_min": "$under_work_30_min"
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
                      { "$lt": ["$loginHours", "$$under_work_30_min"] },
                    ]
                  }
                }
              },
              {
                $group: {
                  _id: null,
                  users: { $addToSet: '$user_email' },
                }
              },
              {
                $project: {
                  _id: 0,
                  under: { $size: "$users" }
                }
              },
            ],
            as: 'under'
          }
        },
        {
          $unwind: {
            path: "$under",
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $lookup: {
            from: 'activities',
            let: {
              "department": "$department",
              organization: organization,
              "startDate": from,
              "endDate": till,
              "over_work_30_min": "$over_work_30_min",
              "under_work_30_min": "$under_work_30_min"

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
                      { "$lt": ["$loginHours", "$$over_work_30_min"] },
                      { "$gte": ["$loginHours", "$$under_work_30_min"] },

                    ]
                  }
                }
              },
              {
                $group: {
                  _id: null,
                  users: { $addToSet: '$user_email' },
                }
              },
              {
                $project: {
                  _id: 0,
                  adequate: { $size: "$users" }
                }
              },
            ],
            as: 'adequate'
          }
        },
        {
          $unwind: {
            path: "$adequate",
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $addFields: {
            total_for_over_under: {
              $add: [{
                $cond: { if: "$over.over", then: "$over.over", else: 0 }
              }, {
                $cond: { if: "$under.under", then: "$under.under", else: 0 }
              }, {
                $cond: { if: "$adequate.adequate", then: "$adequate.adequate", else: 0 }
              }]
            },
          }
        },

        {
          $addFields: {
            productivity: {
              $round: [{ "$multiply": [{ "$divide": ["$loginHours", { $multiply: [{ $multiply: ["$total_users", "$work_hours", "$days"] }, 60] }] }, 100] }, 2]
            }
          }
        },
        {
          $addFields: {
            over_work: {
              $cond: { if: "$over.over", then: "$over.over", else: 0 }
            },
          }
        },
        {
          $addFields: {
            under_work: {
              $cond: { if: "$under.under", then: "$under.under", else: 0 }
            },
          }
        }, {
          $addFields: {
            adequate_work: {
              $cond: {
                if: "$adequate.adequate", then: "$adequate.adequate", else: 0
              }
            },
          }
        },
        {
          $project: {
            _id: 0,
            department: 1,
            total_users: 1,
            total_present: 1,
            total_absent: {
              $cond: {
                if: { $lt: ['$total_absent', 0] },
                then: 0,
                else: '$total_absent'
              }
            },
            break: 1,
            idle: 1,
            home_count: 1,
            office_count: 1,
            expected_work_hours_min: 1,
            over_work_percentage: {
              $round: [{
                $cond: {
                  if: {
                    $cond: { if: "$over.over", then: "$over.over", else: 0 }
                  }, then: {
                    "$multiply": [{
                      "$divide": [{
                        $cond: { if: "$over.over", then: "$over.over", else: 0 }
                      }, { $add: ["$over_work", "$under_work", "$adequate_work"] }]
                    }, 100]
                  }, else: 0
                }
              }, 2],
            },
            under_work_percentage: {
              $round: [{
                $cond: {
                  if: {
                    $cond: { if: "$under.under", then: "$under.under", else: 0 }
                  }, then: {
                    "$multiply": [{
                      "$divide": [{
                        $cond: { if: "$under.under", then: "$under.under", else: 0 }
                      }, { $add: ["$over_work", "$under_work", "$adequate_work"] }]
                    }, 100]
                  }, else: 0
                }
              }, 2]
            },
            adequate_work_percentage: {
              $round: [{
                $cond: {
                  if: {
                    $cond: { if: "$adequate.adequate", then: "$adequate.adequate", else: 0 }
                  }, then: {
                    "$multiply": [{
                      "$divide": [{
                        $cond: { if: "$adequate.adequate", then: "$adequate.adequate", else: 0 }
                      }, { $add: ["$over_work", "$under_work", "$adequate_work"] }]
                    }, 100]
                  }, else: 0
                }
              }, 2]
            },
            cong: "$config._id",
            days: "$days",
            productivity: "$productivity"
          },
        },
        {
          $sort: {
            "productivity": -1
          }
        }
      ]),
      Users.aggregate([
        {
          $match: query
        },
        {
          $group: {
            _id: "$department",
            users: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } },
      ])
    ])

    let reports = []

    for (let i = 0; i < users.length; i++) {
      if (users[i].productivity === null) {
        users[i].productivity = 0
      }

      let Break_Time_Minutes = users[i].break
      var num = Break_Time_Minutes;
      var hours = (num / 60);
      var rhours = Math.floor(hours);
      var break_minutes = (hours - rhours) * 60;
      var rminutes = Math.round(break_minutes);
      Break_Time_Minutes = rhours + ":" + rminutes;

      let Idle_Time_Minutes = users[i].idle
      var num12 = Idle_Time_Minutes;
      var hours12 = (num12 / 60);
      var rhours12 = Math.floor(hours12);
      var idle_minutes = (hours12 - rhours12) * 60;
      var rminutes12 = Math.round(idle_minutes);
      Idle_Time_Minutes = rhours12 + ":" + rminutes12;


      let entry = {
        department: users[i].department,
        productivity_percentage: users[i].productivity,
        total_users: users[i].total_users,
        total_present: users[i].total_present,
        total_absent: users[i].total_absent,
        idle_min: Idle_Time_Minutes,
        break_min: Break_Time_Minutes,
        adequate_work_percentage: users[i].adequate_work_percentage,
        over_work_percentage: users[i].over_work_percentage,
        under_work_percentage: users[i].under_work_percentage,
        wfh_wfo: users[i].home_count + "/" + users[i].office_count
      }
      reports.push(entry)
    }

    if (report_type === "csv") {
      try {
        let reports = []

        for (let i = 0; i < users.length; i++) {
          if (users[i].productivity === null) {
            users[i].productivity = 0
          }

          let Break_Time_Minutes = users[i].break
          var num = Break_Time_Minutes;
          var hours = (num / 60);
          var rhours = Math.floor(hours);
          var break_minutes = (hours - rhours) * 60;
          var rminutes = Math.round(break_minutes);
          Break_Time_Minutes = rhours + ":" + rminutes;

          let Idle_Time_Minutes = users[i].idle
          var num12 = Idle_Time_Minutes;
          var hours12 = (num12 / 60);
          var rhours12 = Math.floor(hours12);
          var idle_minutes = (hours12 - rhours12) * 60;
          var rminutes12 = Math.round(idle_minutes);
          Idle_Time_Minutes = rhours12 + ":" + rminutes12;


          let entry = {
            Organization: organization,
            Department: users[i].department,
            "Date Range(from - to)": moment(from).tz(time_zone).format('DD-MMM-YYYY') + " - " + moment(to).tz(time_zone).format('DD-MMM-YYYY'),
            "Productivity (%)": users[i].productivity,
            "Total Users": users[i].total_users,
            "Total Present": users[i].total_present,
            "Total Absent": users[i].total_absent,
            "Idle Time(hh:mm)": Idle_Time_Minutes,
            "Break Time(hh:mm": Break_Time_Minutes,
            "Adequate (%)": users[i].adequate_work_percentage,
            "Over Utilized (%)": users[i].over_work_percentage,
            "Under Utilized (%)": users[i].under_work_percentage,
            "WFH/WFO": users[i].home_count + "/" + users[i].office_count
          }
          reports.push(entry)
        }
        const fields = ['Organization', 'Department', 'Productivity (%)', 'Total Users', 'Total Present', 'Total Absent', 'Idle Time(hh:mm)', 'Break Time(hh:mm', 'Adequate (%)', 'Over Utilized (%)', 'Under Utilized (%)', 'WFH/WFO'];
        const opts = { fields };
        const csv = parse(reports, opts);
        return res.status(200).send(csv);

      } catch (err) {
        logger.error(err);
        return res.status(500).json({
          'code': 'SERVER_ERROR',
          'description': 'something went wrong, Please try again'
        });
      }
    } else {

      return res.status(200).json({
        'message': 'Department wise data fetched successfully',
        data: reports.sort((a, b) => { return a._id - b._id; }),
        total: total.length
      });

    }


  } catch (error) {
    logger.error(error)

    return res.status(500).json({
      'code': 'SERVER_ERROR',
      'description': 'something went wrong, Please try again'
    });
  }
}

const getWebProductivityByOrganization = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let assigned_to = req.assigned_to;
    let user_email = req.user_email;

    let { from, to, report_type } = req.body;

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

    let query = null;
    let departmentName;
    let departmentsArray;
    let inDepartments = [];

    if (const_config.isAllowedRole(role, ['SUPER_ADMIN', 'MANAGER'])) {
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

    let web_data = await Activity.aggregate([
      {
        $match: query,
      },
      {
        $unwind: '$visitedWeb',
      },
      {
        $group: {
          _id: {
            is_productive: '$visitedWeb.is_productive',
            category: '$visitedWeb.category',
            name: '$visitedWeb.domain',
          },
          totalMinutes: {
            $sum: {
              $divide: [
                { $subtract: ['$visitedWeb.endTime', '$visitedWeb.startTime'] },
                1000 * 60,
              ],
            },
          },


        },
      },
      {
        $project: {
          _id: 0,
          organization: organization,
          is_productive: '$_id.is_productive',
          totalMinutes: {
            $round: ["$totalMinutes", 0],
          },
          name: '$_id.name',
        },
      },
      {
        '$match': { 'totalMinutes': { '$ne': 0 } }
      },
      {
        $sort: { totalMinutes: -1 },
      },
      {
        $group: {
          _id: null,
          productive: {
            $push: {
              $cond: [
                {
                  $eq: ['$is_productive', true],
                },
                {
                  name: '$name',
                  minutes: '$totalMinutes',
                },
                '$$REMOVE',
              ],
            },
          },
          un_productive: {
            $push: {
              $cond: [
                {
                  $and: [
                    {
                      $eq: ['$is_productive', false],
                    },
                  ],
                },
                {
                  name: '$name',
                  minutes: '$totalMinutes',
                },
                '$$REMOVE',
              ],
            },
          },
        }
      },
      {
        $sort: { 'un_productive.minutes': -1 },
      },
      {
        $sort: { 'productive.minutes': -1 },
      },
      {
        $project: {
          _id: 0,
          organization: organization,
          productive: {
            $slice: ['$productive', 0, 10],
          },
          un_productive: {
            $slice: ['$un_productive', 0, 10],
          },
        },
      },
    ]);
    let total_prod = 0;
    let total_un_prod = 0;

    let reports = [];
    let reports1 = [];

    for (let i = 0; i < web_data.length; i++) {
      for (let j = 0; j < web_data[i].productive.length; j++) {
        total_prod = total_prod + web_data[i].productive[j].minutes;
      }
    }

    for (let i = 0; i < web_data.length; i++) {
      for (let j = 0; j < web_data[i].productive.length; j++) {
        let productivity_cal = web_data[i].productive[j].minutes;
        let productivity_per = ((productivity_cal / total_prod) * 100).toFixed(
          2
        );

        let entry = {
          name: web_data[i].productive[j].name,
          percentage: Number(productivity_per),
        };
        reports.push(entry);
      }
    }

    for (let i = 0; i < web_data.length; i++) {
      for (let j = 0; j < web_data[i].un_productive.length; j++) {
        total_un_prod = total_un_prod + web_data[i].un_productive[j].minutes;
      }
    }

    for (let i = 0; i < web_data.length; i++) {
      for (let j = 0; j < web_data[i].un_productive.length; j++) {
        let productivity_cal = web_data[i].un_productive[j].minutes;
        let productivity_per = (
          (productivity_cal / total_un_prod) *
          100
        ).toFixed(2);


        let entry = {
          name: web_data[i].un_productive[j].name,
          percentage: Number(productivity_per),
        };
        reports1.push(entry);
      }
    }

    if (report_type === 'csv') {
      try {
        let total_prod = 0;
        let total_un_prod = 0;

        let reports = [];
        let reports1 = [];
        for (let i = 0; i < web_data.length; i++) {
          for (let j = 0; j < web_data[i].productive.length; j++) {
            total_prod = total_prod + web_data[i].productive[j].minutes;
          }
        }

        for (let i = 0; i < web_data.length; i++) {
          for (let j = 0; j < web_data[i].productive.length; j++) {
            let productivity_cal = web_data[i].productive[j].minutes;
            let productivity_per = (
              (productivity_cal / total_prod) *
              100
            ).toFixed(2);

            let entry = {
              name: web_data[i].productive[j].name,
              productive_percentage: Number(productivity_per),
            };
            reports.push(entry);
          }
        }

        for (let i = 0; i < web_data.length; i++) {
          for (let j = 0; j < web_data[i].un_productive.length; j++) {
            total_un_prod =
              total_un_prod + web_data[i].un_productive[j].minutes;
          }
        }

        for (let i = 0; i < web_data.length; i++) {
          for (let j = 0; j < web_data[i].un_productive.length; j++) {
            let productivity_cal = web_data[i].un_productive[j].minutes;
            let productivity_per = (
              (productivity_cal / total_un_prod) *
              100
            ).toFixed(2);

            let entry = {
              name: web_data[i].un_productive[j].name,
              un_productive_percentage: Number(productivity_per),
            };
            reports1.push(entry);
          }
        }
        let array3 = reports.concat(reports1);

        let response = [];
        for (let i = 0; i < array3.length; i++) {
          let entry = {
            Name: array3[i].name,
            Productive: array3[i].productive_percentage,
            'Non Productive': array3[i].un_productive_percentage,
          };
          response.push(entry);
        }

        const fields = ['Name', 'Productive', 'Non Productive'];
        const opts = { fields };
        const csv = parse(response, opts);
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
        message: 'Get Web productive and un-productive fetched successfully',
        productive: reports,
        un_productive: reports1,
        // web_data: web_data
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

const getAppProductivityOrganization = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let assigned_to = req.assigned_to;
    let user_email = req.user_email;

    let { from, to, report_type } = req.body;

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

    let query = null;
    let departmentName;
    let departmentsArray;
    let inDepartments = [];

    if (const_config.isAllowedRole(role, ['SUPER_ADMIN', 'MANAGER'])) {
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

    let app_data = await Activity.aggregate([
      {
        $match: query,
      },
      {
        $project: {
          _id: 0,
          activeApps: 1,
        },
      },
      {
        $unwind: '$activeApps',
      },

      {
        $group: {
          _id: {
            is_productive: '$activeApps.is_productive',
            category: '$activeApps.category',
            name: '$activeApps.name',
          },
          totalMinutes: {
            $sum: {
              $divide: [
                { $subtract: ['$activeApps.endTime', '$activeApps.startTime'] },
                1000 * 60,
              ],
            },
          },
        },
      },

      {
        $project: {
          _id: 0,
          organization: organization,
          is_productive: '$_id.is_productive',
          totalMinutes: {
            $round: ['$totalMinutes', 0],
          },
          name: '$_id.name',
        },
      },
      {
        '$match': { 'totalMinutes': { '$ne': 0 } }
      },
      {
        $sort: { totalMinutes: -1 },
      },
      {
        $group: {
          _id: null,
          productive: {
            $push: {
              $cond: [
                {
                  $eq: ['$is_productive', true],
                },
                {
                  name: '$name',
                  minutes: '$totalMinutes',
                },
                '$$REMOVE',
              ],
            },
          },
          un_productive: {
            $push: {
              $cond: [
                {
                  $and: [
                    {
                      $eq: ['$is_productive', false],
                    },
                  ],
                },
                {
                  name: '$name',
                  minutes: '$totalMinutes',
                },
                '$$REMOVE',
              ],
            },
          },
        },
      },
      {
        $sort: { 'un_productive.minutes': -1 },
      },
      {
        $sort: { 'productive.minutes': -1 },
      },
      {
        $project: {
          _id: 0,
          organization: organization,
          productive: {
            $slice: ['$productive', 0, 10],
          },
          un_productive: {
            $slice: ['$un_productive', 0, 10],
          },
        },
      },

    ]);

    let total_prod = 0;
    let total_un_prod = 0;

    let reports = [];
    let reports1 = [];

    for (let i = 0; i < app_data.length; i++) {
      for (let j = 0; j < app_data[i].productive.length; j++) {
        total_prod = total_prod + app_data[i].productive[j].minutes;
      }
    }

    for (let i = 0; i < app_data.length; i++) {
      for (let j = 0; j < app_data[i].productive.length; j++) {
        let productivity_cal = app_data[i].productive[j].minutes;
        let productivity_per = ((productivity_cal / total_prod) * 100).toFixed(
          2
        );

        let entry = {
          name: app_data[i].productive[j].name,
          percentage: Number(productivity_per),
        };
        reports.push(entry);
      }
    }

    for (let i = 0; i < app_data.length; i++) {
      for (let j = 0; j < app_data[i].un_productive.length; j++) {
        total_un_prod = total_un_prod + app_data[i].un_productive[j].minutes;
      }
    }

    logger.debug('total_un_prod,total_un_prod', total_un_prod);
    for (let i = 0; i < app_data.length; i++) {
      for (let j = 0; j < app_data[i].un_productive.length; j++) {
        let productivity_cal = app_data[i].un_productive[j].minutes;
        let productivity_per = (
          (productivity_cal / total_un_prod) *
          100
        ).toFixed(2);

        let entry = {
          name: app_data[i].un_productive[j].name,
          percentage: Number(productivity_per),
        };
        reports1.push(entry);
      }
    }

    if (report_type === 'csv') {
      try {
        let total_prod = 0;
        let total_un_prod = 0;

        let reports = [];
        let reports1 = [];

        for (let i = 0; i < app_data.length; i++) {
          for (let j = 0; j < app_data[i].productive.length; j++) {
            total_prod = total_prod + app_data[i].productive[j].minutes;
          }
        }

        for (let i = 0; i < app_data.length; i++) {
          for (let j = 0; j < app_data[i].productive.length; j++) {
            let productivity_cal = app_data[i].productive[j].minutes;
            let productivity_per = (
              (productivity_cal / total_prod) *
              100
            ).toFixed(2);

            let entry = {
              name: app_data[i].productive[j].name,
              productive_percentage: Number(productivity_per),
            };
            reports.push(entry);
          }
        }

        for (let i = 0; i < app_data.length; i++) {
          for (let j = 0; j < app_data[i].un_productive.length; j++) {
            total_un_prod =
              total_un_prod + app_data[i].un_productive[j].minutes;
          }
        }

        for (let i = 0; i < app_data.length; i++) {
          for (let j = 0; j < app_data[i].un_productive.length; j++) {
            let productivity_cal = app_data[i].un_productive[j].minutes;
            let productivity_per = (
              (productivity_cal / total_un_prod) *
              100
            ).toFixed(2);

            let entry = {
              name: app_data[i].un_productive[j].name,
              un_productive_percentage: Number(productivity_per),
            };
            reports1.push(entry);
          }
        }

        let array3 = reports.concat(reports1);

        let response = [];
        for (let i = 0; i < array3.length; i++) {
          let entry = {
            Name: array3[i].name,
            Productive: array3[i].productive_percentage,
            'Non Productive': array3[i].un_productive_percentage,
          };
          response.push(entry);
        }

        const fields = ['Name', 'Productive', 'Non Productive'];
        const opts = { fields };
        const csv = parse(response, opts);
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
        message: 'Get App productive and un-productive fetched successfully',
        productive: reports,
        un_productive: reports1,
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

const getLoggedInNotLoggedInByOrganization = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let assigned_to = req.assigned_to;
    let user_email = req.user_email;

    let { from, to, report_type, manager_name } = req.body;

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
    let departmentName;
    let departmentsArray;
    let inDepartments = [];

    if (const_config.isAllowedRole(role, ['SUPER_ADMIN', 'MANAGER'])) {
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

    let users = await Activity.aggregate([
      {
        $match: query,
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%m-%d-%Y',
              date: '$date',
              timezone: time_zone,
            },
          },
          users: { $addToSet: '$user_email' },
        },
      },

      {
        $lookup: {
          from: 'users',
          let: {
            organization: organization,
            is_licensed: true,
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$organization', '$$organization'] },
                    { $eq: ['$is_licensed', '$$is_licensed'] },
                  ],
                },
              },
            },
            {
              $match: {
                department: { $in: inDepartments },
              },
            },
            {
              $project: {
                _id: 0,
                user_email: 1,
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
                department: department,
                total_users: { $size: '$users' },
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
          total_present: { $size: '$users' },
        },
      },
      {
        $project: {
          _id: 0,
          date: '$_id',
          total_present: {
            $cond: {
              if: '$total_present',
              then: '$total_present',
              else: 0,
            },
          },
          total_users: '$data.total_users',
        },
      },
      {
        $addFields: {
          total_absent: { $subtract: ['$total_users', '$total_present'] },
        },
      },
      {
        $sort: {
          date: 1,
        },
      },
      {
        $project: {
          _id: 0,
          date: 1,
          total_users: 1,
          total_present: 1,
          total_absent: 1,
        },
      },
      { $match: { idle: { $ne: 0 } } },
    ]);

    let reports = [];
    if (report_type === 'csv') {
      try {
        for (i = 0; i < users.length; i++) {
          let entry = {
            organization: organization,
            date: users[i].date,
            total_users: users[i].total_users,
            total_present: users[i].total_present,
            total_absent: users[i].total_absent,
          };
          reports.push(entry);
        }

        const fields = [
          'organization',
          'date',
          'total_users',
          'total_present',
          'total_absent',
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
        message: 'Present Vs Absent count fetched successfully',
        data: users,
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

const getAppWebPerByOrganization = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let assigned_to = req.assigned_to;
    let user_email = req.user_email;

    let { from, to, report_type } = req.body;

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

    let query = null;
    let departmentName;
    let departmentsArray;
    let inDepartments = [];

    if (const_config.isAllowedRole(role, ['SUPER_ADMIN', 'MANAGER'])) {
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

    let web_app_per = await Activity.aggregate([
      {
        $match: query,
      },
      {
        $project: {
          _id: 0,
          activeApps: 1,
          visitedWeb: 1,
        },
      },
      {
        $project: {
          activeApps: { $setUnion: ['$activeApps', '$visitedWeb'] },
        },
      },
      {
        $unwind: '$activeApps',
      },
      {
        $group: {
          _id: {
            is_productive: '$activeApps.is_productive',
            name: '$activeApps.name',
          },
          totalMinutes: {
            $sum: {
              $divide: [
                { $subtract: ['$activeApps.endTime', '$activeApps.startTime'] },
                1000 * 60,
              ],
            },
          },
        },
      },
      {
        $group: {
          _id: null,
          productive: {
            $push: {
              $cond: [
                {
                  $eq: ['$_id.is_productive', true],
                },
                {
                  name: '$_id.name',
                  minutes: '$totalMinutes',
                },
                '$$REMOVE',
              ],
            },
          },
          un_productive: {
            $push: {
              $cond: [
                {
                  $and: [
                    {
                      $eq: ['$_id.is_productive', false],
                    },
                  ],
                },
                {
                  name: '$_id.name',
                  minutes: { $round: ['$totalMinutes', 1] },
                },
                '$$REMOVE',
              ],
            },
          },
        },
      },

      {
        $addFields: {
          prod: { $sum: '$productive.minutes' },
        },
      },
      {
        $addFields: {
          un_prod: { $sum: '$un_productive.minutes' },
        },
      },
      {
        $addFields: {
          total: { $add: ['$prod', '$un_prod'] },
        },
      },
      {
        $project: {
          _id: 0,
          organization: organization,
          productive_percentage: {
            $round: [
              {
                $cond: {
                  if: '$prod',
                  then: { $multiply: [{ $divide: ['$prod', '$total'] }, 100] },
                  else: 0,
                },
              },
              1,
            ],
          },
          unproductive_percentage: {
            $round: [
              {
                $cond: {
                  if: '$un_prod',
                  then: {
                    $multiply: [{ $divide: ['$un_prod', '$total'] }, 100],
                  },
                  else: 0,
                },
              },
              1,
            ],
          },
        },
      },
    ]);
    let reports = [];

    if (report_type === 'csv') {
      try {
        for (i = 0; i < web_app_per.length; i++) {
          let entry = {
            Organization: web_app_per[i].organization,
            'Productive Percentage': web_app_per[i].productive_percentage,
            'Non Productive Percentage': web_app_per[i].unproductive_percentage,
          };
          reports.push(entry);
        }

        const fields = [
          'Organization',
          'Productive Percentage',
          'Non Productive Percentage',
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
        message: 'Get Web app Percentage fetched successfully',
        data: web_app_per,
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

const getWorkHoursSummaryOrgDepMang = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;
    let assigned_to = req.assigned_to;

    let { from, to } = req.query;
    let { type, required_role, manager_name, report_type } = req.body;

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

    let departmentName;
    let departmentsArray;
    let inDepartments = [];

    if (type === 'ORGANIZATION') {
      let query = null;
      let departmentName;
      let departmentsArray;
      let inDepartments = [];

      if (const_config.isAllowedRole(role, ['SUPER_ADMIN', 'MANAGER'])) {
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

        query = {
          organization: organization,
          is_licensed: true,
          department: { $in: inDepartments },
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

        logger.debug('departmentsArray', inDepartments);

        query = {
          organization: organization,
          department: { $in: inDepartments },
          is_licensed: true,
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
          is_licensed: true,
        };
      }

      let users = await Users.aggregate([
        {
          $match: query,
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
            head_count: { $size: '$users' },
          },
        },
        {
          $lookup: {
            from: 'activities',
            let: {
              department: '$department',
              organization: organization,
              startDate: from,
              endDate: till,
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$organization', '$$organization'] },
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
                  loginHours: 1,
                },
              },

              {
                $group: {
                  _id: null,
                  users: { $addToSet: '$user_email' },
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
                  attendance_count: { $size: '$users' },
                  idle: { $sum: '$idle.idleTime' },
                  break: { $sum: '$break.minutes' },
                  loginHours: {
                    $round: [{ $divide: ['$loginHours', 60] }, 2],
                  },
                },
              },
              {
                $addFields: {
                  actual_productive_one: { $add: ['$idle', '$break'] },
                },
              },
              {
                $addFields: {
                  actual_productive_min: {
                    $subtract: ['$loginHours', '$actual_productive_one'],
                  },
                },
              },
              {
                $project: {
                  _id: 0,
                  attendance_count: 1,
                  idle: 1,
                  break: 1,
                  loginHours: 1,
                  actual_productive_min: 1,
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
            count: '$data.attendance_count',
          },
        },
        {
          $addFields: {
            total_login_min: '$data.loginHours',
          },
        },
        {
          $addFields: {
            actual_productive_min: '$data.actual_productive_min',
          },
        },
        {
          $project: {
            department: 1,
            total_login_min: '$total_login_min',
            head_count: 1,
            total_absent: 1,
            attendance_count: {
              $cond: { if: '$count', then: '$count', else: 0 },
            },
            break: {
              $cond: { if: '$break', then: '$break', else: 0 },
            },
            idle: {
              $cond: { if: '$idle', then: '$idle', else: 0 },
            },
            actual_productive_min: {
              $cond: {
                if: '$actual_productive_min',
                then: '$actual_productive_min',
                else: 0,
              },
            },
          },
        },
        {
          $lookup: {
            from: 'configurations',
            let: {
              department: '$department',
              organization: organization,
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$organization', '$$organization'] },
                      { $eq: ['$department', '$$department'] },
                      { $eq: ['$organization', '$$organization'] },
                    ],
                  },
                },
              },
              {
                $group: {
                  _id: {
                    productivity: '$productivity.work_hours',
                    work_hrs_in_min: {
                      $multiply: ['$productivity.work_hours', 60],
                    },
                  },
                },
              },
              {
                $project: {
                  _id: 0,
                  productivity: '$_id.productivity',
                  work_hrs_in_min: '$_id.work_hrs_in_min',
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
            head_count: 1,
            attendance_count: 1,
            total_login_min: {
              $cond: {
                if: '$total_login_min',
                then: '$total_login_min',
                else: 0,
              },
            },
            total_absent: {
              $cond: { if: '$total_absent', then: '$total_absent', else: 0 },
            },
            break: 1,
            idle: 1,
            work_hours: '$config.productivity',
            actual_productive_min: 1,
          },
        },
        {
          $project: {
            _id: 0,
            department: 1,
            total_login_min: 1,
            head_count: 1,
            attendance_count: 1,
            break: 1,
            idle: 1,
            work_hours: 1,
            actual_productive_min: 1,
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
            expected_work_hours: {
              $multiply: ['$head_count', '$work_hours', '$days'],
            },
          },
        },
        {
          $addFields: {
            expected_work_hours_activity: {
              $multiply: ['$work_hours', '$days', '$attendance_count'],
            },
          },
        },
        {
          $project: {
            _id: 0,
            department: 1,
            head_count: 1,
            attendance_count: 1,
            expected_work_hours: {
              $cond: {
                if: '$expected_work_hours',
                then: '$expected_work_hours',
                else: 0,
              },
            },
            expected_work_hours_activity: {
              $cond: {
                if: '$expected_work_hours_activity',
                then: '$expected_work_hours_activity',
                else: 0,
              },
            },
            idle: 1,
            break: 1,
            total_login_min: 1,
            actual_productive_min: 1,
          },
        },
      ]);

      let reports = [];

      let total_head_count = null;
      let total_attendance_count = null;
      let total_expected_work_hours = null;
      let total_expected_work_hours_activity = null;
      let total_idle_time_in_minutes = null;
      let total_total_logged_minutes = null;
      let total_actual_productive_minutes = null;
      let total_break_time_in_minutes = null;

      for (let i = 0; i < users.length; i++) {
        total_head_count = total_head_count + users[i].head_count;
        total_attendance_count =
          total_attendance_count + users[i].attendance_count;
        total_expected_work_hours =
          total_expected_work_hours + users[i].expected_work_hours;
        total_expected_work_hours_activity =
          total_expected_work_hours_activity +
          users[i].expected_work_hours_activity;
        total_idle_time_in_minutes = total_idle_time_in_minutes + users[i].idle;
        total_total_logged_minutes =
          total_total_logged_minutes + users[i].total_login_min;
        total_actual_productive_minutes =
          total_actual_productive_minutes + users[i].actual_productive_min;
        total_break_time_in_minutes =
          total_break_time_in_minutes + users[i].break;

        let entry = {
          organization: organization,
          department: users[i].department,
          head_count: users[i].head_count,
          attendance_count: users[i].attendance_count,
          expected_work_hours: users[i].expected_work_hours,
          expected_work_hours_activity: users[i].expected_work_hours_activity,
          idle_time_in_minutes: users[i].idle,
          total_logged_minutes: users[i].total_login_min,
          actual_productive_minutes: users[i].actual_productive_min,
          break_time_in_minutes: users[i].break,
        };
        reports.push(entry);
      }

      if (report_type === 'csv') {
        try {
          const hours = Math.floor(total_total_logged_minutes / 60);
          const minutes = Math.round(total_total_logged_minutes % 60);
          const formattedHours = hours.toString().padStart(2, '0');
          const formattedMinutes = minutes.toString().padStart(2, '0');
          const formattedTime = `${formattedHours}:${formattedMinutes}`;

          const hours1 = Math.floor(total_break_time_in_minutes / 60);
          const minutes1 = Math.round(total_break_time_in_minutes % 60);
          const formattedHours1 = hours1.toString().padStart(2, '0');
          const formattedMinutes1 = minutes1.toString().padStart(2, '0');
          const formattedTime1 = `${formattedHours1}:${formattedMinutes1}`;

          const hours2 = Math.floor(total_idle_time_in_minutes / 60);
          const minutes2 = Math.round(total_idle_time_in_minutes % 60);
          const formattedHours2 = hours2.toString().padStart(2, '0');
          const formattedMinutes2 = minutes2.toString().padStart(2, '0');
          const formattedTime2 = `${formattedHours2}:${formattedMinutes2}`;

          const hours3 = Math.floor(total_actual_productive_minutes / 60);
          const minutes3 = Math.round(total_actual_productive_minutes % 60);
          const formattedHours3 = hours3.toString().padStart(2, '0');
          const formattedMinutes3 = minutes3.toString().padStart(2, '0');
          const formattedTime3 = `${formattedHours3}:${formattedMinutes3}`;

          var hoursInt = Math.floor(total_expected_work_hours);
          var minutes4 = Math.round(
            (total_expected_work_hours - hoursInt) * 60
          );
          var hoursString = hoursInt.toString().padStart(2, '0');
          var minutesString = minutes4.toString().padStart(2, '0');
          const formattedTime4 = `${hoursString}:${minutesString}`;

          var hoursInt = Math.floor(total_expected_work_hours_activity);
          var minutes5 = Math.round(
            (total_expected_work_hours_activity - hoursInt) * 60
          );
          var hoursString = hoursInt.toString().padStart(2, '0');
          var minutesString = minutes5.toString().padStart(2, '0');
          const formattedTime5 = `${hoursString}:${minutesString}`;

          let entry = [
            {
              Organization: organization,
              'Head Count': total_head_count,
              'Attendance Count': total_attendance_count,
              'Expected Work Hours(hh:mm)': formattedTime4,
              'Expected Productive Hours(hh:mm)': formattedTime5,
              'Actual Productive Hours(hh:mm)': formattedTime3,
              'Total Idle Hours(hh:mm)': formattedTime2,
              'Total Break Time(hh:mm)': formattedTime1,
              'Total Logged in Hours(hh:mm)': formattedTime,
            },
          ];
          const fields = [
            'Organization',
            'Head Count',
            'Attendance Count',
            'Expected Work Hours(hh:mm)',
            'Expected Productive Hours(hh:mm)',
            'Total Idle Hours(hh:mm)',
            'Total Logged in Hours(hh:mm)',
            'Actual Productive Hours(hh:mm)',
            'Total Break Time(hh:mm)',
          ];
          const opts = {
            fields,
          };
          const csv = parse(entry, opts);
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
            head_count: total_head_count,
            attendance_count: total_attendance_count,
            expected_work_hours: Math.round(total_expected_work_hours),
            expected_work_hours_activity: Math.round(
              total_expected_work_hours_activity
            ),
            idle_time_in_minutes: Math.round(total_idle_time_in_minutes),
            total_logged_minutes: Math.round(total_total_logged_minutes),
            actual_productive_minutes: Math.round(
              total_actual_productive_minutes
            ),
            break_time_in_minutes: Math.round(total_break_time_in_minutes),
          },
        });
      }
    } else if (type === 'DEPARTMENT') {
      if (const_config.isAllowedRole(role, ['MANAGER'])) {
        userCountQuery = {
          assigned_to: user_email,
          organization: organization,
          department: department,
          is_licensed: true,
        };

        attendanceQuery = {
          organization: organization,
          assigned_to: user_email,
          department: department,
          date: {
            $gte: from,
            $lt: till,
          },
        };
      } else if (
        const_config.isAllowedRole(role, [
          'SUPER_ADMIN',
          'CLIENT',
          'SUPER_AUDIT',
        ])
      ) {
        userCountQuery = {
          organization: organization,
          department: department,
          is_licensed: true,
        };

        attendanceQuery = {
          organization: organization,
          department: department,
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

        userCountQuery = {
          organization: organization,
          department: { $in: inDepartments },
          is_licensed: true,
        };

        attendanceQuery = {
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

        userCountQuery = {
          organization: organization,
          department: { $in: inDepartments },
          is_licensed: true,
        };

        attendanceQuery = {
          organization: organization,
          department: { $in: inDepartments },
          date: {
            $gte: from,
            $lt: till,
          },
        };
      }
    } else if (type === 'MANAGER') {
      if (const_config.isAllowedRole(role, ['MANAGER'])) {
        userCountQuery = {
          assigned_to: user_email,
          organization: organization,
          department: department,
          is_licensed: true,
        };

        attendanceQuery = {
          organization: organization,
          assigned_to: user_email,
          department: department,
          date: {
            $gte: from,
            $lt: till,
          },
        };
      } else if (
        const_config.isAllowedRole(role, [
          'SUPER_ADMIN',
          'CLIENT',
          'SUPER_AUDIT',
        ])
      ) {
        if (manager_name) {
          userCountQuery = {
            organization: organization,
            department: department,
            assigned_to: manager_name,
            is_licensed: true,
          };

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
          userCountQuery = {
            organization: organization,
            department: department,
            assigned_to: user_email,
            is_licensed: true,
          };

          attendanceQuery = {
            organization: organization,
            department: department,
            assigned_to: user_email,
            date: {
              $gte: from,
              $lt: till,
            },
          };
        }
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

        if (manager_name) {
          userCountQuery = {
            organization: organization,
            department: department,
            assigned_to: manager_name,
            is_licensed: true,
          };

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
          userCountQuery = {
            organization: organization,
            department: { $in: inDepartments },
            is_licensed: true,
          };

          attendanceQuery = {
            organization: organization,
            department: { $in: inDepartments },
            date: {
              $gte: from,
              $lt: till,
            },
          };
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

        if (manager_name) {
          userCountQuery = {
            organization: organization,
            department: department,
            assigned_to: manager_name,
            is_licensed: true,
          };

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
          userCountQuery = {
            organization: organization,
            department: { $in: inDepartments },
            is_licensed: true,
          };

          attendanceQuery = {
            organization: organization,
            department: { $in: inDepartments },
            date: {
              $gte: from,
              $lt: till,
            },
          };
        }
      }
    }

    let idle_time_in_minutes = 0;
    let total_logged_hours = 0;
    let break_time_in_minutes = 0;
    let expected_work_hours = 0;
    let expected_work_hours_activity = 0;
    let break_time_minutes = 0;

    let [head_count, configs, activities] = await Promise.all([
      Users.countDocuments(userCountQuery),
      Configuration.findOne(configQuery),
      Activity.find(attendanceQuery, 'idleTime breaks loginHours'),
    ]);

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
        const hours = Math.floor(total_logged_hours / 60);
        const minutes = Math.round(total_logged_hours % 60);
        const formattedHours = hours.toString().padStart(2, '0');
        const formattedMinutes = minutes.toString().padStart(2, '0');
        const formattedTime = `${formattedHours}:${formattedMinutes}`;

        const hours1 = Math.floor(break_time_in_minutes / 60);
        const minutes1 = Math.round(break_time_in_minutes % 60);
        const formattedHours1 = hours1.toString().padStart(2, '0');
        const formattedMinutes1 = minutes1.toString().padStart(2, '0');
        const formattedTime1 = `${formattedHours1}:${formattedMinutes1}`;

        const hours2 = Math.floor(idle_time_in_minutes / 60);
        const minutes2 = Math.round(idle_time_in_minutes % 60);
        const formattedHours2 = hours2.toString().padStart(2, '0');
        const formattedMinutes2 = minutes2.toString().padStart(2, '0');
        const formattedTime2 = `${formattedHours2}:${formattedMinutes2}`;

        const hours3 = Math.floor(actual_productive_minutes / 60);
        const minutes3 = Math.round(actual_productive_minutes % 60);
        const formattedHours3 = hours3.toString().padStart(2, '0');
        const formattedMinutes3 = minutes3.toString().padStart(2, '0');
        const formattedTime3 = `${formattedHours3}:${formattedMinutes3}`;

        var hoursInt = Math.floor(expected_work_hours);
        var minutes4 = Math.round((expected_work_hours - hoursInt) * 60);
        var hoursString = hoursInt.toString().padStart(2, '0');
        var minutesString = minutes4.toString().padStart(2, '0');
        const formattedTime4 = `${hoursString}:${minutesString}`;

        var hoursInt = Math.floor(expected_work_hours_activity);
        var minutes5 = Math.round(
          (expected_work_hours_activity - hoursInt) * 60
        );
        var hoursString = hoursInt.toString().padStart(2, '0');
        var minutesString = minutes5.toString().padStart(2, '0');
        const formattedTime5 = `${hoursString}:${minutesString}`;
        if (type === 'DEPARTMENT') {
          let entry = [
            {
              Organization: organization,
              Department: department,
              'Head Count': head_count,
              'Attendance Count': attendance_count,
              'Expected Work Hours(hh:mm)': formattedTime4,
              'Expected Productive Hours(hh:mm)': formattedTime5,
              'Actual Productive Hours(hh:mm)': formattedTime3,
              'Total Idle Hours(hh:mm)': formattedTime2,
              'Total Break Time(hh:mm)': formattedTime1,
              'Total Logged in Hours(hh:mm)': formattedTime,
            },
          ];
          const fields = [
            'Organization',
            'Department',
            'Head Count',
            'Attendance Count',
            'Expected Work Hours(hh:mm)',
            'Expected Productive Hours(hh:mm)',
            'Total Idle Hours(hh:mm)',
            'Total Logged in Hours(hh:mm)',
            'Actual Productive Hours(hh:mm)',
            'Total Break Time(hh:mm)',
          ];
          const opts = {
            fields,
          };
          const csv = parse(entry, opts);
          //console.log(csv);
          return res.status(200).send(csv);
        } else if (type === 'MANAGER') {
          if (const_config.isAllowedRole(role, ['MANAGER'])) {
            let entry = [
              {
                Organization: organization,
                Department: department,
                Manager: user_email,
                'Head Count': head_count,
                'Attendance Count': attendance_count,
                'Expected Work Hours(hh:mm)': formattedTime4,
                'Expected Productive Hours(hh:mm)': formattedTime5,
                'Actual Productive Hours(hh:mm)': formattedTime3,
                'Total Idle Hours(hh:mm)': formattedTime2,
                'Total Break Time(hh:mm)': formattedTime1,
                'Total Logged in Hours(hh:mm)': formattedTime,
              },
            ];
            const fields = [
              'Organization',
              'Department',
              'Manager',
              'Head Count',
              'Attendance Count',
              'Expected Work Hours(hh:mm)',
              'Expected Productive Hours(hh:mm)',
              'Total Idle Hours(hh:mm)',
              'Total Logged in Hours(hh:mm)',
              'Actual Productive Hours(hh:mm)',
              'Total Break Time(hh:mm)',
            ];
            const opts = {
              fields,
            };
            const csv = parse(entry, opts);
            //console.log(csv);
            return res.status(200).send(csv);
          } else {
            let entry = [
              {
                Organization: organization,
                Department: department,
                Manager: manager_name,
                'Head Count': head_count,
                'Attendance Count': attendance_count,
                'Expected Work Hours(hh:mm)': formattedTime4,
                'Expected Productive Hours(hh:mm)': formattedTime5,
                'Actual Productive Hours(hh:mm)': formattedTime3,
                'Total Idle Hours(hh:mm)': formattedTime2,
                'Total Break Time(hh:mm)': formattedTime1,
                'Total Logged in Hours(hh:mm)': formattedTime,
              },
            ];
            const fields = [
              'Organization',
              'Department',
              'Manager',
              'Head Count',
              'Attendance Count',
              'Expected Work Hours(hh:mm)',
              'Expected Productive Hours(hh:mm)',
              'Total Idle Hours(hh:mm)',
              'Total Logged in Hours(hh:mm)',
              'Actual Productive Hours(hh:mm)',
              'Total Break Time(hh:mm)',
            ];
            const opts = {
              fields,
            };
            const csv = parse(entry, opts);
            //console.log(csv);
            return res.status(200).send(csv);
          }
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
        message: 'Work hour Summary fetched successfully',
        data: {
          head_count: head_count,
          attendance_count: attendance_count,
          expected_work_hours: Math.round(expected_work_hours),
          expected_work_hours_activity: Math.round(
            expected_work_hours_activity
          ),
          idle_time_in_minutes: Math.round(idle_time_in_minutes),
          total_logged_minutes: Math.round(total_logged_hours),
          actual_productive_minutes: Math.round(actual_productive_minutes),
          break_time_in_minutes: Math.round(break_time_in_minutes),
        },
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


const getCurrentStatusOrgDepMang = async (req, res, next) => {
  try {
    let role = req.role;

    logger.debug('role', role);
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;
    let assigned_to = req.assigned_to;

    let { date, required_role, manager_name } = req.body;
    let { type, current_status_type, report_type } = req.body;

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

    if (type === undefined || type === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Type is required',
        field: 'type',
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

    let loggedInUserQuery = null;
    let loggedOutUserQuery = null;
    let activeUserQuery = null;
    let notLoggedInUser = null;
    let idleUserQuery = null;
    let userCountQuery = null;
    let isAuxManagementQuery = null;
    let isBreakQuery = null;
    let departmentName;
    let departmentsArray;
    let inDepartments = [];

    if (type === 'ORGANIZATION') {
      //isBreak
      if (const_config.isAllowedRole(role, ['MANAGER'])) {
        loggedInUserQuery = {
          assigned_to: user_email,
          organization: organization,
          date: {
            $gte: from,
            $lt: till,
          },
        };

        loggedOutUserQuery = {
          assigned_to: user_email,
          organization: organization,
          date: {
            $gte: from,
            $lt: till,
          },
          lastSessionLogout: {
            $gte: from,
            $lt: till,
          },
        };

        activeUserQuery = {
          assigned_to: user_email,
          organization: organization,
          isIdle: false,
          date: {
            $gte: from,
            $lt: till,
          },
          logoutTime: { $exists: false },
        };

        notLoggedInUser = {
          assigned_to: user_email,
          organization: organization,
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

        idleUserQuery = {
          assigned_to: user_email,
          organization: organization,
          isIdle: true,
          date: {
            $gte: from,
            $lt: till,
          },
        };
        isAuxManagementQuery = {
          assigned_to: user_email,
          organization: organization,
          isAuxManagement: true,
          date: {
            $gte: from,
            $lt: till,
          },
        };
        isBreakQuery = {
          assigned_to: user_email,
          organization: organization,
          isBreak: true,
          date: {
            $gte: from,
            $lt: till,
          },
        };

        userCountQuery = {
          assigned_to: user_email,
          organization: organization,
          is_licensed: true,
        };
      } else if (
        const_config.isAllowedRole(role, [
          'SUPER_ADMIN',
          'CLIENT',
          'SUPER_AUDIT',
        ])
      ) {
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

        loggedInUserQuery = {
          organization: organization,
          department: { $in: inDepartments },
          date: {
            $gte: from,
            $lt: till,
          },
        };

        loggedOutUserQuery = {
          organization: organization,
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

        activeUserQuery = {
          organization: organization,
          department: { $in: inDepartments },
          isIdle: false,
          date: {
            $gte: from,
            $lt: till,
          },
          logoutTime: { $exists: false },
        };

        notLoggedInUser = {
          organization: organization,
          department: { $in: inDepartments },
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

        idleUserQuery = {
          organization: organization,
          department: { $in: inDepartments },
          isIdle: true,
          date: {
            $gte: from,
            $lt: till,
          },
        };
        isAuxManagementQuery = {
          organization: organization,
          department: { $in: inDepartments },
          isAuxManagement: true,
          date: {
            $gte: from,
            $lt: till,
          },
        };
        isBreakQuery = {
          organization: organization,
          department: { $in: inDepartments },
          isBreak: true,
          date: {
            $gte: from,
            $lt: till,
          },
        };

        userCountQuery = {
          organization: organization,
          department: { $in: inDepartments },
          is_licensed: true,
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

        loggedInUserQuery = {
          organization: organization,
          department: { $in: inDepartments },
          date: {
            $gte: from,
            $lt: till,
          },
        };

        loggedOutUserQuery = {
          organization: organization,
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

        activeUserQuery = {
          organization: organization,
          department: { $in: inDepartments },
          isIdle: false,
          date: {
            $gte: from,
            $lt: till,
          },
          logoutTime: { $exists: false },
        };

        notLoggedInUser = {
          organization: organization,
          is_licensed: true,
          department: { $in: inDepartments },
          $or: [
            {
              app_access_time: {
                $lt: from,
              },
            },
            { app_access_time: { $exists: false } },
          ],
        };

        idleUserQuery = {
          organization: organization,
          department: { $in: inDepartments },
          isIdle: true,
          date: {
            $gte: from,
            $lt: till,
          },
        };
        isAuxManagementQuery = {
          organization: organization,
          department: { $in: inDepartments },
          isAuxManagement: true,
          date: {
            $gte: from,
            $lt: till,
          },
        };
        isBreakQuery = {
          organization: organization,
          department: { $in: inDepartments },
          isBreak: true,
          date: {
            $gte: from,
            $lt: till,
          },
        };

        userCountQuery = {
          organization: organization,
          department: { $in: inDepartments },
          is_licensed: true,
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

        loggedInUserQuery = {
          organization: organization,
          department: { $in: inDepartments },
          date: {
            $gte: from,
            $lt: till,
          },
        };

        loggedOutUserQuery = {
          organization: organization,
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

        activeUserQuery = {
          organization: organization,
          department: { $in: inDepartments },
          isIdle: false,
          date: {
            $gte: from,
            $lt: till,
          },
          logoutTime: { $exists: false },
        };

        notLoggedInUser = {
          organization: organization,
          is_licensed: true,
          department: { $in: inDepartments },
          $or: [
            {
              app_access_time: {
                $lt: from,
              },
            },
            { app_access_time: { $exists: false } },
          ],
        };

        idleUserQuery = {
          organization: organization,
          department: { $in: inDepartments },
          isIdle: true,
          date: {
            $gte: from,
            $lt: till,
          },
        };
        isAuxManagementQuery = {
          organization: organization,
          department: { $in: inDepartments },
          isAuxManagement: true,
          date: {
            $gte: from,
            $lt: till,
          },
        };
        isBreakQuery = {
          organization: organization,
          department: { $in: inDepartments },
          isBreak: true,
          date: {
            $gte: from,
            $lt: till,
          },
        };

        userCountQuery = {
          organization: organization,
          department: { $in: inDepartments },
          is_licensed: true,
        };
      }
    } else if (type === 'DEPARTMENT') {
      //isBreak
      if (const_config.isAllowedRole(role, ['MANAGER'])) {
        loggedInUserQuery = {
          assigned_to: user_email,
          organization: organization,
          department: department,
          date: {
            $gte: from,
            $lt: till,
          },
        };

        loggedOutUserQuery = {
          assigned_to: user_email,
          organization: organization,
          department: department,
          date: {
            $gte: from,
            $lt: till,
          },
          lastSessionLogout: {
            $gte: from,
            $lt: till,
          },
        };

        activeUserQuery = {
          assigned_to: user_email,
          organization: organization,
          department: department,
          isIdle: false,
          date: {
            $gte: from,
            $lt: till,
          },
          logoutTime: { $exists: false },
        };

        notLoggedInUser = {
          assigned_to: user_email,
          organization: organization,
          department: department,
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

        idleUserQuery = {
          assigned_to: user_email,
          organization: organization,
          department: department,
          isIdle: true,
          date: {
            $gte: from,
            $lt: till,
          },
        };
        isAuxManagementQuery = {
          assigned_to: user_email,
          organization: organization,
          department: department,
          isAuxManagement: true,
          date: {
            $gte: from,
            $lt: till,
          },
        };
        isBreakQuery = {
          assigned_to: user_email,
          organization: organization,
          department: department,
          isBreak: true,
          date: {
            $gte: from,
            $lt: till,
          },
        };

        userCountQuery = {
          assigned_to: user_email,
          organization: organization,
          department: department,
          is_licensed: true,
        };
      } else if (
        const_config.isAllowedRole(role, [
          'SUPER_ADMIN',
          'CLIENT',
          'SUPER_AUDIT',
        ])
      ) {
        loggedInUserQuery = {
          organization: organization,
          department: department,
          date: {
            $gte: from,
            $lt: till,
          },
        };

        loggedOutUserQuery = {
          organization: organization,
          department: department,
          date: {
            $gte: from,
            $lt: till,
          },
          lastSessionLogout: {
            $gte: from,
            $lt: till,
          },
        };

        activeUserQuery = {
          organization: organization,
          department: department,
          isIdle: false,
          date: {
            $gte: from,
            $lt: till,
          },
          logoutTime: { $exists: false },
        };

        notLoggedInUser = {
          organization: organization,
          department: department,
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

        idleUserQuery = {
          organization: organization,
          department: department,
          isIdle: true,
          date: {
            $gte: from,
            $lt: till,
          },
        };
        isAuxManagementQuery = {
          organization: organization,
          department: department,
          isAuxManagement: true,
          date: {
            $gte: from,
            $lt: till,
          },
        };
        isBreakQuery = {
          organization: organization,
          department: department,
          isBreak: true,
          date: {
            $gte: from,
            $lt: till,
          },
        };

        userCountQuery = {
          organization: organization,
          department: department,
          is_licensed: true,
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

        loggedInUserQuery = {
          organization: organization,
          department: { $in: inDepartments },
          date: {
            $gte: from,
            $lt: till,
          },
        };

        loggedOutUserQuery = {
          organization: organization,
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

        activeUserQuery = {
          organization: organization,
          department: { $in: inDepartments },
          isIdle: false,
          date: {
            $gte: from,
            $lt: till,
          },
          logoutTime: { $exists: false },
        };

        notLoggedInUser = {
          organization: organization,
          department: { $in: inDepartments },
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

        idleUserQuery = {
          organization: organization,
          department: { $in: inDepartments },
          isIdle: true,
          date: {
            $gte: from,
            $lt: till,
          },
        };
        isAuxManagementQuery = {
          organization: organization,
          department: { $in: inDepartments },
          isAuxManagement: true,
          date: {
            $gte: from,
            $lt: till,
          },
        };
        isBreakQuery = {
          organization: organization,
          department: { $in: inDepartments },
          isBreak: true,
          date: {
            $gte: from,
            $lt: till,
          },
        };

        userCountQuery = {
          organization: organization,
          department: { $in: inDepartments },
          is_licensed: true,
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

        loggedInUserQuery = {
          organization: organization,
          department: { $in: inDepartments },
          date: {
            $gte: from,
            $lt: till,
          },
        };

        loggedOutUserQuery = {
          organization: organization,
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

        activeUserQuery = {
          organization: organization,
          department: { $in: inDepartments },
          isIdle: false,
          date: {
            $gte: from,
            $lt: till,
          },
          logoutTime: { $exists: false },
        };

        notLoggedInUser = {
          organization: organization,
          department: { $in: inDepartments },
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

        idleUserQuery = {
          organization: organization,
          department: { $in: inDepartments },
          isIdle: true,
          date: {
            $gte: from,
            $lt: till,
          },
        };
        isAuxManagementQuery = {
          organization: organization,
          department: { $in: inDepartments },
          isAuxManagement: true,
          date: {
            $gte: from,
            $lt: till,
          },
        };
        isBreakQuery = {
          organization: organization,
          department: { $in: inDepartments },
          isBreak: true,
          date: {
            $gte: from,
            $lt: till,
          },
        };

        userCountQuery = {
          organization: organization,
          department: { $in: inDepartments },
          is_licensed: true,
        };
      }
    } else if (type === 'MANAGER') {
      //isBreak
      if (const_config.isAllowedRole(role, ['MANAGER'])) {
        loggedInUserQuery = {
          assigned_to: user_email,
          department: department,
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
          date: {
            $gte: from,
            $lt: till,
          },
          lastSessionLogout: {
            $gte: from,
            $lt: till,
          },
        };

        activeUserQuery = {
          assigned_to: user_email,
          organization,
          department: department,
          isIdle: false,
          date: {
            $gte: from,
            $lt: till,
          },
          logoutTime: { $exists: false },
        };

        notLoggedInUser = {
          assigned_to: user_email,
          department: department,
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
        };

        idleUserQuery = {
          assigned_to: user_email,
          organization,
          department: department,
          isIdle: true,
          date: {
            $gte: from,
            $lt: till,
          },
        };
        isAuxManagementQuery = {
          assigned_to: user_email,
          organization,
          department: department,
          isAuxManagement: true,
          date: {
            $gte: from,
            $lt: till,
          },
        };
        isBreakQuery = {
          assigned_to: user_email,
          organization,
          department: department,
          isBreak: true,
          date: {
            $gte: from,
            $lt: till,
          },
        };

        userCountQuery = {
          assigned_to: user_email,
          organization: organization,
          department: department,
          is_licensed: true,
        };
      } else if (
        const_config.isAllowedRole(role, ['SUPER_ADMIN', 'ADMIN', 'AUDIT'])
      ) {
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
          lastSessionLogout: {
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

        notLoggedInUser = {
          organization,
          department,
          is_licensed: true,
          assigned_to: manager_name,
          $or: [
            {
              app_access_time: {
                $lt: from,
              },
            },
            { app_access_time: { $exists: false } },
          ],
        };

        idleUserQuery = {
          organization,
          department: department,
          assigned_to: manager_name,
          isIdle: true,
          date: {
            $gte: from,
            $lt: till,
          },
        };
        isAuxManagementQuery = {
          organization,
          department,
          assigned_to: manager_name,
          isAuxManagement: true,
          date: {
            $gte: from,
            $lt: till,
          },
        };
        isBreakQuery = {
          organization,
          department,
          assigned_to: manager_name,
          isBreak: true,
          date: {
            $gte: from,
            $lt: till,
          },
        };

        userCountQuery = {
          organization: organization,
          department: department,
          assigned_to: manager_name,
          is_licensed: true,
        };
      }
    }

    let [
      logged_in_count,
      // not_logged,
      idle_count,
      // active_count,
      head_count,
      logged_out_count,
      auxManagement_count,
      break_count,
      active_user
    ] = await Promise.all([
      Activity.countDocuments(loggedInUserQuery),
      // Users.countDocuments(notLoggedInUser),
      Activity.countDocuments(idleUserQuery),
      // Activity.countDocuments(activeUserQuery),
      Users.countDocuments(userCountQuery),
      Activity.find(
        loggedOutUserQuery,
        'lastSessionLogout subsequentLoginTime'
      ),
      Activity.countDocuments(isAuxManagementQuery),
      Activity.countDocuments(isBreakQuery),
      Activity.aggregate([
        {
          $match: loggedInUserQuery,
        },
        {
          $match: {
            lastSessionLogout: { $exists: false },
          },
        },
      ])
    ]);

    let working_user = active_user.length;

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
      organization: organization,
      logged_in_count: logged_in_count,
      logged_out_count: logout,
      not_logged: head_count - logged_in_count,
      idle_count: idle_count,
      active_count: active + working_user,
      head_count: head_count,
      auxManagement_count: auxManagement_count,
      break_count: break_count,
    };
    if (report_type === 'csv') {
      try {
        const fields = [
          'organization',
          'logged_in_count',
          'logged_out_count',
          'not_logged',
          'idle_count',
          'active_count',
          'head_count',
          'auxManagement_count',
          'break_count',
        ];
        const opts = { fields };
        const csv = parse(response, opts);
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
        message: 'Current status count fetched successfully',
        data: response,
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
const getAttendanceSummaryOrganization = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let assigned_to = req.assigned_to;
    let user_email = req.user_email;

    let { from, to, report_type, manager_name, type } = req.body;

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

    const startDate = moment(from, 'MM-DD-YYYY').utc().startOf('day');
    const endDate = moment(to, 'MM-DD-YYYY').utc().startOf('day');

    const date_array = [];
    let currentDate = startDate.add(1, 'day'); // Exclude the starting date

    while (currentDate <= endDate) {
      date_array.push(currentDate.utc().format('MM-DD-YYYY'));
      currentDate = currentDate.add(1, 'day');
    }

    let query = null;
    let departmentName;
    let departmentsArray;
    let inDepartments = [];

    if (type === 'ORGANIZATION') {
      if (const_config.isAllowedRole(role, ['SUPER_ADMIN', 'MANAGER'])) {
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

        query = {
          organization: organization,
          department: { $in: inDepartments },
          is_licensed: true,
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
          is_licensed: true,
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
          is_licensed: true,
        };
      }

      let department_present = await Users.aggregate([
        {
          $match: query,
        },
        {
          $group: {
            _id: {
              department: '$department',
              organization: '$organization',
            },
            users: {
              $sum: 1,
            },
          },
        },
        {
          $project: {
            _id: 0,
            department: '$_id.department',
            organization: '$_id.organization',
            total_users: '$users',
          },
        },
        {
          $lookup: {
            from: 'activities',
            let: {
              department: '$department',
              organization: '$organization',
              startDate: from,
              endDate: till,
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$organization', '$$organization'] },
                      { $eq: ['$department', '$$department'] },
                      { $gte: ['$date', '$$startDate'] },
                      { $lt: ['$date', '$$endDate'] },
                    ],
                  },
                },
              },
              // {
              //   $project: {
              //     _id: 0,
              //     user_email: 1,
              //     date: 1,
              //     department: 1,
              //   },
              // },
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
                  users: { $addToSet: '$user_email' },
                },
              },
              {
                $project: {
                  _id: 0,
                  department: 1,
                  date: '$_id.date',
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
          $project: {
            _id: 0,
            department: 1,
            organization: 1,
            total_users: 1,
            department_present: '$data.total_present',
            date: '$data.date',
          },
        },
        {
          $group: {
            _id: '$date',
            data: {
              $push: {
                department: '$department',
                department_present: '$department_present',
              },
            },
          },
        },
        {
          $sort: {
            _id: 1,
          },
        },
      ]);

      const missingDepartments = inDepartments;

      const response = department_present.map(({ _id, data }) => ({
        _id,
        data: missingDepartments.map((department) => {
          const existingData = data.find((d) => d.department === department);
          return existingData
            ? existingData
            : {
              department,
              department_present: 0,
            };
        }),
      }));
      // Get all unique department names
      const departmentNames = Array.from(
        new Set(response.flatMap((item) => item.data.map((d) => d.department)))
      );

      const response1 = date_array.map((date) => {
        const match = response.find((item) => item._id === date);
        const departmentData = departmentNames.map((department) => {
          const departmentMatch = match
            ? match.data.find((d) => d.department === department)
            : undefined;
          return {
            department,
            department_present: departmentMatch
              ? departmentMatch.department_present
              : 0,
          };
        });
        return { _id: date, data: departmentData };
      });

      let users = await Users.aggregate([
        {
          $match: query,
        },
        {
          $group: {
            _id: {
              organization: '$organization',
            },
            users: {
              $sum: 1,
            },
          },
        },
        {
          $project: {
            _id: 0,
            // department: "$_id.department",
            organization: '$_id.organization',
            total_users: '$users',
          },
        },
        {
          $lookup: {
            from: 'activities',
            let: {
              organization: '$organization',
              startDate: from,
              endDate: till,
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$organization', '$$organization'] },
                      { $gte: ['$date', '$$startDate'] },
                      { $lt: ['$date', '$$endDate'] },
                    ],
                  },
                },
              },
              {
                $match: {
                  department: { $in: inDepartments },
                },
              },
              {
                $project: {
                  _id: 0,
                  user_email: '$user_email',
                  date: 1,
                  department: 1,
                },
              },
              {
                $group: {
                  _id: {
                    $dateToString: {
                      format: '%m-%d-%Y',
                      date: '$date',
                      timezone: time_zone,
                    },
                  },
                  users: { $addToSet: '$user_email' },
                },
              },
              {
                $project: {
                  _id: 0,
                  date: '$_id',
                  total_present: { $size: '$users' },
                },
              },
            ],
            as: 'users',
          },
        },
        {
          $unwind: {
            path: '$users',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            _id: 0,
            // department: 1,
            organization: 1,
            total_users: 1,
            date: '$users.date',
            total_present: '$users.total_present',
          },
        },
        {
          $addFields: {
            total_absent: { $subtract: ['$total_users', '$total_present'] },
          },
        },
        {
          $group: {
            _id: '$date',
            data: {
              $push: {
                total_users: '$total_users',
                total_absent: '$total_absent',
                total_present: '$total_present',
              },
            },
          },
        },
        {
          $sort: {
            _id: 1,
          },
        },
      ]);

      const totalUsers = users.length > 0 ? users[0].data[0].total_users : 0;

      const users_response = date_array.map((date) => {
        const match = users.find((item) => item._id === date);
        const dataObj = match
          ? match.data[0]
          : { total_users: totalUsers, total_absent: 0, total_present: 0 };
        if (dataObj.total_present === 0) {
          dataObj.total_absent = dataObj.total_users;
        } else {
          dataObj.total_absent = dataObj.total_users - dataObj.total_present;
        }

        return { _id: date, data: [dataObj] };
      });

      let reports = [];
      if (report_type === 'csv') {
        try {
          let department_present = await Users.aggregate([
            {
              $match: query,
            },
            {
              $group: {
                _id: {
                  department: '$department',
                  organization: '$organization',
                },
                users: {
                  $sum: 1,
                },
              },
            },
            {
              $project: {
                _id: 0,
                department: '$_id.department',
                organization: '$_id.organization',
                total_users: '$users',
              },
            },
            {
              $lookup: {
                from: 'activities',
                let: {
                  department: '$department',
                  organization: '$organization',
                  startDate: from,
                  endDate: till,
                },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $eq: ['$organization', '$$organization'] },
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
                      date: 1,
                      department: 1,
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
                            // timezone: time_zone
                          },
                        },
                      },
                      users: { $addToSet: '$user_email' },
                    },
                  },
                  {
                    $project: {
                      _id: 0,
                      department: 1,
                      date: '$_id.date',
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
              $project: {
                _id: 0,
                department: 1,
                organization: 1,
                total_users: 1,
                department_present: {
                  $cond: {
                    if: '$data.total_present',
                    then: '$data.total_present',
                    else: 0,
                  },
                },
                date: {
                  $cond: { if: '$data.date', then: '$data.date', else: null },
                },
              },
            },
            {
              $addFields: {
                total_absent: {
                  $subtract: ['$total_users', '$department_present'],
                },
              },
            },

            {
              $sort: {
                _id: 1,
              },
            },
            { $match: { date: { $ne: null } } },
          ]);

          const output = department_present.map(
            ({
              department,
              organization,
              date,
              total_users,
              department_present,
              total_absent,
            }) => ({
              Department: department,
              Organization: organization,
              Date: date,
              'Total Users': total_users,
              Present: department_present,
              Absent: total_absent,
            })
          );

          const fields = [
            'Organization',
            'Department',
            'Date',
            'Total Users',
            'Present',
            'Absent',
          ];
          const opts = { fields };
          const csv = parse(output, opts);
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
          message: 'Present Vs Absent count fetched successfully',
          department: response1,
          users_response: users_response,
        });
      }
    }
    if (type === 'DEPARTMENT') {
      let manager_user = await Users.findOne({
        organization: organization,
        department: department,
        is_manager: true,
        is_licensed: true,
      }).distinct('user_email');

      logger.debug('manager_user', manager_user);

      let userCountQuery = {
        organization: organization,
        department: department,
        assigned_to: {
          $in: manager_user,
        },
        is_licensed: true,
      };

      let manager_present = await Users.aggregate([
        {
          $match: userCountQuery,
        },
        {
          $group: {
            _id: '$assigned_to',
            users: {
              $sum: 1,
            },
          },
        },
        {
          $project: {
            _id: 0,
            manager: '$_id',
            department: department,
            total_users: '$users',
          },
        },
        {
          $lookup: {
            from: 'activities',
            let: {
              assigned_to: '$manager',
              department: department,
              organization: organization,
              startDate: from,
              endDate: till,
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$department', '$$department'] },
                      { $eq: ['$organization', '$$organization'] },
                      { $eq: ['$assigned_to', '$$assigned_to'] },
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
                  date: 1,
                  assigned_to: 1,
                },
              },
              {
                $group: {
                  _id: {
                    assigned_to: '$assigned_to',
                    date: {
                      $dateToString: {
                        format: '%m-%d-%Y',
                        date: '$date',
                        timezone: time_zone,
                      },
                    },
                  },
                  users: { $addToSet: '$user_email' },
                },
              },
              {
                $project: {
                  _id: 0,
                  assigned_to: 1,
                  date: '$_id.date',
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
          $project: {
            _id: 0,
            manager: 1,
            total_users: 1,
            manager_present: '$data.total_present',
            date: '$data.date',
          },
        },
        {
          $group: {
            _id: '$date',
            data: {
              $push: {
                manager: '$manager',
                manager_present: '$manager_present',
              },
            },
          },
        },
        {
          $sort: {
            _id: 1,
          },
        },
      ]);

      const missingDepartments = manager_user;

      const response = manager_present.map(({ _id, data }) => ({
        _id,
        data: missingDepartments.map((manager) => {
          const existingData = data.find((d) => d.manager === manager);
          return existingData
            ? existingData
            : {
              manager,
              manager_present: 0,
            };
        }),
      }));
      // Get all unique department names
      const departmentNames = Array.from(
        new Set(response.flatMap((item) => item.data.map((d) => d.manager)))
      );

      const response1 = date_array.map((date) => {
        const match = response.find((item) => item._id === date);
        const departmentData = departmentNames.map((manager) => {
          const departmentMatch = match
            ? match.data.find((d) => d.manager === manager)
            : undefined;
          return {
            manager,
            manager_present: departmentMatch
              ? departmentMatch.manager_present
              : 0,
          };
        });
        return { _id: date, data: departmentData };
      });

      let users = await Users.aggregate([
        {
          $match: {
            organization: organization,
            department: department,
            is_licensed: true,
          },
        },
        {
          $group: {
            _id: {
              department: '$department',
            },
            users: {
              $sum: 1,
            },
          },
        },
        {
          $project: {
            _id: 0,
            department: '$_id.department',
            total_users: '$users',
          },
        },
        {
          $lookup: {
            from: 'activities',
            let: {
              organization: organization,
              department: '$department',
              startDate: from,
              endDate: till,
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$organization', '$$organization'] },
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
                  date: 1,
                  department: 1,
                },
              },
              {
                $group: {
                  _id: {
                    $dateToString: {
                      format: '%m-%d-%Y',
                      date: '$date',
                      timezone: time_zone,
                    },
                  },
                  users: { $addToSet: '$user_email' },
                },
              },
              {
                $project: {
                  _id: 0,
                  date: '$_id',
                  total_present: { $size: '$users' },
                },
              },
            ],
            as: 'users',
          },
        },
        {
          $unwind: {
            path: '$users',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            _id: 0,
            department: 1,
            total_users: 1,
            date: '$users.date',
            total_present: '$users.total_present',
          },
        },
        {
          $addFields: {
            total_absent: { $subtract: ['$total_users', '$total_present'] },
          },
        },
        {
          $group: {
            _id: '$date',
            data: {
              $push: {
                total_users: '$total_users',
                total_absent: '$total_absent',
                total_present: '$total_present',
              },
            },
          },
        },
        {
          $sort: {
            _id: 1,
          },
        },
      ]);

      const totalUsers = users.length > 0 ? users[0].data[0].total_users : 0;

      const users_response = date_array.map((date) => {
        const match = users.find((item) => item._id === date);
        const dataObj = match
          ? match.data[0]
          : { total_users: totalUsers, total_absent: 0, total_present: 0 };
        if (dataObj.total_present === 0) {
          dataObj.total_absent = dataObj.total_users;
        } else {
          dataObj.total_absent = dataObj.total_users - dataObj.total_present;
        }

        return { _id: date, data: [dataObj] };
      });

      let reports = [];
      if (report_type === 'csv') {
        try {
          let manager_present = await Users.aggregate([
            {
              $match: userCountQuery,
            },
            {
              $group: {
                _id: '$assigned_to',
                users: {
                  $sum: 1,
                },
              },
            },
            {
              $project: {
                _id: 0,
                manager: '$_id',
                department: department,
                total_users: '$users',
              },
            },
            {
              $lookup: {
                from: 'activities',
                let: {
                  assigned_to: '$manager',
                  department: department,
                  organization: organization,
                  startDate: from,
                  endDate: till,
                },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $eq: ['$department', '$$department'] },
                          { $eq: ['$organization', '$$organization'] },
                          { $eq: ['$assigned_to', '$$assigned_to'] },
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
                      date: 1,
                      assigned_to: 1,
                    },
                  },
                  {
                    $group: {
                      _id: {
                        assigned_to: '$assigned_to',
                        date: {
                          $dateToString: {
                            format: '%m-%d-%Y',
                            date: '$date',
                            timezone: time_zone,
                          },
                        },
                      },
                      users: { $addToSet: '$user_email' },
                    },
                  },
                  {
                    $project: {
                      _id: 0,
                      assigned_to: 1,
                      date: '$_id.date',
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
              $project: {
                _id: 0,
                manager: 1,
                department: department,
                organization: organization,
                total_users: 1,
                manager_present: '$data.total_present',
                date: {
                  $cond: { if: '$data.date', then: '$data.date', else: null },
                },
              },
            },
            {
              $addFields: {
                total_absent: {
                  $subtract: ['$total_users', '$manager_present'],
                },
              },
            },

            {
              $sort: {
                date: 1,
              },
            },
            { $match: { date: { $ne: null } } },
          ]);
          const output = manager_present.map(
            ({
              department,
              organization,
              manager,
              date,
              total_users,
              manager_present,
              total_absent,
            }) => ({
              Department: department,
              Organization: organization,
              Manager: manager,
              Date: date,
              'Total Users': total_users,
              Present: manager_present,
              Absent: total_absent,
            })
          );

          const fields = [
            'Organization',
            'Department',
            'Date',
            'Manager',
            'Total Users',
            'Present',
            'Absent',
          ];
          const opts = { fields };
          const csv = parse(output, opts);
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
          message: 'Present Vs Absent count fetched successfully',
          manager: response1,
          users_response: users_response,
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

const getHybridSummaryOrgDep = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let assigned_to = req.assigned_to;
    let user_email = req.user_email;

    let { from, to, report_type, manager_name, type } = req.body;

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

    const startDate = moment(from, 'MM-DD-YYYY').utc().startOf('day');
    const endDate = moment(to, 'MM-DD-YYYY').utc().startOf('day');

    const date_array = [];
    let currentDate = startDate.add(1, 'day'); // Exclude the starting date

    while (currentDate <= endDate) {
      date_array.push(currentDate.utc().format('MM-DD-YYYY'));
      currentDate = currentDate.add(1, 'day');
    }

    let query = null;
    let departmentName;
    let departmentsArray;
    let inDepartments = [];

    if (type === 'ORGANIZATION') {
      if (const_config.isAllowedRole(role, ['SUPER_ADMIN', 'MANAGER'])) {
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

      let hybrid = await WorkLocation.aggregate([
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
            home: {
              $sum: {
                $cond: [
                  { $eq: ['$work_location', 'Home'] }, 1, 0
                ]
              }
            },
          },
        },
        {
          $project: {
            _id: 0,
            date: '$_id.date',
            department: '$_id.department',
            home: '$home',
          },
        },
        {
          $group: {
            _id: '$date',
            data: {
              $push: {
                department: '$department',
                count: '$home',
              },
            },
          },
        },
        {
          $sort: {
            _id: 1,
          },
        },
      ]);

      const missingDepartments = inDepartments;

      const response = hybrid.map(({ _id, data }) => ({
        _id,
        data: missingDepartments.map((department) => {
          const existingData = data.find((d) => d.department === department);
          return existingData
            ? existingData
            : {
              department,
              count: 0,
            };
        }),
      }));

      const departmentNames = Array.from(
        new Set(response.flatMap((item) => item.data.map((d) => d.department)))
      );

      const response1 = date_array.map((date) => {
        const match = response.find((item) => item._id === date);
        const departmentData = departmentNames.map((department) => {
          const departmentMatch = match
            ? match.data.find((d) => d.department === department)
            : undefined;
          return {
            department,
            count: departmentMatch ? departmentMatch.count : 0,
          };
        });
        return { _id: date, data: departmentData };
      });

      let users = await WorkLocation.aggregate([
        {
          $match: query,
        },
        {
          $group: {
            _id: {
              organization: '$organization',
              date: {
                $dateToString: {
                  format: '%m-%d-%Y',
                  date: '$date',
                  timezone: time_zone,
                },
              },
            },
            home: {
              $sum: {
                $cond: [
                  { $eq: ['$work_location', 'Home'] }, 1, 0
                ]
              }
            },
            office: {
              $sum: {
                $cond: [
                  { $eq: ['$work_location', 'Office'] }, 1, 0
                ]
              }
            },
          },
        },
        {
          $project: {
            _id: 0,
            date: '$_id.date',
            organization: '$_id.organization',
            home: '$home',
            office: '$office',
          },
        },
        {
          $group: {
            _id: '$date',
            data: {
              $push: {
                home: '$home',
                office: '$office',
              },
            },
          },
        },
        {
          $sort: {
            _id: 1,
          },
        },
      ]);
      const users_response = date_array.map((date) => {
        const match = users.find((item) => item._id === date);
        const dataObj = match ? match.data[0] : { home: 0, office: 0 };

        return { _id: date, data: [dataObj] };
      });

      let reports = [];
      if (report_type === 'csv') {
        try {
          let hybrid = await WorkLocation.aggregate([
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
                home: {
                  $sum: {
                    $cond: [
                      { $eq: ['$work_location', 'Home'] }, 1, 0
                    ]
                  }
                },
              },
            },
            {
              $project: {
                _id: 0,
                date: '$_id.date',
                organization: organization,
                department: '$_id.department',
                home: '$home',
              },
            },
            { $match: { home: { $ne: 0 } } },
            {
              $sort: {
                date: 1,
              },
            },
          ]);

          const output = hybrid.map(
            ({ department, organization, date, home }) => ({
              Department: department,
              Organization: organization,
              Date: date,
              'Home Count': home,
            })
          );

          const fields = ['Organization', 'Department', 'Date', 'Home Count'];
          const opts = { fields };
          const csv = parse(output, opts);
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
          message: 'Present Vs Absent count fetched successfully',
          department: response1,
          users_response: users_response,
        });
      }
    }
    if (type === 'DEPARTMENT') {
      let manager_user = await Users.findOne({
        organization: organization,
        department: department,
        is_manager: true,
        is_licensed: true,
      }).distinct('user_email');

      logger.debug('manager_user', manager_user);

      let userCountQuery = {
        organization: organization,
        department: department,
        assigned_to: {
          $in: manager_user,
        },
        date: {
          $gte: from,
          $lt: till,
        },
      };

      let manager_present = await WorkLocation.aggregate([
        {
          $match: userCountQuery,
        },
        {
          $group: {
            _id: {
              assigned_to: '$assigned_to',
              date: {
                $dateToString: {
                  format: '%m-%d-%Y',
                  date: '$date',
                  timezone: time_zone,
                },
              },
            },
            home: {
              $sum: {
                $cond: [
                  { $eq: ['$work_location', 'Home'] }, 1, 0
                ]
              }
            },
          },
        },
        {
          $project: {
            _id: 0,
            date: '$_id.date',
            manager: '$_id.assigned_to',
            department: department,
            home: '$home',
          },
        },
        {
          $group: {
            _id: '$date',
            data: {
              $push: {
                manager: '$manager',
                count: '$home',
              },
            },
          },
        },
        {
          $sort: {
            _id: 1,
          },
        },
      ]);

      const missingDepartments = manager_user;

      const response = manager_present.map(({ _id, data }) => ({
        _id,
        data: missingDepartments.map((manager) => {
          const existingData = data.find((d) => d.manager === manager);
          return existingData
            ? existingData
            : {
              manager,
              count: 0,
            };
        }),
      }));
      // Get all unique department names
      const departmentNames = Array.from(
        new Set(response.flatMap((item) => item.data.map((d) => d.manager)))
      );

      const response1 = date_array.map((date) => {
        const match = response.find((item) => item._id === date);
        const departmentData = departmentNames.map((manager) => {
          const departmentMatch = match
            ? match.data.find((d) => d.manager === manager)
            : undefined;
          return {
            manager,
            count: departmentMatch ? departmentMatch.count : 0,
          };
        });
        return { _id: date, data: departmentData };
      });

      let users = await WorkLocation.aggregate([
        {
          $match: {
            organization: organization,
            department: department,
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
                  timezone: time_zone,
                },
              },
            },
            home: {
              $sum: {
                $cond: [
                  { $eq: ['$work_location', 'Home'] }, 1, 0
                ]
              }
            },
            office: {
              $sum: {
                $cond: [
                  { $eq: ['$work_location', 'Office'] }, 1, 0
                ]
              }
            },
          },
        },
        {
          $project: {
            _id: 0,
            date: '$_id.date',
            department: '$_id.department',
            home: '$home',
            office: '$office',
          },
        },
        {
          $group: {
            _id: '$date',
            data: {
              $push: {
                home: '$home',
                office: '$office',
              },
            },
          },
        },
        {
          $sort: {
            _id: 1,
          },
        },
      ]);

      const users_response = date_array.map((date) => {
        const match = users.find((item) => item._id === date);
        const dataObj = match ? match.data[0] : { home: 0, office: 0 };

        return { _id: date, data: [dataObj] };
      });

      let reports = [];
      if (report_type === 'csv') {
        try {
          let manager_present = await WorkLocation.aggregate([
            {
              $match: userCountQuery,
            },
            {
              $group: {
                _id: {
                  assigned_to: '$assigned_to',
                  date: {
                    $dateToString: {
                      format: '%m-%d-%Y',
                      date: '$date',
                      timezone: time_zone,
                    },
                  },
                },
                home: {
                  $sum: {
                    $cond: [
                      { $eq: ['$work_location', 'Home'] }, 1, 0
                    ]
                  }
                },
              },
            },
            {
              $project: {
                _id: 0,
                date: '$_id.date',
                manager: '$_id.assigned_to',
                department: department,
                organization: organization,
                home: '$home',
              },
            },
            { $match: { home: { $ne: 0 } } },

            {
              $sort: {
                date: 1,
              },
            },
          ]);

          const output = manager_present.map(
            ({ department, organization, manager, date, home }) => ({
              Department: department,
              Organization: organization,
              Manager: manager,
              Date: date,
              'Home Count': home,
            })
          );

          const fields = [
            'Organization',
            'Department',
            'Manager',
            'Date',
            'Home Count',
          ];
          const opts = { fields };
          const csv = parse(output, opts);
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
          message: 'Present Vs Absent count fetched successfully',
          manager: response1,
          users_response: users_response,
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
  getProductivityByOrganization: getProductivityByOrganization,
  getPresentVsAbsentByOrganization: getPresentVsAbsentByOrganization,
  getWfhVsWfoByOrganization: getWfhVsWfoByOrganization,
  getIdleTimeByOrganization: getIdleTimeByOrganization,
  getBreakTimeByOrganization: getBreakTimeByOrganization,
  summarizedDataOrganization: summarizedDataOrganization,
  getWebProductivityByOrganization: getWebProductivityByOrganization,
  getAppProductivityOrganization: getAppProductivityOrganization,
  getLoggedInNotLoggedInByOrganization: getLoggedInNotLoggedInByOrganization,
  getAppWebPerByOrganization: getAppWebPerByOrganization,
  getWorkHoursSummaryOrgDepMang: getWorkHoursSummaryOrgDepMang,
  getCurrentStatusOrgDepMang: getCurrentStatusOrgDepMang,
  getAttendanceSummaryOrganization: getAttendanceSummaryOrganization,
  getHybridSummaryOrgDep: getHybridSummaryOrgDep,
};
