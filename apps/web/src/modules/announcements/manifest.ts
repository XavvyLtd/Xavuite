import { PERMISSIONS } from '../../platform/permissions';

export default {
  key:   'announcements',
  title: 'Announcements',
  icon:  '📢',
  group: 'comms',
  permissions: [
    PERMISSIONS.ANN_VIEW,
    PERMISSIONS.ANN_CREATE,
    PERMISSIONS.ANN_MANAGE,
  ],
  navigation: [
    { label: 'Announcements', path: '/announcements', permission: PERMISSIONS.ANN_VIEW },
  ],
};
