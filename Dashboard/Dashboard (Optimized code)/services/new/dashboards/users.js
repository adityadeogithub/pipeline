const express = require('express');
const mongoose = require('mongoose');
const Users = require('../../../models/users');
const Activity = require('../../../models/activity');

const const_config = require('../../../utility/util');
const { parse } = require('json2csv');

const Logger = require('../../../configs/log');
const logger = new Logger('department');
const moment = require('moment-timezone');

const allUsersActivityUser = async (req, res, next) => {
  try {

    let role = req.role
    let organization = req.organization
    let department = req.department
    let assigned_to = req.assigned_to
    let user_email = req.user_email

    let {
      from,
      to,
      member_email,
      limit,
      skip,
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

    if (limit === undefined || limit === '') {
      return res.status(422).json({
        'code': 'REQUIRED_FIELD_MISSING',
        'description': 'Limit is required',
        'field': 'limit'
      });
    }

    if (skip === undefined || skip === '') {
      return res.status(422).json({
        'code': 'REQUIRED_FIELD_MISSING',
        'description': 'Skip is required',
        'field': 'skip'
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

    if (const_config.isAllowedRole(role, ["MANAGER"])) {

      if (member_email === member_email) {
        query = {
          organization: organization,
          user_email: { $regex: member_email, $options: 'i' },
          assigned_to: user_email,
          is_licensed: true
        }
      } else {
        query = {
          organization: organization,
          assigned_to: user_email,
          is_licensed: true

        }
      }
    }
    else {

      if (member_email === member_email) {
        query = {
          organization: organization,
          department: department,
          user_email: { $regex: member_email, $options: 'i' },
          is_licensed: true
        }
      } else {
        query = {
          organization: organization,
          department: department,
          is_licensed: true
        }
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
    let reports = []

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
        user: users[i].user,
        department: users[i].department,
        organization: organization,
        manager: users[i].assigned_to_name,
        manager_name: users[i].assigned_to,
        productivity_percentage: users[i].productivity,
        desk_time: Logged_in_Minutes,
        idle_min: Idle_Time_Minutes,
        break_min: Break_Time_Minutes,
        aux: Aux_Minutes,
        productive: productive_in_Minutes,
        un_productive: un_productive_in_Minutes,
      }
      reports.push(entry)
    }

    if (report_type === "csv") {
      try {

        let reports = []
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
          'code': 'SERVER_ERROR',
          'description': 'something went wrong, Please try again'
        });
      }
    } else {

      reports = reports.slice(skip, skip + limit);

      return res.status(200).json({
        'message': 'Users list respective manager fetched successfully',
        'data': reports,
        total: total.length,
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

const violationTimeUser = async (req, res, next) => {
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
        $project: {
          _id: 0,
          user_email: 1,
          activities: 1,
          date: 1,
        },
      },
      {
        $unwind: {
          path: '$activities',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $match: { 'activities.type': 'BREACH' },
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: '%d-%m-%Y',
                date: '$date',
              },
            },
            user_email: '$user_email',
          },
          activities: {
            $push: {
              user_email: '$activities',
            },
          },
        },
      },
      {
        $group: {
          _id: {
            date: '$_id.date',
            user_email: '$_id.user_email',
            activities: '$activities.user_email',
          },
        },
      },
    ]);

    return res.status(200).json({
      message: 'Users list respective manager fetched successfully',
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
  allUsersActivityUser: allUsersActivityUser,
  violationTimeUser: violationTimeUser,
};
