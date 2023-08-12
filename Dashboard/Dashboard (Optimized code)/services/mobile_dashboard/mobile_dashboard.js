const Activity = require('../../models/activity');
const LeadTracking = require('../../models/lead_tracking');
const Department = require('../../models/department');
const AdminOrganization = require('../../models/admin_organization');
const AuditOrganization = require('../../models/audit_organization');
const Logger = require('../../configs/log');
const logger = new Logger('guru service');
const const_config = require('../../utility/util');
const moment = require('moment-timezone');
const util = require('../../fwks/util');
const Uuid = require('uuid');
const { parse } = require('json2csv');
const Users = require('../../models/users');

const todaysAnalytics = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;

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
    logger.debug('user_email', user_email);

    let date = new Date();
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
        .format('YYYY-MM-DDTHH:mm:ss.SSS[Z]');
      from = local_date;

      till = moment(jDateToday)
        .endOf('day')
        .tz(time_zone)
        .format('YYYY-MM-DD[T]HH:mm:ss.SSS[Z]'); //.add(23, 'hours').add(59, 'minutes').add(59, 'seconds').add(999, 'ms').format('YYYY-MM-DDTHH:mm:ss.SSS[Z]')
    }
    logger.info('From  == ', from);
    logger.debug('till', till);

    let query = {
      organization: organization,
      department: department,
      user_email: user_email,
      date: {
        $gte: from,
        $lt: till,
      },
    };

    let response = await Activity.aggregate([
      {
        $match: query,
      },
      {
        $group: {
          _id: {
            user_email: '$user_email',
            department: department,
            organization: organization,
            loginHours: '$loginHours',
            breaks: '$breaks',
          },
        },
      },
      {
        $unwind: {
          path: '$_id.breaks',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 0,
          user_email: '$_id.user_email',
          department: '$_id.department',
          organization: '$_id.organization',
          loginHours: '$_id.loginHours',
          user_break_time_taken: {
            $cond: {
              if: '$_id.breaks.minutes',
              then: '$_id.breaks.minutes',
              else: 0,
            },
          },
          no_of_breaks_taken: {
            $cond: {
              if: '$_id.breaks.no_of_breaks',
              then: '$_id.breaks.no_of_breaks',
              else: 0,
            },
          },
        },
      },
      {
        $lookup: {
          from: 'active_aux_managements',
          let: {
            user_email: '$user_email',
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
                    { $eq: ['$user_email', '$$user_email'] },
                    { $eq: ['$department', '$$department'] },
                    { $eq: ['$organization', '$$organization'] },
                    { $gte: ['$date', '$$startDate'] },
                    { $lt: ['$date', '$$endDate'] },
                  ],
                },
              },
            },
            {
              $project: {
                _id: 0,
                aux_management: 1,
              },
            },
            {
              $unwind: {
                path: '$aux_management',
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $project: {
                _id: 0,
                name: '$aux_management.name',
                seconds: {
                  $round: ['$aux_management.minutes', 0],
                },
              },
            },
            {
              $group: {
                _id: {
                  seconds: { $multiply: ['$seconds', 60] },
                  name: '$name',
                },
              },
            },
            {
              $project: {
                _id: 0,
                name: '$_id.name',
                seconds: {
                  $round: ['$_id.seconds', 0],
                },
              },
            },

            {
              $group: {
                _id: null,
                aux: {
                  $push: {
                    seconds: '$seconds',
                    name: '$name',
                  },
                },
              },
            },
          ],
          as: 'aux',
        },
      },
      {
        $unwind: {
          path: '$aux',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'configurations',
          let: {
            department: department,
            organization: organization,
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
              $unwind: {
                path: '$breaks',
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $group: {
                _id: {
                  productivity: '$productivity.work_hours',
                  work_hrs_min: { $multiply: ['$productivity.work_hours', 60] },
                  allowed_no_of_breaks: '$breaks.allowed_no_of_breaks',
                  allowed_break_minutes: '$breaks.minutes',
                },
              },
            },
            {
              $project: {
                _id: 0,
                productivity: '$_id.productivity',
                work_hrs_min: '$_id.work_hrs_min',
                allowed_no_of_breaks: '$_id.allowed_no_of_breaks',
                allowed_break_minutes: '$_id.allowed_break_minutes',
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
          user_email: 1,
          department: 1,
          organization: 1,
          loginHours: 1,
          total_login_sec: { $multiply: ['$config.work_hrs_min', 60] },
          user_break_time_taken_sec: {
            $multiply: ['$user_break_time_taken', 60],
          },
          no_of_breaks_taken: 1,
          user_break_time_total_sec: {
            $multiply: ['$config.allowed_break_minutes', 60],
          },
          no_of_breaks_total: '$config.allowed_no_of_breaks',
          aux_sec: '$aux.aux',
        },
      },
    ]);

    return res.status(200).json({
      message: `Today's analytics fetched successfully.`,
      data: response,
    });
  } catch (error) {
    logger.error(error);
    return res.status(500).json({
      code: 'SERVER_ERROR',
      description: 'Something went wrong, please try again',
    });
  }
};

const meetingStatus = async (req, res, next) => {
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

    logger.debug('user_email', user_email);
    let query = {
      organization: organization,
      department: department,
      user_id: user_email,
      partner_meeting_date: {
        $gte: from,
        $lt: till,
      },
    };

    let response = await LeadTracking.aggregate([
      {
        $match: query,
      },
      {
        $group: {
          _id: {
            user_email: '$user_email',
            organization: '$organization',
            department: '$department',
          },
          allocated: {
            $push: {
              $cond: [
                {
                  $eq: ['$status', 'OPEN'],
                },
                {
                  status: '$status',
                },
                '$$REMOVE',
              ],
            },
          },
          done: {
            $push: {
              $cond: [
                {
                  $eq: ['$status', 'MET'],
                },
                {
                  status: '$status',
                },
                '$$REMOVE',
              ],
            },
          },
          upcoming: {
            $push: {
              $cond: [
                {
                  $eq: ['$status', 'PENDING'],
                },
                {
                  status: '$status',
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
          user_email: '$_id.user_email',
          department: '$_id.department',
          organization: '$_id.organization',
          allocated: { $size: '$allocated' },
          done: { $size: '$done' },
          upcoming: { $size: '$upcoming' },
        },
      },
    ]);

    return res.status(200).json({
      message: `Meeting status fetched successfully.`,
      data: response,
    });
  } catch (error) {
    logger.error(error);
    return res.status(500).json({
      code: 'SERVER_ERROR',
      description: 'Something went wrong, please try again',
    });
  }
};

const getUpcomingMeetings = async (req, res, next) => {
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

    logger.debug('user_email', user_email);
    logger.debug('from', from);
    logger.debug('till', till);

    let query = {
      organization: organization,
      department: department,
      user_id: user_email,
      status: 'PENDING',
      partner_meeting_date: {
        $gte: from,
        $lt: till,
      },
    };

    let response = await LeadTracking.aggregate([
      {
        $match: query,
      },
      { $sort: { partner_meeting_date: 1 } },
    ]);

    return res.status(200).json({
      message: `Pending meetings fetched successfully`,
      data: response,
    });
  } catch (error) {
    logger.error(error);
    return res.status(500).json({
      code: 'SERVER_ERROR',
      description: 'Something went wrong, please try again',
    });
  }
};

const getBreakVsAux = async (req, res, next) => {
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
      department: department,
      user_email: user_email,
      date: {
        $gte: from,
        $lt: till,
      },
    };

    let response = await Activity.aggregate([
      {
        $match: query,
      },
      {
        $project: {
          _id: 0,
          breaks: 1,
          date: 1,
          department: 1,
          organization: 1,
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
          _id: {
            user_email: '$user_email',
            department: '$department',
            organization: '$organization',
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
        $addFields: {
          break: { $sum: '$break.minutes' },
        },
      },
      {
        $project: {
          _id: 0,
          date: '$_id.date',
          user_email: '$_id.user_email',
          department: '$_id.department',
          organization: '$_id.organization',
          break: '$break',
        },
      },
      {
        $lookup: {
          from: 'active_aux_managements',
          let: {
            user_email: '$user_email',
            department: department,
            organization: organization,
            startDate: from,
            endDate: till,
            date: '$date',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$user_email', '$$user_email'] },
                    { $eq: ['$department', '$$department'] },
                    { $eq: ['$organization', '$$organization'] },
                    { $gte: ['$date', '$$startDate'] },
                    { $lt: ['$date', '$$endDate'] },
                  ],
                },
              },
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
                  user_email: '$user_email',
                  department: '$department',
                  organization: '$organization',
                  date: {
                    $dateToString: {
                      format: '%m-%d-%Y',
                      date: '$date',
                    },
                  },
                },
                Status: {
                  $push: {
                    Minutes: {
                      $round: [{ $sum: '$aux_management.minutes' }, 1],
                    },
                  },
                },
              },
            },
            {
              $project: {
                _id: 0,
                user_email: '$_id.user_email',
                department: '$_id.department',
                organization: '$_id.organization',
                date: '$_id.date',
                minutes: {
                  $round: [{ $sum: '$Status.Minutes' }, 1],
                },
              },
            },
            {
              $project: {
                _id: 0,
                user_email: 1,
                department: 1,
                organization: 1,
                date: 1,
                minutes: {
                  $round: ['$minutes', 0],
                },
              },
            },
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$date', '$$date'] }],
                },
              },
            },
          ],
          as: 'aux',
        },
      },
      {
        $unwind: {
          path: '$aux',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 0,
          date: 1,
          user_email: 1,
          department: 1,
          organization: 1,
          break: 1,
          aux: {
            $cond: { if: '$aux.minutes', then: '$aux.minutes', else: 0 },
          },
        },
      },
      {
        $sort: { date: 1 },
      },
    ]);

    return res.status(200).json({
      message: 'Break vs Aux fetched successfully',
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

const meetingAnalytics = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;

    let { from, to, type, report_type } = req.body;

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

    if (type === 'ORGANIZATION') {
      let query = null;
      let departmentName;
      let departmentsArray;
      let inDepartments = [];

      function getDates(from, till) {
        var dateArray = [];
        var currentDate = moment(from);
        var stopDate = moment(till);
        while (currentDate <= stopDate) {
          dateArray.push(moment(currentDate).format('MM-DD-YYYY'));
          currentDate = moment(currentDate).add(1, 'days');
        }
        return dateArray;
      }

      let date_array = getDates(from, till);

      if (const_config.isAllowedRole(role, ['SUPER_ADMIN'])) {
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
          partner_meeting_date: {
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

        logger.debug('departmentsArray', inDepartments);
        query = {
          organization: organization,
          department: { $in: inDepartments },
          partner_meeting_date: {
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
          partner_meeting_date: {
            $gte: from,
            $lt: till,
          },
        };
      }

      let response = await LeadTracking.aggregate([
        {
          $match: query,
        },
        {
          $group: {
            _id: {
              organization: '$organization',
              department: '$department',
              assigned_to: '$assigned_to',
              date: {
                $dateToString: {
                  format: '%m-%d-%Y',
                  date: '$partner_meeting_date',
                },
              },
            },
            allocated: {
              $push: {
                $cond: [
                  {
                    $eq: ['$status', 'OPEN'],
                  },
                  {
                    status: '$status',
                  },
                  '$$REMOVE',
                ],
              },
            },
            done: {
              $push: {
                $cond: [
                  {
                    $eq: ['$status', 'MET'],
                  },
                  {
                    status: '$status',
                  },
                  '$$REMOVE',
                ],
              },
            },
            upcoming: {
              $push: {
                $cond: [
                  {
                    $eq: ['$status', 'PENDING'],
                  },
                  {
                    status: '$status',
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
            organization: '$_id.organization',
            department: '$_id.department',
            assigned_to: '$_id.assigned_to',
            date: '$_id.date',
            allocated: { $size: '$allocated' },
            done: { $size: '$done' },
            pending: { $size: '$upcoming' },
          },
        },
      ]);

      const allocatedMap = {};
      const doneMap = {};
      const pendingMap = {};

      for (const item of response) {
        allocatedMap[item.date] = item.allocated;
        doneMap[item.date] = item.done;
        pendingMap[item.date] = item.pending;
      }

      const result = date_array.map((date) => ({
        date,
        allocated: allocatedMap[date] || 0,
        done: doneMap[date] || 0,
        pending: pendingMap[date] || 0,
      }));

      let reports = [];
      if (report_type === 'csv') {
        try {
          for (let i = 0; i < response.length; i++) {
            let record = {
              Organization: response[i].organization,
              Department: response[i].department,
              Manager: response[i].assigned_to,
              Date: response[i].date,
              Allocated: response[i].allocated,
              Done: response[i].done,
              Pending: response[i].pending,
            };
            reports.push(record);
          }

          const fields = [
            'Organization',
            'Department',
            'Manager',
            'Date',
            'Allocated',
            'Done',
            'Pending',
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
          message: `Meeting status fetched successfully.`,
          data: result,
        });
      }
    } else if (type === 'DEPARTMENT') {
      function getDates(from, till) {
        var dateArray = [];
        var currentDate = moment(from);
        var stopDate = moment(till);
        while (currentDate <= stopDate) {
          dateArray.push(moment(currentDate).format('MM-DD-YYYY'));
          currentDate = moment(currentDate).add(1, 'days');
        }
        return dateArray;
      }

      let date_array = getDates(from, till);

      if (const_config.isAllowedRole(role, ['MANAGER'])) {
        query = {
          organization: organization,
          department: department,
          assigned_to: user_email,
          partner_meeting_date: {
            $gte: from,
            $lt: till,
          },
        };
      } else if (
        const_config.isAllowedRole(role, ['SUPER_ADMIN', 'ADMIN', 'AUDIT'])
      ) {
        query = {
          organization: organization,
          department: department,
          partner_meeting_date: {
            $gte: from,
            $lt: till,
          },
        };
      }

      let response = await LeadTracking.aggregate([
        {
          $match: query,
        },
        {
          $group: {
            _id: {
              organization: '$organization',
              department: '$department',
              assigned_to: '$assigned_to',
              date: {
                $dateToString: {
                  format: '%m-%d-%Y',
                  date: '$partner_meeting_date',
                },
              },
            },
            allocated: {
              $push: {
                $cond: [
                  {
                    $eq: ['$status', 'OPEN'],
                  },
                  {
                    status: '$status',
                  },
                  '$$REMOVE',
                ],
              },
            },
            done: {
              $push: {
                $cond: [
                  {
                    $eq: ['$status', 'MET'],
                  },
                  {
                    status: '$status',
                  },
                  '$$REMOVE',
                ],
              },
            },
            upcoming: {
              $push: {
                $cond: [
                  {
                    $eq: ['$status', 'PENDING'],
                  },
                  {
                    status: '$status',
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
            organization: '$_id.organization',
            department: '$_id.department',
            assigned_to: '$_id.assigned_to',
            date: '$_id.date',
            allocated: { $size: '$allocated' },
            done: { $size: '$done' },
            pending: { $size: '$upcoming' },
          },
        },
      ]);

      const allocatedMap = {};
      const doneMap = {};
      const pendingMap = {};

      for (const item of response) {
        allocatedMap[item.date] = item.allocated;
        doneMap[item.date] = item.done;
        pendingMap[item.date] = item.pending;
      }

      const result = date_array.map((date) => ({
        date,
        allocated: allocatedMap[date] || 0,
        done: doneMap[date] || 0,
        pending: pendingMap[date] || 0,
      }));

      let reports = [];
      if (report_type === 'csv') {
        try {
          for (let i = 0; i < response.length; i++) {
            let record = {
              Organization: response[i].organization,
              Department: response[i].department,
              Manager: response[i].assigned_to,
              Date: response[i].date,
              Allocated: response[i].allocated,
              Done: response[i].done,
              Pending: response[i].pending,
            };
            reports.push(record);
          }

          const fields = [
            'Organization',
            'Department',
            'Manager',
            'Date',
            'Allocated',
            'Done',
            'Pending',
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
          message: `Meeting status fetched successfully.`,
          data: result,
        });
      }
    } else if (type === 'MANAGER') {
      function getDates(from, till) {
        var dateArray = [];
        var currentDate = moment(from);
        var stopDate = moment(till);
        while (currentDate <= stopDate) {
          dateArray.push(moment(currentDate).format('MM-DD-YYYY'));
          currentDate = moment(currentDate).add(1, 'days');
        }
        return dateArray;
      }

      let date_array = getDates(from, till);

      query = {
        organization: organization,
        department: department,
        assigned_to: user_email,
        partner_meeting_date: {
          $gte: from,
          $lt: till,
        },
      };

      let response = await LeadTracking.aggregate([
        {
          $match: query,
        },
        {
          $group: {
            _id: {
              organization: '$organization',
              department: '$department',
              assigned_to: '$assigned_to',
              date: {
                $dateToString: {
                  format: '%m-%d-%Y',
                  date: '$partner_meeting_date',
                },
              },
            },
            allocated: {
              $push: {
                $cond: [
                  {
                    $eq: ['$status', 'OPEN'],
                  },
                  {
                    status: '$status',
                  },
                  '$$REMOVE',
                ],
              },
            },
            done: {
              $push: {
                $cond: [
                  {
                    $eq: ['$status', 'MET'],
                  },
                  {
                    status: '$status',
                  },
                  '$$REMOVE',
                ],
              },
            },
            upcoming: {
              $push: {
                $cond: [
                  {
                    $eq: ['$status', 'PENDING'],
                  },
                  {
                    status: '$status',
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
            organization: '$_id.organization',
            department: '$_id.department',
            assigned_to: '$_id.assigned_to',
            date: '$_id.date',
            allocated: { $size: '$allocated' },
            done: { $size: '$done' },
            pending: { $size: '$upcoming' },
          },
        },
      ]);

      const allocatedMap = {};
      const doneMap = {};
      const pendingMap = {};

      for (const item of response) {
        allocatedMap[item.date] = item.allocated;
        doneMap[item.date] = item.done;
        pendingMap[item.date] = item.pending;
      }

      const result = date_array.map((date) => ({
        date,
        allocated: allocatedMap[date] || 0,
        done: doneMap[date] || 0,
        pending: pendingMap[date] || 0,
      }));

      let reports = [];
      if (report_type === 'csv') {
        try {
          for (let i = 0; i < response.length; i++) {
            let record = {
              Organization: response[i].organization,
              Department: response[i].department,
              Manager: response[i].assigned_to,
              Date: response[i].date,
              Allocated: response[i].allocated,
              Done: response[i].done,
              Pending: response[i].pending,
            };
            reports.push(record);
          }

          const fields = [
            'Organization',
            'Department',
            'Manager',
            'Date',
            'Allocated',
            'Done',
            'Pending',
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
          message: `Meeting status fetched successfully.`,
          data: result,
        });
      }
    }
  } catch (error) {
    logger.error(error);
    return res.status(500).json({
      code: 'SERVER_ERROR',
      description: 'Something went wrong, please try again',
    });
  }
};

const meetingSummary = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;

    let { from, to, type } = req.body;

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

    if (type === 'ORGANIZATION') {
      let query = null;
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
          logger.debug('element', element);
        }

        departmentsArray = departmentName.department_array;
        query = {
          organization: organization,
          department: { $in: inDepartments },
          partner_meeting_date: {
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

        logger.debug('departmentsArray', inDepartments);
        query = {
          organization: organization,
          department: { $in: inDepartments },
          partner_meeting_date: {
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
          partner_meeting_date: {
            $gte: from,
            $lt: till,
          },
        };
      }

      let response = await LeadTracking.aggregate([
        {
          $match: query,
        },
        {
          $group: {
            _id: null,
            allocated: {
              $push: {
                $cond: [
                  {
                    $eq: ['$status', 'OPEN'],
                  },
                  {
                    status: '$status',
                  },
                  '$$REMOVE',
                ],
              },
            },
            done: {
              $push: {
                $cond: [
                  {
                    $eq: ['$status', 'MET'],
                  },
                  {
                    status: '$status',
                  },
                  '$$REMOVE',
                ],
              },
            },
            upcoming: {
              $push: {
                $cond: [
                  {
                    $eq: ['$status', 'PENDING'],
                  },
                  {
                    status: '$status',
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
            allocated: { $size: '$allocated' },
            done: { $size: '$done' },
            upcoming: { $size: '$upcoming' },
          },
        },
      ]);

      return res.status(200).json({
        message: `Meeting status fetched successfully.`,
        data:
          response.length === 0
            ? [
                {
                  allocated: 0,
                  done: 0,
                  upcoming: 0,
                },
              ]
            : response,
      });
    } else if (type === 'DEPARTMENT') {
      if (const_config.isAllowedRole(role, ['MANAGER'])) {
        query = {
          organization: organization,
          department: department,
          assigned_to: user_email,
          partner_meeting_date: {
            $gte: from,
            $lt: till,
          },
        };
      } else if (
        const_config.isAllowedRole(role, ['SUPER_ADMIN', 'ADMIN', 'AUDIT'])
      ) {
        query = {
          organization: organization,
          department: department,
          partner_meeting_date: {
            $gte: from,
            $lt: till,
          },
        };
      }
      let response = await LeadTracking.aggregate([
        {
          $match: query,
        },
        {
          $group: {
            _id: null,
            allocated: {
              $push: {
                $cond: [
                  {
                    $eq: ['$status', 'OPEN'],
                  },
                  {
                    status: '$status',
                  },
                  '$$REMOVE',
                ],
              },
            },
            done: {
              $push: {
                $cond: [
                  {
                    $eq: ['$status', 'MET'],
                  },
                  {
                    status: '$status',
                  },
                  '$$REMOVE',
                ],
              },
            },
            upcoming: {
              $push: {
                $cond: [
                  {
                    $eq: ['$status', 'PENDING'],
                  },
                  {
                    status: '$status',
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
            allocated: { $size: '$allocated' },
            done: { $size: '$done' },
            upcoming: { $size: '$upcoming' },
          },
        },
      ]);

      return res.status(200).json({
        message: `Meeting status fetched successfully.`,
        data:
          response.length === 0
            ? [
                {
                  allocated: 0,
                  done: 0,
                  upcoming: 0,
                },
              ]
            : response,
      });
    } else if (type === 'MANAGER') {
      query = {
        organization: organization,
        department: department,
        assigned_to: user_email,
        partner_meeting_date: {
          $gte: from,
          $lt: till,
        },
      };

      let response = await LeadTracking.aggregate([
        {
          $match: query,
        },
        {
          $group: {
            _id: null,
            allocated: {
              $push: {
                $cond: [
                  {
                    $eq: ['$status', 'OPEN'],
                  },
                  {
                    status: '$status',
                  },
                  '$$REMOVE',
                ],
              },
            },
            done: {
              $push: {
                $cond: [
                  {
                    $eq: ['$status', 'MET'],
                  },
                  {
                    status: '$status',
                  },
                  '$$REMOVE',
                ],
              },
            },
            upcoming: {
              $push: {
                $cond: [
                  {
                    $eq: ['$status', 'PENDING'],
                  },
                  {
                    status: '$status',
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
            allocated: { $size: '$allocated' },
            done: { $size: '$done' },
            upcoming: { $size: '$upcoming' },
          },
        },
      ]);

      return res.status(200).json({
        message: `Meeting status fetched successfully.`,
        data:
          response.length === 0
            ? [
                {
                  allocated: 0,
                  done: 0,
                  upcoming: 0,
                },
              ]
            : response,
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

const getUpcomingMeetingsSummary = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;

    let { from, to, report_type, type, manager_name, skip, limit } = req.body;

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

    if (type === 'ORGANIZATION') {
      let query = null;
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
          logger.debug('element', element);
        }

        departmentsArray = departmentName.department_array;
        query = {
          organization: organization,
          department: { $in: inDepartments },
          status: 'PENDING',
          partner_meeting_date: {
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

        logger.debug('departmentsArray', inDepartments);
        query = {
          organization: organization,
          department: { $in: inDepartments },
          status: 'PENDING',
          partner_meeting_date: {
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
          status: 'PENDING',
          partner_meeting_date: {
            $gte: from,
            $lt: till,
          },
        };
      }

      let [response, total] = await Promise.all([
        LeadTracking.aggregate([
          {
            $match: query,
          },
          {
            $group: {
              _id: {
                _id: '$_id',
                status: '$status',
                comment: '$comment',
                note: '$note',
                organization: '$organization',
                department: '$department',
                assigned_to: '$assigned_to',
                user_id: '$user_id',
                partner_name: '$partner_name',
                partner_address: '$partner_address',
                partner_city: '$partner_city',
                partner_state: '$partner_state',
                partner_contact: '$partner_contact',
                partner_latitude: '$partner_latitude',
                partner_longitude: '$partner_longitude',
                partner_meeting_date: '$partner_meeting_date',
                created_on: '$created_on',
                createdAt: '$createdAt',
                updatedAt: '$updatedAt',
                email: '$email',
              },
            },
          },
          { $sort: { ' _id.partner_meeting_date': 1 } },
          { $skip: skip },
          { $limit: limit },
        ]),
        LeadTracking.aggregate([
          {
            $match: query,
          },
          {
            $group: {
              _id: {
                _id: '$_id',
                status: '$status',
                comment: '$comment',
                note: '$note',
                time: {
                  $dateToString: {
                    format: '%H:%M',
                    date: '$partner_meeting_date',
                  },
                },
                organization: '$organization',
                department: '$department',
                assigned_to: '$assigned_to',
                user_id: '$user_id',
                partner_name: '$partner_name',
                partner_address: '$partner_address',
                partner_city: '$partner_city',
                partner_state: '$partner_state',
                partner_contact: '$partner_contact',
                partner_latitude: '$partner_latitude',
                partner_longitude: '$partner_longitude',
                partner_meeting_date: {
                  $dateToString: {
                    format: '%d-%m-%Y',
                    date: '$partner_meeting_date',
                  },
                },
                created_on: '$created_on',
                createdAt: '$createdAt',
                updatedAt: '$updatedAt',
                email: '$email',
              },
            },
          },
          { $sort: { ' _id.partner_meeting_date': 1 } },
        ]),
      ]);

      let reports = [];
      let order = 1;
      for (let i = 0; i < response.length; i++) {
        let entry = {
          _id: response[i]._id._id,
          status: response[i]._id.status,
          comment: response[i]._id.comment,
          note: response[i]._id.note,
          organization: response[i]._id.organization,
          department: response[i]._id.department,
          Manager: response[i]._id.assigned_to,
          user_id: response[i]._id.user_id,
          partner_name: response[i]._id.partner_name,
          partner_address: response[i]._id.partner_address,
          partner_city: response[i]._id.partner_city,
          partner_state: response[i]._id.partner_state,
          partner_contact: response[i]._id.partner_contact,
          partner_latitude: response[i]._id.partner_latitude,
          partner_longitude: response[i]._id.partner_longitude,
          partner_meeting_date: response[i]._id.partner_meeting_date,
          created_on: response[i]._id.created_on,
          createdAt: response[i]._id.createdAt,
          updatedAt: response[i]._id.updatedAt,
          email: response[i]._id.email,
          order: 'Meeting ' + order++ + ' in the list',
        };
        reports.push(entry);
      }

      if (report_type === 'csv') {
        try {
          let response = await LeadTracking.aggregate([
            {
              $match: query,
            },
            {
              $group: {
                _id: {
                  _id: '$_id',
                  status: '$status',
                  comment: '$comment',
                  note: '$note',
                  time: {
                    $dateToString: {
                      format: '%H:%M',
                      date: '$partner_meeting_date',
                    },
                  },
                  organization: '$organization',
                  department: '$department',
                  assigned_to: '$assigned_to',
                  user_id: '$user_id',
                  partner_name: '$partner_name',
                  partner_address: '$partner_address',
                  partner_city: '$partner_city',
                  partner_state: '$partner_state',
                  partner_contact: '$partner_contact',
                  partner_latitude: '$partner_latitude',
                  partner_longitude: '$partner_longitude',
                  partner_meeting_date: {
                    $dateToString: {
                      format: '%d-%m-%Y',
                      date: '$partner_meeting_date',
                    },
                  },
                  created_on: '$created_on',
                  createdAt: '$createdAt',
                  updatedAt: '$updatedAt',
                  email: '$email',
                },
              },
            },
            { $sort: { ' _id.partner_meeting_date': 1 } },
          ]);

          let reports = [];
          let order = 1;
          for (let i = 0; i < response.length; i++) {
            let entry = {
              _id: response[i]._id._id,
              status: response[i]._id.status,
              comment: response[i]._id.comment,
              note: response[i]._id.note,
              Time: response[i]._id.time,
              Organization: response[i]._id.organization,
              Department: response[i]._id.department,
              Manager: response[i]._id.assigned_to,
              Date: response[i]._id.partner_meeting_date,
              User: response[i]._id.user_id,
              'Partner Name': response[i]._id.partner_name,
              'Partner Address': response[i]._id.partner_address,
              'Partner City': response[i]._id.partner_city,
              'Partner State': response[i]._id.partner_state,
              'Partner Contact': response[i]._id.partner_contact,
              'Partner Latitude': response[i]._id.partner_latitude,
              'Partner Longitude': response[i]._id.partner_longitude,
              created_on: response[i]._id.created_on,
              createdAt: response[i]._id.createdAt,
              updatedAt: response[i]._id.updatedAt,
              email: response[i]._id.email,
              order: 'Meeting ' + order++ + ' in the list',
            };
            reports.push(entry);
          }
          const fields = [
            'Organization',
            'Department',
            'Manager',
            'Date',
            'User',
            'Partner Name',
            'Time',
            'Partner Contact',
            'Partner Latitude',
            'Partner Longitude',
            'Partner City',
            'Partner State',
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
          message: `Pending meetings fetched successfully`,
          data: reports,
          total: total.length,
        });
      }
    } else if (type === 'DEPARTMENT') {
      if (const_config.isAllowedRole(role, ['MANAGER'])) {
        query = {
          organization: organization,
          department: department,
          assigned_to: user_email,
          status: 'PENDING',
          partner_meeting_date: {
            $gte: from,
            $lt: till,
          },
        };
      } else if (
        const_config.isAllowedRole(role, ['SUPER_ADMIN', 'ADMIN', 'AUDIT'])
      ) {
        query = {
          organization: organization,
          department: department,
          status: 'PENDING',
          partner_meeting_date: {
            $gte: from,
            $lt: till,
          },
        };
      }

      let [response, total] = await Promise.all([
        LeadTracking.aggregate([
          {
            $match: query,
          },
          {
            $group: {
              _id: {
                _id: '$_id',
                status: '$status',
                comment: '$comment',
                note: '$note',
                organization: '$organization',
                department: '$department',
                assigned_to: '$assigned_to',
                user_id: '$user_id',
                partner_name: '$partner_name',
                partner_address: '$partner_address',
                partner_city: '$partner_city',
                partner_state: '$partner_state',
                partner_contact: '$partner_contact',
                partner_latitude: '$partner_latitude',
                partner_longitude: '$partner_longitude',
                partner_meeting_date: '$partner_meeting_date',
                created_on: '$created_on',
                createdAt: '$createdAt',
                updatedAt: '$updatedAt',
                email: '$email',
              },
            },
          },
          { $sort: { ' _id.partner_meeting_date': 1 } },
          { $skip: skip },
          { $limit: limit },
        ]),
        LeadTracking.aggregate([
          {
            $match: query,
          },
          {
            $group: {
              _id: {
                _id: '$_id',
                status: '$status',
                comment: '$comment',
                note: '$note',
                time: {
                  $dateToString: {
                    format: '%H:%M',
                    date: '$partner_meeting_date',
                  },
                },
                organization: '$organization',
                department: '$department',
                assigned_to: '$assigned_to',
                user_id: '$user_id',
                partner_name: '$partner_name',
                partner_address: '$partner_address',
                partner_city: '$partner_city',
                partner_state: '$partner_state',
                partner_contact: '$partner_contact',
                partner_latitude: '$partner_latitude',
                partner_longitude: '$partner_longitude',
                partner_meeting_date: {
                  $dateToString: {
                    format: '%d-%m-%Y',
                    date: '$partner_meeting_date',
                  },
                },
                created_on: '$created_on',
                createdAt: '$createdAt',
                updatedAt: '$updatedAt',
                email: '$email',
              },
            },
          },
          { $sort: { ' _id.partner_meeting_date': 1 } },
        ]),
      ]);

      let reports = [];
      let order = 1;
      for (let i = 0; i < response.length; i++) {
        let entry = {
          _id: response[i]._id._id,
          status: response[i]._id.status,
          comment: response[i]._id.comment,
          note: response[i]._id.note,
          organization: response[i]._id.organization,
          department: response[i]._id.department,
          Manager: response[i]._id.assigned_to,
          user_id: response[i]._id.user_id,
          partner_name: response[i]._id.partner_name,
          partner_address: response[i]._id.partner_address,
          partner_city: response[i]._id.partner_city,
          partner_state: response[i]._id.partner_state,
          partner_contact: response[i]._id.partner_contact,
          partner_latitude: response[i]._id.partner_latitude,
          partner_longitude: response[i]._id.partner_longitude,
          partner_meeting_date: response[i]._id.partner_meeting_date,
          created_on: response[i]._id.created_on,
          createdAt: response[i]._id.createdAt,
          updatedAt: response[i]._id.updatedAt,
          email: response[i]._id.email,
          order: 'Meeting ' + order++ + ' in the list',
        };
        reports.push(entry);
      }

      if (report_type === 'csv') {
        try {
          let response = await LeadTracking.aggregate([
            {
              $match: query,
            },
            {
              $group: {
                _id: {
                  _id: '$_id',
                  status: '$status',
                  comment: '$comment',
                  note: '$note',
                  time: {
                    $dateToString: {
                      format: '%H:%M',
                      date: '$partner_meeting_date',
                    },
                  },
                  organization: '$organization',
                  department: '$department',
                  assigned_to: '$assigned_to',
                  user_id: '$user_id',
                  partner_name: '$partner_name',
                  partner_address: '$partner_address',
                  partner_city: '$partner_city',
                  partner_state: '$partner_state',
                  partner_contact: '$partner_contact',
                  partner_latitude: '$partner_latitude',
                  partner_longitude: '$partner_longitude',
                  partner_meeting_date: {
                    $dateToString: {
                      format: '%d-%m-%Y',
                      date: '$partner_meeting_date',
                    },
                  },
                  created_on: '$created_on',
                  createdAt: '$createdAt',
                  updatedAt: '$updatedAt',
                  email: '$email',
                },
              },
            },
            { $sort: { ' _id.partner_meeting_date': 1 } },
          ]);

          let reports = [];
          let order = 1;
          for (let i = 0; i < response.length; i++) {
            let entry = {
              _id: response[i]._id._id,
              status: response[i]._id.status,
              comment: response[i]._id.comment,
              note: response[i]._id.note,
              Time: response[i]._id.time,
              Organization: response[i]._id.organization,
              Department: response[i]._id.department,
              Manager: response[i]._id.assigned_to,
              Date: response[i]._id.partner_meeting_date,
              User: response[i]._id.user_id,
              'Partner Name': response[i]._id.partner_name,
              'Partner Address': response[i]._id.partner_address,
              'Partner City': response[i]._id.partner_city,
              'Partner State': response[i]._id.partner_state,
              'Partner Contact': response[i]._id.partner_contact,
              'Partner Latitude': response[i]._id.partner_latitude,
              'Partner Longitude': response[i]._id.partner_longitude,
              created_on: response[i]._id.created_on,
              createdAt: response[i]._id.createdAt,
              updatedAt: response[i]._id.updatedAt,
              email: response[i]._id.email,
              order: 'Meeting ' + order++ + ' in the list',
            };
            reports.push(entry);
          }
          const fields = [
            'Organization',
            'Department',
            'Manager',
            'Date',
            'User',
            'Partner Name',
            'Time',
            'Partner Contact',
            'Partner Latitude',
            'Partner Longitude',
            'Partner City',
            'Partner State',
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
          message: `Pending meetings fetched successfully`,
          data: reports,
          total: total.length,
        });
      }
    } else if (type === 'MANAGER') {
      query = {
        organization: organization,
        department: department,
        status: 'PENDING',
        assigned_to: manager_name,
        partner_meeting_date: {
          $gte: from,
          $lt: till,
        },
      };

      let [response, total] = await Promise.all([
        LeadTracking.aggregate([
          {
            $match: query,
          },
          {
            $group: {
              _id: {
                _id: '$_id',
                status: '$status',
                comment: '$comment',
                note: '$note',
                organization: '$organization',
                department: '$department',
                assigned_to: '$assigned_to',
                user_id: '$user_id',
                partner_name: '$partner_name',
                partner_address: '$partner_address',
                partner_city: '$partner_city',
                partner_state: '$partner_state',
                partner_contact: '$partner_contact',
                partner_latitude: '$partner_latitude',
                partner_longitude: '$partner_longitude',
                partner_meeting_date: '$partner_meeting_date',
                created_on: '$created_on',
                createdAt: '$createdAt',
                updatedAt: '$updatedAt',
                email: '$email',
              },
            },
          },
          { $sort: { ' _id.partner_meeting_date': 1 } },
          { $skip: skip },
          { $limit: limit },
        ]),
        LeadTracking.aggregate([
          {
            $match: query,
          },
          {
            $group: {
              _id: {
                _id: '$_id',
                status: '$status',
                comment: '$comment',
                note: '$note',
                time: {
                  $dateToString: {
                    format: '%H:%M',
                    date: '$partner_meeting_date',
                  },
                },
                organization: '$organization',
                department: '$department',
                assigned_to: '$assigned_to',
                user_id: '$user_id',
                partner_name: '$partner_name',
                partner_address: '$partner_address',
                partner_city: '$partner_city',
                partner_state: '$partner_state',
                partner_contact: '$partner_contact',
                partner_latitude: '$partner_latitude',
                partner_longitude: '$partner_longitude',
                partner_meeting_date: {
                  $dateToString: {
                    format: '%d-%m-%Y',
                    date: '$partner_meeting_date',
                  },
                },
                created_on: '$created_on',
                createdAt: '$createdAt',
                updatedAt: '$updatedAt',
                email: '$email',
              },
            },
          },
          { $sort: { ' _id.partner_meeting_date': 1 } },
        ]),
      ]);

      let reports = [];
      let order = 1;
      for (let i = 0; i < response.length; i++) {
        let entry = {
          _id: response[i]._id._id,
          status: response[i]._id.status,
          comment: response[i]._id.comment,
          note: response[i]._id.note,
          organization: response[i]._id.organization,
          department: response[i]._id.department,
          Manager: response[i]._id.assigned_to,
          user_id: response[i]._id.user_id,
          partner_name: response[i]._id.partner_name,
          partner_address: response[i]._id.partner_address,
          partner_city: response[i]._id.partner_city,
          partner_state: response[i]._id.partner_state,
          partner_contact: response[i]._id.partner_contact,
          partner_latitude: response[i]._id.partner_latitude,
          partner_longitude: response[i]._id.partner_longitude,
          partner_meeting_date: response[i]._id.partner_meeting_date,
          created_on: response[i]._id.created_on,
          createdAt: response[i]._id.createdAt,
          updatedAt: response[i]._id.updatedAt,
          email: response[i]._id.email,
          order: 'Meeting ' + order++ + ' in the list',
        };
        reports.push(entry);
      }

      if (report_type === 'csv') {
        try {
          let response = await LeadTracking.aggregate([
            {
              $match: query,
            },
            {
              $group: {
                _id: {
                  _id: '$_id',
                  status: '$status',
                  comment: '$comment',
                  note: '$note',
                  time: {
                    $dateToString: {
                      format: '%H:%M',
                      date: '$partner_meeting_date',
                    },
                  },
                  organization: '$organization',
                  department: '$department',
                  assigned_to: '$assigned_to',
                  user_id: '$user_id',
                  partner_name: '$partner_name',
                  partner_address: '$partner_address',
                  partner_city: '$partner_city',
                  partner_state: '$partner_state',
                  partner_contact: '$partner_contact',
                  partner_latitude: '$partner_latitude',
                  partner_longitude: '$partner_longitude',
                  partner_meeting_date: {
                    $dateToString: {
                      format: '%d-%m-%Y',
                      date: '$partner_meeting_date',
                    },
                  },
                  created_on: '$created_on',
                  createdAt: '$createdAt',
                  updatedAt: '$updatedAt',
                  email: '$email',
                },
              },
            },
            { $sort: { ' _id.partner_meeting_date': 1 } },
          ]);

          let reports = [];
          let order = 1;
          for (let i = 0; i < response.length; i++) {
            let entry = {
              _id: response[i]._id._id,
              status: response[i]._id.status,
              comment: response[i]._id.comment,
              note: response[i]._id.note,
              Time: response[i]._id.time,
              Organization: response[i]._id.organization,
              Department: response[i]._id.department,
              Manager: response[i]._id.assigned_to,
              Date: response[i]._id.partner_meeting_date,
              User: response[i]._id.user_id,
              'Partner Name': response[i]._id.partner_name,
              'Partner Address': response[i]._id.partner_address,
              'Partner City': response[i]._id.partner_city,
              'Partner State': response[i]._id.partner_state,
              'Partner Contact': response[i]._id.partner_contact,
              'Partner Latitude': response[i]._id.partner_latitude,
              'Partner Longitude': response[i]._id.partner_longitude,
              created_on: response[i]._id.created_on,
              createdAt: response[i]._id.createdAt,
              updatedAt: response[i]._id.updatedAt,
              email: response[i]._id.email,
              order: 'Meeting ' + order++ + ' in the list',
            };
            reports.push(entry);
          }
          const fields = [
            'Organization',
            'Department',
            'Manager',
            'Date',
            'User',
            'Partner Name',
            'Time',
            'Partner Contact',
            'Partner Latitude',
            'Partner Longitude',
            'Partner City',
            'Partner State',
          ];
          const opts = {
            fields,
          };
          const csv = parse(reports, opts);

          return res.status(200).send(csv);
        } catch (err) {
          console.error(err);
          logger.error(err);

          return res.status(500).json({
            code: 'SERVER_ERROR',
            description: 'something went wrong, Please try again',
          });
        }
      } else {
        return res.status(200).json({
          message: `Pending meetings fetched successfully`,
          data: reports,
          total: total.length,
        });
      }
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
  todaysAnalytics: todaysAnalytics,
  meetingStatus: meetingStatus,
  getUpcomingMeetings: getUpcomingMeetings,
  getBreakVsAux: getBreakVsAux,
  meetingAnalytics: meetingAnalytics,
  meetingSummary: meetingSummary,
  getUpcomingMeetingsSummary: getUpcomingMeetingsSummary,
};
