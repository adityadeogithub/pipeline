const Logger = require('./log');
const logger = new Logger('dashboard_db');

const {
  NODE_ENV,
  MONGO_USERNAME,
  MONGO_PASSWORD,
  MONGO_HOSTNAME,
  MONGO_PORT,
  MONGO_DB,
} = process.env;

const options = {
  useNewUrlParser: true,
  useCreateIndex: true,
  useUnifiedTopology: true,
  connectTimeoutMS: 10000,
};

let url = null;
if (NODE_ENV === 'production') {
  console.info('Production environment set');
  url = `mongodb://${MONGO_USERNAME}:${MONGO_PASSWORD}@${MONGO_HOSTNAME}:${MONGO_PORT}/${MONGO_DB}?authSource=admin`;
} else if (NODE_ENV === 'staging') {
  console.info('Staging environment set');
  url = `mongodb://${MONGO_USERNAME}:${MONGO_PASSWORD}@${MONGO_HOSTNAME}:${MONGO_PORT}/${MONGO_DB}?authSource=admin`;
} else if (NODE_ENV === 'testing') {
  console.info('Testing environment set');
  url = `mongodb://${MONGO_USERNAME}:${MONGO_PASSWORD}@${MONGO_HOSTNAME}:${MONGO_PORT}/${MONGO_DB}?authSource=admin`;
} else if (NODE_ENV === 'development') {
  logger.info('Development environment set');
  url = `mongodb://${MONGO_USERNAME}:${MONGO_PASSWORD}@${MONGO_HOSTNAME}:${MONGO_PORT}/${MONGO_DB}`;
} else if (NODE_ENV === undefined || NODE_ENV === '') {
  logger.warn('NODE_ENV is missing. Setting it to Development environment');
  //url = `mongodb://${MONGO_USERNAME}:${MONGO_PASSWORD}@${MONGO_HOSTNAME}:${MONGO_PORT}/${MONGO_DB}`;
  url = `mongodb://${MONGO_USERNAME}:${MONGO_PASSWORD}@${MONGO_HOSTNAME}:${MONGO_PORT}/${MONGO_DB}?authSource=admin`;
}

module.exports = {
  secret: '',
  database: url,
  // database: "mongodb://adminUser:wAnywheredev1232123@dev-api.wanywhere.com:27017/w-anywhere?authSource=admin&readPreference=primary&directConnection=true&ssl=false",
  // database: "mongodb://adminUser:admin123@test-api.wanywhere.com:27017/w-anywhere?authSource=admin&readPreference=primary&directConnection=true&ssl=false",
  options: options,
};
