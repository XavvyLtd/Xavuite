import { PERMISSIONS } from '../../platform/permissions';

export default {
  key:   'leave',
  title: 'Leave Management',
  icon:  '🌴',
  group: 'people',
  permissions: [
    PERMISSIONS.LEAVE_VIEW,
    PERMISSIONS.LEAVE_CREATE,
    PERMISSIONS.LEAVE_APPROVE,
    PERMISSIONS.LEAVE_POLICY,
  ],
  navigation: [
    { label: 'All Requests', path: '/leave',           permission: PERMISSIONS.LEAVE_VIEW },
    { label: 'Pending',      path: '/leave?status=pending', permission: PERMISSIONS.LEAVE_APPROVE },
    { label: 'My Requests',  path: '/leave?mine=true', permission: PERMISSIONS.LEAVE_CREATE },
  ],
};
