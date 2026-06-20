import { PERMISSIONS } from '../../platform/permissions';

export default {
  key:   'timesheets',
  title: 'Timesheets',
  icon:  '⏱',
  group: 'projects',
  permissions: [
    PERMISSIONS.TS_VIEW,
    PERMISSIONS.TS_CREATE,
    PERMISSIONS.TS_APPROVE,
    PERMISSIONS.TS_EXPORT,
  ],
  navigation: [
    { label: 'All Timesheets', path: '/timesheets',               permission: PERMISSIONS.TS_VIEW },
    { label: 'Pending',        path: '/timesheets?status=pending', permission: PERMISSIONS.TS_APPROVE },
    { label: 'Mine',           path: '/timesheets?mine=true',      permission: PERMISSIONS.TS_CREATE },
  ],
};
