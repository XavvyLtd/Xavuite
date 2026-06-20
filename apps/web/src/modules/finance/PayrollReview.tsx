import { useState, useMemo } from 'react';
import {
  usePayroll, usePayrollHistory, exportPayrollCsv, useEmailPayrollReport, useSavePayroll,
  type PayrollRow, type PayrollRunSummary,
} from '../../hooks/api';
import { useAuth } from '../../context/AuthContext';
import {
  Card, MetricCard, MetricGrid, DataTable, Btn, Loading, Alert,
  inputStyle, C, type ColDef,
} from '../../components/ui';
import { PermissionGate } from '../../platform/permissions';
import { PERMISSIONS } from '../../platform/permissions';

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const ACTION_LABELS: Record<PayrollRunSummary['action'], string> = {
  loaded:   'Loaded',
  exported: 'Exported',
  emailed:  'Emailed',
  saved:    'Saved',
};

const ACTION_COLORS: Record<PayrollRunSummary['action'], string> = {
  loaded:   C.dim,
  exported: C.primary,
  emailed:  '#22C55E',
  saved:    '#F59E0B',
};

export default function PayrollReview() {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [overrides, setOverrides] = useState<Record<string, Partial<PayrollRow>>>({});
  const [exporting, setExporting] = useState(false);

  const { data, isLoading, isError, refetch } = usePayroll(year, month);
  const { data: historyData } = usePayrollHistory();
  const emailMutation = useEmailPayrollReport();
  const saveMutation = useSavePayroll();
  const { accessToken } = useAuth();

  // Merge server rows with any local edits the Finance user has made
  const rows: PayrollRow[] = useMemo(() => {
    const base = data?.rows ?? [];
    return base.map(r => ({ ...r, ...(overrides[r.employee_id] ?? {}) }));
  }, [data, overrides]);

  const totals = useMemo(() => {
    return rows.reduce((acc, r) => ({
      gross:   acc.gross + (r.gross_salary || 0),
      payroll: acc.payroll + (r.payroll_days || 0),
    }), { gross: 0, payroll: 0 });
  }, [rows]);

  function updateRow(employeeId: string, field: keyof PayrollRow, value: number | string) {
    setOverrides(prev => {
      const current = { ...(prev[employeeId] ?? {}) };
      (current as any)[field] = value;

      // Recompute payroll_days and gross_salary when worked/leave days change
      const original = (data?.rows ?? []).find(r => r.employee_id === employeeId);
      if (original) {
        const merged = { ...original, ...current };
        if (field === 'worked_days' || field === 'paid_leave_days' || field === 'unpaid_leave_days') {
          const workingDays = data?.workingDays ?? merged.working_days;
          const payrollDays = Math.min(workingDays, Number(merged.worked_days) + Number(merged.paid_leave_days));
          const dailyRate    = workingDays > 0 ? merged.base_salary / workingDays : 0;
          (current as any).payroll_days = payrollDays;
          (current as any).gross_salary = Math.round(dailyRate * payrollDays * 100) / 100;
        }
      }

      return { ...prev, [employeeId]: current };
    });
  }

  function setWorkedDaysEqualWorkingDays() {
    if (!data) return;
    const next: Record<string, Partial<PayrollRow>> = {};
    for (const r of data.rows) {
      const dailyRate    = data.workingDays > 0 ? r.base_salary / data.workingDays : 0;
      const payrollDays  = Math.min(data.workingDays, data.workingDays); // worked = working
      next[r.employee_id] = {
        worked_days:  data.workingDays,
        payroll_days: payrollDays,
        gross_salary: Math.round(dailyRate * payrollDays * 100) / 100,
      };
    }
    setOverrides(next);
  }

  async function handleExport() {
    setExporting(true);
    try {
      await exportPayrollCsv(rows, year, month, accessToken ?? '');
    } catch (e) {
      console.error(e);
    } finally {
      setExporting(false);
    }
  }

  async function handleEmail() {
    const defaultTo = 'hr@xavvy.uk';
    const to = window.prompt('Send payroll report to which email address?', defaultTo);
    if (!to) return; // user cancelled
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      window.alert('Please enter a valid email address.');
      return;
    }
    await emailMutation.mutateAsync({ rows, year, month, to });
  }

  async function handleSave() {
    await saveMutation.mutateAsync({ rows, year, month });
  }

  const cols: ColDef<PayrollRow>[] = [
    { key: 'employee_name', label: 'Employee' },
    {
      key: 'base_salary', label: 'Salary',
      render: (v: number, row) => `${row.currency} ${v.toLocaleString()}`,
    },
    { key: 'working_days', label: 'Working Days' },
    {
      key: 'worked_days', label: 'Worked Days',
      render: (v: number, row) => (
        <input
          type="number" min={0} max={31} value={v}
          onChange={e => updateRow(row.employee_id, 'worked_days', Number(e.target.value))}
          style={{ ...inputStyle, width: 64, padding: '4px 8px' }}
        />
      ),
    },
    {
      key: 'paid_leave_days', label: 'Paid Leave',
      render: (v: number, row) => (
        <input
          type="number" min={0} max={31} value={v}
          onChange={e => updateRow(row.employee_id, 'paid_leave_days', Number(e.target.value))}
          style={{ ...inputStyle, width: 64, padding: '4px 8px' }}
        />
      ),
    },
    {
      key: 'unpaid_leave_days', label: 'Unpaid Leave',
      render: (v: number, row) => (
        <input
          type="number" min={0} max={31} value={v}
          onChange={e => updateRow(row.employee_id, 'unpaid_leave_days', Number(e.target.value))}
          style={{ ...inputStyle, width: 64, padding: '4px 8px' }}
        />
      ),
    },
    { key: 'payroll_days', label: 'Payroll Days' },
    {
      key: 'gross_salary', label: 'Gross Salary',
      render: (v: number, row) => <strong>{row.currency} {v.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>,
    },
    {
      key: 'notes', label: 'Notes',
      render: (v: string, row) => (
        <input
          type="text" value={v ?? ''}
          onChange={e => updateRow(row.employee_id, 'notes', e.target.value)}
          style={{ ...inputStyle, width: 180, padding: '4px 8px' }}
          placeholder="Add a note..."
        />
      ),
    },
  ];

  // Columns for the Payroll Run History list — a simple read-only audit trail
  // of every Load / Export / Email action taken on this page.
  const historyCols: ColDef<PayrollRunSummary>[] = [
    {
      key: 'year', label: 'Period',
      render: (_: number, row) =>
        new Date(row.year, row.month - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
    },
    {
      key: 'action', label: 'Action',
      render: (v: PayrollRunSummary['action']) => (
        <span style={{
          color: ACTION_COLORS[v], fontWeight: 700, fontSize: 11,
          textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          {ACTION_LABELS[v]}
        </span>
      ),
    },
    { key: 'employee_count', label: 'Employees' },
    {
      key: 'total_gross', label: 'Total Gross',
      render: (v: number, row) => `${row.currency} ${v.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    },
    {
      key: 'emailed_to', label: 'Emailed To',
      render: (v: string | null) => v ?? '—',
    },
    {
      key: 'run_by_email', label: 'Run By',
      render: (v: string | null) => v ?? '—',
    },
    {
      key: 'run_at', label: 'Run At',
      render: (v: string) => new Date(v).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: 0 }}>Payroll Review</h1>
        <p style={{ color: C.dim, fontSize: 13, marginTop: 4 }}>
          Calculated on-the-fly from timesheets, leave and current compensation. Every Load, Export
          and Email action is recorded below for reference.
        </p>
      </div>

      <Card>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: 11, color: C.dim, textTransform: 'uppercase', fontWeight: 700 }}>Month</label>
            <select
              value={month}
              onChange={e => { setMonth(Number(e.target.value)); setOverrides({}); }}
              style={{ ...inputStyle, marginTop: 4 }}
            >
              {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: C.dim, textTransform: 'uppercase', fontWeight: 700 }}>Year</label>
            <input
              type="number" value={year}
              onChange={e => { setYear(Number(e.target.value)); setOverrides({}); }}
              style={{ ...inputStyle, marginTop: 4, width: 100 }}
            />
          </div>
          <Btn onClick={() => { setOverrides({}); refetch(); }}>
            Load Payroll
          </Btn>
          <PermissionGate permission={PERMISSIONS.COMP_MANAGE}>
            <Btn variant="ghost" onClick={setWorkedDaysEqualWorkingDays} disabled={!data}>
              Set Worked Days = Working Days
            </Btn>
          </PermissionGate>
          <PermissionGate permission={PERMISSIONS.COMP_MANAGE}>
            <Btn variant="ghost" onClick={handleSave} disabled={!data || saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving…' : 'Save Adjustments'}
            </Btn>
          </PermissionGate>
          <Btn variant="ghost" onClick={handleExport} disabled={!data || exporting}>
            {exporting ? 'Exporting…' : 'Export CSV'}
          </Btn>
          <PermissionGate permission={PERMISSIONS.COMP_MANAGE}>
            <Btn variant="ghost" onClick={handleEmail} disabled={!data || emailMutation.isPending}>
              {emailMutation.isPending ? 'Sending…' : 'Email Payroll Report'}
            </Btn>
          </PermissionGate>
        </div>
      </Card>

      {isError && <Alert type="error" message="Failed to load payroll data. Check your permissions and try again." />}
      {emailMutation.isSuccess && (
        <Alert type="success" message={`Payroll report emailed to ${emailMutation.data?.to ?? 'recipient'}.`} />
      )}
      {emailMutation.isError && <Alert type="error" message="Failed to send payroll report email." />}
      {saveMutation.isSuccess && <Alert type="success" message="Adjustments saved to payroll history." />}
      {saveMutation.isError && <Alert type="error" message="Failed to save adjustments." />}

      {isLoading ? (
        <Loading text="Calculating payroll..." />
      ) : data ? (
        <>
          <MetricGrid>
            <MetricCard label="Employees" value={rows.length} icon="👥" color={C.primary} />
            <MetricCard label="Working Days" value={data.workingDays} icon="📅" color={C.primary} />
            <MetricCard label="Total Payroll Days" value={totals.payroll} icon="🗓️" color={C.primary} />
            <MetricCard
              label="Total Gross Salary"
              value={totals.gross.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              icon="💰" color={C.primary}
            />
          </MetricGrid>

          <Card>
            <DataTable cols={cols} rows={rows} emptyText="No active employees found for this period." />
          </Card>
        </>
      ) : (
        <Card>
          <p style={{ color: C.dim, textAlign: 'center', padding: 32 }}>
            Select a month and click "Load Payroll" to begin.
          </p>
        </Card>
      )}

      <Card>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: '0 0 12px' }}>Payroll Run History</h2>
        <DataTable
          cols={historyCols}
          rows={historyData?.runs ?? []}
          emptyText="No payroll runs recorded yet — load, export or email a payroll report to start building history."
        />
      </Card>
    </div>
  );
}
