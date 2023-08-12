const express = require('express');
const mongoose = require('mongoose');
const Users = require('../../../models/users');
const Logger = require('../../../configs/log');
const logger = new Logger('department');
const moment = require('moment-timezone');
const { parse } = require('json2csv');

const getUsersProfile = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let assigned_to = req.assigned_to;
    let user_email = req.user_email;

    let { member_email, from, to } = req.body;

    let query = {
      organization: organization,
      user_email: member_email,
    };

    let time_zone = req.timezone;

    let new_live = moment(moment.utc())
      .subtract(2, 'minutes')
      .format('YYYY-MM-DDTHH:mm');
    let updated_live = moment(moment.utc())
      .add(1, 'minutes')
      .format('YYYY-MM-DDTHH:mm');

    let date_live = moment(moment.utc()).format('MM-DD-YYYY');

    let jDateToday_live = new Date(date_live);

    let local_date = moment(jDateToday_live);
    let local_date_from = moment(local_date).tz(time_zone);
    let local_date_till = moment(local_date).tz(time_zone);

    let from_live = local_date_from.startOf('day').toDate();
    let till_live = local_date_till.endOf('day').toDate();

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

    let total_users = await Users.find({
      organization: organization,
      department: department,
      is_licensed: true,
    }).countDocuments();

    let user = await Users.aggregate([
      {
        $match: query,
      },
      {
        $project: {
          _id: 0,
          user_email: 1,
          user_name: 1,
          department: 1,
          organization: 1,
          first_name: 1,
          last_name: 1,
          gender: {
            $cond: { if: '$gender', then: '$gender', else: '' },
          },
          phone: {
            $cond: { if: '$phone', then: '$phone', else: '' },
          },
          assigned_to: 1,
          photo_url: 1,
          address: 1,
          interest_and_hobbies: 1,
          skills: 1,
        },
      },
      {
        $lookup: {
          from: 'activities',
          let: {
            user_email: member_email,
            department: '$department',
            organization: '$organization',
            startDate: from_live,
            endDate: till_live,
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
                is_am_alive: 1,
              },
            },
            {
              $group: {
                _id: {
                  $dateToString: {
                    format: '%Y-%m-%dT%H:%M',
                    date: '$is_am_alive',
                  },
                },
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
          user: '$user_email',
          user_name: 1,
          department: 1,
          organization: 1,
          first_name: 1,
          last_name: 1,
          gender: 1,
          phone: 1,
          assigned_to: 1,
          photo_url: 1,
          address: 1,
          interest_and_hobbies: 1,
          skills: 1,
          activity: {
            $cond: {
              if: {
                $and: [
                  { $gte: ['$data._id', new_live] },
                  { $lt: ['$data._id', updated_live] },
                ],
              },
              then: 'ACTIVE',
              else: 'NOT-ACTIVE',
            },
          },
        },
      },
      {
        $lookup: {
          from: 'activities',
          let: {
            user_email: '$user',
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
                user_email: 1,
                breaks: { $sum: '$breaks.minutes' },
                idleTime: 1,
                loginHours: 1,
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
              },
            },
            {
              $project: {
                _id: 0,
                idle: 1,
                break: 1,
                loginHours: 1,
              },
            },
          ],
          as: 'active',
        },
      },
      {
        $unwind: {
          path: '$active',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          break: '$active.break',
        },
      },
      {
        $addFields: {
          idle: '$active.idle',
        },
      },
      {
        $addFields: {
          desk_time: { minutes: { $round: ['$active.loginHours', 0] } },
        },
      },
      {
        $lookup: {
          from: 'configurations',
          let: {
            organization: organization,
            department: '$department',
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
          user_name: 1,
          department: 1,
          organization: 1,
          first_name: 1,
          last_name: 1,
          gender: 1,
          phone: 1,
          assigned_to: 1,
          photo_url: 1,
          address: 1,
          interest_and_hobbies: 1,
          skills: 1,
          activity: '$activity',
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
          user_name: 1,
          department: 1,
          organization: 1,
          first_name: 1,
          last_name: 1,
          gender: 1,
          phone: 1,
          assigned_to: 1,
          photo_url: 1,
          address: 1,
          interest_and_hobbies: 1,
          skills: 1,
          activity: 1,
          idle: 1,
          break: 1,
          desk_time: 1,
          work_hours: 1,
          days: 1,
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
          user: 1,
          user_name: 1,
          department: 1,
          organization: 1,
          first_name: 1,
          last_name: 1,
          gender: 1,
          phone: 1,
          assigned_to: 1,
          photo_url: 1,
          address: 1,
          interest_and_hobbies: 1,
          skills: 1,
          activity: 1,
          idle: 1,
          break: 1,
          desk_time: 1,
          work_hours: 1,
          days: 1,
          expected_work_hours_min: 1,
          productivity: {
            $round: ['$productivity', 2],
          },
        },
      },
      {
        $addFields: {
          idle_percentage: {
            $multiply: [
              { $divide: ['$idle', '$expected_work_hours_min'] },
              100,
            ],
          },
        },
      },
      {
        $addFields: {
          break_percentage: {
            $multiply: [
              { $divide: ['$break', '$expected_work_hours_min'] },
              100,
            ],
          },
        },
      },

      {
        $lookup: {
          from: 'active_aux_managements',
          let: {
            user_email: '$user',
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
                    { $eq: ['$user_email', '$$user_email'] },
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
              $group: {
                _id: null,
                Status: {
                  $push: {
                    Minutes: '$aux_management.minutes',
                  },
                },
              },
            },
            {
              $project: {
                _id: 0,
                minutes: {
                  $round: [{ $sum: '$Status.Minutes' }, 1],
                },
              },
            },
          ],
          as: 'active_aux',
        },
      },
      {
        $unwind: {
          path: '$active_aux',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 0,
          user: 1,
          user_name: 1,
          department: 1,
          organization: 1,
          first_name: 1,
          last_name: 1,
          gender: 1,
          phone: 1,
          assigned_to: 1,
          photo_url: 1,
          address: 1,
          interest_and_hobbies: 1,
          skills: 1,
          activity: 1,
          idle_percentage: '$idle_percentage',
          break_percentage: '$break_percentage',
          idle: 1,
          break: 1,
          desk_time: 1,
          expected_work_hours_min: 1,
          aux: {
            $cond: {
              if: '$active_aux.minutes',
              then: '$active_aux.minutes',
              else: 0,
            },
          },
          productivity: {
            $round: ['$productivity', 2],
          },
        },
      },
      {
        $addFields: {
          aux_percentage: {
            $multiply: [{ $divide: ['$aux', '$expected_work_hours_min'] }, 100],
          },
        },
      },
      {
        $project: {
          _id: 0,
          user: 1,
          user_name: 1,
          department: 1,
          organization: 1,
          first_name: 1,
          last_name: 1,
          gender: 1,
          phone: 1,
          assigned_to: 1,
          photo_url: 1,
          address: 1,
          interest_and_hobbies: 1,
          skills: 1,
          activity: 1,
          idle_percentage: 1,
          break_percentage: 1,
          idle: 1,
          break: 1,
          desk_time: 1,
          expected_work_hours_min: 1,
          aux_percentage: 1,
          productivity: 1,
        },
      },
    ]);

    return res.status(200).json({
      message: 'User details fetched successfully',
      data: user,
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
  getUsersProfile: getUsersProfile,
};
