const _ = require('lodash');
const env = 'local';
const envConfig = require('./' + env);
let defaultConfig = {
  env: env,
};
module.exports = _.merge(defaultConfig, envConfig);
