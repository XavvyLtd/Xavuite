export default {
  key:   'clients',
  title: 'Clients',
  icon:  '🏢',
  group: 'projects',
  permissions: ['clients:view:client'],
  navigation: [{ label: 'All clients', path: '/clients', permission: 'clients:view:client' }],
};
