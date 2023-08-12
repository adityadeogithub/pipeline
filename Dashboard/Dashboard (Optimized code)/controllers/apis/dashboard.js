const express = require('express');
const dashboardService = require('../../services/dashboards/dashboard');
const breakService = require('../../services/dashboards/break');
const productivityService = require('../../services/dashboards/productivity');
const tasksService = require('../../services/dashboards/tasks');
const userService = require('../../services/dashboards/user');
const appUsageService = require('../../services/dashboards/app_usage');
const breachesService = require('../../services/dashboards/breach');
const dashboardAgentService = require('../../services/dashboards/dashboard_agent');
const outlookMeetingService = require('../../services/dashboards/outlook_meeting');
const timeSheetService = require('../../services/dashboards/timesheet');
const streamingDashboardService = require('../../services/dashboards/streaming_dashboard');
const leaderboardService = require('../../services/dashboards/leaderboard');
const desktopService = require('../../services/desktop');

let router = express.Router();

router.post(
  '/productivity-percentage',
  dashboardService.getProductivityPercentage
);
router.post(
  '/productivity-percentage-logged-in',
  dashboardService.getProductivityPercentageLoggedIn
);
router.post('/active-users', productivityService.getTotalActiveUsers);
router.post('/completed-tasks', tasksService.getTotalCompletedTasks);
router.post('/pending-tasks', tasksService.getTotalPendingTasks);
router.post('/idle-time', productivityService.getTotalIdleTime);
router.post('/current-status', productivityService.getCurrentStatus);
router.post('/breaks', breakService.getTotalTimeOnBreaks);
router.post('/breaks-date-wise', breakService.getTotalTimeOnBreaksDateWise);
router.post(
  '/breaks-date-wise-new',
  breakService.getTotalTimeOnBreaksDateWiseNew
);
router.post(
  '/loggedin-absent-users',
  productivityService.getLoggedInAndAbsentUsers
);
router.post(
  '/completed-inprogress-tasks',
  tasksService.getCompletedAndInProgressTasks
);
router.post('/privacy-breaches', breachesService.getNumberOfPrivacyBreaches);
router.post('/top-sites', appUsageService.geTopWebsitesVisited); // done
router.post('/top-apps', appUsageService.geTopAppsUsed); //2
router.post('/idle-time-date-wise', productivityService.geIdleTimeDateWise);
router.post(
  '/idle-time-date-wise-new',
  productivityService.geIdleTimeDateWiseNew
);
router.post('/total-head-count', dashboardService.getTotalHeadCount);
router.post('/expected-work-hours', dashboardService.getExpectedWorkHours);
router.post(
  '/total-attendance-count',
  dashboardService.getTotalAttendanceCount
);
router.post('/total-logged-hours', productivityService.getTotalLoggedHours);
router.post(
  '/actual-productive-hours',
  productivityService.getActualProductiveHours
);
router.post(
  '/current-status-details',
  productivityService.getCurrentStatusDetails
);
router.post('/active-vs-idle', productivityService.getActiveVsIdleDetails);
router.post('/avg_logged_non_worked', dashboardService.getAvgLoggedVsNonWork);
router.post('/day-wise-macro', productivityService.getDayWiseMacro);
router.post('/present-vs-absent', productivityService.getPresentVsAbsent);
router.post(
  '/privacy-breaches-with-dates',
  breachesService.getNumberOfPrivacyBreachesWithDates
);
router.post('/breaches-percentage', breachesService.breachesPercentage);
router.post('/risky-users', breachesService.riskyUsers);
router.post('/get-Work-Hours-Summary', dashboardService.getWorkHoursSummary);
router.post('/risky-users-remediation', breachesService.riskyUsersRemediation);
router.post('/tat-dashboard', breachesService.tatDashboard);
router.post('/hours-with-dates', productivityService.getNumberOfHoursWithDates);

router.post('/hours-with-dates-pagination', productivityService.hoursWithDates);
router.post('/hours-dates-pagination', productivityService.hoursWithDates);

router.post(
  '/privacy-breaches-with-dates-pagination',
  breachesService.breachesWithDatesTest
);
router.post('/breaches-with-dates', breachesService.breachesWithDates);
router.post('/breaches-with-dates-test', breachesService.breachesWithDatesTest);
router.post(
  '/attendance-count-department',
  dashboardService.attendanceCountDepartment
);

//API  Agent
router.post(
  '/idel-time-date-range',
  dashboardAgentService.getIdleTimeByDateRange
);
router.post(
  '/privacy-breaches-date_range',
  dashboardAgentService.getPrivacyBreachByDateRange
);
router.post(
  '/break-time-date-range',
  dashboardAgentService.getBreakTimeDateRange
);
router.post(
  '/productive-hours-date-range',
  dashboardAgentService.getProductiveHoursByDateRange
);
router.post('/task-distribution', tasksService.getTaskDistribution);
router.post('/complete-percentage', tasksService.completePercentage);
router.post(
  '/all-tasks-productivity',
  tasksService.getTaskProductivityInDetail
);
//AppWeb Analytics
router.post(
  '/website-usage-daterange',
  appUsageService.getWebsiteUsageDateRange
);
router.post('/app-usage-daterange', appUsageService.getAppUsageDateRange);
router.post(
  '/website-usage-daterange-by-category',
  appUsageService.getWebsiteUsageDateRangeByCategory
);
router.post(
  '/app-usage-daterange-by-category',
  appUsageService.getAppUsageDateRangeByCategory
);

router.post(
  '/website-productive-vs-nonproductive',
  appUsageService.getWebsiteProdVsNonProd
);
router.post(
  '/app-productive-vs-nonproductive',
  appUsageService.getAppProdVsNonProd
);

router.post('/task-productivity', tasksService.getTaskProductivity);
router.post('/top-most-delayed-tasks', tasksService.topMostDelayedTasks);
router.post('/workload-graph', tasksService.workLoadGraph);
router.post('/project-overview', tasksService.projectOverview);
router.post('/get-upcoming-tasks', tasksService.upcomingTasks);
router.post(
  '/created-complete-tasks',
  tasksService.taskCreatedCompletedByDates
);
router.post('/project-statics', tasksService.projectStatics);
router.post('/project-lists', tasksService.projectLists);
router.post('/delayed-tasks', tasksService.delayedTasks);
router.post('/get-workload', tasksService.getWorkLoad);
router.post('/overview-by-project', tasksService.overviewByProject);
router.post('/get-workload-by-project', tasksService.getWorkLoadByProject);
router.post(
  '/get-created-vs-completed-task-by-project',
  tasksService.getCreatedVsCompletedTasksByProject
);
router.post(
  '/get-delayed-task-by-project',
  tasksService.delayedTasksByProjects
);

router.post('/get-wl-percentage', dashboardService.getWorkLocationPercentage);
router.post('/home-vs-location', productivityService.workFromHomeLocation);
router.post('/user-leave-analytics', dashboardService.getUserLeaveAnalytics);
router.post(
  '/present-vs-absent-new',
  productivityService.getPresentVsAbsentNew
);
router.post('/test', dashboardService.test);
router.post(
  '/loginHour-idleTime-break',
  dashboardService.loginHoursIdleTimeBreak
);
router.post('/workSummaryDateWise', dashboardAgentService.workSummaryDateWise);
//Outlook Service
router.post('/meeting-record', outlookMeetingService.getMeetingRecord);
router.post('/meeting-details', outlookMeetingService.getMeetingDetails);
router.post('/meeting-count', outlookMeetingService.getMeetingCount);
router.post('/manager-list', userService.getManagersList);
router.post(
  '/user-logged-in-vs-not-logged-in',
  productivityService.getUserLoggedInVsNotLoggedIn
);
//Timesheet
router.post('/get-task-for-dashboard', timeSheetService.getTaskTimeAndCost);

router.post(
  '/get-duration-against-status',
  dashboardService.getDurationAgainstStatusCode
);
router.post('/aux-live', dashboardService.auxLive);
router.post(
  '/get-user-vs-status-code',
  dashboardService.getUserCountVsStatusCode
);
router.post('/get-aux-code-duration', dashboardService.getAuxCodeDuration);

router.post(
  '/logged-in-users-by-hours',
  productivityService.getLoggedInUsersCountByHours
);
router.post(
  '/top-ten-user-break-data',
  productivityService.topTenUserBreakData
);
router.post(
  '/top-ten-more-less-idle-time',
  productivityService.topTenUserIdleData
);
router.post('/get-working-pattern', productivityService.getWorkingPattern);
router.post(
  '/get-user-wise-productivity',
  productivityService.getUserWiseProductivity
);

router.post(
  '/top-ten-more-less-break-data',
  productivityService.topTenUserMoreLessBreakData
);
router.post(
  '/top-ten-productive-users',
  productivityService.getTopTenProductiveUsers
);
router.post(
  '/top-department-wise-productivity',
  productivityService.getDepartmentWiseProductivity
);
router.post(
  '/get-whiteboard-screen-sharing',
  streamingDashboardService.getScreenWhiteboardSharing
);

router.post(
  '/get-streaming-dashboard',
  streamingDashboardService.getMeetingDashboard
);

router.post(
  '/get-chats-attachments-groups',
  streamingDashboardService.getChatGroupAttachments
);
router.post('/get-birthdays', desktopService.getBirthdays);
router.post('/get-favorite-reports', desktopService.getFavoriteReport);
// LEADERBOARD
router.post(
  '/get-user-leaderboard-data',
  leaderboardService.getUserLeaderboardData
);

router.post('/get-favorite-reports-list', desktopService.getFavoriteReportList);
router.post(
  '/favorite-reports-multiple',
  desktopService.favoriteReportMultiple
);
router.post('/get-app-list', desktopService.getAppsList);
module.exports = router;
