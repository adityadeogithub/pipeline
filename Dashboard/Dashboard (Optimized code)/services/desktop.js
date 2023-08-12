const express = require('express');
const Users = require('../models/users');
const ReportCategory = require('../models/report_category');
const App = require('../models/app');

const Logger = require('../configs/log');
const logger = new Logger('dashboard');
const util = require('util');
const const_config = require('../utility/util');
const moment = require('moment-timezone');

const getBirthdays = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let user_email = req.user_email;
    let assigned_to = req.assigned_to;

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

    let jDateToday = new Date();
    logger.debug('jDateToday', jDateToday);

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

    let query = {
      organization,
      dob: {
        $gte: from,
        $lt: till,
      },
    };

    let birthdays = await Users.aggregate([
      {
        $match: query,
      },
      {
        $project: {
          _id: 0,
          department: 1,
          organization: 1,
          user_email: 1,
          dob: 1,
          first_name: 1,
          last_name: 1,
        },
      },
    ]);

    return res.status(200).json({
      message: "Birthday's fetched successfully",
      data: birthdays,
    });
  } catch (error) {
    logger.error(error);
    return res.status(500).json({
      code: 'SERVER_ERROR',
      description: 'something went wrong, Please try again',
    });
  }
};

const getFavoriteReport = async (req, res, next) => {
  try {
    let role = req.role;
    let user_email = req.user_email;
    let organization = req.organization;
    let department = req.department;

    let { language } = req.body;
    let query = {
      user_email: user_email,
      organization: organization,
      language: language,
    };

    let response = await ReportCategory.aggregate([
      {
        $match: query,
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      {
        $unwind: {
          path: '$category.reports',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: '$category.reports._id',
          user_email: 1,
          organization: 1,
          department: 1,
          assigned_to: 1,
          category_name: '$category.category_name',
          name: '$category.reports.name',
          url: '$category.reports.url',
          description: '$category.reports.description',
          star: '$category.reports.star',
        },
      },
      {
        $match: { star: true },
      },

      // {
      //     $group: {
      //         _id: {
      //             _id: "$_id",
      //             user_email: "$user_email",
      //             organization: "$organization",
      //             department: "$department",
      //             name: "$name",
      //             idleTime: "$idleTime",
      //             loginTime: "$loginTime",
      //             breaks: "$breaks",
      //             loginHours: "$loginHours",
      //             logoutTime: "$logoutTime",
      //             date: "$date",
      //             lastSessionLogout: "$lastSessionLogout",
      //             login_type: "$login_type",
      //             systemLogoutTime: "$systemLogoutTime",
      //             videoUpdate: "$videoUpdate",
      //             timeLapseUrl: "$timeLapseUrl",
      //             achievement: "$achievement",
      //             achievementCount: "$achievementCount",
      //             activities: "$activities.activities",

      //         },
      //         activities: { $push: { activities: "$activities" } }

      //     }
      // },
      // {
      //     $project: {
      //         _id: "$_id._id",
      //         user_email: "$_id.user_email",
      //         organization: "$_id.organization",
      //         department: "$_id.department",
      //         name: "$_id.name",
      //         idleTime: "$_id.idleTime",
      //         loginTime: "$_id.loginTime",
      //         breaks: "$_id.breaks",
      //         loginHours: "$_id.loginHours",
      //         logoutTime: "$_id.lastSessionLogout",
      //         date: "$_id.date",
      //         lastSessionLogout: "$_id.lastSessionLogout",
      //         login_type: "$_id.login_type",
      //         systemLogoutTime: "$_id.systemLogoutTime",
      //         videoUpdate: "$_id.videoUpdate",
      //         timeLapseUrl: "$_id.timeLapseUrl",
      //         achievement: "$_id.achievement",
      //         activities: "$activities.activities",
      //         achievementCount: "$_id.achievementCount"
      //     }
      // }
    ]);

    return res.status(200).json({
      message: 'Flag updated successfully',
      response: response,
    });
  } catch (error) {
    logger.error(error);
    return res.status(500).json({
      code: 'SERVER_ERROR',
      description: 'something went wrong, Please try again',
    });
  }
};

const getFavoriteReportList = async (req, res, next) => {
  try {
    let role = req.role;
    let user_email = req.user_email;
    let organization = req.organization;
    let department = req.department;

    let { language } = req.body;
    let query = {
      user_email: user_email,
      organization: organization,
      language: language,
    };

    logger.debug('user_email', user_email);
    logger.debug('organization', organization);

    let response = await ReportCategory.aggregate([
      {
        $match: query,
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      {
        $unwind: {
          path: '$category.reports',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: '$category.reports._id',
          user_email: 1,
          organization: 1,
          department: 1,
          assigned_to: 1,
          category_name: '$category.category_name',
          name: '$category.reports.name',
          url: '$category.reports.url',
          description: '$category.reports.description',
          star: '$category.reports.star',
        },
      },
      // {
      //     $match: { star: true }
      // },

      // {
      //     $group: {
      //         _id: {
      //             _id: "$_id",
      //             user_email: "$user_email",
      //             organization: "$organization",
      //             department: "$department",
      //             name: "$name",
      //             idleTime: "$idleTime",
      //             loginTime: "$loginTime",
      //             breaks: "$breaks",
      //             loginHours: "$loginHours",
      //             logoutTime: "$logoutTime",
      //             date: "$date",
      //             lastSessionLogout: "$lastSessionLogout",
      //             login_type: "$login_type",
      //             systemLogoutTime: "$systemLogoutTime",
      //             videoUpdate: "$videoUpdate",
      //             timeLapseUrl: "$timeLapseUrl",
      //             achievement: "$achievement",
      //             achievementCount: "$achievementCount",
      //             activities: "$activities.activities",

      //         },
      //         activities: { $push: { activities: "$activities" } }

      //     }
      // },
      // {
      //     $project: {
      //         _id: "$_id._id",
      //         user_email: "$_id.user_email",
      //         organization: "$_id.organization",
      //         department: "$_id.department",
      //         name: "$_id.name",
      //         idleTime: "$_id.idleTime",
      //         loginTime: "$_id.loginTime",
      //         breaks: "$_id.breaks",
      //         loginHours: "$_id.loginHours",
      //         logoutTime: "$_id.lastSessionLogout",
      //         date: "$_id.date",
      //         lastSessionLogout: "$_id.lastSessionLogout",
      //         login_type: "$_id.login_type",
      //         systemLogoutTime: "$_id.systemLogoutTime",
      //         videoUpdate: "$_id.videoUpdate",
      //         timeLapseUrl: "$_id.timeLapseUrl",
      //         achievement: "$_id.achievement",
      //         activities: "$activities.activities",
      //         achievementCount: "$_id.achievementCount"
      //     }
      // }
    ]);

    return res.status(200).json({
      message: 'Flag updated successfully',
      response: response,
    });
  } catch (error) {
    logger.error(error);
    return res.status(500).json({
      code: 'SERVER_ERROR',
      description: 'something went wrong, Please try again',
    });
  }
};

const favoriteReportMultiple = async (req, res, next) => {
  try {
    let role = req.role;
    let user_email = req.user_email;
    let organization = req.organization;
    let department = req.department;

    let { urlsTrue, starTrue, urlsFalse, starFalse } = req.body;

    if (starTrue === starTrue) {
      for (let i = 0; i < urlsTrue.length; i++) {
        let flagUpdate = await ReportCategory.updateMany(
          {
            organization: organization,
            user_email: user_email,
            'category.reports.url': urlsTrue[i],
          },
          {
            $set: {
              'category.$[].reports.$[j].star': starTrue,
            },
          },
          {
            arrayFilters: [
              {
                'j.url': urlsTrue[i],
              },
            ],
          }
        );
      }
    }

    if (starFalse === starFalse) {
      for (let i = 0; i < urlsFalse.length; i++) {
        let flagUpdate = await ReportCategory.updateMany(
          {
            organization: organization,
            user_email: user_email,
            'category.reports.url': urlsFalse[i],
          },
          {
            $set: {
              'category.$[].reports.$[j].star': starFalse,
            },
          },
          {
            arrayFilters: [
              {
                'j.url': urlsFalse[i],
              },
            ],
          }
        );
      }
    }

    return res.status(200).json({
      message: 'Flag updated successfully',
    });
  } catch (error) {
    logger.error(error);
    return res.status(500).json({
      code: 'SERVER_ERROR',
      description: 'something went wrong, Please try again',
    });
  }
};

const getAppsList = async (req, res, next) => {
  try {
    let role = req.role;
    let user_email = req.user_email;
    let organization = req.organization;
    let department = req.department;

    let query = {
      user_email: user_email,
      organization: organization,
    };

    let response = await App.aggregate([
      {
        $match: query,
      },
      {
        $group: {
          _id: null,
          project: {
            $push: {
              name: 'Project Mgmt',
              taskManager: '$taskManager',
              selected: '$taskManager',
            },
          },
          leave: {
            $push: {
              name: 'Leave Mgmt',
              leaveManagement: '$leaveManagement',
              selected: '$leaveManagement',
            },
          },
          note: {
            $push: {
              name: 'Note',
              note: '$note',
              selected: '$note',
            },
          },
          reminder: {
            $push: {
              name: 'Reminder',
              reminder: '$reminder',
              selected: '$reminder',
            },
          },
          asset: {
            $push: {
              name: 'Asset',
              asset: '$asset',
              selected: '$asset',
            },
          },
          vault: {
            $push: {
              name: 'Vault',
              drive: '$drive',
              selected: '$drive',
            },
          },
          daily_reflection: {
            $push: {
              name: 'Daily Reflection',
              daily_reflection: '$daily_reflection',
              selected: '$daily_reflection',
            },
          },
          timesheet: {
            $push: {
              name: 'Time Sheet',
              time_sheet: '$time_sheet',
              selected: '$time_sheet',
            },
          },
          ideation: {
            $push: {
              name: 'Ideation Zone',
              ideationZone: '$ideationZone',
              selected: '$ideationZone',
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          project: 1,
          leave: 1,
          note: 1,
          reminder: 1,
          asset: 1,
          vault: 1,
          daily_reflection: 1,
          timesheet: 1,
          ideation: 1,
        },
      },
      {
        $project: {
          data: {
            $objectToArray: '$$ROOT',
          },
        },
      },

      {
        $project: {
          value: '$data.v',
        },
      },
      { $unwind: { path: '$value', preserveNullAndEmptyArrays: true } },
    ]);

    const output = response.map((item) => item.value[0]);

    return res.status(200).json({
      message: 'Desktop apps flag updated successfully',
      response: output,
    });
  } catch (error) {
    logger.error(error);
    return res.status(500).json({
      code: 'SERVER_ERROR',
      description: 'something went wrong, Please try again',
    });
  }
};

const updateAppList = async (req, res, next) => {
  try {
    let role = req.role;
    let user_email = req.user_email;
    let organization = req.organization;
    let department = req.department;

    let { appTrue, markTrue, appFalse, MarkFalse } = req.body;

    if (starTrue === starTrue) {
      for (let i = 0; i < appTrue.length; i++) {
        let temp = {
          taskManager: taskManager,
          leaveManagement: leaveManagement,
          note: note,
          reminder: reminder,
          asset: asset,
          drive: drive,
          chat_app: chat_app,
          connect_app: connect_app,
          daily_reflection: daily_reflection,
          time_sheet: time_sheet,
          google_calender: google_calender,
          ideationZone: ideationZone,
        };

        // let updateApp = await Apps.updateOne({
        //     organization: organization,
        //     "user_email": user_email
        // }, {
        //     new: true
        // }
        // );

        let flagUpdate = await Apps.updateMany(
          {
            organization: organization,
            user_email: user_email,
            'category.reports.url': appTrue[i],
          },
          {
            $set: {
              taskManager: true,
              leaveManagement: true,
              note: true,
              reminder: true,
              asset: false,
              drive: true,
              chat_app: false,
              connect_app: true,
              daily_reflection: true,
              time_sheet: true,
              google_calender: false,
              ideationZone: true,
            },
          },
          {
            arrayFilters: [
              {
                'j.url': urlsTrue[i],
              },
            ],
          }
        );
      }
    }

    if (starFalse === starFalse) {
      for (let i = 0; i < urlsFalse.length; i++) {
        let flagUpdate = await ReportCategory.updateMany(
          {
            organization: organization,
            user_email: user_email,
            'category.reports.url': urlsFalse[i],
          },
          {
            $set: {
              'category.$[].reports.$[j].star': starFalse,
            },
          },
          {
            arrayFilters: [
              {
                'j.url': urlsFalse[i],
              },
            ],
          }
        );
      }
    }

    return res.status(200).json({
      message: 'Flag updated successfully',
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
  getBirthdays: getBirthdays,
  getFavoriteReport: getFavoriteReport,
  getFavoriteReportList: getFavoriteReportList,
  favoriteReportMultiple: favoriteReportMultiple,
  getAppsList: getAppsList,
};
