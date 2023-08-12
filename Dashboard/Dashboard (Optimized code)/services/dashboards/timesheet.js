const express = require('express');
const TimeSheet = require('../../models/timesheet');
const TimeSheetManagement = require('../../models/timesheet_management');
const Dinero = require('dinero.js');
const Users = require('../../models/users');
const Logger = require('../../configs/log');
const logger = new Logger('dashboard');
const util = require('util');
const const_config = require('../../utility/util');
const moment = require('moment-timezone');
const CC = require('currency-converter-lt');
const { parse } = require('json2csv');

const Rates = require('../../models/rates');

const getTaskTimeAndCost = async (req, res, next) => {
  try {
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;
    let assigned_to = req.assigned_to;

    let { from, to, currency_type } = req.body;

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

    if (currency_type === undefined || currency_type === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'Currency type is required',
        field: 'currency_type',
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

    let query = {
      organization: organization,
      department: department,
      createdAt: {
        $gte: from,
        $lt: till,
      },
    };

    let users_length = await TimeSheetManagement.countDocuments({
      organization: organization,
      department: department,
    });
    let response = await TimeSheet.aggregate([
      {
        $match: query,
      },
      {
        $group: {
          _id: {
            task_assign_to: '$task_assign_to',
            date: {
              $dateToString: {
                format: '%m-%d-%Y',
                date: '$taskStartTime',
              },
            },
          },
          tasks: {
            $push: {
              date: '$_id.date',
              task: '$taskTitle',
              taskID: '$_id',
              assignBy: '$assignBy',
              totalSeconds: {
                $sum: {
                  $divide: [
                    {
                      $subtract: ['$taskEndTime', '$taskStartTime'],
                    },
                    1000 * 60,
                  ],
                },
              },
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
          _id: '$_id.task_assign_to',
          tasks: {
            $push: {
              date: '$_id.date',
              task: '$tasks',
            },
          },
          total_hours: {
            $sum: {
              $sum: '$tasks.totalSeconds',
            },
          },
        },
      },
      {
        $lookup: {
          from: 'timesheetmanagements',
          let: {
            user_email: '$_id',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    {
                      $eq: ['$user_email', '$$user_email'],
                    },
                  ],
                },
              },
            },
          ],
          as: 'user_price',
        },
      },
      {
        $unwind: {
          path: '$user_price',
          preserveNullAndEmptyArrays: false,
        },
      },

      {
        $project: {
          _id: 1,
          tasks: 1,
          total_hours: 1,
          userPrice: {
            $divide: ['$user_price.price', 60],
          },
        },
      },
      {
        $project: {
          _id: 1,
          tasks: 1,
          total_hours: 1,
          total_price: {
            $round: [
              {
                $multiply: ['$total_hours', '$userPrice'],
              },
              0,
            ],
          },
        },
      },
      {
        $group: {
          _id: 0,
          total_price: {
            $push: {
              total_price: '$total_price',
            },
          },
          total_hours: {
            $push: {
              total_hours: '$total_hours',
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          total_price: { $sum: '$total_price.total_price' },
          total_hours: { $sum: '$total_hours.total_hours' },
        },
      },
    ]);
    let act = response.length > 0 ? response[0].total_price : 0;

    let rates = await Rates.findOne();

    let result = rates.rates[currency_type];
    logger.debug('result-', result);
    let value = act / result;
    logger.debug('value-', value);

    response.total_price = value;

    return res.status(200).json({
      message: 'Total tasks fetched successfully',
      data: users_length,
      total_minutes: response.length > 0 ? response[0].total_hours : 0,
      total_price: value,
    });
  } catch (error) {
    logger.error(error);
    return res.status(500).json({
      code: 'SERVER_ERROR',
      description: 'Something went wrong, please try again',
    });
  }
};

module.exports = {
  getTaskTimeAndCost: getTaskTimeAndCost,
};
