const const_config = require('../../utility/util');
const moment = require('moment-timezone');
const users = require('../../models/users');
const Configuration = require('../../models/configuration');

const getManagersList = async (req, res, next) => {
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

    if (user_email === undefined || user_email === '') {
      return res.status(422).json({
        code: 'REQUIRED_FIELD_MISSING',
        description: 'User Email is required',
        field: 'user_email',
      });
    }

    let Query = null;

    if (const_config.isAllowedRole(role, ['MANAGER'])) {
      Query = {
        organization: organization,
        assigned_to: user_email,
        is_licensed: true,
      };
    } else
      const_config.isAllowedRole(role, [
        'ADMIN',
        'SUPER_ADMIN',
        'AUDIT',
        'CLIENT',
        'SUPER_AUDIT',
      ]);
    {
      Query = {
        organization: organization,
        department: department,
        is_manager: true,
        is_licensed: true,
      };
    }

    let managerList = await users.find(
      Query,
      'user_email first_name last_name'
    );

    return res.status(200).json({
      message: 'Manager List fetched successfully',
      data: managerList,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      code: 'SERVER_ERROR',
      description: 'something went wrong, Please try again',
    });
  }
};

module.exports = {
  getManagersList: getManagersList,
};
