import { PERMISSIONS } from '../../platform/permissions';

export default {
  key:   'pmo',
  title: 'Projects',
  icon:  '📂',
  group: 'projects',
  permissions: [
    PERMISSIONS.PMO_VIEW,
    PERMISSIONS.PMO_CREATE,
    PERMISSIONS.TASK_VIEW,
    PERMISSIONS.TASK_CREATE,
    PERMISSIONS.TASK_EDIT,
  ],
  navigation: [
    { label: 'Projects',   path: '/pmo',          permission: PERMISSIONS.PMO_VIEW },
    { label: 'Task Board', path: '/pmo?view=board', permission: PERMISSIONS.TASK_VIEW },
  ],
};
