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

const getBreachesSummaryManager = async (req, res, next) => {
  try {
    let role = req.role;
    let organization = req.organization;
    let department = req.department;
    let assigned_to = req.assigned_to;
    let user_email = req.user_email;

    let { from, to, report_type, member_email, manager_name, skip, limit } =
      req.body;

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
      assigned_to: manager_name,
      is_licensed: true,
    }).distinct('user_email');

    logger.debug('usersss', manager_user);

    let query = null;
    if (member_email) {
      query = {
        organization: organization,
        department: department,
        detected_at: {
          $gte: from,
          $lt: till,
        },
        assigned_to: manager_name,
        $and: [
          { user_email: { $regex: member_email, $options: 'i' } },
          {
            user_email: {
              $in: manager_user,
            },
          },
        ],
      };
    } else {
      query = {
        organization: organization,
        department: department,
        user_email: {
          $in: manager_user,
        },
        assigned_to: manager_name,
        detected_at: {
          $gte: from,
          $lt: till,
        },
      };
    }

    let reports = [];

    let [breach_summary, total] = await Promise.all([
      await PrivacyBreach.aggregate([
        {
          $match: query,
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
          $lookup: {
            from: 'users',
            let: {
              department: department,
              organization: organization,
              is_licensed: true,
              manager: assigned_to,
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$assigned_to', '$$manager'] },
                      { $eq: ['$department', '$$department'] },
                      { $eq: ['$organization', '$$organization'] },
                      { $eq: ['$is_licensed', '$$is_licensed'] },
                    ],
                  },
                },
              },
              {
                $group: {
                  _id: null,
                  users: {
                    $sum: 1
                  },
                },
              },

              {
                $project: {
                  _id: 0,
                  department: department,
                  total_users: '$users',
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
            department: department,
            organization: organization,
            manager: assigned_to,
            user_email: '$_id',
            total_users: '$data.total_users',
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
        { $skip: skip },
        { $limit: limit },
      ]),
      await PrivacyBreach.aggregate([
        {
          $match: query,
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
          $lookup: {
            from: 'users',
            let: {
              department: department,
              organization: organization,
              is_licensed: true,
              manager: assigned_to,
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$assigned_to', '$$manager'] },
                      { $eq: ['$department', '$$department'] },
                      { $eq: ['$organization', '$$organization'] },
                      { $eq: ['$is_licensed', '$$is_licensed'] },
                    ],
                  },
                },
              },
              {
                $group: {
                  _id: null,
                  users: {
                    $sum: 1
                  },
                },
              },

              {
                $project: {
                  _id: 0,
                  department: department,
                  total_users: '$users',
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
            department: department,
            organization: organization,
            manager: assigned_to,
            user_email: '$_id',
            total_users: '$data.total_users',
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
      ]),
    ]);

    if (report_type === 'csv') {
      try {
        let total = await PrivacyBreach.aggregate([
          {
            $match: {
              organization: organization,
              department: department,
              user_email: {
                $in: manager_user,
              },
              assigned_to: manager_name,
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
            $lookup: {
              from: 'users',
              let: {
                department: department,
                organization: organization,
                is_licensed: true,
                manager: assigned_to,
              },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ['$assigned_to', '$$manager'] },
                        { $eq: ['$department', '$$department'] },
                        { $eq: ['$organization', '$$organization'] },
                        { $eq: ['$is_licensed', '$$is_licensed'] },
                      ],
                    },
                  },
                },
                {
                  $group: {
                    _id: null,
                    users: {
                      $sum: 1
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
            $project: {
              _id: 0,
              department: department,
              organization: organization,
              manager: assigned_to,
              user_email: '$_id',
              total_users: '$data.total_users',
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
        ]);

        for (let i = 0; i < total.length; i++) {
          let entry = {
            organization: organization,
            department: department,
            user_email: total[i].user_email,
            manager: total[i].manager,
            total_users: total[i].total_users,
            not_at_desk_count: total[i].not_at_desk_count,
            mobile_detected_count: total[i].mobile_detected_count,
            multiple_persons_count: total[i].multiple_persons_count,
            unknown_person_count: total[i].unknown_person_count,
            total_breach_count: total[i].total_breach_count,
          };
          reports.push(entry);
        }

        const fields = [
          'organization',
          'department',
          'user_email',
          'manager',
          'total_users',
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
        message: 'Breach summary fetched successfully',
        data: breach_summary,
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

const complianceBreachesManager = async (req, res, next) => {
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
    let reports = [];

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
      assigned_to: manager_name,
      is_licensed: true,
    }).distinct('user_email');

    let query = {
      organization: organization,
      department: department,
      assigned_to: manager_name,
      user_email: {
        $in: manager_user,
      },
      detected_at: {
        $gte: from,
        $lt: till,
      },
    };

    let [breach_summary, total] = await Promise.all([
      PrivacyBreach.aggregate([
      {
        $match: query,
      },
      {
        $group: {
          _id: null,
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
        $project: {
          _id: 0,
          organization: organization,
          department: department,
          manager: manager_name,
          audit_done: '$audit_done',
          compliance: '$compliance',
          non_compliance: '$non_compliance',
          purge: '$purge'
        },
      }
    ]),

    PrivacyBreach.countDocuments({
      organization: organization,
      department: department,
      assigned_to: manager_name,
      detected_at: {
        $gte: from,
        $lt: till
      }
    })
    ]);

    if (breach_summary.length) {
      breach_summary[0].total_breaches = total;
      breach_summary[0].unaudited = parseInt(total) - parseInt(breach_summary[0].audit_done);
    }

    if (report_type === 'csv') {
      try {
        for (let i = 0; i < breach_summary.length; i++) {
          let entry = {
            organization: organization,
            department: department,
            manager: manager_name,
            audit_done: breach_summary[i].audit_done,
            compliance: breach_summary[i].compliance,
            non_compliance: breach_summary[i].non_compliance,
            purge: breach_summary[i].purge,
            unaudited: breach_summary[i].unaudited,
            total_breaches: breach_summary[i].total_breaches,
          };
          reports.push(entry);
        }

        const fields = [
          'organization',
          'department',
          'manager',
          'audit_done',
          'compliance',
          'non_compliance',
          'purge',
          'unaudited',
          'total_breaches',
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
        message: 'Compliance breaches fetched successfully',
        data: breach_summary,
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

const departmentMaxViolationManager = async (req, res, next) => {
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
      assigned_to: manager_name,
      is_licensed: true,
    }).distinct('user_email');

    let query = {
      organization: organization,
      department: department,
      assigned_to: manager_name,
      user_email: {
        $in: manager_user,
      },
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
          department: department,
          organization: organization,
          manager: manager_name,
          user_email: '$_id',
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
        $limit: 5,
      },
    ]);

    if (report_type === 'csv') {
      try {
        for (let i = 0; i < breach_summary.length; i++) {
          let entry = {
            organization: organization,
            department: department,
            manager: manager_name,
            user_email: breach_summary[i].user_email,
            not_at_desk_count: breach_summary[i].not_at_desk_count,
            mobile_detected_count: breach_summary[i].mobile_detected_count,
            multiple_persons_count: breach_summary[i].multiple_persons_count,
            unknown_person_count: breach_summary[i].unknown_person_count,
            total_breach_count: breach_summary[i].total_breach_count,
          };
          reports.push(entry);
        }

        const fields = [
          'organization',
          'department',
          'manager',
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
        return res.status(500).json({
          code: 'SERVER_ERROR',
          description: 'Something went wrong, please try again',
        });
      }
    } else {
      return res.status(200).json({
        message: 'Department with highest violation fetched successfully',
        data: breach_summary,
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

const topTenRiskyUsersManager = async (req, res, next) => {
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
      assigned_to: manager_name,
      is_licensed: true,
    }).distinct('user_email');

    let query = {
      organization: organization,
      department: department,
      assigned_to: manager_name,
      user_email: {
        $in: manager_user,
      },
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
          organization: organization,
          department: department,
          manager: manager_name,
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
    ]);

    if (report_type === 'csv') {
      try {
        for (let i = 0; i < breach_summary.length; i++) {
          let entry = {
            organization: organization,
            department: department,
            manager: manager_name,
            user_email: breach_summary[i].user_email,
            not_at_desk_count: breach_summary[i].not_at_desk_count,
            mobile_detected_count: breach_summary[i].mobile_detected_count,
            multiple_persons_count: breach_summary[i].multiple_persons_count,
            unknown_person_count: breach_summary[i].unknown_person_count,
            total_breach_count: breach_summary[i].total_breach_count,
          };
          reports.push(entry);
        }

        const fields = [
          'organization',
          'department',
          'manager',
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
      return res.status(200).json({
        message: 'Department with highest violation fetched successfully',
        data: breach_summary,
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

const repeatedViolationsManager = async (req, res, next) => {
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
      assigned_to: manager_name,
      is_licensed: true,
    }).distinct('user_email');

    let query = {
      organization: organization,
      department: department,
      assigned_to: manager_name,
      user_email: {
        $in: manager_user,
      },
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
          manager: manager_name,
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
        manager: manager_name,
        date: breach_summary[i].date,
        manager: breach_summary[i].manager,
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
          'manager',
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
module.exports = {
  getBreachesSummaryManager: getBreachesSummaryManager,
  complianceBreachesManager: complianceBreachesManager,
  departmentMaxViolationManager: departmentMaxViolationManager,
  topTenRiskyUsersManager: topTenRiskyUsersManager,
  repeatedViolationsManager: repeatedViolationsManager,
};
