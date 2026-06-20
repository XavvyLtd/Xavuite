import { PERMISSIONS } from '../../platform/permissions';

export default {
  key:   'expenses',
  title: 'Expenses',
  icon:  '💳',
  group: 'finance',
  permissions: [
    PERMISSIONS.EXP_VIEW,
    PERMISSIONS.EXP_CREATE,
    PERMISSIONS.EXP_APPROVE,
    PERMISSIONS.EXP_MANAGE,
  ],
  navigation: [
    { label: 'All Claims', path: '/expenses',               permission: PERMISSIONS.EXP_VIEW },
    { label: 'Pending',    path: '/expenses?status=pending', permission: PERMISSIONS.EXP_APPROVE },
    { label: 'Mine',       path: '/expenses?mine=true',      permission: PERMISSIONS.EXP_CREATE },
  ],
};
