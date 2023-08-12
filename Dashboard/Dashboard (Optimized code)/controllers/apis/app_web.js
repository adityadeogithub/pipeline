const express = require('express');
const appUsageService = require('../../services/dashboards/app_usage');
let router = express.Router();

router.post('/top-apps-webs', appUsageService.getTopAppsAndWebsites);
router.post('/time-spent-auth', appUsageService.timeSpentAuth);
router.post(
  '/total-spent-time-by-category',
  appUsageService.totalSpentTimeByCategory
);
router.post(
  '/user-authorize-unauthorize',
  appUsageService.userByAuthorizeVsUnauthorizeCategory
);
router.post('/get-category-list', appUsageService.getCategoryList);
router.post(
  '/time-spent-by-authorize-and-an-authorize-category',
  appUsageService.totalSpentTimeByAuthorizeVsUnauthorizeCategory
);
router.post(
  '/get-app-dashboard-by-config',
  appUsageService.getAppDashboardByConfig
);
router.post(
  '/get-app-dashboard-by-config-new',
  appUsageService.getAppDashboardByConfigNew
);

router.post(
  '/get-app-dashboard-by-config-date-wise',
  appUsageService.getAppDashboardByConfigDateWise
);
router.post(
  '/get-app-web-total-prod-un-prod',
  appUsageService.getAppWebTotalProdUnProd
);
router.post(
  '/get-app-web-total-prod-un-prod-new',
  appUsageService.getAppWebTotalProdUnProdNew
);

module.exports = router;
