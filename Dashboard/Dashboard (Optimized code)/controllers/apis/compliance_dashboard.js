const express = require('express');
const complianceService = require('../../services/compliance_dashboard/compliance');
const complianceDepartmentService = require('../../services/compliance_dashboard/compliance_department');
const complianceManagerService = require('../../services/compliance_dashboard/compliance_manager');
const complianceUserService = require('../../services/compliance_dashboard/compliance_user');

let router = express.Router();

router.post('/breaches-summary-org', complianceService.getBreachesSummaryOrg);
router.post(
  '/compliance-breaches-org',
  complianceService.complianceBreachesOrg
);
router.post(
  '/department-maximum-violation-org',
  complianceService.departmentMaxViolationOrg
);
router.post('/top-ten-risky-users-org', complianceService.topTenRiskyUsersOrg);
router.post('/repeated-violation-org', complianceService.repeatedViolationsOrg);

router.post(
  '/breaches-summary-dep',
  complianceDepartmentService.getBreachesSummaryDep
);
router.post(
  '/compliance-breaches-dep',
  complianceDepartmentService.complianceBreachesDep
);
router.post(
  '/department-maximum-violation-dep',
  complianceDepartmentService.departmentMaxViolationDep
);
router.post(
  '/top-ten-risky-users-dep',
  complianceDepartmentService.topTenRiskyUsersDep
);
router.post(
  '/repeated-violation-dep',
  complianceDepartmentService.repeatedViolationsDep
);

router.post(
  '/breaches-summary-manager',
  complianceManagerService.getBreachesSummaryManager
);
router.post(
  '/compliance-breaches-manager',
  complianceManagerService.complianceBreachesManager
);
router.post(
  '/department-maximum-violation-manager',
  complianceManagerService.departmentMaxViolationManager
);
router.post(
  '/top-ten-risky-users-manager',
  complianceManagerService.topTenRiskyUsersManager
);
router.post(
  '/repeated-violation-manager',
  complianceManagerService.repeatedViolationsManager
);

router.post(
  '/breaches-summary-user',
  complianceUserService.getBreachesSummaryUser
);
router.post(
  '/repeated-violation-user',
  complianceUserService.repeatedViolationsUser
);

router.post(
  '/get-breach-summary-all-users',
  complianceUserService.getBreachSummaryAllUsers
);

module.exports = router;
