const express = require('express');
const organizationService = require('../../../../services/new/dashboards/organization');
const departmentService = require('../../../../services/new/dashboards/department');
const managerService = require('../../../../services/new/dashboards/manager');
const userService = require('../../../../services/new/dashboards/users');
const userProfileService = require('../../../../services/new/dashboards/user_profile');

let router = express.Router();

//organization

router.post(
  '/get-productivity-by-org',
  organizationService.getProductivityByOrganization
);

router.post(
  '/present-absent-by-org',
  organizationService.getPresentVsAbsentByOrganization
);

router.post('/wfh-wfo-by-org', organizationService.getWfhVsWfoByOrganization);

router.post(
  '/get-idle-time-by-org',
  organizationService.getIdleTimeByOrganization
);

router.post(
  '/get-break-time-by-org',
  organizationService.getBreakTimeByOrganization
);

router.post(
  '/summarized-data-by-org',
  organizationService.summarizedDataOrganization
);

router.post(
  '/get-app-prod-un-prod-by-org',
  organizationService.getAppProductivityOrganization
); //saas

router.post(
  '/get-web-prod-un-prod-by-org',
  organizationService.getWebProductivityByOrganization
); //saas

router.post(
  '/get-app-web-per-by-org',
  organizationService.getAppWebPerByOrganization
);

router.post(
  '/get-logged-in-vs-not-logged-by-org',
  organizationService.getLoggedInNotLoggedInByOrganization
);

router.post(
  '/get-Work-Hours-Summary-org-dep-mang',
  organizationService.getWorkHoursSummaryOrgDepMang
);

router.post(
  '/current-status-org-dep-mang',
  organizationService.getCurrentStatusOrgDepMang
);

//department
router.post(
  '/get-productivity-by-dep',
  departmentService.getProductivityByDepartment
);

router.post(
  '/present-absent-by-dep',
  departmentService.getPresentVsAbsentByDepartment
);

router.post('/wfh-wfo-by-dep', departmentService.getWfhVsWfoByDepartment);

router.post('/get-idle-time-by-dep', departmentService.getIdleTimeByDepartment);

router.post(
  '/get-break-time-by-dep',
  departmentService.getBreakTimeByDepartment
);

router.post(
  '/summarized-data-by-dep',
  departmentService.summarizedDataDepartment
);

router.post(
  '/get-app-web-per-by-dep',
  departmentService.getAppWebPerByDepartment
);

router.post(
  '/get-app-prod-un-prod-by-dep',
  departmentService.getAppProductivityDepartment
); //saas

router.post(
  '/get-web-prod-un-prod-by-dep',
  departmentService.getWebProductivityByDepartment
); //saas

router.post('/all-users-productivity', departmentService.allUsersActivity);

router.post(
  '/get-most-tracked-hours-by-dep',
  departmentService.getTrackedMostHoursByDepartment
);

router.post(
  '/get-least-tracked-hours-by-dep',
  departmentService.getTrackedLeastHoursByDepartment
);

router.post(
  '/get-logged-in-vs-not-logged-in-dep',
  departmentService.getLoggedInNotLoggedInByDepartment
);

//manager

router.post(
  '/get-present-absent-by-manger',
  managerService.getPresentAbsentByManager
);

router.post('/wfh-wfo-by-manager', managerService.getWfhVsWfoByManager);

router.post('/break-idle-by-manager', managerService.getBreakIdleTimeByManager);

router.post('/overview-by-manager', managerService.overviewManager);

router.post(
  '/all-users-productivity-by-manager',
  managerService.allUsersActivityManager
);

router.post(
  '/get-app-web-per-by-manager',
  managerService.getAppWebPerByManager
);

router.post(
  '/get-web-prod-un-prod-by-manager',
  managerService.getWebProductivityByManager
); //saas

router.post(
  '/get-app-prod-un-prod-by-manager',
  managerService.getAppProductivityManager
); //saas

//user

router.post(
  '/all-users-productivity-by-user',
  userService.allUsersActivityUser
);
router.post('/user-violation', userService.violationTimeUser);

//user profile

router.post('/get-user-profile', userProfileService.getUsersProfile);

router.post(
  '/get-attendance-summary-by-org',
  organizationService.getAttendanceSummaryOrganization
);
router.post(
  '/get-hybrid-summary-by-or-dep',
  organizationService.getHybridSummaryOrgDep
);
module.exports = router;
