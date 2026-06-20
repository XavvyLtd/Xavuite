import { PERMISSIONS } from '../../platform/permissions';

export default {
  key:   'hr',
  title: 'HR',
  icon:  '👥',
  group: 'people',
  permissions: [
    PERMISSIONS.HR_VIEW,
    PERMISSIONS.HR_CREATE,
    PERMISSIONS.HR_EDIT,
    PERMISSIONS.HR_MANAGE,
  ],
  navigation: [
    { label: 'Employees',   path: '/hr',              permission: PERMISSIONS.HR_VIEW },
  ],
};
