const express = require('express');
const dashboard = require('../../models/dashboard');
const Activity = require('../../models/activity');
const PrivacyBreach = require('../../models/privacy_breach');
const Task = require('../../models/task');
const Logger = require('../../configs/log');
const logger = new Logger('app_usage_dashboard');
const util = require('util');
const const_config = require('../../utility/util');
const moment = require('moment-timezone');
const { parse } = require('json2csv');
const Category = require('../../models/app_web_category');

const Department = require('../../models/department');
const AdminOrganization = require('../../models/admin_organization');
const AuditOrganization = require('../../models/audit_organization');

const CategoryRevised = require('../../models/app_web_category_revised');
const WebCategory = require('../../models/web_category');
const AppCategory = require('../../models/app_category');
const geTopWebsitesVisited = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;
    let assigned_to = req.assigned_to;

    let { from, to } = req.query;
    let { manager_name, report_type, type, organization_name } = req.body;

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
    // let local_date_from = moment(jDateToday).tz(time_zone)
    // let local_date_till = moment(jDateTill).tz(time_zone)

    // from = local_date_from.startOf('day').toDate()
    // let till = local_date_till.endOf('day').toDate()
    logger.debug('From', from);
    logger.debug('Till', till);

    let topWebsitesQuery = null;

    if (type === 'Organization') {
      let { organization_name } = req.body;

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
        topWebsitesQuery = {
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
        topWebsitesQuery = {
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

        topWebsitesQuery = {
          organization: organization,
          department: { $in: inDepartments },
          date: {
            $gte: from,
            $lt: till,
          },
        };
      }
    } else {
      if (const_config.isAllowedRole(role, ['AGENT'])) {
        topWebsitesQuery = {
          organization: organization,
          department: department,
          user_email: user_email,
          date: {
            $gte: from,
            $lt: till,
          },
        };
      } else if (const_config.isAllowedRole(role, ['MANAGER'])) {
        topWebsitesQuery = {
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
          topWebsitesQuery = {
            organization: organization,
            date: {
              $gte: from,
              $lt: till,
            },
          };
        } else {
          if (!(manager_name === undefined || manager_name === '')) {
            topWebsitesQuery = {
              organization: organization,
              department: department,
              assigned_to: manager_name,
              date: {
                $gte: from,
                $lt: till,
              },
            };
          } else {
            topWebsitesQuery = {
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
    }

    console.log('role', role);
    console.log('topWebsitesQuery', topWebsitesQuery);

    let reports = [];

    Activity.aggregate([
      {
        $match: topWebsitesQuery,
      },
      { $unwind: '$visitedWeb' },
      {
        $group: {
          _id: {
            name: '$visitedWeb.domain',
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]).exec((err, topWebSites) => {
      if (err) throw err;
      if (report_type === 'csv') {
        try {
          if (manager_name) {
            for (let i = 0; i < topWebSites.length; i++) {
              let record = {
                Organization: organization,
                Department: department,
                Web_Name: topWebSites[i]._id.name,
                Manager: manager_name,
                Visited_count: topWebSites[i].count,
              };
              reports.push(record);
            }

            const fields = [
              'Organization',
              'Department',
              'Manager',
              'Web_Name',
              'Visited_count',
            ];
            const opts = {
              fields,
            };
            const csv = parse(reports, opts);

            return res.status(200).send(csv);
          } else {
            for (let i = 0; i < topWebSites.length; i++) {
              let record = {
                Organization: organization,
                Department: department,
                Web_Name: topWebSites[i]._id.name,
                Visited_count: topWebSites[i].count,
              };
              reports.push(record);
            }

            const fields = [
              'Organization',
              'Department',
              'Web_Name',
              'Visited_count',
            ];
            const opts = {
              fields,
            };
            const csv = parse(reports, opts);

            return res.status(200).send(csv);
          }
        } catch (err) {
          console.error(err);

          return res.status(500).json({
            code: 'SERVER_ERROR',
            description: 'something went wrong, Please try again',
          });
        }
      } else {
        return res.status(200).json({
          message: 'Top 10 Web Sites fetched successfully',
          data: topWebSites,
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

const geTopAppsUsed = async (req, res, next) => {
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
      from = new Date(from);
      till = new Date(till);
    }
    logger.debug('From', from);
    logger.debug('Till', till);

    console.log('role', role);

    let topAppsQuery = null;
    if (type === 'Organization') {
      let { organization_name } = req.body;

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
        topAppsQuery = {
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
        topAppsQuery = {
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

        topAppsQuery = {
          organization: organization,
          department: { $in: inDepartments },
          date: {
            $gte: from,
            $lt: till,
          },
        };
      }
    } else {
      if (const_config.isAllowedRole(role, ['AGENT'])) {
        topAppsQuery = {
          organization: organization,
          department: department,
          user_email: user_email,
          date: {
            $gte: from,
            $lt: till,
          },
        };
      } else if (const_config.isAllowedRole(role, ['MANAGER'])) {
        topAppsQuery = {
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
          topAppsQuery = {
            organization: organization,
            date: {
              $gte: from,
              $lt: till,
            },
          };
        } else {
          if (!(manager_name === undefined || manager_name === '')) {
            topAppsQuery = {
              organization: organization,
              department: department,
              assigned_to: manager_name,
              date: {
                $gte: from,
                $lt: till,
              },
            };
          } else {
            topAppsQuery = {
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
    }
    let reports = [];

    Activity.aggregate([
      {
        $match: topAppsQuery,
      },
      { $unwind: '$activeApps' },
      {
        $group: {
          _id: {
            name: '$activeApps.name',
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]).exec((err, topApps) => {
      if (err) throw err;

      if (report_type === 'csv') {
        try {
          if (manager_name) {
            for (let i = 0; i < topApps.length; i++) {
              let record = {
                Organization: organization,
                Department: department,
                Manager: manager_name,
                App_Name: topApps[i]._id.name,
                Visited_count: topApps[i].count,
              };
              reports.push(record);
            }

            const fields = [
              'Organization',
              'Department',
              'Manager',
              'App_Name',
              'Visited_count',
            ];
            const opts = {
              fields,
            };
            const csv = parse(reports, opts);

            return res.status(200).send(csv);
          } else {
            for (let i = 0; i < topApps.length; i++) {
              let record = {
                Organization: organization,
                Department: department,
                App_Name: topApps[i]._id.name,
                Visited_count: topApps[i].count,
              };
              reports.push(record);
            }

            const fields = [
              'Organization',
              'Department',
              'App_Name',
              'Visited_count',
            ];
            const opts = {
              fields,
            };
            const csv = parse(reports, opts);

            return res.status(200).send(csv);
          }
        } catch (err) {
          console.error(err);

          return res.status(500).json({
            code: 'SERVER_ERROR',
            description: 'something went wrong, Please try again',
          });
        }
      } else {
        return res.status(200).json({
          message: 'Top 10 Apps fetched successfully',
          data: topApps,
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

const getWebsiteUsageDateRange = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let assigned_to = req.assigned_to;
    let user_email = req.user_email;

    let { from, to, manager_name, report_type } = req.body;
    if (organization === undefined || organization === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Organization is required',
        field: 'organization',
      });
    }

    if (department === undefined || department === '') {
      department = 'DEFAULT';
    }
    if (user_email === undefined || user_email === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Email is required',
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

    if (!moment(from, 'MM-DD-YYYY').isValid()) {
      return res.status(400).json({
        code: 'INVALID_DATE',
        description: 'from is invalid',
      });
    }

    if (!moment(to, 'MM-DD-YYYY').isValid()) {
      return res.status(400).json({
        code: 'INVALID_DATE',
        description: 'To is invalid',
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
      from = new Date(from);
      till = new Date(till);
    }
    logger.debug('From', from);
    logger.debug('Till', till);

    let query = null;
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
    } else if (const_config.isAllowedRole(role, ['MANAGER'])) {
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

    Activity.aggregate([
      {
        $match: query,
      },
      { $unwind: '$visitedWeb' },
      {
        $group: {
          _id: {
            name: { $ifNull: ['$visitedWeb.category', 'OTHER'] },
          },
          count: { $sum: 1 },
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
      { $sort: { count: -1 } },
    ]).exec((err, website_visits_time) => {
      if (err) {
        logger.error(err);
        return res.status(500).json({
          code: 'SERVER_ERROR',
          description: 'something went wrong, Please try again',
        });
      }
      logger.debug('Website', website_visits_time);
      let results = [];
      website_visits_time.forEach((element) => {
        let website = element._id.name;
        let count = element.count;
        let minutes = element.totalMinutes;
        let isAuthorized = element._id.isAuthorized;

        let ws = {
          name: website,
          count: count,
          minutes: minutes,
          isAuthorized: isAuthorized,
        };
        results.push(ws);
      });

      if (report_type === 'csv') {
        try {
          const fields = ['name', 'count', 'minutes'];
          const opts = { fields };
          const csv = parse(results, opts);
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
          message:
            'Web Site Visits and total time in minutes fetched successfully',
          data: results
            .sort((a, b) => {
              return b.minutes - a.minutes;
            })
            .slice(0, 10),
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

const getAppUsageDateRange = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let assigned_to = req.assigned_to;
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
      department = 'DEFAULT';
    }
    if (user_email === undefined || user_email === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Email is required',
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

    if (!moment(from, 'MM-DD-YYYY').isValid()) {
      return res.status(400).json({
        code: 'INVALID_DATE',
        description: 'from is invalid',
      });
    }

    if (!moment(to, 'MM-DD-YYYY').isValid()) {
      return res.status(400).json({
        code: 'INVALID_DATE',
        description: 'To is invalid',
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
      from = new Date(from);
      till = new Date(till);
    }
    logger.debug('From', from);
    logger.debug('Till', till);

    let query = null;
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
    } else if (const_config.isAllowedRole(role, ['MANAGER'])) {
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

    Activity.aggregate([
      {
        $match: query,
      },
      { $unwind: '$activeApps' },
      {
        $group: {
          _id: {
            name: { $ifNull: ['$activeApps.category', 'OTHER'] },
          },
          count: { $sum: 1 },
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
      { $sort: { minutes: -1 } },
    ]).exec((err, app_visits_time) => {
      if (err) {
        logger.error(err);

        return res.status(500).json({
          code: 'SERVER_ERROR',
          description: 'something went wrong, Please try again',
        });
      }
      logger.debug('app', app_visits_time);
      let results = [];

      app_visits_time.forEach((element) => {
        let website = element._id.name;
        let count = element.count;
        let minutes = element.totalMinutes;
        let isAuthorized = element._id.isAuthorized;

        let ws = {
          name: website,
          count: count,
          minutes: minutes,
          isAuthorized: isAuthorized,
        };
        results.push(ws);
      });

      return res.status(200).json({
        message: 'App Visits and total time in minutes fetched successfully',
        data: results
          .sort((a, b) => {
            return b.minutes - a.minutes;
          })
          .slice(0, 10),
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

const getWebsiteUsageDateRangeByCategory = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let assigned_to = req.assigned_to;
    let user_email = req.user_email;

    let { from, to, category_value, manager_name, report_type } = req.body;
    if (organization === undefined || organization === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Organization is required',
        field: 'organization',
      });
    }

    if (department === undefined || department === '') {
      department = 'DEFAULT';
    }
    if (user_email === undefined || user_email === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Email is required',
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

    if (category_value === undefined || category_value === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'category_value is required',
        field: 'category_value',
      });
    }

    if (!moment(from, 'MM-DD-YYYY').isValid()) {
      return res.status(400).json({
        code: 'INVALID_DATE',
        description: 'from is invalid',
      });
    }
    if (to === undefined || to === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'From is required',
        field: 'to',
      });
    }
    if (!moment(to, 'MM-DD-YYYY').isValid()) {
      return res.status(400).json({
        code: 'INVALID_DATE',
        description: 'To is invalid',
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
      from = new Date(from);
      till = new Date(till);
    }
    logger.debug('From', from);
    logger.debug('Till', till);

    let query = null;
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
    } else if (const_config.isAllowedRole(role, ['MANAGER'])) {
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

    Activity.aggregate([
      {
        $match: query,
      },
      { $unwind: '$visitedWeb' },
      {
        $group: {
          _id: {
            name: '$visitedWeb.domain',
            category: { $ifNull: ['$visitedWeb.category', 'OTHER'] },
          },
          count: { $sum: 1 },
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
      { $sort: { count: -1 } },
    ]).exec((err, website_visits_time) => {
      if (err) {
        logger.error(err);
        return res.status(500).json({
          code: 'SERVER_ERROR',
          description: 'something went wrong, Please try again',
        });
      }
      logger.debug('Website', website_visits_time);
      let results = [];
      website_visits_time.forEach((element) => {
        let website = element._id.name;
        let count = element.count;
        let minutes = element.totalMinutes;
        let isAuthorized = element._id.isAuthorized;
        if (element._id.category === category_value) {
          let ws = {
            name: website,
            count: count,
            minutes: minutes,
            isAuthorized: isAuthorized,
          };
          results.push(ws);
        }
      });

      if (report_type === 'csv') {
        try {
          const fields = ['name', 'count', 'minutes'];
          const opts = { fields };
          const csv = parse(results, opts);
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
          message:
            'Web Site Visits and total time in minutes fetched successfully',
          data: results
            .sort((a, b) => {
              return b.minutes - a.minutes;
            })
            .slice(0, 10),
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

const getAppUsageDateRangeByCategory = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let assigned_to = req.assigned_to;
    let user_email = req.user_email;

    let { from, to, category_value, manager_name } = req.body;
    if (organization === undefined || organization === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Organization is required',
        field: 'organization',
      });
    }

    if (department === undefined || department === '') {
      department = 'DEFAULT';
    }
    if (user_email === undefined || user_email === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Email is required',
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

    if (!moment(from, 'MM-DD-YYYY').isValid()) {
      return res.status(400).json({
        code: 'INVALID_DATE',
        description: 'from is invalid',
      });
    }

    if (!moment(to, 'MM-DD-YYYY').isValid()) {
      return res.status(400).json({
        code: 'INVALID_DATE',
        description: 'To is invalid',
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
      from = new Date(from);
      till = new Date(till);
    }
    logger.debug('From', from);
    logger.debug('Till', till);

    let query = null;
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
    } else if (const_config.isAllowedRole(role, ['MANAGER'])) {
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

    Activity.aggregate([
      {
        $match: query,
      },
      { $unwind: '$activeApps' },
      {
        $group: {
          _id: {
            name: '$activeApps.name',
            category: { $ifNull: ['$activeApps.category', 'OTHER'] },
          },

          count: { $sum: 1 },
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
      { $sort: { minutes: -1 } },
    ]).exec((err, app_visits_time) => {
      if (err) {
        logger.error(err);

        return res.status(500).json({
          code: 'SERVER_ERROR',
          description: 'something went wrong, Please try again',
        });
      }
      logger.debug('app', app_visits_time);
      let results = [];

      app_visits_time.forEach((element) => {
        let website = element._id.name;
        let count = element.count;
        let minutes = element.totalMinutes;
        let isAuthorized = element._id.isAuthorized;
        if (element._id.category === category_value) {
          let ws = {
            name: website,
            count: count,
            minutes: minutes,
            isAuthorized: isAuthorized,
          };
          results.push(ws);
        }
      });

      return res.status(200).json({
        message: 'App Visits and total time in minutes fetched successfully',
        data: results
          .sort((a, b) => {
            return b.minutes - a.minutes;
          })
          .slice(0, 10),
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

const getWebsiteProdVsNonProd = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let assigned_to = req.assigned_to;
    let user_email = req.user_email;

    let { from, to, manager_name, report_type } = req.body;
    if (organization === undefined || organization === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Organization is required',
        field: 'organization',
      });
    }

    if (department === undefined || department === '') {
      department = 'DEFAULT';
    }
    if (user_email === undefined || user_email === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Email is required',
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

    if (!moment(from, 'MM-DD-YYYY').isValid()) {
      return res.status(400).json({
        code: 'INVALID_DATE',
        description: 'from is invalid',
      });
    }
    if (to === undefined || to === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'From is required',
        field: 'to',
      });
    }
    if (!moment(to, 'MM-DD-YYYY').isValid()) {
      return res.status(400).json({
        code: 'INVALID_DATE',
        description: 'To is invalid',
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
      from = new Date(from);
      till = new Date(till);
    }
    logger.debug('From', from);
    logger.debug('Till', till);

    let query = null;
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
    } else if (const_config.isAllowedRole(role, ['MANAGER'])) {
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

    Activity.aggregate([
      {
        $match: query,
      },
      { $unwind: '$visitedWeb' },
      {
        $group: {
          _id: {
            name: { $ifNull: ['$visitedWeb.is_productive', false] },
          },
          count: { $sum: 1 },
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
      { $sort: { count: -1 } },
    ]).exec((err, website_visits_time) => {
      if (err) {
        logger.error(err);
        return res.status(500).json({
          code: 'SERVER_ERROR',
          description: 'something went wrong, Please try again',
        });
      }
      logger.debug('Website', website_visits_time);
      let results = [];
      website_visits_time.forEach((element) => {
        let website = element._id.name;
        let count = element.count;
        let minutes = element.totalMinutes;
        let isAuthorized = element._id.isAuthorized;

        let ws = {
          is_productive: website,
          count: count,
          minutes: minutes,
          isAuthorized: isAuthorized,
        };
        results.push(ws);
      });

      if (report_type === 'csv') {
        try {
          const fields = ['is_productive', 'count', 'minutes'];
          const opts = { fields };
          const csv = parse(results, opts);
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
          message:
            'Web Site Visits and total time in minutes fetched successfully',
          data: results
            .sort((a, b) => {
              return b.minutes - a.minutes;
            })
            .slice(0, 10),
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

const getAppProdVsNonProd = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let assigned_to = req.assigned_to;
    let user_email = req.user_email;

    let { from, to, manager_name, report_type } = req.body;
    if (organization === undefined || organization === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Organization is required',
        field: 'organization',
      });
    }

    if (department === undefined || department === '') {
      department = 'DEFAULT';
    }
    if (user_email === undefined || user_email === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Email is required',
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

    if (!moment(from, 'MM-DD-YYYY').isValid()) {
      return res.status(400).json({
        code: 'INVALID_DATE',
        description: 'from is invalid',
      });
    }

    if (!moment(to, 'MM-DD-YYYY').isValid()) {
      return res.status(400).json({
        code: 'INVALID_DATE',
        description: 'To is invalid',
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
      from = new Date(from);
      till = new Date(till);
    }
    logger.debug('From', from);
    logger.debug('Till', till);

    let query = null;
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
    } else if (const_config.isAllowedRole(role, ['MANAGER'])) {
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

    Activity.aggregate([
      {
        $match: query,
      },
      { $unwind: '$activeApps' },
      {
        $group: {
          _id: {
            name: { $ifNull: ['$activeApps.is_productive', false] },
          },

          count: { $sum: 1 },
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
      { $sort: { minutes: -1 } },
    ]).exec((err, app_visits_time) => {
      if (err) {
        logger.error(err);

        return res.status(500).json({
          code: 'SERVER_ERROR',
          description: 'something went wrong, Please try again',
        });
      }
      logger.debug('app', app_visits_time);
      let results = [];

      app_visits_time.forEach((element) => {
        let is_productive = element._id.name;
        let count = element.count;
        let minutes = element.totalMinutes;
        let isAuthorized = element._id.isAuthorized;

        let ws = {
          is_productive: is_productive,
          count: count,
          minutes: minutes,
          isAuthorized: isAuthorized,
        };
        results.push(ws);
      });

      if (report_type === 'csv') {
        try {
          const fields = ['is_productive', 'count', 'minutes'];
          const opts = { fields };
          const csv = parse(results, opts);
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
          message: 'App Visits and total time in minutes fetched successfully',
          data: results
            .sort((a, b) => {
              return b.minutes - a.minutes;
            })
            .slice(0, 10),
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
const getTopAppsAndWebsites = async (req, res, next) => {
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

    let topAppsQuery = null;
    if (const_config.isAllowedRole(role, ['AGENT'])) {
      topAppsQuery = {
        organization: organization,
        department: department,
        user_email: user_email,
        date: {
          $gte: from,
          $lt: till,
        },
      };
    } else if (const_config.isAllowedRole(role, ['MANAGER'])) {
      topAppsQuery = {
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
        topAppsQuery = {
          organization: organization,
          date: {
            $gte: from,
            $lt: till,
          },
        };
      } else {
        if (!(manager_name === undefined || manager_name === '')) {
          topAppsQuery = {
            organization: organization,
            department: department,
            assigned_to: manager_name,
            date: {
              $gte: from,
              $lt: till,
            },
          };
        } else {
          topAppsQuery = {
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
    logger.debug('topAppsQuery', topAppsQuery);
    let [web, app] = await Promise.all([
      Activity.aggregate([
        {
          $match: topAppsQuery,
        },
        { $unwind: '$visitedWeb' },
        {
          $group: {
            _id: {
              name: '$visitedWeb.domain',
              category: '$visitedWeb.category',
            },
            count: { $sum: 1 },
          },
        },

        // {
        //     $project:
        //     {
        //         "visitedWeb.name": { $replaceAll: { input: "$visitedWeb.name", find: "New Tab", replacement: "Chrome" } },
        //         count: 1

        //     }
        // },
        {
          $project: {
            'visitedWeb.name': {
              $arrayElemAt: [{ $split: ['$visitedWeb.name', ') '] }, -1],
            },
            count: 1,
          },
        },

        {
          $project: {
            'visitedWeb.name': {
              $arrayElemAt: [{ $split: ['$visitedWeb.name', '| '] }, -1],
            },
            count: 1,
          },
        },
        {
          $project: {
            'visitedWeb.name': {
              $arrayElemAt: [{ $split: ['$visitedWeb.name', '- '] }, -1],
            },
            count: 1,
          },
        },
        {
          $project: {
            'visitedWeb.name': {
              $arrayElemAt: [{ $split: ['$visitedWeb.name', '-'] }, -1],
            },
            count: 1,
          },
        },

        {
          $project: {
            'visitedWeb.name': {
              $arrayElemAt: [{ $split: ['$_id.name', '/'] }, 0],
            },
            count: 1,
          },
        },
        // {
        //     $project:
        //     {
        //         "visitedWeb.name": { $replaceAll: { input: "$_id.name", find: "Outlook", replacement: "Outlook" } },
        //         count: 1

        //     }
        // },
        // {
        //     $project:
        //     {
        //         "visitedWeb.name": { $replaceAll: { input: "$_id.name", find: "console.wanywhere.com", replacement: "wAnywhere Console" } },
        //         count: 1

        //     }
        // },
        {
          $group: {
            _id: {
              name: '$_id.name',
              category: '$_id.category',
            },
            count: { $sum: '$count' },
          },
        },

        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      Activity.aggregate([
        {
          $match: topAppsQuery,
        },
        { $unwind: '$activeApps' },
        {
          $group: {
            _id: {
              name: '$activeApps.name',
              category: '$activeApps.category',
            },
            count: { $sum: 1 },
          },
        },

        // {
        //     $project:
        //     {
        //         "activeApps.name": { $arrayElemAt: [{ $split: ["$activeApps.name", "| "] }, -1] },
        //         count: 1
        //     }
        // },
        // {
        //     $project:
        //     {
        //         "activeApps.name": { $arrayElemAt: [{ $split: ["$activeApps.name", "- "] }, 0] },
        //         count: 1

        //     }

        // },

        // {
        //     $project:
        //     {
        //         "activeApps.name": { $arrayElemAt: [{ $split: ["$activeApps.name", " ["] }, 0] },
        //         count: 1

        //     }

        // },

        // {
        //     $project:
        //     {
        //         "activeApps.name": { $replaceAll: { input: "$activeApps.name", find: "agent", replacement: "Agent" } },
        //         count: 1
        //     }
        // },

        // {
        //     $project:
        //     {
        //         "activeApps.name": { $replaceAll: { input: "$activeApps.name", find: "wanywhere-Agent.exe", replacement: "Agent" } },
        //         count: 1
        //     }
        // },
        // {
        //     $project:
        //     {
        //         "activeApps.name": { $replaceAll: { input: "$activeApps.name", find: "Agent", replacement: "wanywhere" } },
        //         count: 1
        //     }
        // },
        // {
        //     $project:
        //     {
        //         "activeApps.name": { $replaceAll: { input: "$activeApps.name", find: "wAnywhere Agent", replacement: "wanywhere" } },
        //         count: 1
        //     }
        // },
        // {
        //     $project:
        //     {
        //         "activeApps.name": { $replaceAll: { input: "$activeApps.name", find: "wanywhere-wanywhere", replacement: "wanywhere" } },
        //         count: 1
        //     }
        // },
        // {
        //     $project:
        //     {
        //         "activeApps.name": { $replaceAll: { input: "$activeApps.name", find: " Google Chrome", replacement: "Chrome" } },
        //         count: 1
        //     }
        // },
        // {
        //     $project:
        //     {
        //         "activeApps.name": { $replaceAll: { input: "$activeApps.name", find: "Google-chrome", replacement: "Chrome" } },
        //         count: 1
        //     }
        // },
        // {
        //     $project:
        //     {
        //         "activeApps.name": { $replaceAll: { input: "$activeApps.name", find: "Google Chrome", replacement: "Chrome" } },
        //         count: 1
        //     }
        // },

        // {
        //     $project:
        //     {
        //         "activeApps.name": { $replaceAll: { input: "$activeApps.name", find: "chrome.exe", replacement: "Chrome" } },
        //         count: 1
        //     }
        // },
        // {
        //     $project:
        //     {
        //         "activeApps.name": { $replaceAll: { input: "$activeApps.name", find: "Google-chrome", replacement: "Chrome" } },
        //         count: 1
        //     }
        // },

        // {
        //     $project:
        //     {
        //         "activeApps.name": { $replaceAll: { input: "$activeApps.name", find: "Teams.exe", replacement: "Microsoft Teams" } },
        //         count: 1
        //     }
        // },

        {
          $group: {
            _id: {
              name: '$_id.name',
              category: '$_id.category',
            },
            count: { $sum: '$count' },
          },
        },
        { $sort: { count: 1 } },
        { $limit: 10 },
      ]),
    ]);

    return res.status(200).json({
      message: 'Top 10 Apps and Webs fetched successfully',
      web: web,
      app: app,
    });
  } catch (error) {
    logger.error(error);
    return res.status(500).json({
      code: 'SERVER_ERROR',
      description: 'something went wrong, Please try again',
    });
  }
};
//Pie Chart
const timeSpentAuth = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let assigned_to = req.assigned_to;
    let user_email = req.user_email;
    let { from, to } = req.query;
    let { report_type, isAuthorized, application_type, manager_name } =
      req.body;
    if (application_type === undefined || application_type === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'application_type is required',
        field: 'application_type',
      });
    }

    if (department === undefined || department === '') {
      department = 'DEFAULT';
    }
    if (isAuthorized === undefined || isAuthorized === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Authorized is required',
        field: 'isAuthorized',
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

    if (!moment(from, 'MM-DD-YYYY').isValid()) {
      return res.status(400).json({
        code: 'INVALID_DATE',
        description: 'from is invalid',
      });
    }

    if (!moment(to, 'MM-DD-YYYY').isValid()) {
      return res.status(400).json({
        code: 'INVALID_DATE',
        description: 'To is invalid',
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
    logger.debug('From', from);
    logger.debug('Till', till);

    let query = null;
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
    } else if (const_config.isAllowedRole(role, ['MANAGER'])) {
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

    if (application_type === 'app') {
      let reports = [];
      let match = {
        'activeApps.isAuthorized': isAuthorized,
      };

      let allRecords = await Activity.aggregate([
        {
          $match: query,
        },
        { $unwind: '$activeApps' },
        {
          $match: match,
        },
        {
          $group: {
            _id: {
              category: '$activeApps.category',
            },
            count: { $sum: 1 },
            totalMinutes: {
              $sum: {
                $divide: [
                  {
                    $subtract: ['$activeApps.endTime', '$activeApps.startTime'],
                  },
                  1000 * 60,
                ],
              },
            },
          },
        },
        { $sort: { minutes: -1 } },
      ]);
      if (report_type === 'csv') {
        try {
          let allRecords = await Activity.aggregate([
            {
              $match: query,
            },

            { $unwind: '$activeApps' },

            {
              $match: match,
            },
            {
              $group: {
                _id: {
                  category: '$activeApps.category',
                  date: {
                    $dateToString: {
                      format: '%m-%d-%Y',
                      date: '$date',
                    },
                  },
                },

                count: { $sum: 1 },
                totalMinutes: {
                  $sum: {
                    $divide: [
                      {
                        $subtract: [
                          '$activeApps.endTime',
                          '$activeApps.startTime',
                        ],
                      },
                      1000 * 60,
                    ],
                  },
                },
              },
            },
            { $sort: { minutes: -1 } },
          ]);
          for (let i = 0; i < allRecords.length; i++) {
            let record = {
              Organization: organization,
              Department: department,
              Category: allRecords[i]._id.category,
              Date: allRecords[i]._id.date,
              Total_Number_Of_Visits: allRecords[i].count,
            };
            reports.push(record);
          }
          const fields = [
            'Organization',
            'Department',
            'Date',
            'Category',
            'Total_Number_Of_Visits',
          ];
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
          message: 'User report fetched successfully',
          data: allRecords,
        });
      }
    }

    if (application_type === 'web') {
      let reports = [];
      let match = {
        'visitedWeb.isAuthorized': isAuthorized,
      };

      let allRecords = await Activity.aggregate([
        {
          $match: query,
        },

        { $unwind: '$visitedWeb' },

        {
          $match: match,
        },
        {
          $group: {
            _id: {
              category: '$visitedWeb.category',
            },

            count: { $sum: 1 },
            totalMinutes: {
              $sum: {
                $divide: [
                  {
                    $subtract: ['$visitedWeb.endTime', '$visitedWeb.startTime'],
                  },
                  1000 * 60,
                ],
              },
            },
          },
        },
        { $sort: { minutes: -1 } },
      ]);

      if (report_type === 'csv') {
        try {
          let allRecords = await Activity.aggregate([
            {
              $match: query,
            },

            { $unwind: '$visitedWeb' },

            {
              $match: match,
            },
            {
              $group: {
                _id: {
                  category: '$visitedWeb.category',
                  date: {
                    $dateToString: {
                      format: '%m-%d-%Y',
                      date: '$date',
                    },
                  },
                },

                count: { $sum: 1 },
                totalMinutes: {
                  $sum: {
                    $divide: [
                      {
                        $subtract: [
                          '$visitedWeb.endTime',
                          '$visitedWeb.startTime',
                        ],
                      },
                      1000 * 60,
                    ],
                  },
                },
              },
            },
            { $sort: { minutes: -1 } },
          ]);
          for (let i = 0; i < allRecords.length; i++) {
            let record = {
              Organization: organization,
              Department: department,
              Category: allRecords[i]._id.category,
              Date: allRecords[i]._id.date,
              Total_Number_Of_Visits: allRecords[i].count,
            };
            reports.push(record);
          }
          const fields = [
            'Organization',
            'Department',
            'Date',
            'Category',
            'Total_Number_Of_Visits',
          ];
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
          message: 'Details fetched successfully',
          data: allRecords,
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

const totalSpentTimeByCategory = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let assigned_to = req.assigned_to;
    let user_email = req.user_email;
    let { from, to } = req.query;
    let { report_type, application_type, manager_name } = req.body;
    if (organization === undefined || organization === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Organization is required',
        field: 'organization',
      });
    }

    if (department === undefined || department === '') {
      department = 'DEFAULT';
    }
    if (user_email === undefined || user_email === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Email is required',
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

    if (!moment(from, 'MM-DD-YYYY').isValid()) {
      return res.status(400).json({
        code: 'INVALID_DATE',
        description: 'from is invalid',
      });
    }

    if (!moment(to, 'MM-DD-YYYY').isValid()) {
      return res.status(400).json({
        code: 'INVALID_DATE',
        description: 'To is invalid',
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
    logger.debug('From', from);
    logger.debug('Till', till);

    let query = null;
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
    } else if (const_config.isAllowedRole(role, ['MANAGER'])) {
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
    if (application_type === 'app') {
      let reports = [];

      let allRecords = await Activity.aggregate([
        {
          $match: query,
        },
        { $unwind: '$activeApps' },
        {
          $group: {
            _id: {
              category: '$activeApps.category',
            },

            totalMinutes: {
              $sum: {
                $divide: [
                  {
                    $subtract: ['$activeApps.endTime', '$activeApps.startTime'],
                  },
                  1000 * 60,
                ],
              },
            },
          },
        },
        { $sort: { minutes: -1 } },
      ]);
      if (report_type === 'csv') {
        try {
          for (let i = 0; i < allRecords.length; i++) {
            let minHr = allRecords[i].totalMinutes;
            var num = minHr;
            var hours = num / 60;
            var rhours = Math.floor(hours);
            var minutes = (hours - rhours) * 60;
            var rminutes = Math.round(minutes);
            minHr =
              rhours.toString().padStart(2, '0') +
              ':' +
              rminutes.toString().padStart(2, '0');

            let record = {
              Organization: organization,
              Department: department,
              Category: allRecords[i]._id.category,
              Total: minHr,
            };
            reports.push(record);
          }

          const fields = ['Organization', 'Department', 'Category', 'Total'];
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
          message: 'User report fetched successfully',
          data: allRecords,
        });
      }
    }
    if (application_type === 'web') {
      let reports = [];

      let allRecords = await Activity.aggregate([
        {
          $match: query,
        },
        { $unwind: '$visitedWeb' },
        {
          $group: {
            _id: {
              category: '$visitedWeb.category',
            },

            totalMinutes: {
              $sum: {
                $divide: [
                  {
                    $subtract: ['$visitedWeb.endTime', '$visitedWeb.startTime'],
                  },
                  1000 * 60,
                ],
              },
            },
          },
        },
        { $sort: { minutes: -1 } },
      ]);
      if (report_type === 'csv') {
        try {
          for (let i = 0; i < allRecords.length; i++) {
            let minHr = allRecords[i].totalMinutes;
            var num = minHr;
            var hours = num / 60;
            var rhours = Math.floor(hours);
            var minutes = (hours - rhours) * 60;
            var rminutes = Math.round(minutes);
            minHr =
              rhours.toString().padStart(2, '0') +
              ':' +
              rminutes.toString().padStart(2, '0');

            let record = {
              Organization: organization,
              Department: department,
              Category: allRecords[i]._id.category,
              Total: minHr,
            };
            reports.push(record);
          }
          const fields = ['Organization', 'Department', 'Category', 'Total'];
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
          message: 'User report fetched successfully',
          data: allRecords,
        });
      }
    }
    return res.status(404).json({
      code: 'BAD_REQUEST_ERROR',
      description: 'Unsupported application type',
    });
  } catch (error) {
    logger.error(error);

    return res.status(500).json({
      code: 'SERVER_ERROR',
      description: 'something went wrong, Please try again',
    });
  }
};

const totalSpentTimeByAuthorizeVsUnauthorizeCategory = async (
  req,
  res,
  next
) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let assigned_to = req.assigned_to;
    let user_email = req.user_email;

    let { from, to } = req.query;

    let { report_type, application_type, manager_name } = req.body;
    if (organization === undefined || organization === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Organization is required',
        field: 'organization',
      });
    }

    if (department === undefined || department === '') {
      department = 'DEFAULT';
    }
    if (user_email === undefined || user_email === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Email is required',
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

    if (!moment(from, 'MM-DD-YYYY').isValid()) {
      return res.status(400).json({
        code: 'INVALID_DATE',
        description: 'from is invalid',
      });
    }

    if (!moment(to, 'MM-DD-YYYY').isValid()) {
      return res.status(400).json({
        code: 'INVALID_DATE',
        description: 'To is invalid',
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
      from = new Date(from);
      till = new Date(till);
    }
    logger.debug('From', from);
    logger.debug('Till', till);

    let query = null;
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
    } else if (const_config.isAllowedRole(role, ['MANAGER'])) {
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

    if (application_type === 'app') {
      let reports = [];

      let allRecords = await Activity.aggregate([
        {
          $match: query,
        },

        { $unwind: '$activeApps' },

        {
          $group: {
            _id: {
              category: '$activeApps.category',
              isAuthorized: '$activeApps.isAuthorized',
            },

            totalMinutes: {
              $sum: {
                $divide: [
                  {
                    $subtract: ['$activeApps.endTime', '$activeApps.startTime'],
                  },
                  1000 * 60,
                ],
              },
            },
          },
        },
        {
          $group: {
            _id: '$_id.category',

            data: {
              $push: {
                authorized: '$_id.isAuthorized',
                count: '$totalMinutes',
              },
            },
          },
        },
        { $sort: { minutes: -1 } },
      ]);
      if (report_type === 'csv') {
        try {
          const items = allRecords.map((each) => {
            each.data.forEach((eachData) => {
              if (eachData.authorized === 'true') {
                each.authorized = eachData.count;
              } else if (eachData.authorized === 'false') {
                each.unauthorized = eachData.count;
              }
            });

            delete each.data;

            return each;
          });

          for (let i = 0; i < items.length; i++) {
            let minHr = items[i].authorized;
            var num = minHr;
            var hours = num / 60;
            var rhours = Math.floor(hours);
            var minutes = (hours - rhours) * 60;
            var rminutes = Math.round(minutes);
            minHr =
              rhours.toString().padStart(2, '0') +
              ':' +
              rminutes.toString().padStart(2, '0');

            let minHr1 = items[i].unauthorized;
            var num1 = minHr1;
            var hours1 = num1 / 60;
            var rhours1 = Math.floor(hours1);
            var minutes1 = (hours1 - rhours1) * 60;
            var rminutes1 = Math.round(minutes1);
            minHr1 =
              rhours1.toString().padStart(2, '0') +
              ':' +
              rminutes1.toString().padStart(2, '0');

            let record = {
              Organization: organization,
              Department: department,
              Category: items[i]._id,
              Authorized: minHr,
              UnAuthorized: minHr1,
            };
            reports.push(record);
          }

          const fields = [
            'Organization',
            'Department',
            'Category',
            'Authorized',
            'UnAuthorized',
          ];
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
          message: 'User report fetched successfully',
          data: allRecords,
        });
      }
    } else {
      let reports = [];

      let allRecords = await Activity.aggregate([
        {
          $match: query,
        },

        { $unwind: '$visitedWeb' },

        {
          $group: {
            _id: {
              category: '$visitedWeb.category',
              isAuthorized: '$visitedWeb.isAuthorized',
            },

            totalMinutes: {
              $sum: {
                $divide: [
                  {
                    $subtract: ['$visitedWeb.endTime', '$visitedWeb.startTime'],
                  },
                  1000 * 60,
                ],
              },
            },
          },
        },
        {
          $group: {
            _id: '$_id.category',

            data: {
              $push: {
                authorized: '$_id.isAuthorized',

                count: '$totalMinutes',
              },
            },
          },
        },
        { $sort: { minutes: -1 } },
      ]);
      if (report_type === 'csv') {
        try {
          const items = allRecords.map((each) => {
            each.data.forEach((eachData) => {
              if (eachData.authorized === 'true') {
                each.authorized = eachData.count;
              } else if (eachData.authorized === 'false') {
                each.unauthorized = eachData.count;
              }
            });

            delete each.data;

            return each;
          });

          for (let i = 0; i < items.length; i++) {
            let minHr = items[i].authorized;
            var num = minHr;
            var hours = num / 60;
            var rhours = Math.floor(hours);
            var minutes = (hours - rhours) * 60;
            var rminutes = Math.round(minutes);
            minHr =
              rhours.toString().padStart(2, '0') +
              ':' +
              rminutes.toString().padStart(2, '0');

            let minHr1 = items[i].unauthorized;
            var num1 = minHr1;
            var hours1 = num1 / 60;
            var rhours1 = Math.floor(hours1);
            var minutes1 = (hours1 - rhours1) * 60;
            var rminutes1 = Math.round(minutes1);
            minHr1 =
              rhours1.toString().padStart(2, '0') +
              ':' +
              rminutes1.toString().padStart(2, '0');

            let record = {
              Organization: organization,
              Department: department,
              Category: items[i]._id,
              Authorized: minHr,
              UnAuthorized: minHr1,
            };
            reports.push(record);
          }

          const fields = [
            'Organization',
            'Department',
            'Category',
            'Authorized',
            'UnAuthorized',
          ];
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
          message: ' Report fetched successfully',
          data: allRecords,
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

const userByAuthorizeVsUnauthorizeCategory = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let assigned_to = req.assigned_to;
    let user_email = req.user_email;

    let { report_type, manager_name, category, type } = req.body;
    let { from, to } = req.query;
    if (organization === undefined || organization === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Organization is required',
        field: 'organization',
      });
    }

    if (department === undefined || department === '') {
      department = 'DEFAULT';
    }
    if (user_email === undefined || user_email === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Email is required',
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

    if (type === undefined || type === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Type is required',
        field: 'type',
      });
    }

    if (category === undefined || category === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Category is required',
        field: 'category',
      });
    }

    if (!moment(from, 'MM-DD-YYYY').isValid()) {
      return res.status(400).json({
        code: 'INVALID_DATE',
        description: 'from is invalid',
      });
    }

    if (!moment(to, 'MM-DD-YYYY').isValid()) {
      return res.status(400).json({
        code: 'INVALID_DATE',
        description: 'To is invalid',
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
    logger.debug('From', from);
    logger.debug('Till', till);
    let reports = [];

    let query = null;
    if (type === 'app') {
      if (const_config.isAllowedRole(role, ['AGENT'])) {
        query = {
          organization: organization,
          department: department,
          user_email: user_email,
          'activeApps.category': category,
          date: {
            $gte: from,
            $lt: till,
          },
        };
      } else if (const_config.isAllowedRole(role, ['MANAGER'])) {
        query = {
          organization: organization,
          assigned_to: user_email,
          'activeApps.category': category,
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
            'activeApps.category': category,

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
              'activeApps.category': category,

              date: {
                $gte: from,
                $lt: till,
              },
            };
          } else {
            query = {
              organization: organization,
              department: department,
              'activeApps.category': category,
              date: {
                $gte: from,
                $lt: till,
              },
            };
          }
        }
      }
      if (report_type === 'csv') {
        let activeApps = await Activity.aggregate([
          {
            $match: query,
          },
          { $unwind: '$activeApps' },
          {
            $group: {
              _id: {
                organization: '$organization',
                department: '$department',
                user_email: '$user_email',
                isAuthorized: '$activeApps.isAuthorized',
                date: {
                  $dateToString: {
                    format: '%m-%d-%Y',
                    date: '$date',
                  },
                },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { '_id.date': -1 } },

          {
            $group: {
              _id: {
                date: '$_id.date',
                organization: '$_id.organization',
                department: '$_id.department',
                isAuthorized: '$_id.isAuthorized',
              },
              userCount: { $sum: 1 },
            },
          },
          { $sort: { '_id.isAuthorized': 1 } },
          {
            $group: {
              _id: {
                date: '$_id.date',
                organization: '$_id.organization',
                department: '$_id.department',
              },
              data: {
                $push: {
                  authorizedFlag: '$_id.isAuthorized',
                  userCount: '$userCount',
                },
              },
            },
          },
        ]);

        for (let i = 0; i < activeApps.length; i++) {
          let record;
          if (activeApps[i].data.length === 2) {
            logger.debug('enter in false');
            record = {
              Organization: activeApps[i]._id.organization,
              Department: activeApps[i]._id.department,
              Date: activeApps[i]._id.date,
              UnAuthorized_User_Count: activeApps[i].data[0].userCount,
              Authorized_User_Count: activeApps[i].data[1].userCount,
            };
            reports.push(record);
          } else if (activeApps[i].data[0].authorizedFlag === 'true') {
            record = {
              Organization: activeApps[i]._id.organization,
              Department: activeApps[i]._id.department,
              Date: activeApps[i]._id.date,
              UnAuthorized_User_Count: 0,
              Authorized_User_Count:
                activeApps[i].data[0] !== undefined
                  ? activeApps[i].data[0].userCount
                  : 0,
            };
            reports.push(record);
          } else if (activeApps[i].data[0].authorizedFlag === 'false') {
            record = {
              Organization: activeApps[i]._id.organization,
              Department: activeApps[i]._id.department,
              Date: activeApps[i]._id.date,
              UnAuthorized_User_Count:
                activeApps[i].data[0] !== undefined
                  ? activeApps[i].data[0].userCount
                  : 0,
              Authorized_User_Count: 0,
            };
            reports.push(record);
          }
        }
        try {
          const fields = [
            'Organization',
            'Department',
            'Date',
            'UnAuthorized_User_Count',
            'Authorized_User_Count',
          ];
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
        let activeApps = await Activity.aggregate([
          {
            $match: query,
          },
          { $unwind: '$activeApps' },
          {
            $group: {
              _id: {
                user_email: '$user_email',
                isAuthorized: '$activeApps.isAuthorized',
                date: {
                  $dateToString: {
                    format: '%m-%d-%Y',
                    date: '$date',
                  },
                },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { '_id.date': -1 } },
          {
            $group: {
              _id: {
                date: '$_id.date',
                isAuthorized: '$_id.isAuthorized',
              },
              userCount: { $sum: 1 },
            },
          },
          {
            $group: {
              _id: '$_id.isAuthorized',
              data: {
                $push: {
                  date: '$_id.date',
                  userCount: '$userCount',
                },
              },
            },
          },
        ]);
        {
          return res.status(200).json({
            message: 'User report fetched successfully',
            data: activeApps,
          });
        }
      }
    } else {
      if (const_config.isAllowedRole(role, ['AGENT'])) {
        query = {
          organization: organization,
          department: department,
          user_email: user_email,
          'visitedWeb.category': category,
          date: {
            $gte: from,
            $lt: till,
          },
        };
      } else if (const_config.isAllowedRole(role, ['MANAGER'])) {
        query = {
          organization: organization,
          assigned_to: user_email,
          'visitedWeb.category': category,
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
            'visitedWeb.category': category,
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
              'visitedWeb.category': category,
              date: {
                $gte: from,
                $lt: till,
              },
            };
          } else {
            query = {
              organization: organization,
              department: department,
              'visitedWeb.category': category,
              date: {
                $gte: from,
                $lt: till,
              },
            };
          }
        }
      }

      if (report_type === 'csv') {
        try {
          let activeWebs = await Activity.aggregate([
            {
              $match: query,
            },
            { $unwind: '$visitedWeb' },
            {
              $group: {
                _id: {
                  organization: '$organization',
                  department: '$department',
                  user_email: '$user_email',
                  isAuthorized: '$visitedWeb.isAuthorized',
                  date: {
                    $dateToString: {
                      format: '%m-%d-%Y',
                      date: '$date',
                    },
                  },
                },
                count: { $sum: 1 },
              },
            },
            { $sort: { '_id.date': -1 } },

            {
              $group: {
                _id: {
                  date: '$_id.date',
                  organization: '$_id.organization',
                  department: '$_id.department',
                  isAuthorized: '$_id.isAuthorized',
                },
                userCount: { $sum: 1 },
              },
            },
            { $sort: { '_id.isAuthorized': 1 } },
            {
              $group: {
                _id: {
                  date: '$_id.date',
                  organization: '$_id.organization',
                  department: '$_id.department',
                },
                data: {
                  $push: {
                    authorizedFlag: '$_id.isAuthorized',
                    userCount: '$userCount',
                  },
                },
              },
            },
          ]);

          for (let i = 0; i < activeWebs.length; i++) {
            let record;
            if (activeWebs[i].data.length === 2) {
              logger.debug('enter in false');
              record = {
                Organization: activeWebs[i]._id.organization,
                Department: activeWebs[i]._id.department,
                Date: activeWebs[i]._id.date,
                UnAuthorized_User_Count: activeWebs[i].data[0].userCount,
                Authorized_User_Count: activeWebs[i].data[1].userCount,
              };
              reports.push(record);
            } else if (activeWebs[i].data[0].authorizedFlag === 'true') {
              record = {
                Organization: activeWebs[i]._id.organization,
                Department: activeWebs[i]._id.department,
                Date: activeWebs[i]._id.date,
                UnAuthorized_User_Count: 0,
                Authorized_User_Count:
                  activeWebs[i].data[0] !== undefined
                    ? activeWebs[i].data[0].userCount
                    : 0,
              };
              reports.push(record);
            } else if (activeWebs[i].data[0].authorizedFlag === 'false') {
              record = {
                Organization: activeWebs[i]._id.organization,
                Department: activeWebs[i]._id.department,
                Date: activeWebs[i]._id.date,
                UnAuthorized_User_Count:
                  activeWebs[i].data[0] !== undefined
                    ? activeWebs[i].data[0].userCount
                    : 0,
                Authorized_User_Count: 0,
              };
              reports.push(record);
            }
          }
          const fields = [
            'Organization',
            'Department',
            'Date',
            'UnAuthorized_User_Count',
            'Authorized_User_Count',
          ];
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
        let activeWebs = await Activity.aggregate([
          {
            $match: query,
          },
          { $unwind: '$visitedWeb' },
          {
            $group: {
              _id: {
                user_email: '$user_email',
                isAuthorized: '$visitedWeb.isAuthorized',
                date: {
                  $dateToString: {
                    format: '%m-%d-%Y',
                    date: '$date',
                  },
                },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { '_id.date': -1 } },
          {
            $group: {
              _id: {
                date: '$_id.date',
                isAuthorized: '$_id.isAuthorized',
              },
              userCount: { $sum: 1 },
            },
          },
          {
            $group: {
              _id: '$_id.isAuthorized',
              data: {
                $push: {
                  date: '$_id.date',
                  userCount: '$userCount',
                },
              },
            },
          },
        ]);
        return res.status(200).json({
          message: 'User report fetched successfully',
          data: activeWebs,
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
const getCategoryList = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let assigned_to = req.assigned_to;
    let user_email = req.user_email;

    let { type, manager_name } = req.body;

    if (organization === undefined || organization === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Organization is required',
        field: 'organization',
      });
    }

    if (department === undefined || department === '') {
      department = 'DEFAULT';
    }
    if (user_email === undefined || user_email === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Email is required',
        field: 'user_email',
      });
    }
    if (type === undefined || type === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Type is required',
        field: 'type',
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

    if (type === 'app') {
      let categoryList = await Activity.aggregate([
        {
          $match: query,
        },
        { $unwind: '$activeApps' },
        {
          $group: {
            _id: '$activeApps.category',
          },
        },
      ]);

      return res.status(200).json({
        message: 'Category list for app fetched successfully',
        data: categoryList,
      });
    } else {
      let categoryList = await Activity.aggregate([
        {
          $match: query,
        },
        { $unwind: '$visitedWeb' },
        {
          $group: {
            _id: '$visitedWeb.category',
          },
        },
      ]);

      return res.status(200).json({
        message: 'Category list for web fetched successfully',
        data: categoryList,
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

const getAppDashboardByConfig = async (req, res, next) => {
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

    if (user_email === undefined || user_email === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Email is required',
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

    logger.debug('type', type);

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

    if (type === 'Organization') {
      let { organization_name } = req.body;

      let departmentName;
      let departmentsArray;
      let inDepartments = [];

      if (const_config.isAllowedRole(role, ['SUPER_ADMIN'])) {
        departmentName = await Department.findOne(
          { organization: organization_name },
          'department_array.name'
        );

        console.log('departmentName', departmentName);

        for (let i = 0; i < departmentName.department_array.length; i++) {
          let element = departmentName.department_array[i].name;
          inDepartments.push(element);
          // logger.debug("element", element)
        }
        console.log('inDepartments', inDepartments);

        departmentsArray = departmentName.department_array;
        query = {
          organization: organization_name,
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

        for (
          let j = 0;
          j < tempDepartmentName.organization_array.length;
          j++
        ) {
          let orgName = tempDepartmentName.organization_array[j].name;
          if (orgName === organization_name) {
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
          organization: organization_name,
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
          if (orgName === organization_name) {
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
          organization: organization_name,
          department: { $in: inDepartments },
          date: {
            $gte: from,
            $lt: till,
          },
        };
      }
    } else {
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
    }

    let results = await Activity.aggregate([
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
          apps: { $setUnion: ['$activeApps', '$visitedWeb'] },
        },
      },

      { $unwind: '$apps' },

      {
        $group: {
          _id: {
            category: '$apps.category',
            is_productive: '$apps.is_productive',
            name: '$apps.name',
          },
          totalMinutes: {
            $sum: {
              $divide: [
                { $subtract: ['$apps.endTime', '$apps.startTime'] },
                1000 * 60,
              ],
            },
          },
        },
      },
      {
        $project: {
          '_id.name': { $arrayElemAt: [{ $split: ['$_id.name', ') '] }, -1] },
          '_id.category': 1,
          '_id.is_productive': 1,
          'apps.name': 1,
          totalMinutes: 1,
        },
      },
      {
        $project: {
          '_id.name': { $arrayElemAt: [{ $split: ['$_id.name', '| '] }, -1] },
          '_id.category': 1,
          '_id.is_productive': 1,
          'apps.name': 1,
          totalMinutes: 1,
        },
      },
      {
        $project: {
          '_id.name': { $arrayElemAt: [{ $split: ['$_id.name', '- '] }, -1] },
          '_id.category': 1,
          '_id.is_productive': 1,
          'apps.name': 1,
          totalMinutes: 1,
        },
      },
      {
        $project: {
          '_id.name': { $arrayElemAt: [{ $split: ['$_id.name', '-'] }, -1] },
          '_id.category': 1,
          '_id.is_productive': 1,
          'apps.name': 1,
          totalMinutes: 1,
        },
      },

      {
        $project: {
          '_id.name': {
            $replaceAll: {
              input: '$_id.name',
              find: ' Google Chrome',
              replacement: 'Google Chrome',
            },
          },
          '_id.category': 1,
          '_id.is_productive': 1,
          'apps.name': 1,
          totalMinutes: 1,
        },
      },
      {
        $project: {
          '_id.name': {
            $replaceAll: {
              input: '$_id.name',
              find: 'WhatsApp Web',
              replacement: 'Google Chrome',
            },
          },
          '_id.category': 1,
          '_id.is_productive': 1,
          'apps.name': 1,
          totalMinutes: 1,
        },
      },
      {
        $project: {
          '_id.name': {
            $replaceAll: {
              input: '$_id.name',
              find: 'Google Search',
              replacement: 'Google Chrome',
            },
          },
          '_id.category': 1,
          '_id.is_productive': 1,
          'apps.name': 1,
          totalMinutes: 1,
        },
      },
      {
        $group: {
          _id: {
            category: '$_id.category',
            is_productive: '$_id.is_productive',
            name: '$_id.name',
          },
          totalMinutes: { $sum: '$totalMinutes' },
        },
      },
      {
        $group: {
          _id: '$_id.category',
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
                  $eq: ['$_id.is_productive', false],
                },
                {
                  name: '$_id.name',
                  minutes: '$totalMinutes',
                },
                '$$REMOVE',
              ],
            },
          },
        },
      },
    ]);

    let categoryData = await Category.aggregate([
      {
        $match: {
          organization,
          department,
        },
      },
      {
        $group: {
          _id: {
            category_name: '$category_name',
          },
          data: {
            $push: {
              authorized: '$authorized',
              unauthorized: '$unauthorized',
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          category_name: '$_id.category_name',
          data: 1,
          visitedWeb: 1,
        },
      },
    ]);

    let finalArray = [];

    for (let i = 0; i < categoryData.length; i++) {
      let authorizedArray = [];
      let unAuthorizedArray = [];

      for (let j = 0; j < categoryData[i].data.length; j++) {
        authorizedArray = authorizedArray.concat(
          categoryData[i].data[j].authorized
        );
        unAuthorizedArray = unAuthorizedArray.concat(
          categoryData[i].data[j].unauthorized
        );
      }
      let entry = {
        _id: categoryData[i].category_name,
        productive: authorizedArray,
        un_productive: unAuthorizedArray,
      };
      finalArray.push(entry);
    }

    for (let i = 0; i < finalArray.length; i++) {
      var result = finalArray[i].productive.reduce((unique, o) => {
        if (!unique.some((obj) => obj.name === o.name)) {
          unique.push(o);
        }
        return unique;
      }, []);

      finalArray[i].productive = result;
      var result1 = finalArray[i].un_productive.reduce((unique, o) => {
        if (!unique.some((obj) => obj.name === o.name)) {
          unique.push(o);
        }
        return unique;
      }, []);
      finalArray[i].un_productive = result1;
    }

    for (let i = 0; i < results.length; i++) {
      if (results[i]._id !== 'OTHER') {
        for (let j = 0; j < finalArray.length; j++) {
          if (results[i]._id === finalArray[j]._id) {
            results[i].productive = results[i].productive.concat(
              finalArray[j].productive
            );
            results[i].un_productive = results[i].un_productive.concat(
              finalArray[j].un_productive
            );
          }
        }
      }
    }

    for (let i = 0; i < results.length; i++) {
      if (results[i]._id !== 'OTHER') {
        for (let j = 0; j < results[i].productive.length; j++) {
          let items = results[i].productive.filter(
            (e) => e.name === results[i].productive[j].name
          );
          if (items.length > 1) {
            items.forEach(function (item) {
              if (item.minutes === undefined) {
                results[i].productive = results[i].productive.filter(
                  (e) => e._id !== item._id
                );
              }
            });
          } else {
            results[i].productive[j].minutes = 0;
          }
        }
        for (let j = 0; j < results[i].un_productive.length; j++) {
          let items = results[i].un_productive.filter(
            (e) => e.name === results[i].un_productive[j].name
          );
          if (items.length > 1) {
            items.forEach(function (item) {
              if (item.minutes === undefined) {
                results[i].un_productive = results[i].un_productive.filter(
                  (e) => e._id !== item._id
                );
              }
            });
          } else {
            results[i].un_productive[j].minutes = 0;
          }
        }
      }
    }
    let reports = [];
    let reports1 = [];

    if (report_type === 'csv') {
      try {
        for (let i = 0; i < results.length; i++) {
          for (let j = 0; j < results[i].productive.length; j++) {
            let productive_minutes =
              results[i].productive[j].minutes !== undefined
                ? results[i].productive[j].minutes
                : 0;
            var num = productive_minutes;
            var hours = num / 60;
            var rhours = Math.floor(hours);
            var idleminutes = (hours - rhours) * 60;
            var rminutes = Math.round(idleminutes);
            productive_minutes =
              rhours.toString().padStart(2, '0') +
              ':' +
              rminutes.toString().padStart(2, '0');

            let entry = {
              Category: results[i]._id,
              Name: results[i].productive[j].name,
              Minutes: productive_minutes,
              Productive: true,
            };
            reports.push(entry);
          }
          for (let k = 0; k < results[i].un_productive.length; k++) {
            let unproductive_minutes =
              results[i].un_productive[k].minutes !== undefined
                ? results[i].un_productive[k].minutes
                : 0;
            var num1 = unproductive_minutes;
            var hours1 = num1 / 60;
            var rhours1 = Math.floor(hours1);
            var idleminutes1 = (hours1 - rhours1) * 60;
            var rminutes1 = Math.round(idleminutes1);
            unproductive_minutes =
              rhours1.toString().padStart(2, '0') +
              ':' +
              rminutes1.toString().padStart(2, '0');
            let entry1 = {
              Category: results[i]._id,
              Name: results[i].un_productive[k].name,
              Minutes: unproductive_minutes,
              Productive: false,
            };
            reports.push(entry1);
          }
        }
        const fields = ['Category', 'Name', 'Minutes', 'Productive'];
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
        message: 'App Visits and total time in minutes fetched successfully',
        data: results,
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

const getAppWebTotalProdUnProd = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let assigned_to = req.assigned_to;
    let user_email = req.user_email;
    let { from, to, manager_name, type } = req.body;
    if (organization === undefined || organization === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Organization is required',
        field: 'organization',
      });
    }

    if (user_email === undefined || user_email === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Email is required',
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

    let query = null;
    if (type === 'Organization') {
      let { organization_name } = req.body;

      let departmentName;
      let departmentsArray;
      let inDepartments = [];

      if (const_config.isAllowedRole(role, ['SUPER_ADMIN'])) {
        departmentName = await Department.findOne(
          { organization: organization_name },
          'department_array.name'
        );

        console.log('departmentName', departmentName);

        for (let i = 0; i < departmentName.department_array.length; i++) {
          let element = departmentName.department_array[i].name;
          inDepartments.push(element);
          // logger.debug("element", element)
        }
        console.log('inDepartments', inDepartments);

        departmentsArray = departmentName.department_array;
        query = {
          organization: organization_name,
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

        for (
          let j = 0;
          j < tempDepartmentName.organization_array.length;
          j++
        ) {
          let orgName = tempDepartmentName.organization_array[j].name;
          if (orgName === organization_name) {
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
          organization: organization_name,
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
          if (orgName === organization_name) {
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
          organization: organization_name,
          department: { $in: inDepartments },
          date: {
            $gte: from,
            $lt: till,
          },
        };
      }
    } else {
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
        logger.debug('data');
        if (department === 'ALL') {
          logger.debug('data11');

          query = {
            organization: organization,
            date: {
              $gte: from,
              $lt: till,
            },
          };
        } else {
          if (!(manager_name === undefined || manager_name === '')) {
            logger.debug('data33');

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
            logger.debug('data444');
            logger.debug('department', department);

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
    }
    logger.debug('role', role);

    logger.debug('query', query);

    let sum = await Activity.aggregate([
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
            category: '$activeApps.category',
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
          _id: '$name',
          productive: {
            $push: {
              $cond: [
                {
                  $eq: ['$_id.is_productive', true],
                },
                {
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
                    {
                      $ne: ['$_id.category', 'OTHER'],
                    },
                  ],
                },
                {
                  name: '$_id.name',
                  minutes: '$totalMinutes',
                },
                '$$REMOVE',
              ],
            },
          },
          other: {
            $push: {
              $cond: [
                {
                  $and: [
                    {
                      $eq: ['$_id.is_productive', false],
                    },
                    {
                      $eq: ['$_id.category', 'OTHER'],
                    },
                  ],
                },
                {
                  name: '$_id.name',
                  minutes: '$totalMinutes',
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
          productive: { $sum: '$productive.minutes' },
          un_productive: { $sum: '$un_productive.minutes' },
          other: { $sum: '$other.minutes' },
        },
      },
    ]);
    let productive = await Activity.aggregate([
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
          apps: { $setUnion: ['$activeApps', '$visitedWeb'] },
        },
      },
      { $unwind: '$apps' },
      {
        $match: { 'apps.category': { $ne: 'OTHER' } },
      },
      {
        $group: {
          _id: {
            is_productive: '$apps.is_productive',
            category: '$apps.category',
          },
          totalMinutes: {
            $sum: {
              $divide: [
                { $subtract: ['$apps.endTime', '$apps.startTime'] },
                1000 * 60,
              ],
            },
          },
        },
      },
      {
        $group: {
          _id: '$_id.category',
          productive: {
            $push: {
              $cond: [
                {
                  $and: [
                    {
                      $eq: ['$_id.is_productive', true],
                    },
                    {
                      $ne: ['$_id.category', 'OTHER'],
                    },
                  ],
                },
                {
                  minutes: '$totalMinutes',
                },
                '$$REMOVE',
              ],
            },
          },
        },
      },
      {
        $project: {
          _id: 1,
          productive: { $sum: '$productive.minutes' },
        },
      },
      {
        $sort: { _id: -1 },
      },
    ]);
    let un_productive = await Activity.aggregate([
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
          apps: { $setUnion: ['$activeApps', '$visitedWeb'] },
        },
      },
      { $unwind: '$apps' },
      {
        $match: { 'apps.category': { $ne: 'OTHER' } },
      },
      {
        $group: {
          _id: {
            is_productive: '$apps.is_productive',
            category: '$apps.category',
          },
          totalMinutes: {
            $sum: {
              $divide: [
                { $subtract: ['$apps.endTime', '$apps.startTime'] },
                1000 * 60,
              ],
            },
          },
        },
      },
      {
        $group: {
          _id: '$_id.category',
          un_productive: {
            $push: {
              $cond: [
                {
                  $and: [
                    {
                      $eq: ['$_id.is_productive', false],
                    },
                    {
                      $ne: ['$_id.category', 'OTHER'],
                    },
                  ],
                },
                {
                  minutes: '$totalMinutes',
                },
                '$$REMOVE',
              ],
            },
          },
        },
      },
      {
        $project: {
          _id: 1,
          un_productive: { $sum: '$un_productive.minutes' },
        },
      },
      {
        $sort: { _id: -1 },
      },
    ]);

    return res.status(200).json({
      message: 'Total App and Web time fetched successfully',
      data: sum,
      productive: productive,
      un_productive: un_productive,
    });
  } catch (error) {
    logger.error(error);
    return res.status(500).json({
      code: 'SERVER_ERROR',
      description: 'something went wrong, Please try again',
    });
  }
};
//app web config
const getAppDashboardByConfigNew = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let assigned_to = req.assigned_to;
    let user_email = req.user_email;

    let { from, to, manager_name, report_type, type, name } = req.body;
    if (organization === undefined || organization === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Organization is required',
        field: 'organization',
      });
    }

    if (user_email === undefined || user_email === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Email is required',
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

    logger.debug('type', type);

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

    let category_query = null;

    if (type === 'Organization') {
      let { organization_name } = req.body;

      let departmentName;
      let departmentsArray;
      let inDepartments = [];

      if (const_config.isAllowedRole(role, ['SUPER_ADMIN'])) {
        departmentName = await Department.findOne(
          { organization: organization_name },
          'department_array.name'
        );

        console.log('departmentName', departmentName);

        for (let i = 0; i < departmentName.department_array.length; i++) {
          let element = departmentName.department_array[i].name;
          inDepartments.push(element);
          // logger.debug("element", element)
        }
        console.log('inDepartments', inDepartments);

        departmentsArray = departmentName.department_array;
        query = {
          organization: organization_name,
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

        for (
          let j = 0;
          j < tempDepartmentName.organization_array.length;
          j++
        ) {
          let orgName = tempDepartmentName.organization_array[j].name;
          if (orgName === organization_name) {
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
          organization: organization_name,
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
          if (orgName === organization_name) {
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
          organization: organization_name,
          department: { $in: inDepartments },
          date: {
            $gte: from,
            $lt: till,
          },
        };
      }


    } else {
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
    }


    if (name === 'APP') {
      let results = await Activity.aggregate([
        {
          $match: query,
        },
        { $unwind: '$activeApps' },
        {
          $group: {
            _id: {
              category: '$activeApps.category',
              is_productive: '$activeApps.is_productive',
              name: '$activeApps.name',
            },
            totalMinutes: {
              $sum: {
                $divide: [
                  {
                    $subtract: [
                      '$activeApps.endTime',
                      '$activeApps.startTime',
                    ],
                  },
                  1000 * 60,
                ],
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            category: '$_id.category',
            is_productive: '$_id.is_productive',
            name: '$_id.name',
            minutes: { $round: ['$totalMinutes', 0] },
          },
        },
        {
          $match: { minutes: { $ne: 0 } },
        },
        {
          $sort: {
            '_id.name': 1,
          },
        },
        {
          $group: {
            _id: '$category',
            productive: {
              $push: {
                $cond: [
                  {
                    $eq: ['$is_productive', true],
                  },
                  {
                    name: '$name',
                    minutes: '$minutes',
                  },
                  '$$REMOVE',
                ],
              },
            },
            un_productive: {
              $push: {
                $cond: [
                  {
                    $eq: ['$is_productive', false],
                  },
                  {
                    name: '$name',
                    minutes: '$minutes',
                  },
                  '$$REMOVE',
                ],
              },
            },
          },
        },
        {
          $project: {
            _id: '$_id',
            productive: '$productive',
            un_productive: '$un_productive',
          },
        },
      ]);

      if (report_type === 'csv') {
        try {
          let reports = [];
          for (let i = 0; i < results.length; i++) {
            for (let j = 0; j < results[i].productive.length; j++) {
              let productive_minutes =
                results[i].productive[j].minutes !== undefined
                  ? results[i].productive[j].minutes
                  : 0;
              var num = productive_minutes;
              var hours = num / 60;
              var rhours = Math.floor(hours);
              var idleminutes = (hours - rhours) * 60;
              var rminutes = Math.round(idleminutes);
              productive_minutes =
                rhours.toString().padStart(2, '0') +
                ':' +
                rminutes.toString().padStart(2, '0');

              let entry = {
                Category: results[i]._id,
                Name: results[i].productive[j].name,
                Minutes: productive_minutes,
                Productive: true,
              };
              reports.push(entry);
            }
            for (let k = 0; k < results[i].un_productive.length; k++) {
              let unproductive_minutes =
                results[i].un_productive[k].minutes !== undefined
                  ? results[i].un_productive[k].minutes
                  : 0;
              var num1 = unproductive_minutes;
              var hours1 = num1 / 60;
              var rhours1 = Math.floor(hours1);
              var idleminutes1 = (hours1 - rhours1) * 60;
              var rminutes1 = Math.round(idleminutes1);
              unproductive_minutes =
                rhours1.toString().padStart(2, '0') +
                ':' +
                rminutes1.toString().padStart(2, '0');
              let entry1 = {
                Category: results[i]._id,
                Name: results[i].un_productive[k].name,
                Minutes: unproductive_minutes,
                Productive: false,
              };
              reports.push(entry1);
            }
          }

          let array_res = [];
          for (let l = 0; l < reports.length; l++) {
            let entry = {
              Category: reports[l].Category,
              Name: reports[l].Name,
              'Time (hh:mm)': reports[l].Minutes,
              Type:
                reports[l].Productive === true
                  ? 'Productive'
                  : 'Non-Productive',
            };
            array_res.push(entry);
          }

          const fields = ['Category', 'Name', 'Time (hh:mm)', 'Type'];
          const opts = { fields };
          const csv = parse(array_res, opts);
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
          message:
            'App Visits and total time in minutes fetched successfully',
          data: results,
        });
      }
    } else if (name === 'WEB') {
      logger.debug('web', query);

      let results = await Activity.aggregate([
        {
          $match: query,
        },
        { $unwind: '$visitedWeb' },
        {
          $group: {
            _id: {
              category: '$visitedWeb.category',
              is_productive: '$visitedWeb.is_productive',
              name: '$visitedWeb.domain',
            },
            totalMinutes: {
              $sum: {
                $divide: [
                  {
                    $subtract: [
                      '$visitedWeb.endTime',
                      '$visitedWeb.startTime',
                    ],
                  },
                  1000 * 60,
                ],
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            category: '$_id.category',
            is_productive: '$_id.is_productive',
            name: '$_id.name',
            minutes: { $round: ['$totalMinutes', 0] },
          },
        },
        {
          $match: { minutes: { $ne: 0 } },
        },
        {
          $sort: {
            '_id.name': 1,
          },
        },
        {
          $group: {
            _id: '$category',
            productive: {
              $push: {
                $cond: [
                  {
                    $eq: ['$is_productive', true],
                  },
                  {
                    name: '$name',
                    minutes: '$minutes',
                  },
                  '$$REMOVE',
                ],
              },
            },
            un_productive: {
              $push: {
                $cond: [
                  {
                    $eq: ['$is_productive', false],
                  },
                  {
                    name: '$name',
                    minutes: '$minutes',
                  },
                  '$$REMOVE',
                ],
              },
            },
          },
        },
        {
          $project: {
            _id: '$_id',
            productive: '$productive',
            un_productive: '$un_productive',
          },
        },
      ]);
      let reports = [];

      if (report_type === 'csv') {
        try {
          for (let i = 0; i < results.length; i++) {
            for (let j = 0; j < results[i].productive.length; j++) {
              let productive_minutes =
                results[i].productive[j].minutes !== undefined
                  ? results[i].productive[j].minutes
                  : 0;
              var num = productive_minutes;
              var hours = num / 60;
              var rhours = Math.floor(hours);
              var idleminutes = (hours - rhours) * 60;
              var rminutes = Math.round(idleminutes);
              productive_minutes =
                rhours.toString().padStart(2, '0') +
                ':' +
                rminutes.toString().padStart(2, '0');

              let entry = {
                Category: results[i]._id,
                Name: results[i].productive[j].name,
                Minutes: productive_minutes,
                Productive: true,
              };
              reports.push(entry);
            }
            for (let k = 0; k < results[i].un_productive.length; k++) {
              let unproductive_minutes =
                results[i].un_productive[k].minutes !== undefined
                  ? results[i].un_productive[k].minutes
                  : 0;
              var num1 = unproductive_minutes;
              var hours1 = num1 / 60;
              var rhours1 = Math.floor(hours1);
              var idleminutes1 = (hours1 - rhours1) * 60;
              var rminutes1 = Math.round(idleminutes1);
              unproductive_minutes =
                rhours1.toString().padStart(2, '0') +
                ':' +
                rminutes1.toString().padStart(2, '0');
              let entry1 = {
                Category: results[i]._id,
                Name: results[i].un_productive[k].name,
                Minutes: unproductive_minutes,
                Productive: false,
              };
              reports.push(entry1);
            }
          }

          let array_res = [];
          for (let l = 0; l < reports.length; l++) {
            let entry = {
              Category: reports[l].Category,
              Name: reports[l].Name,
              'Time (hh:mm)': reports[l].Minutes,
              Type:
                reports[l].Productive === true
                  ? 'Productive'
                  : 'Non-Productive',
            };
            array_res.push(entry);
          }
          const fields = ['Category', 'Name', 'Time (hh:mm)', 'Type'];
          const opts = { fields };
          const csv = parse(array_res, opts);
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
          message:
            'App Visits and total time in minutes fetched successfully',
          data: results,
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

//total
const getAppWebTotalProdUnProdNew = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let assigned_to = req.assigned_to;
    let user_email = req.user_email;
    let { from, to, manager_name, type, name } = req.body;
    if (organization === undefined || organization === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Organization is required',
        field: 'organization',
      });
    }

    if (user_email === undefined || user_email === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Email is required',
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

    let query = null;
    if (type === 'Organization') {
      let { organization_name } = req.body;

      let departmentName;
      let departmentsArray;
      let inDepartments = [];

      if (const_config.isAllowedRole(role, ['SUPER_ADMIN'])) {
        departmentName = await Department.findOne(
          { organization: organization_name },
          'department_array.name'
        );


        for (let i = 0; i < departmentName.department_array.length; i++) {
          let element = departmentName.department_array[i].name;
          inDepartments.push(element);
        }

        departmentsArray = departmentName.department_array;
        query = {
          organization: organization_name,
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

        for (
          let j = 0;
          j < tempDepartmentName.organization_array.length;
          j++
        ) {
          let orgName = tempDepartmentName.organization_array[j].name;
          if (orgName === organization_name) {
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
          organization: organization_name,
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
          if (orgName === organization_name) {
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
          organization: organization_name,
          department: { $in: inDepartments },
          date: {
            $gte: from,
            $lt: till,
          },
        };

        category_query = {
          organization: organization_name,
          department: { $in: inDepartments },
        };
      }


    } else {
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
          logger.debug('data11');

          query = {
            organization: organization,
            date: {
              $gte: from,
              $lt: till,
            },
          };
        } else {
          if (!(manager_name === undefined || manager_name === '')) {
            logger.debug('data33');

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
            logger.debug('data444');
            logger.debug('department', department);

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
    }


    if (name === 'APP') {
      let sum = await Activity.aggregate([
        {
          $match: query,
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
                  {
                    $subtract: [
                      '$activeApps.endTime',
                      '$activeApps.startTime',
                    ],
                  },
                  1000 * 60,
                ],
              },
            },
          },
        },
        {
          $group: {
            _id: '$_id.category',
            productive: {
              $push: {
                $cond: [
                  {
                    $and: [
                      {
                        $eq: ['$_id.is_productive', true],
                      },
                      {
                        $ne: ['$_id.category', 'OTHER'],
                      },
                    ],
                  },
                  {
                    minutes: { $round: ['$totalMinutes', 0] },
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
                      {
                        $ne: ['$_id.category', 'OTHER'],
                      },
                    ],
                  },
                  {
                    minutes: { $round: ['$totalMinutes', 0] },
                  },
                  '$$REMOVE',
                ],
              },
            },
            other: {
              $push: {
                $cond: [
                  {
                    $and: [
                      {
                        $eq: ['$_id.is_productive', false],
                      },
                      {
                        $eq: ['$_id.category', 'OTHER'],
                      },
                    ],
                  },
                  {
                    minutes: { $round: ['$totalMinutes', 0] },
                  },
                  '$$REMOVE',
                ],
              },
            },
          },
        },
        
        {
          $project: {
            _id: "$_id",
            productive: { $sum: '$productive.minutes' },
            un_productive: { $sum: '$un_productive.minutes' },
            other: { $sum: '$other.minutes' },
          },
        },
      ]);
      let total_productive = 0;
      let total_un_productive = 0;
      let total_other = 0;

      for (const entry of sum) {
        total_productive += entry.productive;
        total_un_productive += entry.un_productive;
        total_other += entry.other;
      }

      const result = [
        {
          "productive": total_productive,
          "un_productive": total_un_productive,
          "other": total_other
        }
      ];

      const productiveArray = sum.map(item => ({
        _id: item._id,
        productive: item.productive
      }));

      const unproductiveArray = sum.map(item => ({
        _id: item._id,
        productive: item.un_productive
      }));

      return res.status(200).json({
        message: 'Total App and Web time fetched successfully',
        data1: result,
        productive: productiveArray,
        un_productive: unproductiveArray,
      });
    } else if (name === 'WEB') {
      let sum = await Activity.aggregate([
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
                  {
                    $subtract: [
                      '$visitedWeb.endTime',
                      '$visitedWeb.startTime',
                    ],
                  },
                  1000 * 60,
                ],
              },
            },
          },
        },
        {
          $group: {
            _id: '$_id.category',
            productive: {
              $push: {
                $cond: [
                  {
                    $and: [
                      {
                        $eq: ['$_id.is_productive', true],
                      },
                      {
                        $ne: ['$_id.category', 'OTHER'],
                      },
                    ],
                  },
                  {
                    minutes: { $round: ['$totalMinutes', 0] },
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
                      {
                        $ne: ['$_id.category', 'OTHER'],
                      },
                    ],
                  },
                  {
                    minutes: { $round: ['$totalMinutes', 0] },
                  },
                  '$$REMOVE',
                ],
              },
            },
            other: {
              $push: {
                $cond: [
                  {
                    $and: [
                      {
                        $eq: ['$_id.is_productive', false],
                      },
                      {
                        $eq: ['$_id.category', 'OTHER'],
                      },
                    ],
                  },
                  {
                    minutes: { $round: ['$totalMinutes', 0] },
                  },
                  '$$REMOVE',
                ],
              },
            },
          },
        },
        
        {
          $project: {
            _id: "$_id",
            productive: { $sum: '$productive.minutes' },
            un_productive: { $sum: '$un_productive.minutes' },
            other: { $sum: '$other.minutes' },
          },
        },
      ]);

      let total_productive = 0;
      let total_un_productive = 0;
      let total_other = 0;

      for (const entry of sum) {
        total_productive += entry.productive;
        total_un_productive += entry.un_productive;
        total_other += entry.other;
      }

      const result = [
        {
          "productive": total_productive,
          "un_productive": total_un_productive,
          "other": total_other
        }
      ];

      const productiveArray = sum.map(item => ({
        _id: item._id,
        productive: item.productive
      }));

      const unproductiveArray = sum.map(item => ({
        _id: item._id,
        productive: item.un_productive
      }));

      return res.status(200).json({
        message: 'Total App and Web time fetched successfully',
        data: result,
        productive: productiveArray,
        un_productive: unproductiveArray
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

const getAppDashboardByConfigDateWise = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let assigned_to = req.assigned_to;
    let user_email = req.user_email;

    let { from, to, manager_name, type, report_type, name } = req.body;
    if (organization === undefined || organization === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Organization is required',
        field: 'organization',
      });
    }

    if (user_email === undefined || user_email === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Email is required',
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
    }
    logger.debug('from =', from);
    logger.debug('till =', till);

    let query = null;
    if (type === 'Organization') {
      let { organization_name } = req.body;

      let departmentName;
      let departmentsArray;
      let inDepartments = [];
      if (const_config.isAllowedRole(role, ['SUPER_ADMIN'])) {
        departmentName = await Department.findOne(
          { organization: organization_name },
          'department_array.name'
        );

        console.log('departmentName', departmentName);


        for (let i = 0; i < departmentName.department_array.length; i++) {
          let element = departmentName.department_array[i].name;
          inDepartments.push(element);
          // logger.debug("element", element)
        }
        console.log('inDepartments', inDepartments);

        departmentsArray = departmentName.department_array;
        query = {
          organization: organization_name,
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

        for (
          let j = 0;
          j < tempDepartmentName.organization_array.length;
          j++
        ) {
          let orgName = tempDepartmentName.organization_array[j].name;
          if (orgName === organization_name) {
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
          organization: organization_name,
          department: { $in: inDepartments },
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
          if (orgName === organization_name) {
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
          organization: organization_name,
          department: { $in: inDepartments },
          date: {
            $gte: from,
            $lt: till,
          },
        };

      }
    } else {
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
    }

    if (name === 'APP') {
      let sum = await Activity.aggregate([
        {
          $match: query,
        },
        {
          $project: {
            activeApps: 1,
          },
        },
        {
          $unwind: '$activeApps',
        },
        {
          $group: {
            _id: {
              category: '$activeApps.category',
              is_productive: '$activeApps.is_productive',
              name: '$activeApps.name',
            },
            totalMinutes: {
              $sum: {
                $divide: [
                  {
                    $subtract: ['$activeApps.endTime', '$activeApps.startTime'],
                  },
                  1000 * 60,
                ],
              },
            },
          },
        },
        {
          $group: {
            _id: '$_id.category',
            productive: {
              $push: {
                $cond: [
                  {
                    $eq: ['$_id.is_productive', true],
                  },
                  {
                    name: '$_id.name',
                    minutes: { $round: ['$totalMinutes', 0] },
                  },
                  '$$REMOVE',
                ],
              },
            },
            un_productive: {
              $push: {
                $cond: [
                  {
                    $eq: ['$_id.is_productive', false],
                  },
                  {
                    name: '$_id.name',
                    minutes: { $round: ['$totalMinutes', 0] },
                  },
                  '$$REMOVE',
                ],
              },
            },
          },
        },
        {
          $project: {
            _id: 1,
            productive: { $sum: '$productive.minutes' },
            un_productive: { $sum: '$un_productive.minutes' },
          },
        },
        {
          $match: {
            $nor: [{ productive: 0, un_productive: 0 }],
          },
        },
      ]);
      let reports = [];

      if (report_type === 'csv') {
        try {
          for (let i = 0; i < sum.length; i++) {
            let productive_minutes =
              sum[i].productive !== undefined ? sum[i].productive : 0;
            var num = productive_minutes;
            var hours = num / 60;
            var rhours = Math.floor(hours);
            var idleminutes = (hours - rhours) * 60;
            var rminutes = Math.round(idleminutes);
            productive_minutes =
              rhours.toString().padStart(2, '0') +
              ':' +
              rminutes.toString().padStart(2, '0');

            let unproductive_minutes =
              sum[i].un_productive !== undefined ? sum[i].un_productive : 0;
            var num1 = unproductive_minutes;
            var hours1 = num1 / 60;
            var rhours1 = Math.floor(hours1);
            var idleminutes1 = (hours1 - rhours1) * 60;
            var rminutes1 = Math.round(idleminutes1);
            unproductive_minutes =
              rhours1.toString().padStart(2, '0') +
              ':' +
              rminutes1.toString().padStart(2, '0');

            let entry1 = {
              Category: sum[i]._id,
              'Productive Time': productive_minutes,
              'Non Productive Time': unproductive_minutes,
            };
            reports.push(entry1);
          }
          const fields = ['Category', 'Productive Time', 'Non Productive Time'];
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
          message: 'App Visits and total time in minutes fetched successfully',
          data: sum,
        });
      }
    } else if (name === 'WEB') {
      let sum = await Activity.aggregate([
        {
          $match: query,
        },
        {
          $project: {
            visitedWeb: 1,
          },
        },
        {
          $unwind: '$visitedWeb',
        },
        {
          $group: {
            _id: {
              category: '$visitedWeb.category',
              is_productive: '$visitedWeb.is_productive',
              name: '$visitedWeb.domain',
            },
            totalMinutes: {
              $sum: {
                $divide: [
                  {
                    $subtract: ['$visitedWeb.endTime', '$visitedWeb.startTime'],
                  },
                  1000 * 60,
                ],
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            category: '$_id.category',
            is_productive: '$_id.is_productive',
            name: '$_id.name',
            totalMinutes: { $round: ['$totalMinutes', 0] },
          },
        },
        {
          $group: {
            _id: '$category',
            productive: {
              $push: {
                $cond: [
                  {
                    $eq: ['$is_productive', true],
                  },
                  {
                    name: '$name',
                    minutes: { $round: ['$totalMinutes', 0] },
                  },
                  '$$REMOVE',
                ],
              },
            },
            un_productive: {
              $push: {
                $cond: [
                  {
                    $eq: ['$is_productive', false],
                  },
                  {
                    name: '$name',
                    minutes: { $round: ['$totalMinutes', 0] },
                  },
                  '$$REMOVE',
                ],
              },
            },
          },
        },
        {
          $project: {
            _id: 1,
            productive: { $sum: '$productive.minutes' },
            un_productive: { $sum: '$un_productive.minutes' },
          },
        },
      ]);
      let reports = [];

      if (report_type === 'csv') {
        try {
          for (let i = 0; i < sum.length; i++) {
            let productive_minutes =
              sum[i].productive !== undefined ? sum[i].productive : 0;
            var num = productive_minutes;
            var hours = num / 60;
            var rhours = Math.floor(hours);
            var idleminutes = (hours - rhours) * 60;
            var rminutes = Math.round(idleminutes);
            productive_minutes =
              rhours.toString().padStart(2, '0') +
              ':' +
              rminutes.toString().padStart(2, '0');

            let unproductive_minutes =
              sum[i].un_productive !== undefined ? sum[i].un_productive : 0;
            var num1 = unproductive_minutes;
            var hours1 = num1 / 60;
            var rhours1 = Math.floor(hours1);
            var idleminutes1 = (hours1 - rhours1) * 60;
            var rminutes1 = Math.round(idleminutes1);
            unproductive_minutes =
              rhours1.toString().padStart(2, '0') +
              ':' +
              rminutes1.toString().padStart(2, '0');

            let entry1 = {
              Category: sum[i]._id,
              'Productive Time': productive_minutes,
              'Non Productive Time': unproductive_minutes,
            };
            reports.push(entry1);
          }
          const fields = ['Category', 'Productive Time', 'Non Productive Time'];
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
          message: 'App Visits and total time in minutes fetched successfully',
          data: sum,
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

module.exports = {
  geTopWebsitesVisited: geTopWebsitesVisited,
  geTopAppsUsed: geTopAppsUsed,
  getWebsiteUsageDateRange: getWebsiteUsageDateRange,
  getAppUsageDateRange: getAppUsageDateRange,
  getWebsiteUsageDateRangeByCategory: getWebsiteUsageDateRangeByCategory,
  getAppUsageDateRangeByCategory: getAppUsageDateRangeByCategory,
  getWebsiteProdVsNonProd: getWebsiteProdVsNonProd,
  getAppProdVsNonProd: getAppProdVsNonProd,
  getTopAppsAndWebsites: getTopAppsAndWebsites,
  timeSpentAuth: timeSpentAuth,
  totalSpentTimeByCategory: totalSpentTimeByCategory,
  totalSpentTimeByAuthorizeVsUnauthorizeCategory:
    totalSpentTimeByAuthorizeVsUnauthorizeCategory,
  userByAuthorizeVsUnauthorizeCategory: userByAuthorizeVsUnauthorizeCategory,
  getCategoryList: getCategoryList,
  getAppDashboardByConfig: getAppDashboardByConfig,
  getAppDashboardByConfigDateWise: getAppDashboardByConfigDateWise,
  getAppWebTotalProdUnProd: getAppWebTotalProdUnProd,
  getAppWebTotalProdUnProdNew: getAppWebTotalProdUnProdNew,
  getAppDashboardByConfigNew: getAppDashboardByConfigNew,
};
