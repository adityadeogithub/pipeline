const express = require('express');
const guruDashboard = require('../../services/guru/dashboard');
let router = express.Router();

router.post('/guru-dashboard-data', guruDashboard.totalData);
router.post('/course-enrolled-user', guruDashboard.courseEnrolledUser);
router.post('/course-enrolled-user', guruDashboard.totalDataMonthly);
router.post('/course-report-list', guruDashboard.courseReportList);
router.post('/get-course-analytics', guruDashboard.courseAnalytics);
router.post('/total-guru-data-monthly', guruDashboard.totalDataMonthly);
module.exports = router;
