const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const promBundle = require('express-prom-bundle');
const compression = require('compression');

const helmet = require('helmet');
const auth = require('.././fwks/auth');
const nocache = require('nocache');
const featurePolicy = require('feature-policy');
const metricsMiddleware = promBundle({
  includeMethod: true,
  includePath: true,
  customLabels: { project_name: 'wAnywhere' },
});
var cors = require('cors');

const { CORS, CORS_URL } = process.env;
let cors_url = `${CORS_URL}`;

module.exports = function () {
  let server = express(),
    create,
    start;

  create = (config, db) => {
    let routes = require('../routes');
    // set all the server things
    server.set('env', config.env);
    server.set('port', config.port);
    server.set('hostname', config.hostname);

    // add middleware to parse the json
    server.use(bodyParser.json());
    server.use(
      bodyParser.urlencoded({
        extended: false,
      })
    );
    //Setting exporter for Prometheus
    server.use(metricsMiddleware);

    server.use(function (err, req, res, next) {
      // ⚙️ our function to catch errors from body-parser
      if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        // do your own thing here 👍
        res.status(400).send({ code: 400, message: 'Bad Request' });
      } else next();
    });

    //Security Settings
    server.use(helmet());
    server.use(auth());
    server.use(nocache());
    server.use(helmet.referrerPolicy({ policy: 'strict-origin' }));
    server.use(
      helmet.contentSecurityPolicy({
        directives: {
          scriptSrc: ["'self'"],
          objectSrc: ["'self'"],
        },
      })
    );
    //compression
    server.use(compression());
    server.use(
      featurePolicy({
        features: {
          geolocation: ["'self''"],
          camera: ["'self'"],
          speaker: ["'self'"],
        },
      })
    );
    var corsOption = {
      origin: cors_url,
      methods: 'GET,POST',
      preflightContinue: false,
      optionsSuccessStatus: 204,
    };

    //Enabling CORS
    if (`${CORS}` === 'true') {
      console.log('CORS Applied');
      server.use(cors(corsOption));
    }

    //connect the database
    mongoose
      .connect(db.database, db.options)
      .then(() => console.log('Successfully connect to MongoDB.'))
      .catch((err) => console.error('Connection error', err));

    // Set up routes
    routes.init(server);
  };

  start = () => {
    let hostname = server.get('hostname'),
      port = server.get('port');
    server.listen(port, function () {
      console.log(
        'Express server listening on - http://' + hostname + ':' + port
      );
    });
  };
  return {
    create: create,
    start: start,
  };
};
