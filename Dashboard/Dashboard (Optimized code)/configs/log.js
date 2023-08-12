const winston = require('winston');
const { LOG_LEVEL } = process.env;
let level = `${LOG_LEVEL}`;
dateFormat = () => {
  return new Date(Date.now()).toUTCString();
};
function color(level) {
  let color = '\u001b[32m';
  if (level === 'WARN' || level === 'ERROR') {
    color = '\u001b[31m';
  } else if (level === 'DEBUG') {
    color = '\u001b[33m';
  }
  return color + level + '\u001b[39m';
}

class LoggerService {
  constructor(route) {
    this.log_data = null;
    this.route = route;
    const myformat = winston.format.combine(
      winston.format.printf((info) => {
        let message = `${dateFormat()} | ${color(
          info.level.toUpperCase()
        )} | ${route} | ${info.message} | `;
        message = info.obj
          ? message + `data:${JSON.stringify(info.obj)} | `
          : message;
        message = this.log_data
          ? message + `log_data:${JSON.stringify(this.log_data)} | `
          : message;
        return message;
      })
    );
    const logger = winston.createLogger({
      transports: [
        new winston.transports.Console({
          level: level,
          format: myformat,
        }),
        new winston.transports.File({
          level: level,
          format: myformat,
          filename: `./logs/${route}.log`,
        }),
      ],
    });
    this.logger = logger;
  }

  setLogData(log_data) {
    this.log_data = log_data;
  }
  async info(message) {
    this.logger.log('info', message);
  }
  async info(message, obj) {
    this.logger.log('info', message, {
      obj,
    });
  }
  async debug(message) {
    this.logger.log('debug', message);
  }
  async debug(message, obj) {
    this.logger.log('debug', message, {
      obj,
    });
  }
  async warn(message) {
    this.logger.log('warn', message);
  }
  async warn(message, obj) {
    this.logger.log('warn', message, {
      obj,
    });
  }
  async error(message) {
    this.logger.log('error', message);
  }
  async error(message, obj) {
    this.logger.log('error', message, {
      obj,
    });
  }
}
module.exports = LoggerService;
