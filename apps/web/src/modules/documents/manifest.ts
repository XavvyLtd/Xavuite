import { PERMISSIONS } from '../../platform/permissions';

export default {
  key:   'documents',
  title: 'Documents',
  icon:  '📄',
  group: 'people',
  permissions: [
    PERMISSIONS.DOCS_VIEW,
    PERMISSIONS.DOCS_CREATE,
    PERMISSIONS.DOCS_MANAGE,
  ],
  navigation: [
    { label: 'All Documents', path: '/documents', permission: PERMISSIONS.DOCS_VIEW },
  ],
};
