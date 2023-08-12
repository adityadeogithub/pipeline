const dashboardController = require('../../controllers/apis/dashboard');
const appController = require('../../controllers/apis/app_web');
const guruController = require('../../controllers/apis/guru');
const ideationController = require('../../controllers/apis/ideation');
const dashboardNewController = require('../../controllers/apis/new/apis/dashboard');
const complianceController = require('../../controllers/apis/compliance_dashboard');
const mobileController = require('../../controllers/apis/mobile_dashboard');

const express = require('express');
let router = express.Router();
router.use('/dashboards', dashboardController);
router.use('/dashboards', appController);
router.use('/dashboards', guruController);
router.use('/dashboards', ideationController);
router.use('/dashboards', dashboardNewController);
router.use('/dashboards', complianceController);
router.use('/dashboards', mobileController);

module.exports = router;
