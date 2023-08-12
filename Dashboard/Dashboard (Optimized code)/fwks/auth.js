const jwt = require('jsonwebtoken');
const Logger = require('../configs/log');
const logger = new Logger('dashboard_auth');

const const_config = require('./../utility/util');
const hash_key = const_config.hash_key;

module.exports = function () {
  return function (req, res, next) {
    let { organization, department } = req.body;

    let token = req.headers['x-access-token'];
    let timezone = req.headers['x-timezone'];
    logger.warn('Timezone ', timezone);
    try {
      //Default set to Asia/Calcutta if timezone header is missing
      if (timezone === undefined || timezone === '') {
        timezone = 'Asia/Calcutta';
      }
      logger.debug('Setting Timezone to : ', timezone);
      req.timezone = timezone;

      if (!token)
        return res
          .status(403)
          .send({ auth: false, message: 'No token provided.' });

      var decoded = jwt.verify(token, hash_key);

      let extracted = {
        user_email: decoded.user_email,
        department: decoded.department,
        organization: decoded.organization,
        role: decoded.role,
        assigned_to: decoded.assigned_to,
      };

      req.user_email = extracted.user_email;

      //Checking if post has the organization or setting it from token
      if (organization === undefined || organization === '') {
        req.organization = extracted.organization;
      } else {
        req.organization = organization;
      }
      //Checking if post has the department or setting it from token
      if (department === undefined || department === '') {
        req.department = extracted.department;
      } else {
        req.department = department;
      }

      req.assigned_to = extracted.assigned_to;
      req.role = extracted.role;
      //TODO: Sid - Need to check this code written.
      if (extracted.role !== 'AGENT') {
        // if (organization === undefined || organization === '' || organization === 'ALL') {
        // 	return res.status(422).json({
        // 		'code': 'REQUIRED_FIELD_MISSING',
        // 		'description': 'Organization is required',
        // 		'field': 'organization'
        // 	});
        // }
        // if (department === undefined || department === '') {
        // 	return res.status(422).json({
        // 		'code': 'REQUIRED_FIELD_MISSING',
        // 		'description': 'Department is required',
        // 		'field': 'department'
        // 	});
        // }
      }
      console.log('Middleware loaded');
      logger.info('Middleware loaded');
      next();
    } catch (err) {
      console.log(err.message);
      logger.error(err.message);

      //TODO: Need to improve on the message
      if (err.message === 'invalid signature') {
        return res
          .status(401)
          .send({
            auth: false,
            code: 'INVALID_TOKEN',
            message: 'Invalid token',
          });
      } else if (err.message === 'jwt expired') {
        return res
          .status(401)
          .send({
            auth: false,
            code: 'TOKEN_EXPIRED',
            message: 'Token expired',
          });
      }
      return res
        .status(401)
        .send({ auth: false, code: 'INVALID_TOKEN', message: 'Invalid token' });
    }
  };
};
