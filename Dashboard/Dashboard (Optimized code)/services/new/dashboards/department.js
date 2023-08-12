const express = require('express');
const mongoose = require('mongoose');
const Activity = require('../../../models/activity');
const Users = require('../../../models/users');
const WorkLocation = require('../../../models/user_work_location');
const Logger = require('../../../configs/log');
const logger = new Logger('department');
const moment = require('moment-timezone');
const const_config = require('../../../utility/util');

const { parse } = require('json2csv');

const getProductivityByDepartment = async (req, res, next) => {
  try {

    let role = req.role
    let organization = req.organization
    let department = req.department
    let assigned_to = req.assigned_to
    let user_email = req.user_email

    let {
      from,
      to,
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

    let query = {
      organization: organization,
      department: department,
      'date': {
        "$gte": from,
        "$lt": till
      }
    }

    let productivity = await Activity.aggregate(
      [
        {
          $match: query
        },

        {
          $group: {
            _id: "$assigned_to",
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
              "manager": "$_id",
              organization: organization,
              department: department,
              is_licensed: true
            },
            pipeline: [
              {
                "$match": {
                  "$expr": {
                    "$and": [
                      { "$eq": ["$assigned_to", "$$manager"] },
                      { "$eq": ["$organization", "$$organization"] },
                      { "$eq": ["$department", "$$department"] },
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
              organization: organization,
              department: department
            },
            pipeline: [
              {
                "$match": {
                  "$expr": {
                    "$and": [
                      { "$eq": ["$organization", "$$organization"] },
                      { "$eq": ["$department", "$$department"] }
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
        { "$match": { "productivity": { "$ne": null } } },
        { "$match": { "productivity": { "$ne": 0 } } },
      ]);



    if (report_type === "csv") {
      try {
        let reports = []
        for (let i = 0; i < productivity.length; i++) {

          let entry = {
            Organization: organization,
            Department: department,
            Manager: productivity[i].name,
            'Productivity Percentage': productivity[i].productivity,
            "Date Range(from - to)": moment(from).tz(time_zone).format('DD-MMM-YYYY') + " - " + moment(to).tz(time_zone).format('DD-MMM-YYYY')

          }
          reports.push(entry)
        }
        const fields = ['Organization', 'Department', 'Manager', 'Date Range(from - to)', 'Productivity Percentage'];
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
        'message': 'Average logged time and average non work time fetched successfully',
        'data': productivity
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

const getPresentVsAbsentByDepartment = async (req, res, next) => {
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




    let userCountQuery = {
      organization: organization,
      department: department,
      is_licensed: true,
    };

    let users = await Users.aggregate([
      {
        $match: userCountQuery,
      },
      {
        $group: {
          _id: '$assigned_to',
          users: {
            $sum: 1
          },
        },
      },
      // {
      //   $project: {
      //     manager: '$_id',
      //     department: department,
      //     total_users: { $size: '$users' },
      //   },
      // },
      // {
      //   $lookup: {
      //     from: 'activities',
      //     let: {
      //       assigned_to: '$_id',
      //       department: department,
      //       organization: organization,
      //       startDate: from,
      //       endDate: till,
      //     },
      //     pipeline: [
      //       {
      //         $match: {
      //           $expr: {
      //             $and: [
      //               { $eq: ['$assigned_to', '$$assigned_to'] },
      //               { $eq: ['$department', '$$department'] },
      //               { $eq: ['$organization', '$$organization'] },
      //               { $gte: ['$date', '$$startDate'] },
      //               { $lt: ['$date', '$$endDate'] },
      //             ],
      //           },
      //         },
      //       },
      //       {
      //         $project: {
      //           _id: 0,
      //           user_email: '$user_email',
      //         },
      //       },
      //       {
      //         $group: {
      //           _id: null,
      //           users: { $addToSet: '$user_email' },
      //         },
      //       },
      //       {
      //         $project: {
      //           _id: 0,
      //           total_present: { $size: '$users' },
      //         },
      //       },
      //     ],
      //     as: 'data',
      //   },
      // },
      // {
      //   $unwind: {
      //     path: '$data',
      //     preserveNullAndEmptyArrays: true,
      //   },
      // },
      // {
      //   $addFields: {
      //     count: '$data.total_present',
      //   },
      // },
      // {
      //   $project: {
      //     _id: 0,
      //     manager: 1,
      //     department: 1,
      //     total_users: 1,
      //     total_present: {
      //       $cond: { if: '$count', then: '$count', else: 0 },
      //     },
      //   },
      // },
      // {
      //   $addFields: {
      //     total_absent: { $subtract: ['$total_users', '$total_present'] },
      //   },
      // },
    ]);
    let reports = [];

    for (let i = 0; i < users.length; i++) {
      let active = await Activity.find({
        organization: organization,
        department: department,
        assigned_to: users[i]._id,
        date: {
          $gte: from,
          $lt: till,
        },
      }).distinct('user_email');;
      console.log("active", active)
      active = active.length
      let entry = {
        "_id": users[i]._id,
        "department": department,
        "manager": users[i]._id,
        "total_users": users[i].users,
        "total_present": active,
        "total_absent": users[i].users - active < 0 ? 0 : users[i].users - active
      }
      reports.push(entry)
    }

    if (report_type === 'csv') {
      try {
        const fields = [
          'manager',
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

const getWfhVsWfoByDepartment = async (req, res, next) => {
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



    let query = {
      organization: organization,
      department: department,
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
          _id: '$assigned_to',
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
          manager: '$_id',
          department: department,
          home: '$home',
          office: '$office'
        },
      },
      {
        $sort: {
          'manager': 1,
        },
      },
      {
        $match: {
          $expr: {
            $or: [{ $ne: ['$office', 0] }, { $ne: ['$home', 0] }],
          },
        },
      },
    ]);
    let reports = [];

    if (report_type === 'csv') {
      try {
        for (let i = 0; i < home_office_count.length; i++) {
          let entry = {
            Organization: organization,
            Manager: home_office_count[i].manager,
            Department: home_office_count[i].department,
            "Home Count": home_office_count[i].home,
            "Office count": home_office_count[i].office,
          };
          reports.push(entry);
        }

        const fields = ['Organization', 'Department', 'Manager', 'Home Count', 'Office count'];
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

const getIdleTimeByDepartment = async (req, res, next) => {
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

    let manager_user = await Users.findOne({
      organization: organization,
      department: department,
      is_manager: true,
      is_licensed: true,
    }).distinct('user_email');

    logger.debug('manager_user', manager_user);

    let query = {
      organization: organization,
      department: department,
      idleTime: { $ne: 0 },
      date: {
        $gte: from,
        $lt: till,
      },
    };

    const startDate = moment(from, "MM-DD-YYYY").utc().startOf('day');
    const endDate = moment(to, "MM-DD-YYYY").utc().startOf('day');

    const date_array = [];
    let currentDate = startDate.add(1, 'day'); // Exclude the starting date

    while (currentDate <= endDate) {
      date_array.push(currentDate.utc().format("MM-DD-YYYY"));
      currentDate = currentDate.add(1, 'day');
    }
    logger.debug("date_array", date_array)
    let idle_count = await Activity.aggregate([
      {
        $match: query,
      },
      {
        $project: {
          _id: 0,
          idleTime: 1,
          assigned_to: 1,
          date: 1,
        },
      },
      {
        $group: {
          _id: {
            manager: '$assigned_to',
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
              name: '$_id.manager',
              value: '$idle'
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
      logger.debug(result);


      function fillMissingValues(data, manager_user) {
        const newData = [];

        data.forEach(entry => {
          const missingDepartments = manager_user.filter(dep => !entry.series.some(item => item.name === dep));

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

      const updatedData = fillMissingValues(result, manager_user);
      if (report_type === 'csv') {
        try {
          for (let i = 0; i < idle_count.length; i++) {
            for (let j = 0; j < idle_count[i].series.length; j++) {

              let entry = {
                Date: idle_count[i]._id,
                Name: idle_count[i].series[j].name,
                "Idle Minutes": idle_count[i].series[j].value,
                Organization: organization,
                Department: department
              };
              reports.push(entry);
            }
          }

          const fields = ['Organization', 'Department', 'Date', 'Name', 'Idle Minutes'];
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
          data: updatedData.sort((a, b) => { return a._id - b._id; }),
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
                Name: idle_count[i].series[j].manager,
                "Idle Minutes": idle_count[i].series[j].idle,
                Organization: organization,
                Department: department
              };
              reports.push(entry);
            }
          }

          const fields = ['Organization', 'Department', 'Date', 'Name', 'Idle Minutes'];
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
          data: [],
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

const getBreakTimeByDepartment = async (req, res, next) => {
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

    let query = {
      organization: organization,
      department: department,
      breaks: { $exists: true, $ne: [] },
      date: {
        $gte: from,
        $lt: till,
      },
    };

    const startDate = moment(from, "MM-DD-YYYY").utc().startOf('day');
    const endDate = moment(to, "MM-DD-YYYY").utc().startOf('day');

    const date_array = [];
    let currentDate = startDate.add(1, 'day'); // Exclude the starting date

    while (currentDate <= endDate) {
      date_array.push(currentDate.utc().format("MM-DD-YYYY"));
      currentDate = currentDate.add(1, 'day');
    }
    logger.debug("date_array", date_array)
    let break_data = await Activity.aggregate([
      {
        $match: query,
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
            manager: '$assigned_to',
            date: {
              $dateToString: {
                format: '%m-%d-%Y',
                date: '$date',
                timezone: time_zone

              },
            },
          },
          break: {
            $sum: {
              $round: ["$breaks.minutes", 0],
            },
          },
        },
      },
      {
        $group: {
          _id: "$_id.date",
          series: {
            $push: {
              name: "$_id.manager",
              value: "$break"
            }
          }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);


    if (break_data.length) {
      function addMissingDatesWithZero(date_array, data) {
        const result = date_array.map(date => {
          const existingEntry = data.find(item => item._id === date);
          return existingEntry
            ? existingEntry
            : { _id: date, series: (data.length > 0 ? data[0].series : []).map(series => ({ ...series, value: 0 })) };
        });

        return result;
      }

      const result = addMissingDatesWithZero(date_array, break_data);


      function fillMissingValues(data, manager_user) {
        const newData = [];

        data.forEach(entry => {
          const missingDepartments = manager_user.filter(dep => !entry.series.some(item => item.name === dep));

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

      const updatedData = fillMissingValues(result, manager_user);
      if (report_type === 'csv') {
        try {

          let reports = [];

          for (let i = 0; i < break_data.length; i++) {
            for (let j = 0; j < break_data[i].series.length; j++) {

              let entry = {
                Date: break_data[i]._id,
                Name: break_data[i].series[j].name,
                "Break Minutes": break_data[i].series[j].value,
                Organization: organization,
                Department: department

              };
              reports.push(entry);
            }
          }
          const fields = ['Organization', 'Department', 'Date', 'Name', 'Break Minutes'];
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
          message: 'Breaks time fetched successfully',
          data: updatedData.sort((a, b) => { return a._id - b._id; })
        });
      }
    } else {
      if (report_type === 'csv') {
        try {
          let reports = [];

          for (let i = 0; i < break_data.length; i++) {
            for (let j = 0; j < break_data[i].series.length; j++) {
              let entry = {
                Date: idle_count[i]._id,
                Name: idle_count[i].series[j].name,
                "Break Minutes": idle_count[i].series[j].value,
                Organization: organization,
                Department: department
              };
              reports.push(entry);
            }
          }

          const fields = ['Organization', 'Department', 'Date', 'Name', 'Idle Minutes'];
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
          message: 'Breaks time fetched successfully',
          data: [],
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

const allUsersActivity = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let assigned_to = req.assigned_to;
    let user_email = req.user_email;

    let { from, to, member_email, report_type, limit, skip } = req.body;

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

    if (const_config.isAllowedRole(role, ['MANAGER'])) {
      if (member_email === member_email) {
        query = {
          organization: organization,
          department: department,
          user_email: { $regex: member_email, $options: 'i' },
          assigned_to: user_email,
          is_licensed: true,
        };
      } else {
        query = {
          organization: organization,
          department: department,
          assigned_to: user_email,
          is_licensed: true,
        };
      }
    } else {
      if (member_email === member_email) {
        query = {
          organization: organization,
          department: department,
          user_email: { $regex: member_email, $options: 'i' },
          is_licensed: true,
        };
      } else {
        query = {
          organization: organization,
          department: department,
          is_licensed: true,
        };
      }
    }


    let [users, total] = await Promise.all([
      await Users.aggregate([
        {
          $match: query
        },
        {
          $group: {
            _id: {
              user_email: "$user_email",
              department: "$department",
            }
          }
        },

        {
          $project: {
            _id: 0,
            user: "$_id.user_email",
            department: "$_id.department",
          }
        },
        { $sort: { user: 1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $lookup: {
            from: 'activities',
            let: {
              "user_email": "$user",
              department: "$department",
              organization: organization,
              "startDate": from,
              "endDate": till
            },
            pipeline: [
              {
                "$match": {
                  "$expr": {
                    "$and": [
                      { "$eq": ["$user_email", "$$user_email"] },
                      { "$eq": ["$department", "$$department"] },
                      { "$eq": ["$organization", "$$organization"] },
                      { "$gte": ["$date", "$$startDate"] },
                      { "$lt": ["$date", "$$endDate"] }
                    ]
                  }
                }
              },
              {
                $project: {
                  _id: 0,
                  user_email: 1,
                  breaks: { $sum: "$breaks.minutes" },
                  idleTime: 1,
                  loginHours: 1,
                  "activeApps": { "$setUnion": ["$activeApps", "$visitedWeb"] },
                  assigned_to_name: 1,
                  assigned_to: 1
                }
              },
              {
                $group: {
                  _id: {
                    assigned_to_name: "$assigned_to_name",
                    assigned_to: "$assigned_to"
                  },
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
                  allAppWeb: {
                    $push: {
                      'activeApps': "$activeApps",
                    }
                  },


                }
              },
              {
                $unwind: {
                  path: "$allAppWeb",
                  preserveNullAndEmptyArrays: true
                }
              },
              {
                $project: {
                  _id: 0,
                  idle: "$idle",
                  break: "$break",
                  loginHours: "$loginHours",
                  activeApps: "$allAppWeb.activeApps",
                  assigned_to_name: "$_id.assigned_to_name",
                  assigned_to: "$_id.assigned_to"
                }
              },
              {
                $unwind: {
                  path: "$activeApps",
                  preserveNullAndEmptyArrays: true
                }
              },
              {
                $group: {
                  _id: {
                    idle: "$idle",
                    break: "$break",
                    loginHours: "$loginHours",
                    'is_productive': "$activeApps.is_productive",
                    assigned_to_name: "$assigned_to_name",
                    assigned_to: "$assigned_to"
                  },
                  "totalMinutes": {
                    "$sum": {
                      "$divide": [
                        { "$subtract": ["$activeApps.endTime", "$activeApps.startTime"] },
                        1000 * 60
                      ]
                    }
                  }
                }
              },
              {
                $group: {
                  _id: {
                    assigned_to_name: "$_id.assigned_to_name",
                    assigned_to: "$_id.assigned_to",
                    idle: "$_id.idle",
                    break: "$_id.break",
                    loginHours: "$_id.loginHours",
                  },
                  productive: {
                    "$push": {
                      "$cond": [{
                        $eq: ["$_id.is_productive", true]
                      },
                      {
                        "minutes": "$totalMinutes"
                      },
                        "$$REMOVE"
                      ]
                    }
                  },
                  un_productive: {
                    "$push": {
                      "$cond": [{
                        "$and": [{
                          $eq: ["$_id.is_productive", false]
                        },
                        {
                          "$ne": ["$_id.category", "OTHER"]
                        }
                        ]
                      },
                      {
                        "minutes": "$totalMinutes"
                      },
                        "$$REMOVE"
                      ]
                    }
                  },
                }
              },

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
          $addFields: {
            desk_time: { "minutes": { $round: ["$data._id.loginHours", 0] } }
          }
        },
        {
          $lookup: {
            from: 'configurations',
            let: {
              organization: organization,
              department: "$department"
            },
            pipeline: [
              {
                "$match": {
                  "$expr": {
                    "$and": [
                      { "$eq": ["$organization", "$$organization"] },
                      { "$eq": ["$department", "$$department"] }
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
          $project: {
            user: 1,
            department: 1,
            assigned_to_name: "$data._id.assigned_to_name",
            assigned_to: "$data._id.assigned_to",
            idle: {
              $cond: { if: "$data._id.idle", then: "$data._id.idle", else: 0 }
            },
            break: {
              $cond: { if: "$data._id.break", then: "$data._id.break", else: 0 }
            },
            desk_time: {
              $cond: { if: "$desk_time.minutes", then: "$desk_time.minutes", else: 0 }
            },
            work_hours: "$config._id",
            productive: { $sum: '$data.productive.minutes' },
            un_productive: { $sum: '$data.un_productive.minutes' },
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
          $addFields: {
            productivity: {
              $round: [{ "$multiply": [{ "$divide": ["$desk_time", { $multiply: [{ $multiply: ["$work_hours", "$days"] }, 60] }] }, 100] }, 2]
            }
          }
        },
        {
          $lookup: {
            from: 'active_aux_managements',
            let: {
              user_email: "$user",
              organization: organization,
              department: "$department",
              "startDate": from,
              "endDate": till
            },
            pipeline: [
              {
                "$match": {
                  "$expr": {
                    "$and": [
                      { "$eq": ["$user_email", "$$user_email"] },
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
                  path: "$aux_management",
                  preserveNullAndEmptyArrays: true
                }
              },

              {
                $group: {
                  _id: null,
                  "minutes": {
                    $sum: {
                      $round: ["$aux_management.minutes", 0],
                    },
                  },
                }
              },
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
          $project: {
            _id: 0,
            user: 1,
            assigned_to_name: 1,
            assigned_to: 1,
            department: 1,
            productivity: "$productivity",
            desk_time: 1,
            break: 1,
            idle: 1,
            aux: {
              $cond: { if: "$data.minutes", then: "$data.minutes", else: 0 }
            },
            productive: 1,
            un_productive: 1
          }
        },
        {
          $sort: {
            productivity: -1
          }
        }
      ]),
      await Users.aggregate([
        {
          $match: query
        },
        {
          $group: {
            _id: {
              user_email: "$user_email",
              department: "$department"
            }
          }
        },
      ]),
    ])

    let reports = [];

    for (let i = 0; i < users.length; i++) {
      let Break_Time_Minutes = users[i].break;
      var num = Break_Time_Minutes;
      var hours = num / 60;
      var rhours = Math.floor(hours);
      var break_minutes = (hours - rhours) * 60;
      var rminutes = Math.round(break_minutes);
      Break_Time_Minutes = rhours + ':' + rminutes;

      let Idle_Time_Minutes = users[i].idle;
      var num12 = Idle_Time_Minutes;
      var hours12 = num12 / 60;
      var rhours12 = Math.floor(hours12);
      var idle_minutes = (hours12 - rhours12) * 60;
      var rminutes12 = Math.round(idle_minutes);
      Idle_Time_Minutes = rhours12 + ':' + rminutes12;

      let Aux_Minutes = users[i].aux;
      var num123 = Aux_Minutes;
      var hours123 = num123 / 60;
      var rhours123 = Math.floor(hours123);
      var aux_minutes = (hours123 - rhours123) * 60;
      var rminutes123 = Math.round(aux_minutes);
      Aux_Minutes = rhours123 + ':' + rminutes123;

      let Logged_in_Minutes = users[i].desk_time;
      var num1234 = Logged_in_Minutes;
      var hours1234 = num1234 / 60;
      var rhours1234 = Math.floor(hours1234);
      var logged_in_minutes = (hours1234 - rhours1234) * 60;
      var rminutes1234 = Math.round(logged_in_minutes);
      Logged_in_Minutes = rhours1234 + ':' + rminutes1234;

      let productive_in_Minutes = users[i].productive ? users[i].productive : 0
      var productiveMins = productive_in_Minutes;
      var productiveHours = productiveMins / 60;
      var rproductiveHours = Math.floor(productiveHours);
      var productive_in_minutes = (productiveHours - rproductiveHours) * 60;
      var rminutes1234 = Math.round(productive_in_minutes);
      productive_in_Minutes = rproductiveHours + ':' + rminutes1234;

      let un_productive_in_Minutes = users[i].un_productive ? users[i].un_productive : 0
      var un_productiveMins = un_productive_in_Minutes;
      var un_productiveHours = un_productiveMins / 60;
      var run_productiveHours = Math.floor(un_productiveHours);
      var un_productive_in_minutes =
        (un_productiveHours - run_productiveHours) * 60;
      var rminutes1234 = Math.round(un_productive_in_minutes);
      un_productive_in_Minutes = run_productiveHours + ':' + rminutes1234;

      let entry = {
        organization: organization,
        user: users[i].user,
        department: users[i].department,
        productivity_percentage: users[i].productivity,
        manager: users[i].assigned_to_name,
        manager_name: users[i].assigned_to,
        desk_time: Logged_in_Minutes,
        idle_min: Idle_Time_Minutes,
        break_min: Break_Time_Minutes,
        aux_min: Aux_Minutes,
        productivity_percentage: users[i].productivity,
        productive: productive_in_Minutes,
        un_productive: un_productive_in_Minutes,
      };
      reports.push(entry);
    }

    if (report_type === 'csv') {
      try {

        for (let i = 0; i < users.length; i++) {

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


          let Aux_Minutes = users[i].aux
          var num123 = Aux_Minutes;
          var hours123 = (num123 / 60);
          var rhours123 = Math.floor(hours123);
          var aux_minutes = (hours123 - rhours123) * 60;
          var rminutes123 = Math.round(aux_minutes);
          Aux_Minutes = rhours123 + ":" + rminutes123;


          let Logged_in_Minutes = users[i].desk_time
          var num1234 = Logged_in_Minutes;
          var hours1234 = (num1234 / 60);
          var rhours1234 = Math.floor(hours1234);
          var logged_in_minutes = (hours1234 - rhours1234) * 60;
          var rminutes1234 = Math.round(logged_in_minutes);
          Logged_in_Minutes = rhours1234 + ":" + rminutes1234;

          let productive_in_Minutes = users[i].productive ? users[i].productive : 0
          var productiveMins = productive_in_Minutes;
          var productiveHours = (productiveMins / 60);
          var rproductiveHours = Math.floor(productiveHours);
          var productive_in_minutes = (productiveHours - rproductiveHours) * 60;
          var rminutes1234 = Math.round(productive_in_minutes);
          productive_in_Minutes = rproductiveHours + ":" + rminutes1234;

          let un_productive_in_Minutes = users[i].un_productive ? users[i].un_productive : 0
          var un_productiveMins = un_productive_in_Minutes;
          var un_productiveHours = (un_productiveMins / 60);
          var run_productiveHours = Math.floor(un_productiveHours);
          var un_productive_in_minutes = (un_productiveHours - run_productiveHours) * 60;
          var rminutes1234 = Math.round(un_productive_in_minutes);
          un_productive_in_Minutes = run_productiveHours + ":" + rminutes1234;



          let entry = {
            Organization: organization,
            User: users[i].user,
            Department: users[i].department,
            'Manager': users[i].assigned_to,
            'Manager Name': users[i].assigned_to_name,
            "Date Range(from - to)": moment(from).tz(time_zone).format('DD-MMM-YYYY') + " - " + moment(to).tz(time_zone).format('DD-MMM-YYYY'),
            "Productivity (%)": users[i].productivity,
            'Desk Time (hrs)': Logged_in_Minutes,
            'Idle Time (hrs)': Idle_Time_Minutes,
            'Break Time (hrs)': Break_Time_Minutes,
            'Aux Time (hrs)': Aux_Minutes,
            'Productive Web & App (hrs)': productive_in_Minutes,
            'Non Productive Web & App (hrs': un_productive_in_Minutes,
          };
          reports.push(entry)
        }

        const fields = ['Organization', 'Department', 'User', 'Manager', 'Manager Name', 'Date Range(from - to)', 'Productivity (%)', 'Desk Time (hrs)', 'Idle Time (hrs)', 'Break Time (hrs)', 'Aux Time (hrs)', 'Productive Web & App (hrs)', 'Non Productive Web & App (hrs'];
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
      reports = reports.slice(skip, skip + limit);

      return res.status(200).json({
        message: 'Users list respective manager fetched successfully',
        data: reports,
        total: total.length,
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

const summarizedDataDepartment = async (req, res, next) => {
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
      report_type,
      assigned_to_name,
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

    if (assigned_to_name === assigned_to_name) {
      query = {
        organization: organization,
        department: department,
        is_licensed: true,
        "$and": [
          { assigned_to: { $regex: assigned_to_name, $options: 'i' } },
        ]


      }
    } else {
      query = {
        organization: organization,
        department: department,
        is_licensed: true
      }
    }


    let users = await Users.aggregate([
      {
        $match: query
      },
      {
        $group: {
          _id: "$assigned_to",
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
            "assigned_to": "$_id",
            department: department,
            organization: organization,
            "startDate": from,
            "endDate": till
          },
          pipeline: [
            {
              "$match": {
                "$expr": {
                  "$and": [
                    { "$eq": ["$assigned_to", "$$assigned_to"] },
                    { "$eq": ["$department", "$$department"] },
                    { "$eq": ["$organization", "$$organization"] },
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
            "assigned_to": "$_id",
            department: department,
            organization: organization,
            "startDate": from,
            "endDate": till
          },
          pipeline: [
            {
              "$match": {
                "$expr": {
                  "$and": [
                    { "$eq": ["$assigned_to", "$$assigned_to"] },
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
                _id: null,
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
            "department": department,
            organization: organization
          },
          pipeline: [
            {
              "$match": {
                "$expr": {
                  "$and": [
                    { "$eq": ["$organization", "$$organization"] },
                    { "$eq": ["$department", "$$department"] }
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
          manager: "$_id",
          loginHours: {
            $cond: { if: "$data.loginHours", then: "$data.loginHours", else: 0 }
          },
          total_users: "$users",
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
        $addFields: {
          total_absent: { $subtract: ["$total_users", "$total_present"] }
        }
      },

      {
        $lookup: {
          from: 'activities',
          let: {
            "assigned_to": "$manager",
            department: department,
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
                    { "$eq": ["$assigned_to", "$$assigned_to"] },
                    { "$eq": ["$department", "$$department"] },
                    { "$eq": ["$organization", "$$organization"] },
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
                users: { $addToSet: "$user_email" }
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
            "assigned_to": "$manager",
            department: department,
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
                    { "$eq": ["$assigned_to", "$$assigned_to"] },
                    { "$eq": ["$department", "$$department"] },
                    { "$eq": ["$organization", "$$organization"] },
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
                users: { $addToSet: "$user_email" }
              }
            },
            {
              $project: {
                _id: 0,
                under: { $size: "$users" }
              }
            }
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
            "assigned_to": "$manager",
            department: department,
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
                    { "$eq": ["$assigned_to", "$$assigned_to"] },
                    { "$eq": ["$department", "$$department"] },
                    { "$eq": ["$organization", "$$organization"] },
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
                users: { $addToSet: "$user_email" }
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
      },
      {
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
          manager: 1,
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
        manager: users[i].manager,
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
            Department: department,
            Manager: users[i].manager,
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
        const fields = ['Organization', 'Department', 'Manager', 'Productivity (%)', 'Total Users', 'Total Present', 'Total Absent', 'Idle Time(hh:mm)', 'Break Time(hh:mm', 'Adequate (%)', 'Over Utilized (%)', 'Under Utilized (%)', 'WFH/WFO'];
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
      reports = reports.slice(skip, skip + limit);


      return res.status(200).json({
        'message': 'Managers wise data fetched successfully',
        data: reports,
        total: users.length,
      });
    }



  } catch (error) {
    console.error(error)

    return res.status(500).json({
      'code': 'SERVER_ERROR',
      'description': 'something went wrong, Please try again'
    });
  }
}


const getAppWebPerByDepartment = async (req, res, next) => {
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

    let query = {
      organization: organization,
      department: department,
      date: {
        $gte: from,
        $lt: till,
      },
    };

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
                  minutes: '$totalMinutes',
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
          department: department,
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
        for (let i = 0; i < web_app_per.length; i++) {
          let entry = {
            Organization: web_app_per[i].organization,
            Department: web_app_per[i].department,
            'Productive Percentage': web_app_per[i].productive_percentage,
            'Non Productive Percentage': web_app_per[i].unproductive_percentage,
          };
          reports.push(entry);
        }

        const fields = [
          'Organization',
          'Department',
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

const getWebProductivityByDepartment = async (req, res, next) => {
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


    let query = {
      organization: organization,
      department: department,
      'date': {
        "$gte": from,
        "$lt": till
      }
    }

    let web_data = await Activity.aggregate([
      {
        $match: query
      },
      {
        "$project": {
          _id: 0,
          visitedWeb: 1
        }
      },
      {
        $unwind: "$visitedWeb"
      },
      {
        $group: {
          _id: {
            name: "$visitedWeb.domain",
            'is_productive': "$visitedWeb.is_productive",
            category: "$visitedWeb.category"
          },
          "totalMinutes": {
            "$sum": {
              "$divide": [
                { "$subtract": ["$visitedWeb.endTime", "$visitedWeb.startTime"] },
                1000 * 60
              ]
            }
          }
        }
      },
      {
        $group: {
          _id: {
            'category': "$_id.category",
            'is_productive': "$_id.is_productive",
            'name': "$_id.name",

          },
          totalMinutes: { $sum: "$totalMinutes" }
        }
      },
      {
        $project: {
          _id: 0,
          organization: organization,
          is_productive: "$_id.is_productive",
          totalMinutes: {
            $round: ["$totalMinutes", 0]
          },
          name: "$_id.name"
        }
      },
      {
        '$match': { 'totalMinutes': { '$ne': 0 } }
      },
      {
        $sort: { totalMinutes: -1 }
      },
      {
        $group: {
          _id: null,
          productive: {
            "$push": {
              "$cond": [{
                $eq: ["$is_productive", true]
              },
              {
                "name": "$name",
                "minutes": "$totalMinutes"
              },
                "$$REMOVE"
              ]
            }
          },
          un_productive: {
            "$push": {
              "$cond": [{
                "$and": [{
                  $eq: ["$is_productive", false]
                }
                ]
              },
              {
                "name": "$name",
                "minutes": "$totalMinutes"
              },
                "$$REMOVE"
              ]
            }
          }
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
            $slice: ["$productive", 0, 10]
          },
          un_productive: {
            $slice: ["$un_productive", 0, 10]
          }
        }
      },

    ]);


    let total_prod = 0
    let total_un_prod = 0

    let reports = []
    let reports1 = []

    for (let i = 0; i < web_data.length; i++) {
      for (let j = 0; j < web_data[i].productive.length; j++) {

        total_prod = total_prod + web_data[i].productive[j].minutes
      }
    }

    for (let i = 0; i < web_data.length; i++) {
      for (let j = 0; j < web_data[i].productive.length; j++) {


        let productivity_cal = web_data[i].productive[j].minutes
        let productivity_per = ((productivity_cal / total_prod) * 100).toFixed(2);

        let entry = {
          name: web_data[i].productive[j].name,
          percentage: Number(productivity_per)

        }
        reports.push(entry)
      }
    }

    for (let i = 0; i < web_data.length; i++) {
      for (let j = 0; j < web_data[i].un_productive.length; j++) {


        total_un_prod = total_un_prod + web_data[i].un_productive[j].minutes
      }
    }

    for (let i = 0; i < web_data.length; i++) {
      for (let j = 0; j < web_data[i].un_productive.length; j++) {


        let productivity_cal = web_data[i].un_productive[j].minutes
        let productivity_per = ((productivity_cal / total_un_prod) * 100).toFixed(2);

        let entry = {
          name: web_data[i].un_productive[j].name,
          percentage: Number(productivity_per)

        }
        reports1.push(entry)
      }
    }


    if (report_type === "csv") {
      try {

        let total_prod = 0
        let total_un_prod = 0

        let reports = []
        let reports1 = []
        for (let i = 0; i < web_data.length; i++) {
          for (let j = 0; j < web_data[i].productive.length; j++) {

            total_prod = total_prod + web_data[i].productive[j].minutes
          }
        }

        for (let i = 0; i < web_data.length; i++) {
          for (let j = 0; j < web_data[i].productive.length; j++) {


            let productivity_cal = web_data[i].productive[j].minutes
            let productivity_per = ((productivity_cal / total_prod) * 100).toFixed(2);

            let entry = {
              name: web_data[i].productive[j].name,
              productive_percentage: Number(productivity_per)

            }
            reports.push(entry)
          }
        }

        for (let i = 0; i < web_data.length; i++) {
          for (let j = 0; j < web_data[i].un_productive.length; j++) {


            total_un_prod = total_un_prod + web_data[i].un_productive[j].minutes
          }
        }

        for (let i = 0; i < web_data.length; i++) {
          for (let j = 0; j < web_data[i].un_productive.length; j++) {


            let productivity_cal = web_data[i].un_productive[j].minutes
            let productivity_per = ((productivity_cal / total_un_prod) * 100).toFixed(2);

            let entry = {
              name: web_data[i].un_productive[j].name,
              un_productive_percentage: Number(productivity_per)

            }
            reports1.push(entry)
          }
        }
        let array3 = reports.concat(reports1);

        let response = []
        for (let i = 0; i < array3.length; i++) {
          let entry = {
            Name: array3[i].name,
            Productive: array3[i].productive_percentage,
            'Non Productive': array3[i].un_productive_percentage
          }
          response.push(entry)
        }



        const fields = ['Name', 'Productive', 'Non Productive'];
        const opts = { fields };
        const csv = parse(response, opts);
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
        'message': 'Get Web productive and un-productive fetched successfully',
        'productive': reports,
        un_productive: reports1
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
//saas
const getAppProductivityDepartment = async (req, res, next) => {
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

    let query = {
      organization: organization,
      department: department,
      'date': {
        "$gte": from,
        "$lt": till
      }
    }

    let app_data = await Activity.aggregate([
      {
        $match: query
      },
      {
        "$project": {
          _id: 0,
          activeApps: 1,
        }
      },
      {
        $unwind: "$activeApps"
      },
      {
        $group: {
          _id: {
            'is_productive': "$activeApps.is_productive",
            'category': "$activeApps.category",
            name: "$activeApps.name"
          },
          "totalMinutes": {
            "$sum": {
              "$divide": [
                { "$subtract": ["$activeApps.endTime", "$activeApps.startTime"] },
                1000 * 60
              ]
            }
          }
        }
      },
      {
        $group: {
          _id: {
            'category': "$_id.category",
            'is_productive': "$_id.is_productive",
            'name': "$_id.name",

          },
          totalMinutes: { $sum: "$totalMinutes" }
        }
      },
      {
        $project: {
          _id: 0,
          organization: organization,
          is_productive: "$_id.is_productive",
          totalMinutes: {
            $round: ["$totalMinutes", 0]
          },
          name: "$_id.name"
        }

      },
      {
        '$match': { 'totalMinutes': { '$ne': 0 } }
      },
      {
        $sort: { totalMinutes: -1 }
      },
      {
        $group: {
          _id: null,
          productive: {
            "$push": {
              "$cond": [{
                $eq: ["$is_productive", true]
              },
              {
                "name": "$name",
                "minutes": "$totalMinutes"
              },
                "$$REMOVE"
              ]
            }
          },
          un_productive: {
            "$push": {
              "$cond": [{
                "$and": [{
                  $eq: ["$is_productive", false]
                }
                ]
              },
              {
                "name": "$name",
                "minutes": "$totalMinutes"
              },
                "$$REMOVE"
              ]
            }
          }
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
            $slice: ["$productive", 0, 10]
          },
          un_productive: {
            $slice: ["$un_productive", 0, 10]
          }
        }

      },
      {
        $limit: 10
      }
    ]);

    let total_prod = 0
    let total_un_prod = 0

    let reports = []
    let reports1 = []

    for (let i = 0; i < app_data.length; i++) {
      for (let j = 0; j < app_data[i].productive.length; j++) {

        total_prod = total_prod + app_data[i].productive[j].minutes
      }
    }

    for (let i = 0; i < app_data.length; i++) {
      for (let j = 0; j < app_data[i].productive.length; j++) {


        let productivity_cal = app_data[i].productive[j].minutes
        let productivity_per = ((productivity_cal / total_prod) * 100).toFixed(2);

        let entry = {
          name: app_data[i].productive[j].name,
          percentage: Number(productivity_per)

        }
        reports.push(entry)
      }
    }

    for (let i = 0; i < app_data.length; i++) {
      for (let j = 0; j < app_data[i].un_productive.length; j++) {


        total_un_prod = total_un_prod + app_data[i].un_productive[j].minutes
      }
    }

    for (let i = 0; i < app_data.length; i++) {
      for (let j = 0; j < app_data[i].un_productive.length; j++) {


        let productivity_cal = app_data[i].un_productive[j].minutes
        let productivity_per = ((productivity_cal / total_un_prod) * 100).toFixed(2);

        let entry = {
          name: app_data[i].un_productive[j].name,
          percentage: Number(productivity_per)

        }
        reports1.push(entry)
      }
    }



    if (report_type === "csv") {
      try {

        let total_prod = 0
        let total_un_prod = 0

        let reports = []
        let reports1 = []

        for (let i = 0; i < app_data.length; i++) {
          for (let j = 0; j < app_data[i].productive.length; j++) {

            total_prod = total_prod + app_data[i].productive[j].minutes
          }
        }

        for (let i = 0; i < app_data.length; i++) {
          for (let j = 0; j < app_data[i].productive.length; j++) {


            let productivity_cal = app_data[i].productive[j].minutes
            let productivity_per = ((productivity_cal / total_prod) * 100).toFixed(2);

            let entry = {
              name: app_data[i].productive[j].name,
              productive_percentage: Number(productivity_per)

            }
            reports.push(entry)
          }
        }

        for (let i = 0; i < app_data.length; i++) {
          for (let j = 0; j < app_data[i].un_productive.length; j++) {


            total_un_prod = total_un_prod + app_data[i].un_productive[j].minutes
          }
        }

        for (let i = 0; i < app_data.length; i++) {
          for (let j = 0; j < app_data[i].un_productive.length; j++) {


            let productivity_cal = app_data[i].un_productive[j].minutes
            let productivity_per = ((productivity_cal / total_un_prod) * 100).toFixed(2);

            let entry = {
              name: app_data[i].un_productive[j].name,
              un_productive_percentage: Number(productivity_per)

            }
            reports1.push(entry)
          }
        }


        let array3 = reports.concat(reports1);




        let response = []
        for (let i = 0; i < array3.length; i++) {
          let entry = {
            Name: array3[i].name,
            "Productive": array3[i].productive_percentage,
            "Non Productive": array3[i].un_productive_percentage
          }
          response.push(entry)
        }

        const fields = ['Name', 'Productive', 'Non Productive'];
        const opts = { fields };
        const csv = parse(response, opts);
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
        'message': 'Get App productive and un-productive fetched successfully',
        productive: reports,
        un_productive: reports1
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

const getTrackedMostHoursByDepartment = async (req, res, next) => {
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

    let query = {
      organization: organization,
      department: department,
      date: {
        $gte: from,
        $lt: till,
      },
    };

    let trackedMostHours = await Activity.aggregate([
      {
        $match: query,
      },
      {
        $project: {
          _id: 0,
          loginHours: 1,
          user_email: 1,
        },
      },
      {
        $group: {
          _id: '$user_email',
          hours: {
            $sum: {
              $round: ["$loginHours", 2]
            }
          },
        },
      },
      {
        $project: {
          _id: 0,
          user: '$_id',
          loginHours: '$hours',
        },
      },
      { $match: { loginHours: { $ne: 0 } } },
      {
        $sort: { loginHours: -1 },
      },
      {
        $limit: 5,
      },
    ]);

    let reports = [];

    let rank = 1;

    for (i = 0; i < trackedMostHours.length; i++) {
      let login_minutes = Math.floor(trackedMostHours[i].loginHours / 60 / 60);
      let minutes =
        Math.floor(trackedMostHours[i].loginHours / 60) - login_minutes * 60;
      let formatted =
        login_minutes.toString().padStart(2, '0') +
        ':' +
        minutes.toString().padStart(2, '0');

      let entry = {
        Organization: organization,
        Department: department,
        User: trackedMostHours[i].user,
        Login_Hours: formatted,
        Rank: rank++,
      };
      reports.push(entry);
    }

    if (report_type === 'csv') {
      try {
        const fields = [
          'Organization',
          'Department',
          'User',
          'Login_Hours',
          'Rank',
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
        message: 'Tracked most hours fetched successfully',
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

const getTrackedLeastHoursByDepartment = async (req, res, next) => {
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

    let query = {
      organization: organization,
      department: department,
      date: {
        $gte: from,
        $lt: till,
      },
    };

    let trackedLeastHours = await Activity.aggregate([
      {
        $match: query,
      },
      {
        $project: {
          _id: 0,
          loginHours: 1,
          user_email: 1,
        },
      },

      {
        $group: {
          _id: '$user_email',
          hours: {
            $sum: {
              $round: ["$loginHours", 2]
            }
          },
        },
      },
      {
        $project: {
          _id: 0,
          user: '$_id',
          loginHours: '$hours',
        },
      },
      { $match: { loginHours: { $ne: 0 } } },
      {
        $sort: { loginHours: 1 },
      },
      {
        $limit: 5,
      },
    ]);

    let reports = [];

    let rank = 1;

    for (i = 0; i < trackedLeastHours.length; i++) {
      let login_minutes = Math.floor(trackedLeastHours[i].loginHours / 60 / 60);
      let minutes =
        Math.floor(trackedLeastHours[i].loginHours / 60) - login_minutes * 60;
      let formatted =
        login_minutes.toString().padStart(2, '0') +
        ':' +
        minutes.toString().padStart(2, '0');

      let entry = {
        Organization: organization,
        Department: department,
        User: trackedLeastHours[i].user,
        Login_Hours: formatted,
        Rank: rank++,
      };
      reports.push(entry);
    }

    if (report_type === 'csv') {
      try {
        const fields = [
          'Organization',
          'Department',
          'User',
          'Login_Hours',
          'Rank',
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
        message: 'Tracked least hours fetched successfully',
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

const getLoggedInNotLoggedInByDepartment = async (req, res, next) => {
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

    let query = {
      organization: organization,
      department: department,
      date: {
        $gte: from,
        $lt: till,
      },
    };

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
            department: department,
            organization: organization,
            is_licensed: true,
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$department', '$$department'] },
                    { $eq: ['$organization', '$$organization'] },
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
        for (let i = 0; i < users.length; i++) {
          let entry = {
            date: users[i].date,
            total_users: users[i].total_users,
            total_present: users[i].total_present,
            total_absent: users[i].total_absent,
          };
          reports.push(entry);
        }

        const fields = ['date', 'total_users', 'total_present', 'total_absent'];
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
        message: 'Logged in vs Not-Logged in count fetched successfully',
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

module.exports = {
  getPresentVsAbsentByDepartment: getPresentVsAbsentByDepartment,
  getWfhVsWfoByDepartment: getWfhVsWfoByDepartment,
  getIdleTimeByDepartment: getIdleTimeByDepartment,
  getBreakTimeByDepartment: getBreakTimeByDepartment,
  summarizedDataDepartment: summarizedDataDepartment,
  getAppWebPerByDepartment: getAppWebPerByDepartment, //ALL user
  getWebProductivityByDepartment: getWebProductivityByDepartment, //ALL user
  getAppProductivityDepartment: getAppProductivityDepartment, //ALL user
  allUsersActivity: allUsersActivity, ///ALL user
  getProductivityByDepartment: getProductivityByDepartment,
  getTrackedMostHoursByDepartment: getTrackedMostHoursByDepartment, //ALL user
  getTrackedLeastHoursByDepartment: getTrackedLeastHoursByDepartment, //ALL user
  getLoggedInNotLoggedInByDepartment: getLoggedInNotLoggedInByDepartment, //ALL user
};
