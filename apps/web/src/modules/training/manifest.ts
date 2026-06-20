import { PERMISSIONS } from '../../platform/permissions';

export default {
  key:   'training',
  title: 'Training',
  icon:  '🎓',
  group: 'people',
  permissions: [
    PERMISSIONS.TRAINING_VIEW,
    PERMISSIONS.TRAINING_CREATE,
    PERMISSIONS.TRAINING_RECORD,
  ],
  navigation: [
    { label: 'Courses',     path: '/training',              permission: PERMISSIONS.TRAINING_VIEW },
    { label: 'Assignments', path: '/training?tab=assignments', permission: PERMISSIONS.TRAINING_VIEW },
  ],
};
