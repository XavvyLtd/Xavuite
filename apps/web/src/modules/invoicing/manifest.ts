export default {
  key:   'invoicing',
  title: 'Invoicing',
  icon:  '🧾',
  group: 'finance',
  permissions: ['invoicing:view:invoice'],
  navigation: [{ label: 'Invoices', path: '/invoicing', permission: 'invoicing:view:invoice' }],
};
