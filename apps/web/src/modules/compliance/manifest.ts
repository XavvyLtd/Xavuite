import { PERMISSIONS } from '../../platform/permissions';

export default {
  key:   'compliance',
  title: 'Compliance',
  icon:  '🛡',
  group: 'people',
  permissions: [
    PERMISSIONS.COMP_RTW_VIEW,
    PERMISSIONS.COMP_RTW_CREATE,
    PERMISSIONS.COMP_RTW_MANAGE,
    PERMISSIONS.AUDIT_VIEW,
  ],
  navigation: [
    { label: 'RTW Checks',     path: '/compliance',                   permission: PERMISSIONS.COMP_RTW_VIEW },
    { label: 'Expiring Soon',  path: '/compliance?status=expiring',   permission: PERMISSIONS.COMP_RTW_VIEW },
    { label: 'Expired',        path: '/compliance?status=expired',    permission: PERMISSIONS.COMP_RTW_MANAGE },
  ],
};
