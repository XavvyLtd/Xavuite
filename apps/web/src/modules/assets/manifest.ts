import { PERMISSIONS } from '../../platform/permissions';

export default {
  key:   'assets',
  title: 'Assets',
  icon:  '💻',
  group: 'work',
  permissions: [
    PERMISSIONS.ASSETS_VIEW,
    PERMISSIONS.ASSETS_CREATE,
    PERMISSIONS.ASSETS_EDIT,
  ],
  navigation: [
    { label: 'Asset Register', path: '/assets', permission: PERMISSIONS.ASSETS_VIEW },
  ],
};
