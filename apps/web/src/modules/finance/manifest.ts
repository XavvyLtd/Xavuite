import { PERMISSIONS } from '../../platform/permissions';

export default {
  key:   'finance_payroll',
  title: 'Payroll Review',
  icon:  '💰',
  group: 'finance',
  permissions: [PERMISSIONS.COMP_VIEW, PERMISSIONS.COMP_MANAGE],
  navigation: [
    { label: 'Payroll Review', path: '/finance/payroll', permission: PERMISSIONS.COMP_VIEW },
  ],
};
