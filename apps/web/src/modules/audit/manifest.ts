import { PERMISSIONS } from '../../platform/permissions';

export default {
  key:   'audit',
  title: 'Audit Log',
  icon:  '🔍',
  group: 'ops',
  permissions: [PERMISSIONS.AUDIT_VIEW],
  navigation: [
    { label: 'Audit Log', path: '/audit', permission: PERMISSIONS.AUDIT_VIEW },
  ],
};
