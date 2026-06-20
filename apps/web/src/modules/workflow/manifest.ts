export default {
  key:   'workflow',
  title: 'Workflows',
  icon:  '🔀',
  group: 'ops',
  permissions: [],
  navigation: [
    { label: 'Pending Approvals', path: '/workflow?tab=pending',     permission: null },
    { label: 'Definitions',       path: '/workflow?tab=definitions', permission: null },
    { label: 'All Instances',     path: '/workflow?tab=instances',   permission: null },
  ],
};
