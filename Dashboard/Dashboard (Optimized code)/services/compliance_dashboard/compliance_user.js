const express = require('express');
const mongoose = require('mongoose');
const PrivacyBreach = require('../../models/privacy_breach');

const Department = require('../../models/department');
const AdminOrganization = require('../../models/admin_organization');
const AuditOrganization = require('../../models/audit_organization');
const Users = require('../../models/users');
const Configuration = require('../../models/configuration');
const const_config = require('../../utility/util');
const Logger = require('../../configs/log');
const logger = new Logger('compliance');
const moment = require('moment-timezone');
const { parse } = require('json2csv');

//updated
const getBreachesSummaryUser = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let assigned_to = req.assigned_to;
    let user_email = req.user_email;

    let { from, to, report_type, member_email, skip, limit } = req.body;

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
      is_licensed: true,
    }).distinct('user_email');

    let query = {
      organization: organization,
      department: department,
      user_email: member_email,
      detected_at: {
        $gte: from,
        $lt: till,
      },
    };

    let reports = [];

    let breach_summary = await PrivacyBreach.aggregate([
      {
        $match: query,
      },
      {
        $group: {
          _id: null,
          NOT_AT_DESK: {
            $sum: {
              $cond: [
                { $eq: ['$breach_type', 'NOT_AT_DESK'] }, 1, 0
              ]
            }
          },
          MOBILE_DETECTED: {
            $sum: {
              $cond: [
                { $eq: ['$breach_type', 'MOBILE_DETECTED'] }, 1, 0
              ]
            }
          },
          MULTIPLE_PERSONS: {
            $sum: {
              $cond: [
                { $eq: ['$breach_type', 'MULTIPLE_PERSONS'] }, 1, 0
              ]
            }
          },
          UNKNOWN_USER: {
            $sum: {
              $cond: [
                { $eq: ['$breach_type', 'UNKNOWN_USER'] }, 1, 0
              ]
            }
          },
          audit_done: {
            $sum: {
              $cond: [
                { $eq: ['$audit_done', true] }, 1, 0
              ]
            }
          },
          compliance: {
            $sum: {
              $cond: [
                { $eq: ['$compliance', true] }, 1, 0
              ]
            }
          },
          non_compliance: {
            $sum: {
              $cond: [
                { $eq: ['$non_compliance', true] }, 1, 0
              ]
            }
          },
          purge: {
            $sum: {
              $cond: [
                { $eq: ['$purge', true] }, 1, 0
              ]
            }
          },
        },
      },
      {
        $lookup: {
          from: 'users',
          let: {
            department: department,
            organization: organization,
            is_licensed: true,
            user_email: member_email,
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$department', '$$department'] },
                    { $eq: ['$organization', '$$organization'] },
                    { $eq: ['$is_licensed', '$$is_licensed'] },
                    { $eq: ['$user_email', '$$user_email'] },
                  ],
                },
              },
            },
            {
              $project: {
                _id: 0,
                user_email: 1,
                assigned_to: 1,
                organization: 1,
                department: 1,
                first_name: 1,
                last_name: 1,
                photo_url: 1,
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
          department: '$data.department',
          organization: '$data.organization',
          manager: '$data.assigned_to',
          user_email: '$data.user_email',
          not_at_desk_count: '$NOT_AT_DESK',
          mobile_detected_count: '$MOBILE_DETECTED',
          multiple_persons_count: '$MULTIPLE_PERSONS',
          unknown_person_count: '$UNKNOWN_USER',
          audit_done: '$audit_done',
          compliance: '$compliance',
          non_compliance: '$non_compliance',
          purge: '$purge',
          user_name: { $concat: ['$data.first_name', ' ', '$data.last_name'] },
          photo_url: '$data.photo_url',
        },
      },
      {
        $addFields: {
          total_breach_count: {
            $add: [
              '$not_at_desk_count',
              '$mobile_detected_count',
              '$multiple_persons_count',
              '$unknown_person_count',
            ],
          },
        },
      },
      {
        $project: {
          _id: 0,
          department: 1,
          organization: 1,
          manager: 1,
          user_email: 1,
          not_at_desk_count: 1,
          mobile_detected_count: 1,
          multiple_persons_count: 1,
          unknown_person_count: 1,
          audit_done: 1,
          compliance: 1,
          non_compliance: 1,
          purge: 1,
          photo_url: 1,
          total_breaches: '$total_breaches',
          total_breach_count: 1,
          unaudited: { $subtract: ['$total_breach_count', '$audit_done'] },
          user_name: '$user_name',
        },
      },
    ]);

    let order = 0;
    let rank = await PrivacyBreach.aggregate([
      {
        $match: {
          organization: organization,
          department: department,
          user_email: {
            $in: manager_user,
          },
          detected_at: {
            $gte: from,
            $lt: till,
          },
        },
      },
      {
        $group: {
          _id: '$user_email',
          NOT_AT_DESK: {
            $sum: {
              $cond: [
                { $eq: ['$breach_type', 'NOT_AT_DESK'] }, 1, 0
              ]
            }
          },
          MOBILE_DETECTED: {
            $sum: {
              $cond: [
                { $eq: ['$breach_type', 'MOBILE_DETECTED'] }, 1, 0
              ]
            }
          },
          MULTIPLE_PERSONS: {
            $sum: {
              $cond: [
                { $eq: ['$breach_type', 'MULTIPLE_PERSONS'] }, 1, 0
              ]
            }
          },
          UNKNOWN_USER: {
            $sum: {
              $cond: [
                { $eq: ['$breach_type', 'UNKNOWN_USER'] }, 1, 0
              ]
            }
          },
        },
      },

      {
        $project: {
          _id: 0,
          user_email: '$_id',
          order: order + 1,
          organization: organization,
          not_at_desk_count: '$NOT_AT_DESK',
          mobile_detected_count: '$MOBILE_DETECTED',
          multiple_persons_count: '$MULTIPLE_PERSONS',
          unknown_person_count: '$UNKNOWN_USER',
        },
      },
      {
        $addFields: {
          total_breach_count: {
            $add: [
              '$not_at_desk_count',
              '$mobile_detected_count',
              '$multiple_persons_count',
              '$unknown_person_count',
            ],
          },
        },
      },
      {
        $sort: {
          total_breach_count: -1,
        },
      },
      {
        $limit: 10,
      },
      {
        $set: {
          rownum: {
            $function: {
              body: 'function() {try {row_number+= 1;} catch (e) {row_number= 1;}return row_number;}',
              args: [],
              lang: 'js',
            },
          },
        },
      },
    ]);

    let entry = {};
    for (let i = 0; i < rank.length; i++) {
      if (rank[i].user_email === member_email) {
        entry = {
          rank: rank[i].rownum,
          user_email: rank[i].user_email,
        };
      }
    }

    if (report_type === 'csv') {
      try {
        for (let i = 0; i < breach_summary.length; i++) {
          let value = {
            organization: breach_summary[i].organization,
            department: breach_summary[i].department,
            user_email: breach_summary[i].user_email,
            manager: breach_summary[i].manager,
            not_at_desk_count: breach_summary[i].not_at_desk_count,
            mobile_detected_count: breach_summary[i].mobile_detected_count,
            multiple_persons_count: breach_summary[i].multiple_persons_count,
            unknown_person_count: breach_summary[i].unknown_person_count,
            total_breach_count: breach_summary[i].total_breach_count,
            audit_done: breach_summary[i].audit_done,
            compliance: breach_summary[i].compliance,
            non_compliance: breach_summary[i].non_compliance,
            purge: breach_summary[i].purge,
            unaudited: breach_summary[i].unaudited,
            photo_url: breach_summary[i].photo_url,
            rank: entry.rank,
          };
          reports.push(value);
        }

        const fields = [
          'organization',
          'department',
          'user_email',
          'manager',
          'not_at_desk_count',
          'mobile_detected_count',
          'multiple_persons_count',
          'unknown_person_count',
          'total_breach_count',
          'audit_done',
          'unaudited',
          'compliance',
          'non_compliance',
          'purge',
          'rank',
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
        message: 'Breach summary fetched successfully',
        data: breach_summary,
        current_ranking: entry,
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

//updated
const repeatedViolationsUser = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let assigned_to = req.assigned_to;
    let user_email = req.user_email;

    let { from, to, report_type, member_email } = req.body;

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
      user_email: member_email,
      detected_at: {
        $gte: from,
        $lt: till,
      },
    };

    let reports = [];
    let breach_summary = await PrivacyBreach.aggregate([
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
          NOT_AT_DESK: {
            $sum: {
              $cond: [
                { $eq: ['$breach_type', 'NOT_AT_DESK'] }, 1, 0
              ]
            }
          },
          MOBILE_DETECTED: {
            $sum: {
              $cond: [
                { $eq: ['$breach_type', 'MOBILE_DETECTED'] }, 1, 0
              ]
            }
          },
          MULTIPLE_PERSONS: {
            $sum: {
              $cond: [
                { $eq: ['$breach_type', 'MULTIPLE_PERSONS'] }, 1, 0
              ]
            }
          },
          UNKNOWN_USER: {
            $sum: {
              $cond: [
                { $eq: ['$breach_type', 'UNKNOWN_USER'] }, 1, 0
              ]
            }
          },
        },
      },

      {
        $project: {
          _id: 0,
          date: '$_id',
          user_email: member_email,
          department: department,
          organization: organization,
          not_at_desk_count: '$NOT_AT_DESK',
          mobile_detected_count: '$MOBILE_DETECTED',
          multiple_persons_count: '$MULTIPLE_PERSONS',
          unknown_person_count: '$UNKNOWN_USER',
        },
      },
      { $sort: { date: 1 } },
      {
        $addFields: {
          total_breach_count: {
            $add: [
              '$not_at_desk_count',
              '$mobile_detected_count',
              '$multiple_persons_count',
              '$unknown_person_count',
            ],
          },
        },
      },
    ]);

    let total_not_at_desk_count = 0;
    let total_mobile_detected_count = 0;
    let total_multiple_persons_count = 0;
    let total_unknown_person_count = 0;
    let total = 0;

    for (let i = 0; i < breach_summary.length; i++) {
      total_not_at_desk_count =
        total_not_at_desk_count + breach_summary[i].not_at_desk_count;
      total_mobile_detected_count =
        total_mobile_detected_count + breach_summary[i].mobile_detected_count;
      total_multiple_persons_count =
        total_multiple_persons_count + breach_summary[i].multiple_persons_count;
      total_unknown_person_count =
        total_unknown_person_count + breach_summary[i].unknown_person_count;
      total = total + breach_summary[i].total_breach_count;

      let entry = {
        organization: organization,
        department: department,
        date: breach_summary[i].date,
        user_email: member_email,
        not_at_desk_count: breach_summary[i].not_at_desk_count,
        mobile_detected_count: breach_summary[i].mobile_detected_count,
        multiple_persons_count: breach_summary[i].multiple_persons_count,
        unknown_person_count: breach_summary[i].unknown_person_count,
        total_breach_count: breach_summary[i].total_breach_count,
      };
      reports.push(entry);
    }

    if (report_type === 'csv') {
      try {
        const fields = [
          'organization',
          'department',
          'user_email',
          'date',
          'not_at_desk_count',
          'mobile_detected_count',
          'multiple_persons_count',
          'unknown_person_count',
          'total_breach_count',
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
        message: 'Department with highest violation fetched successfully',
        data: breach_summary,
        total_not_at_desk_count: total_not_at_desk_count,
        total_mobile_detected_count: total_mobile_detected_count,
        total_multiple_persons_count: total_multiple_persons_count,
        total_unknown_person_count: total_unknown_person_count,
        total: total,
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

//updated -- OLD
// const getBreachSummaryAllUsers = async (req, res, next) => {
//   try {
//     let role = req.role;
//     let organization = req.organization;
//     let department = req.department;
//     let assigned_to = req.assigned_to;
//     let user_email = req.user_email;

//     let { from, to, report_type, member_email, skip, limit } = req.body;

//     if (from === undefined || from === '') {
//       return res.status(422).json({
//         code: 'REQUIRED_FIELD_MISSING',
//         description: 'From is required',
//         field: 'from',
//       });
//     }

//     if (to === undefined || to === '') {
//       return res.status(422).json({
//         code: 'REQUIRED_FIELD_MISSING',
//         description: 'TO is required',
//         field: 'to',
//       });
//     }

//     let jDateToday = new Date(from);
//     let jDateTill = new Date(to);
//     let time_zone = req.timezone;
//     let time_zone_name = moment.tz(time_zone).format('Z');

//     let time_zone_name_char = time_zone_name.charAt(0);
//     let till;
//     if ('+' === time_zone_name_char) {
//       let local_date_from = moment(jDateToday).tz(time_zone);
//       let local_date_till = moment(jDateTill).tz(time_zone);
//       from = local_date_from.startOf('day').toDate();
//       till = local_date_till.endOf('day').toDate();
//     } else {
//       from = moment(jDateToday)
//         .tz(time_zone)
//         .format('YYYY-MM-DDTHH:mm:ss.SSS[Z]');
//       till = moment(jDateTill)
//         .endOf('day')
//         .tz(time_zone)
//         .format('YYYY-MM-DDTHH:mm:ss.SSS[Z]');
//       from = new Date(from);
//       till = new Date(till);
//     }

//     let users_license = await Users.findOne({
//       organization: organization,
//       is_licensed: true,
//     }).distinct('user_email');

//     let query = null;
//     let inDepartments = [];
//     if (const_config.isAllowedRole(role, ['SUPER_ADMIN'])) {
//       if (member_email) {
//         query = {
//           organization: organization,
//           department: department,
//           user_email: { $regex: member_email, $options: 'i' },
//           is_licensed: true,
//         };
//       } else {
//         query = {
//           organization: organization,
//           department: department,
//           is_licensed: true,
//         };
//       }
//     } else if (const_config.isAllowedRole(role, ['ADMIN'])) {
//       if (member_email) {
//         query = {
//           organization: organization,
//           department: department,
//           user_email: { $regex: member_email, $options: 'i' },
//           is_licensed: true,
//         };
//       } else {
//         query = {
//           organization: organization,
//           department: department,
//           is_licensed: true,
//         };
//       }
//     } else if (const_config.isAllowedRole(role, ['AUDIT'])) {
//       if (member_email) {
//         query = {
//           organization: organization,
//           department: department,
//           user_email: { $regex: member_email, $options: 'i' },
//           is_licensed: true,
//         };
//       } else {
//         query = {
//           organization: organization,
//           department: department,
//           is_licensed: true,
//         };
//       }
//     } else if (const_config.isAllowedRole(role, ['MANAGER'])) {
//       if (member_email) {
//         query = {
//           organization: organization,
//           assigned_to: user_email,
//           user_email: { $regex: member_email, $options: 'i' },
//           is_licensed: true,
//         };
//       } else {
//         query = {
//           assigned_to: user_email,
//           organization: organization,
//           is_licensed: true,
//         };
//       }
//     }

//     let reports = [];

//     let [breach_summary, userEmails] = await Promise.all([
//       Users.aggregate([
//         {
//           $match: query,
//         },
//         {
//           $project: {
//             _id: 0,
//             user_email: 1,
//             department: 1,
//           },
//         },
//         {
//           $sort: { user_email: -1 },
//         },
//         {
//           $lookup: {
//             from: 'privacybreaches',
//             let: {
//               user_email: '$user_email',
//               organization: organization,
//               startDate: from,
//               endDate: till,
//             },
//             pipeline: [
//               {
//                 $match: {
//                   $expr: {
//                     $and: [
//                       { $eq: ['$user_email', '$$user_email'] },
//                       { $eq: ['$organization', '$$organization'] },
//                       { $gte: ['$detected_at', '$$startDate'] },
//                       { $lt: ['$detected_at', '$$endDate'] },
//                     ],
//                   },
//                 },
//               },
//               {
//                 $group: {
//                   _id: {
//                     user_email: '$user_email',
//                     department: '$department',
//                   },
//                   NOT_AT_DESK: {
//                     $sum: {
//                       $cond: [
//                         { $eq: ['$breach_type', 'NOT_AT_DESK'] }, 1, 0
//                       ]
//                     }
//                   },
//                   MOBILE_DETECTED: {
//                     $sum: {
//                       $cond: [
//                         { $eq: ['$breach_type', 'MOBILE_DETECTED'] }, 1, 0
//                       ]
//                     }
//                   },
//                   MULTIPLE_PERSONS: {
//                     $sum: {
//                       $cond: [
//                         { $eq: ['$breach_type', 'MULTIPLE_PERSONS'] }, 1, 0
//                       ]
//                     }
//                   },
//                   UNKNOWN_USER: {
//                     $sum: {
//                       $cond: [
//                         { $eq: ['$breach_type', 'UNKNOWN_USER'] }, 1, 0
//                       ]
//                     }
//                   },
//                 },
//               },
//               {
//                 $project: {
//                   _id: 0,
//                   organization: organization,
//                   user_email: '$_id.user_email',
//                   department: '$_id.department',
//                   not_at_desk_count: '$NOT_AT_DESK',
//                   mobile_detected_count: '$MOBILE_DETECTED',
//                   multiple_persons_count: '$MULTIPLE_PERSONS',
//                   unknown_person_count: '$UNKNOWN_USER',
//                 },
//               },
//               {
//                 $addFields: {
//                   total_breach_count: {
//                     $add: [
//                       '$not_at_desk_count',
//                       '$mobile_detected_count',
//                       '$multiple_persons_count',
//                       '$unknown_person_count',
//                     ],
//                   },
//                 },
//               }
//             ],
//             as: 'breach',
//           },
//         },
//         {
//           $skip: skip,
//         },
//         {
//           $limit: limit,
//         },
//       ]),
      
//       Users.aggregate([
//         {
//           $match: query,
//         },
//         {
//           $project: {
//             _id: 0,
//             user_email: 1
//           },
//         },
//       ])
//     ]);

//     let emailArr = [];
//     for (let i = 0; i < userEmails.length; i++) {
//       emailArr.push(userEmails[i].user_email)
//     }

//     let count = await PrivacyBreach.countDocuments({
//       user_email: { $in: emailArr },
//       organization: organization,
//       detected_at: { $gte: from, $lt: till }
//     });

//     let breaches = [];

//     for (let i = 0; i < breach_summary.length; i++) {
//       let breaches_entry = {
//         organization: organization,
//         department: breach_summary[i].department,
//         user_email: breach_summary[i].user_email,
//         not_at_desk_count: breach_summary[i].breach[0].not_at_desk_count,
//         mobile_detected_count: breach_summary[i].breach[0].mobile_detected_count,
//         multiple_persons_count: breach_summary[i].breach[0].multiple_persons_count,
//         unknown_person_count: breach_summary[i].breach[0].unknown_person_count,
//         total_breach_count: breach_summary[i].breach[0].total_breach_count,
//       };
//       breaches.push(breaches_entry);
//     }

//     if (report_type === 'csv') {
//       try {
//         let total = await Users.aggregate([
//           {
//             $match: (query = {
//               organization: organization,
//               is_licensed: true,
//             }),
//           },
//           {
//             $project: {
//               _id: 0,
//               user_email: 1,
//               department: 1,
//             },
//           },
//           {
//             $sort: { user_email: -1 },
//           },
//           {
//             $lookup: {
//               from: 'privacybreaches',
//               let: {
//                 user_email: '$user_email',
//                 organization: organization,
//                 startDate: from,
//                 endDate: till,
//               },
//               pipeline: [
//                 {
//                   $match: {
//                     $expr: {
//                       $and: [
//                         { $eq: ['$user_email', '$$user_email'] },
//                         { $eq: ['$organization', '$$organization'] },
//                         { $gte: ['$detected_at', '$$startDate'] },
//                         { $lt: ['$detected_at', '$$endDate'] },
//                       ],
//                     },
//                   },
//                 },
//                 {
//                   $group: {
//                     _id: {
//                       user_email: '$user_email',
//                       department: '$department',
//                     },
//                     NOT_AT_DESK: {
//                       $sum: {
//                         $cond: [
//                           { $eq: ['$breach_type', 'NOT_AT_DESK'] }, 1, 0
//                         ]
//                       }
//                     },
//                     MOBILE_DETECTED: {
//                       $sum: {
//                         $cond: [
//                           { $eq: ['$breach_type', 'MOBILE_DETECTED'] }, 1, 0
//                         ]
//                       }
//                     },
//                     MULTIPLE_PERSONS: {
//                       $sum: {
//                         $cond: [
//                           { $eq: ['$breach_type', 'MULTIPLE_PERSONS'] }, 1, 0
//                         ]
//                       }
//                     },
//                     UNKNOWN_USER: {
//                       $sum: {
//                         $cond: [
//                           { $eq: ['$breach_type', 'UNKNOWN_USER'] }, 1, 0
//                         ]
//                       }
//                     },
//                   },
//                 },
//                 {
//                   $project: {
//                     _id: 0,
//                     organization: organization,
//                     user_email: '$_id.user_email',
//                     department: '$_id.department',
//                     not_at_desk_count: '$NOT_AT_DESK',
//                     mobile_detected_count: '$MOBILE_DETECTED',
//                     multiple_persons_count: '$MULTIPLE_PERSONS',
//                     unknown_person_count: '$UNKNOWN_USER',
//                   },
//                 },
//                 {
//                   $addFields: {
//                     total_breach_count: {
//                       $add: [
//                         '$not_at_desk_count',
//                         '$mobile_detected_count',
//                         '$multiple_persons_count',
//                         '$unknown_person_count',
//                       ],
//                     },
//                   },
//                 },
//               ],
//               as: 'breach',
//             },
//           },
//           // {
//           //   $unwind: {
//           //     path: '$breach',
//           //     preserveNullAndEmptyArrays: true,
//           //   },
//           // },
//           // {
//           //   $project: {
//           //     _id: 0,
//           //     organization: organization,
//           //     user_email: '$user_email',
//           //     department: '$department',
//           //     not_at_desk_count: {
//           //       $cond: {
//           //         if: '$breach.not_at_desk_count',
//           //         then: '$breach.not_at_desk_count',
//           //         else: '',
//           //       },
//           //     },
//           //     mobile_detected_count: {
//           //       $cond: {
//           //         if: '$breach.mobile_detected_count',
//           //         then: '$breach.mobile_detected_count',
//           //         else: '',
//           //       },
//           //     },
//           //     multiple_persons_count: {
//           //       $cond: {
//           //         if: '$breach.multiple_persons_count',
//           //         then: '$breach.multiple_persons_count',
//           //         else: '',
//           //       },
//           //     },
//           //     unknown_person_count: {
//           //       $cond: {
//           //         if: '$breach.unknown_person_count',
//           //         then: '$breach.unknown_person_count',
//           //         else: '',
//           //       },
//           //     },
//           //     total_breach_count: '$breach.total_breach_count',
//           //   },
//           // },
//           // {
//           //   $sort: { total_breach_count: -1 },
//           // },
//         ]);

//         for (let i = 0; i < total.length; i++) {
//           let entry = {
//             organization: organization,
//             department: total[i].department,
//             user_email: total[i].user_email,
//             not_at_desk_count: total[i].breach[0].not_at_desk_count,
//             mobile_detected_count: total[i].breach[0].mobile_detected_count,
//             multiple_persons_count: total[i].breach[0].multiple_persons_count,
//             unknown_person_count: total[i].breach[0].unknown_person_count,
//             total_breach_count: total[i].breach[0].total_breach_count,
//           };
//           reports.push(entry);
//         }

//         // for (let i = 0; i < total.length; i++) {
//         //   let entry = {
//         //     organization: organization,
//         //     department: total[i].department,
//         //     user_email: total[i].user_email,
//         //     not_at_desk_count: total[i].not_at_desk_count,
//         //     mobile_detected_count: total[i].mobile_detected_count,
//         //     multiple_persons_count: total[i].multiple_persons_count,
//         //     unknown_person_count: total[i].unknown_person_count,
//         //     total_breach_count: total[i].total_breach_count,
//         //   };
//         //   reports.push(entry);
//         // }

//         const fields = [
//           'organization',
//           'department',
//           'user_email',
//           'not_at_desk_count',
//           'mobile_detected_count',
//           'multiple_persons_count',
//           'unknown_person_count',
//           'total_breach_count',
//         ];
//         const opts = { fields };
//         const csv = parse(reports, opts);
//         return res.status(200).send(csv);
//       } catch (err) {
//         logger.error(err);
//         return res.status(500).json({
//           code: 'SERVER_ERROR',
//           description: 'Something went wrong, please try again',
//         });
//       }
//     } else {
//       return res.status(200).json({
//         message: 'Breach summary fetched successfully',
//         data: breaches,
//         total: count,
//       });
//     }
//   } catch (error) {
//     logger.error(error);
//     return res.status(500).json({
//       code: 'SERVER_ERROR',
//       description: 'something went wrong, Please try again',
//     });
//   }
// };

const getBreachSummaryAllUsers = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let assigned_to = req.assigned_to;
    let user_email = req.user_email;

    let { from, to, report_type, member_email, skip, limit } = req.body;

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
    let aggregate_query = null;
    if (const_config.isAllowedRole(role, ['SUPER_ADMIN'])) {
      if (member_email) {
        query = {
          organization: organization,
          department: department,
          user_email: { $regex: member_email, $options: 'i' },
          is_licensed: true,
        };
        aggregate_query = {
          organization: organization,
          department: department,
        }
      } else {
        query = {
          organization: organization,
          department: department,
          is_licensed: true,
        };
        aggregate_query = {
          organization: organization,
          department: department,
        }
      }
    } else if (const_config.isAllowedRole(role, ['ADMIN'])) {
      if (member_email) {
        query = {
          organization: organization,
          department: department,
          user_email: { $regex: member_email, $options: 'i' },
          is_licensed: true,
        };
        aggregate_query = {
          organization: organization,
          department: department,
        }
      } else {
        query = {
          organization: organization,
          department: department,
          is_licensed: true,
        };
        aggregate_query = {
          organization: organization,
          department: department,
        }
      }
    } else if (const_config.isAllowedRole(role, ['AUDIT'])) {
      if (member_email) {
        query = {
          organization: organization,
          department: department,
          user_email: { $regex: member_email, $options: 'i' },
          is_licensed: true,
        };
        aggregate_query = {
          organization: organization,
          department: department,
        }
      } else {
        query = {
          organization: organization,
          department: department,
          is_licensed: true,
        };
        aggregate_query = {
          organization: organization,
          department: department,
        }
      }
    } else if (const_config.isAllowedRole(role, ['MANAGER'])) {
      if (member_email) {
        query = {
          organization: organization,
          assigned_to: user_email,
          user_email: { $regex: member_email, $options: 'i' },
          is_licensed: true,
        };
        aggregate_query = {
          organization: organization,
          assigned_to: user_email,
        }
      } else {
        query = {
          assigned_to: user_email,
          organization: organization,
          is_licensed: true,
        };
        aggregate_query = {
          organization: organization,
          assigned_to: user_email,
        }
      }
    }

    if (report_type === 'csv') {
      try {
        let reports = [];

        let breach_summary = await Users.aggregate([
          {
            $match: query,
          },
          {
            $sort: { user_email: 1 },
          },
          {
            $project: {
              _id: 0,
              user_email: 1
            },
          },
        ]);
    
        let user_emails = [];
        breach_summary.forEach(item => {
          user_emails.push(item.user_email);
        });
    
        let breaches = await PrivacyBreach.aggregate([
          {
            $match: {
              $expr: {
                $and: [
                  { $in: ["$user_email", user_emails] },
                  { $eq: ['$organization', organization] },
                  { $gte: ['$detected_at', from] },
                  { $lt: ['$detected_at', till] },
                ],
              },
            },
          },
          {
            $group: {
              _id: {
                user_email: '$user_email',
                department: '$department',
              },
              NOT_AT_DESK: {
                $sum: {
                  $cond: [
                    { $eq: ['$breach_type', 'NOT_AT_DESK'] }, 1, 0
                  ]
                }
              },
              MOBILE_DETECTED: {
                $sum: {
                  $cond: [
                    { $eq: ['$breach_type', 'MOBILE_DETECTED'] }, 1, 0
                  ]
                }
              },
              MULTIPLE_PERSONS: {
                $sum: {
                  $cond: [
                    { $eq: ['$breach_type', 'MULTIPLE_PERSONS'] }, 1, 0
                  ]
                }
              },
              UNKNOWN_USER: {
                $sum: {
                  $cond: [
                    { $eq: ['$breach_type', 'UNKNOWN_USER'] }, 1, 0
                  ]
                }
              },
            },
          },
          {
            $project: {
              _id: 0,
              organization: organization,
              user_email: '$_id.user_email',
              department: '$_id.department',
              not_at_desk_count: '$NOT_AT_DESK',
              mobile_detected_count: '$MOBILE_DETECTED',
              multiple_persons_count: '$MULTIPLE_PERSONS',
              unknown_person_count: '$UNKNOWN_USER',
            },
          },
          {
            $addFields: {
              total_breach_count: {
                $add: [
                  '$not_at_desk_count',
                  '$mobile_detected_count',
                  '$multiple_persons_count',
                  '$unknown_person_count',
                ],
              },
            },
          }
        ]);

        for (let i = 0; i < breach_summary.length; i++) {
          let entry = {
            organization: organization,
            department: breaches[i].department,
            user_email: breaches[i].user_email,
            not_at_desk_count: breaches[i].not_at_desk_count,
            mobile_detected_count: breaches[i].mobile_detected_count,
            multiple_persons_count: breaches[i].multiple_persons_count,
            unknown_person_count: breaches[i].unknown_person_count,
            total_breach_count: breaches[i].total_breach_count,
          };
          reports.push(entry);
        }

        const fields = [
          'organization',
          'department',
          'user_email',
          'not_at_desk_count',
          'mobile_detected_count',
          'multiple_persons_count',
          'unknown_person_count',
          'total_breach_count',
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
      let [breach_summary, total_users] = await Promise.all([
        Users.aggregate([
          {
            $match: query,
          },
          {
            $sort: { user_email: 1 },
          },
          {
            $skip: skip,
          },
          {
            $limit: limit,
          },
          {
            $project: {
              _id: 0,
              user_email: 1
            },
          },
        ]),
        Users.aggregate([
          {
            $match: query,
          },
          {
            $project: {
              _id: 0,
              user_email: 1
            },
          },
        ]),
      ]);
  
      let user_emails = [];
      breach_summary.forEach(item => {
        user_emails.push(item.user_email);
      });

      let total_user_email = [];
      total_users.forEach(item => {
        total_user_email.push(item.user_email);
      });

      let [breaches, total] = await Promise.all([
        PrivacyBreach.aggregate([
          {
            $match: {
              $expr: {
                $and: [
                  { $in: ["$user_email", user_emails] },
                  { $eq: ['$organization', organization] },
                  { $gte: ['$detected_at', from] },
                  { $lt: ['$detected_at', till] },
                ],
              },
            },
          },
          {
            $group: {
              _id: {
                user_email: '$user_email',
                department: '$department',
              },
              NOT_AT_DESK: {
                $sum: {
                  $cond: [
                    { $eq: ['$breach_type', 'NOT_AT_DESK'] }, 1, 0
                  ]
                }
              },
              MOBILE_DETECTED: {
                $sum: {
                  $cond: [
                    { $eq: ['$breach_type', 'MOBILE_DETECTED'] }, 1, 0
                  ]
                }
              },
              MULTIPLE_PERSONS: {
                $sum: {
                  $cond: [
                    { $eq: ['$breach_type', 'MULTIPLE_PERSONS'] }, 1, 0
                  ]
                }
              },
              UNKNOWN_USER: {
                $sum: {
                  $cond: [
                    { $eq: ['$breach_type', 'UNKNOWN_USER'] }, 1, 0
                  ]
                }
              },
            },
          },
          {
            $project: {
              _id: 0,
              organization: organization,
              user_email: '$_id.user_email',
              department: '$_id.department',
              not_at_desk_count: '$NOT_AT_DESK',
              mobile_detected_count: '$MOBILE_DETECTED',
              multiple_persons_count: '$MULTIPLE_PERSONS',
              unknown_person_count: '$UNKNOWN_USER',
            },
          },
          {
            $addFields: {
              total_breach_count: {
                $add: [
                  '$not_at_desk_count',
                  '$mobile_detected_count',
                  '$multiple_persons_count',
                  '$unknown_person_count',
                ],
              },
            },
          }
        ]),
        PrivacyBreach.aggregate([
          {
            $match: {
              $expr: {
                $and: [
                  { $in: ["$user_email", total_user_email] },
                  aggregate_query,
                  { $gte: ['$detected_at', from] },
                  { $lt: ['$detected_at', till] },
                ],
              },
            },
          },
          {
            $group: {
              _id: {
                user_email: '$user_email',
                department: '$department',
              },
              count: {$sum: 1}
            },
          }
        ])
      ]);

      return res.status(200).json({
        message: 'Breach summary fetched successfully',
        data: breaches,
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

module.exports = {
  getBreachesSummaryUser: getBreachesSummaryUser,
  repeatedViolationsUser: repeatedViolationsUser,
  getBreachSummaryAllUsers: getBreachSummaryAllUsers,
};
