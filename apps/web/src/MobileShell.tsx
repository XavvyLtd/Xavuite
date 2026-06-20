/**
 * MobileShell.tsx
 * Mobile-optimised UI for XavvySuite.
 * Renders when screen width < 768px.
 * Features: Clock In/Out, Quick Timesheet, Leave Balance, Quick Expense, My Tasks, Notifications.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import { useAppStore } from './store/appStore';
import { C } from './platform/branding/theme';
import {
  useProjects, useMyTasks, useNotifications,
  useLeaveBalances, useCreateLeave,
  useTimesheets, useSubmitTimesheet,
  useCreateExpense,
} from './hooks/api';
import { useQueryClient } from '@tanstack/react-query';

const API_URL = import.meta.env.VITE_API_URL ?? 'https://api-v2.xavvy.uk';

// ── Helpers ──────────────────────────────────────────────────────────────────
const getMondayOf = (d = new Date()) => {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const m = new Date(d);
  m.setDate(d.getDate() + diff);
  return m.toISOString().split('T')[0];
};

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const fmtDuration = (mins: number) => `${Math.floor(mins / 60)}h ${mins % 60}m`;
const today = () => new Date().toISOString().split('T')[0];

// ── Clock Hooks ───────────────────────────────────────────────────────────────
function useClockStatus() {
  const [record, setRecord] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [elapsed, setElapsed] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    const tok = localStorage.getItem('xs_token') ?? '';
    const res  = await fetch(`\${API_URL}/api/attendance/today`, { headers: { Authorization: `Bearer ${tok}` } });
    const json: any = await res.json();
    setRecord(json.data);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Live elapsed timer when clocked in
  useEffect(() => {
    if (!record?.clocked_in_at || record?.clocked_out_at) return;
    const interval = setInterval(() => {
      setElapsed(Math.round((Date.now() - new Date(record.clocked_in_at).getTime()) / 60000));
    }, 10000);
    setElapsed(Math.round((Date.now() - new Date(record.clocked_in_at).getTime()) / 60000));
    return () => clearInterval(interval);
  }, [record]);

  const clockIn = async (location?: string) => {
    const tok = localStorage.getItem('xs_token') ?? '';
    await fetch(`\${API_URL}/api/attendance/clock-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ location }),
    });
    await refresh();
  };

  const clockOut = async (location?: string) => {
    const tok = localStorage.getItem('xs_token') ?? '';
    await fetch(`\${API_URL}/api/attendance/clock-out`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ location }),
    });
    await refresh();
  };

  return { record, loading, elapsed, clockIn, clockOut, refresh };
}

// ── Clock In/Out Screen ───────────────────────────────────────────────────────
function ClockScreen() {
  const { record, loading, elapsed, clockIn, clockOut } = useClockStatus();
  const [locating, setLocating] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const isClockedIn = !!record?.clocked_in_at && !record?.clocked_out_at;
  const isClockedOut = !!record?.clocked_out_at;

  const getLocation = (): Promise<string | undefined> =>
    new Promise(resolve => {
      if (!navigator.geolocation) { resolve(undefined); return; }
      navigator.geolocation.getCurrentPosition(
        pos => resolve(`${pos.coords.latitude.toFixed(5)},${pos.coords.longitude.toFixed(5)}`),
        ()  => resolve(undefined),
        { timeout: 5000 }
      );
    });

  const handleClock = async () => {
    setLocating(true); setError('');
    try {
      const loc = await getLocation();
      if (isClockedIn) {
        await clockOut(loc);
      } else {
        await clockIn(loc);
      }
    } catch (e: any) {
      setError(e.message ?? 'Failed');
    } finally {
      setLocating(false);
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
      <div style={{ color: C.muted, fontSize: 14 }}>Loading...</div>
    </div>
  );

  return (
    <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
      {/* Status ring */}
      <div style={{ position: 'relative', marginTop: 16 }}>
        <div style={{
          width: 180, height: 180, borderRadius: '50%',
          background: isClockedIn
            ? `conic-gradient(${C.success} ${Math.min(100, (elapsed / 480) * 100)}%, ${C.border} 0)`
            : `${C.elevated}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: isClockedIn ? `0 0 40px ${C.success}44` : 'none',
          transition: 'all 0.5s ease',
        }}>
          <div style={{
            width: 148, height: 148, borderRadius: '50%',
            background: C.card,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ fontSize: 36 }}>{isClockedIn ? '✅' : isClockedOut ? '🏁' : '⭕'}</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: isClockedIn ? C.success : C.text, marginTop: 4 }}>
              {isClockedIn ? 'Clocked In' : isClockedOut ? 'Done for today' : 'Not clocked in'}
            </div>
            {isClockedIn && (
              <div style={{ fontSize: 22, fontWeight: 900, color: C.success, marginTop: 4 }}>
                {fmtDuration(elapsed)}
              </div>
            )}
            {isClockedIn && (
              <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>
                Since {fmtTime(record.clocked_in_at)}
              </div>
            )}
            {isClockedOut && (
              <div style={{ fontSize: 20, fontWeight: 800, color: C.text, marginTop: 4 }}>
                {fmtDuration(record.duration_mins)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Time info */}
      {!isClockedIn && !isClockedOut && (
        <div style={{ textAlign: 'center', color: C.dim, fontSize: 13 }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: C.text }}>
            {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div>{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        </div>
      )}

      {isClockedOut && (
        <div style={{ background: C.elevated, borderRadius: 12, padding: '14px 20px', width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: C.dim }}>Today's summary</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 8 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{fmtTime(record.clocked_in_at)}</div>
              <div style={{ fontSize: 10, color: C.dim }}>Clock In</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{fmtTime(record.clocked_out_at)}</div>
              <div style={{ fontSize: 10, color: C.dim }}>Clock Out</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.success }}>{fmtDuration(record.duration_mins)}</div>
              <div style={{ fontSize: 10, color: C.dim }}>Total</div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div style={{ background: C.danger + '22', border: `1px solid ${C.danger}44`, borderRadius: 10, padding: '10px 14px', color: C.danger, fontSize: 13, width: '100%', textAlign: 'center' }}>
          {error}
        </div>
      )}

      {/* Main action button */}
      {!isClockedOut && (
        <button
          type="button"
          onClick={handleClock}
          disabled={locating}
          style={{
            width: '100%', padding: '18px', borderRadius: 16, border: 'none',
            background: isClockedIn
              ? `linear-gradient(135deg, ${C.danger}, #B91C1C)`
              : `linear-gradient(135deg, ${C.success}, #059669)`,
            color: '#fff', fontSize: 18, fontWeight: 900, cursor: 'pointer',
            boxShadow: `0 8px 24px ${isClockedIn ? C.danger : C.success}44`,
            transition: 'all 0.2s',
          }}
        >
          {locating ? '📍 Getting location...' : isClockedIn ? '🏁 Clock Out' : '✅ Clock In'}
        </button>
      )}

      {isClockedOut && (
        <div style={{ color: C.dim, fontSize: 13, textAlign: 'center' }}>
          See you tomorrow! 👋
        </div>
      )}
    </div>
  );
}

// ── Quick Timesheet Screen ────────────────────────────────────────────────────
function TimesheetScreen() {
  const qc = useQueryClient();
  const submit = useSubmitTimesheet();
  const { data: projects } = useProjects({ status: 'active' });
  const projectList: any[] = (projects as any) ?? [];

  const [entries, setEntries] = useState<Array<{ date: string; hours: string; projectId: string; description: string }>>(() => {
    // Mon–Fri of current week
    const monday = getMondayOf();
    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      return { date: d.toISOString().split('T')[0], hours: '', projectId: '', description: '' };
    });
  });

  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [error, setError]   = useState('');

  const setEntry = (i: number, k: string, v: string) =>
    setEntries(prev => prev.map((e, idx) => idx === i ? { ...e, [k]: v } : e));

  const totalHours = entries.reduce((s, e) => s + (parseFloat(e.hours) || 0), 0);

  const handleSubmit = async () => {
    const filledEntries = entries.filter(e => parseFloat(e.hours) > 0);
    if (!filledEntries.length) { setError('Enter hours for at least one day'); return; }
    setSaving(true); setError('');
    try {
      const tok = localStorage.getItem('xs_token') ?? '';
      await fetch(`\${API_URL}/api/timesheets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify({
          weekStarting: getMondayOf(),
          entries: filledEntries.map(e => ({
            date: e.date,
            hoursWorked: parseFloat(e.hours),
            description: e.description || 'Work',
            billable: true,
            projectId: e.projectId || null,
          })),
        }),
      });
      qc.invalidateQueries({ queryKey: ['timesheets'] });
      setSaved(true);
    } catch (e: any) {
      setError(e.message ?? 'Failed to submit');
    } finally { setSaving(false); }
  };

  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const todayStr = today();

  if (saved) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: 32 }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
      <div style={{ fontSize: 20, fontWeight: 900, color: C.text, marginBottom: 8 }}>Timesheet submitted!</div>
      <div style={{ fontSize: 14, color: C.muted, marginBottom: 24 }}>{totalHours}h logged for this week</div>
      <button type="button" onClick={() => setSaved(false)} style={{ background: C.primary, color: '#fff', border: 'none', borderRadius: 12, padding: '12px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
        Log another week
      </button>
    </div>
  );

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ fontSize: 13, color: C.dim, marginBottom: 16 }}>
        Week of <strong style={{ color: C.text }}>{getMondayOf()}</strong> · {totalHours}h logged
      </div>

      {error && (
        <div style={{ background: C.danger + '22', borderRadius: 10, padding: '10px 14px', color: C.danger, fontSize: 13, marginBottom: 16 }}>{error}</div>
      )}

      {/* Quick project picker — applies to all */}
      {projectList.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Default Project (optional)</div>
          <select
            onChange={e => setEntries(prev => prev.map(en => ({ ...en, projectId: e.target.value })))}
            style={{ width: '100%', background: C.elevated, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', color: C.text, fontSize: 13, outline: 'none' }}
          >
            <option value="">No project</option>
            {projectList.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}

      {/* Daily entries */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {entries.map((e, i) => {
          const isToday = e.date === todayStr;
          return (
            <div key={e.date} style={{
              background: isToday ? C.primary + '11' : C.elevated,
              border: `1px solid ${isToday ? C.primary + '44' : C.border}`,
              borderRadius: 12, padding: '12px 14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: isToday ? C.primary : C.dim }}>{DAYS[i]}</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: isToday ? C.primary : C.text }}>
                    {new Date(e.date).getDate()}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <input
                    type="number" min="0" max="24" step="0.5"
                    value={e.hours}
                    onChange={ev => setEntry(i, 'hours', ev.target.value)}
                    placeholder="0"
                    style={{ width: '100%', background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', color: C.text, fontSize: 20, fontWeight: 800, outline: 'none', textAlign: 'center' }}
                  />
                </div>
                <div style={{ color: C.muted, fontSize: 13, fontWeight: 700, width: 16 }}>h</div>
              </div>
              {parseFloat(e.hours) > 0 && (
                <input
                  type="text"
                  value={e.description}
                  onChange={ev => setEntry(i, 'description', ev.target.value)}
                  placeholder="What did you work on?"
                  style={{ marginTop: 8, width: '100%', background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 12px', color: C.text, fontSize: 12, outline: 'none' }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Quick fill buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[7.5, 8].map(h => (
          <button key={h} type="button" onClick={() => setEntries(prev => prev.map(e => ({ ...e, hours: String(h) })))}
            style={{ flex: 1, background: C.elevated, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px', color: C.muted, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            Fill {h}h/day
          </button>
        ))}
        <button type="button" onClick={() => setEntries(prev => prev.map(e => ({ ...e, hours: '' })))}
          style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', color: C.dim, fontSize: 12, cursor: 'pointer' }}>
          Clear
        </button>
      </div>

      <button
        type="button" onClick={handleSubmit} disabled={saving || totalHours === 0}
        style={{
          width: '100%', padding: '16px', borderRadius: 14, border: 'none',
          background: totalHours > 0 ? `linear-gradient(135deg,${C.primary},#8B5CF6)` : C.elevated,
          color: totalHours > 0 ? '#fff' : C.dim,
          fontSize: 16, fontWeight: 800, cursor: totalHours > 0 ? 'pointer' : 'default',
          boxShadow: totalHours > 0 ? `0 6px 20px ${C.primary}44` : 'none',
        }}
      >
        {saving ? 'Submitting...' : `Submit ${totalHours}h for this week`}
      </button>
    </div>
  );
}

// ── Leave Screen ──────────────────────────────────────────────────────────────
function LeaveScreen() {
  const { data: balances } = useLeaveBalances();
  const createLeave = useCreateLeave();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ leaveType: 'annual', startDate: today(), endDate: today(), reason: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [error, setError]   = useState('');

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    setSaving(true); setError('');
    try {
      await createLeave.mutateAsync({
        ...form,
        days: Math.max(1, Math.ceil((new Date(form.endDate).getTime() - new Date(form.startDate).getTime()) / 86400000) + 1),
      } as any);
      qc.invalidateQueries({ queryKey: ['leave'] });
      setSaved(true); setShowForm(false);
    } catch (e: any) { setError(e.message ?? 'Failed'); }
    finally { setSaving(false); }
  };

  const LEAVE_ICONS: Record<string, string> = { annual: '🌴', sick: '🤒', maternity: '👶', paternity: '👨‍👧', compassionate: '💙', unpaid: '⏸️', other: '📅' };
  const balls = (balances as any[]) ?? [];

  return (
    <div style={{ padding: '16px' }}>
      {/* Balances */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>Leave Balances</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {balls.length === 0 && (
            <div style={{ gridColumn: '1/-1', color: C.dim, fontSize: 13, textAlign: 'center', padding: 20 }}>No balances set up</div>
          )}
          {balls.map((b: any) => (
            <div key={b.id} style={{ background: C.elevated, borderRadius: 12, padding: '14px', border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 22, marginBottom: 4 }}>{LEAVE_ICONS[b.leave_type] ?? '📅'}</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: b.remaining > 5 ? C.success : b.remaining > 0 ? C.warning : C.danger }}>
                {b.remaining}d
              </div>
              <div style={{ fontSize: 10, color: C.dim, marginTop: 2 }}>{b.leave_type.replace(/_/g,' ')} remaining</div>
              <div style={{ fontSize: 10, color: C.dim }}>of {b.entitlement}d</div>
            </div>
          ))}
        </div>
      </div>

      {saved && (
        <div style={{ background: C.success + '22', borderRadius: 10, padding: '12px 14px', color: C.success, fontSize: 13, marginBottom: 16, textAlign: 'center' }}>
          ✅ Leave request submitted — awaiting approval
        </div>
      )}

      {error && (
        <div style={{ background: C.danger + '22', borderRadius: 10, padding: '10px 14px', color: C.danger, fontSize: 13, marginBottom: 16 }}>{error}</div>
      )}

      {/* Request form */}
      {!showForm ? (
        <button type="button" onClick={() => setShowForm(true)} style={{ width: '100%', background: `linear-gradient(135deg,${C.primary},#8B5CF6)`, color: '#fff', border: 'none', borderRadius: 14, padding: '16px', fontSize: 16, fontWeight: 800, cursor: 'pointer', boxShadow: `0 6px 20px ${C.primary}44` }}>
          + Request Leave
        </button>
      ) : (
        <div style={{ background: C.elevated, borderRadius: 14, padding: '16px', border: `1px solid ${C.border}` }}>
          <div style={{ fontWeight: 800, color: C.text, marginBottom: 14 }}>New Leave Request</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: C.dim, marginBottom: 4 }}>Type</div>
              <select value={form.leaveType} onChange={e => set('leaveType', e.target.value)}
                style={{ width: '100%', background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', color: C.text, fontSize: 13, outline: 'none' }}>
                {['annual','sick','compassionate','unpaid','other'].map(t => (
                  <option key={t} value={t}>{LEAVE_ICONS[t]} {t.replace(/_/g,' ')}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: C.dim, marginBottom: 4 }}>From</div>
                <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)}
                  style={{ width: '100%', background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', color: C.text, fontSize: 13, outline: 'none' }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.dim, marginBottom: 4 }}>To</div>
                <input type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)}
                  style={{ width: '100%', background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', color: C.text, fontSize: 13, outline: 'none' }} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: C.dim, marginBottom: 4 }}>Reason (optional)</div>
              <textarea value={form.reason} onChange={e => set('reason', e.target.value)} rows={2}
                style={{ width: '100%', background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', color: C.text, fontSize: 13, outline: 'none', resize: 'none' }}
                placeholder="e.g. Family holiday" />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => setShowForm(false)} style={{ flex: 1, background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px', color: C.muted, fontSize: 14, cursor: 'pointer' }}>Cancel</button>
              <button type="button" onClick={handleSubmit} disabled={saving} style={{ flex: 2, background: C.primary, color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                {saving ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tasks Screen ──────────────────────────────────────────────────────────────
function TasksScreen() {
  const { data: tasks } = useMyTasks();
  const taskList: any[] = (tasks as any) ?? [];
  const open = taskList.filter(t => t.status !== 'done' && t.status !== 'cancelled');
  const today_ = today();

  const STATUS_COLORS: Record<string, string> = {
    in_progress: C.warning, todo: C.muted, backlog: C.dim,
    done: C.success, blocked: C.danger,
  };

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ fontSize: 13, color: C.dim, marginBottom: 16 }}>
        {open.length} open task{open.length !== 1 ? 's' : ''} assigned to you
      </div>
      {open.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: C.dim }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
          <div>All caught up!</div>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {open.map((t: any) => {
          const isOverdue = t.due_date && t.due_date < today_ && t.status !== 'done';
          return (
            <div key={t.id} style={{
              background: C.elevated, borderRadius: 12, padding: '14px',
              border: `1px solid ${isOverdue ? C.danger + '44' : C.border}`,
              borderLeft: `4px solid ${STATUS_COLORS[t.status] ?? C.muted}`,
            }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 4 }}>{t.name}</div>
              <div style={{ display: 'flex', gap: 10, fontSize: 11, flexWrap: 'wrap' }}>
                <span style={{ color: C.dim }}>{t.project_name ?? '—'}</span>
                {t.due_date && (
                  <span style={{ color: isOverdue ? C.danger : C.dim, fontWeight: isOverdue ? 700 : 400 }}>
                    {isOverdue ? '⚠️ ' : ''}Due {t.due_date}
                  </span>
                )}
                <span style={{ background: (STATUS_COLORS[t.status] ?? C.muted) + '22', color: STATUS_COLORS[t.status] ?? C.muted, borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>
                  {t.status?.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Quick Expense Screen ──────────────────────────────────────────────────────
function ExpenseScreen() {
  const createExpense = useCreateExpense();
  const qc = useQueryClient();
  const [form, setForm] = useState({ amount: '', category: 'travel', description: '', date: today(), receipt_url: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [error, setError]   = useState('');
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const CATEGORIES = [
    { k: 'travel', l: '🚗 Travel' }, { k: 'meals', l: '🍽️ Meals' },
    { k: 'accommodation', l: '🏨 Hotel' }, { k: 'equipment', l: '💻 Equipment' },
    { k: 'training', l: '🎓 Training' }, { k: 'other', l: '📦 Other' },
  ];

  const handleSubmit = async () => {
    if (!form.amount || !form.description) { setError('Amount and description are required'); return; }
    setSaving(true); setError('');
    try {
      await createExpense.mutateAsync({ ...form, amount: parseFloat(form.amount) } as any);
      qc.invalidateQueries({ queryKey: ['expenses'] });
      setSaved(true);
      setForm({ amount: '', category: 'travel', description: '', date: today(), receipt_url: '' });
    } catch (e: any) { setError(e.message ?? 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ padding: '16px' }}>
      {saved && (
        <div style={{ background: C.success + '22', borderRadius: 10, padding: '12px 14px', color: C.success, fontSize: 13, marginBottom: 16, textAlign: 'center' }}>
          ✅ Expense submitted for approval
        </div>
      )}
      {error && (
        <div style={{ background: C.danger + '22', borderRadius: 10, padding: '10px 14px', color: C.danger, fontSize: 13, marginBottom: 16 }}>{error}</div>
      )}

      {/* Category picker */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Category</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {CATEGORIES.map(c => (
            <button key={c.k} type="button" onClick={() => set('category', c.k)}
              style={{ background: form.category === c.k ? C.primary + '22' : C.elevated, border: `1px solid ${form.category === c.k ? C.primary : C.border}`, borderRadius: 10, padding: '10px 6px', color: form.category === c.k ? C.primary : C.muted, fontSize: 11, fontWeight: 700, cursor: 'pointer', textAlign: 'center' }}>
              {c.l}
            </button>
          ))}
        </div>
      </div>

      {/* Amount — large input */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Amount (£)</div>
        <input type="number" min="0" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)}
          placeholder="0.00"
          style={{ width: '100%', background: C.elevated, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px', color: C.text, fontSize: 32, fontWeight: 900, outline: 'none', textAlign: 'center' }} />
      </div>

      {/* Description */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Description</div>
        <input type="text" value={form.description} onChange={e => set('description', e.target.value)}
          placeholder="e.g. Client lunch at Cafe Nero"
          style={{ width: '100%', background: C.elevated, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px', color: C.text, fontSize: 14, outline: 'none' }} />
      </div>

      {/* Date */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Date</div>
        <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
          style={{ width: '100%', background: C.elevated, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px', color: C.text, fontSize: 14, outline: 'none' }} />
      </div>

      <button type="button" onClick={handleSubmit} disabled={saving || !form.amount || !form.description}
        style={{
          width: '100%', padding: '16px', borderRadius: 14, border: 'none',
          background: form.amount && form.description ? `linear-gradient(135deg,${C.primary},#8B5CF6)` : C.elevated,
          color: form.amount && form.description ? '#fff' : C.dim,
          fontSize: 16, fontWeight: 800, cursor: 'pointer',
          boxShadow: form.amount ? `0 6px 20px ${C.primary}44` : 'none',
        }}>
        {saving ? 'Submitting...' : `Submit £${parseFloat(form.amount || '0').toFixed(2)} expense`}
      </button>
    </div>
  );
}

// ── Notifications Screen ──────────────────────────────────────────────────────
function NotifScreen() {
  const { data: notifs } = useNotifications();
  const list: any[] = (notifs as any) ?? [];

  const PRIORITY_COLORS: Record<string, string> = { urgent: C.danger, high: C.warning, medium: C.sky, low: C.dim };

  return (
    <div style={{ padding: '16px' }}>
      {list.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: C.dim }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🔔</div>
          <div>All clear — no notifications</div>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {list.map((n: any) => (
          <div key={n.id} style={{ background: C.elevated, borderRadius: 12, padding: '14px', border: `1px solid ${C.border}`, borderLeft: `4px solid ${PRIORITY_COLORS[n.priority] ?? C.muted}` }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 20 }}>{n.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 2 }}>{n.title}</div>
                <div style={{ fontSize: 11, color: C.dim }}>{n.priority} priority</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Mobile Shell ──────────────────────────────────────────────────────────────
const TABS = [
  { key: 'clock',    icon: '⏱',  label: 'Clock'     },
  { key: 'time',     icon: '📋',  label: 'Timesheet' },
  { key: 'leave',    icon: '🌴',  label: 'Leave'     },
  { key: 'tasks',    icon: '✅',  label: 'Tasks'     },
  { key: 'expense',  icon: '💷',  label: 'Expense'   },
  { key: 'notifs',   icon: '🔔',  label: 'Alerts'    },
] as const;

type TabKey = typeof TABS[number]['key'];

export default function MobileShell() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useAppStore();
  const [tab, setTab] = useState<TabKey>('clock');
  const { data: notifs } = useNotifications();
  const notifCount = ((notifs as any[]) ?? []).length;
  const { record } = useClockStatus();
  const isClockedIn = record && !record.clocked_out_at;

  const name = user?.email?.split('@')[0] ?? 'You';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: C.bg, color: C.text, fontFamily: 'Inter, system-ui, sans-serif', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 11, color: C.dim }}>{greeting},</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.text, lineHeight: 1.2 }}>{name}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isClockedIn && (
            <div style={{ background: C.success + '22', border: `1px solid ${C.success}44`, borderRadius: 20, padding: '3px 10px', fontSize: 11, color: C.success, fontWeight: 700 }}>
              🟢 Clocked in
            </div>
          )}
          <button type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            style={{ background: 'none', border: 'none', color: C.dim, cursor: 'pointer', fontSize: 18, padding: 4 }}>
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button type="button" onClick={logout}
            style={{ background: C.elevated, border: `1px solid ${C.border}`, borderRadius: 8, padding: '5px 10px', color: C.dim, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
            Out
          </button>
        </div>
      </div>

      {/* Screen content — scrollable */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'clock'   && <ClockScreen />}
        {tab === 'time'    && <TimesheetScreen />}
        {tab === 'leave'   && <LeaveScreen />}
        {tab === 'tasks'   && <TasksScreen />}
        {tab === 'expense' && <ExpenseScreen />}
        {tab === 'notifs'  && <NotifScreen />}
      </div>

      {/* Bottom tab bar */}
      <div style={{ background: C.surface, borderTop: `1px solid ${C.border}`, display: 'flex', flexShrink: 0, paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {TABS.map(t => {
          const active = tab === t.key;
          const badge  = t.key === 'notifs' && notifCount > 0;
          return (
            <button key={t.key} type="button" onClick={() => setTab(t.key)}
              style={{ flex: 1, background: 'none', border: 'none', padding: '10px 2px 8px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, position: 'relative' }}>
              {badge && (
                <div style={{ position: 'absolute', top: 6, right: '20%', width: 8, height: 8, borderRadius: '50%', background: C.danger }} />
              )}
              <span style={{ fontSize: 20 }}>{t.icon}</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: active ? C.primary : C.dim, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {t.label}
              </span>
              {active && (
                <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 2, background: C.primary, borderRadius: '0 0 2px 2px' }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
