const express = require('express');
const mobileDashboardDashboard = require('../../services/mobile_dashboard/mobile_dashboard');
let router = express.Router();

router.post('/todays-analytics', mobileDashboardDashboard.todaysAnalytics);
router.post('/get-meeting-status', mobileDashboardDashboard.meetingStatus);
router.post(
  '/get-upcoming-meetings',
  mobileDashboardDashboard.getUpcomingMeetings
);
router.post('/get-break-vs-aux', mobileDashboardDashboard.getBreakVsAux);
router.post(
  '/get-meeting-analytics',
  mobileDashboardDashboard.meetingAnalytics
);
router.post('/get-meeting-summary', mobileDashboardDashboard.meetingSummary);
router.post(
  '/get-upcoming-meeting-summary',
  mobileDashboardDashboard.getUpcomingMeetingsSummary
);

module.exports = router;
