import { useState, useEffect } from 'react';
import {
  useInvoices, useInvoice, useInvoiceEvents,
  useCreateInvoice, useUpdateInvoice,
  useSendInvoice, useMarkInvoicePaid, useVoidInvoice,
  usePullTimesheets, useClients,
} from '../../hooks/api';
import {
  Card, Modal, FormField, Loading, Alert, Btn, MetricCard, MetricGrid,
  inputStyle, selectStyle, C, fmtDate,
} from '../../components/ui';
import { PermissionGate, usePermission, PERMISSIONS } from '../../platform/permissions/index';
import { useQueryClient } from '@tanstack/react-query';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:   { label: 'Draft',   color: C.dim },
  sent:    { label: 'Sent',    color: C.primary },
  viewed:  { label: 'Viewed',  color: C.info },
  paid:    { label: 'Paid',    color: C.success },
  overdue: { label: 'Overdue', color: C.danger },
  void:    { label: 'Void',    color: C.dim },
};

function StatusPill({ status }: { status: string }) {
  const s = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <span style={{
      background: s.color + '22', color: s.color,
      border: `1px solid ${s.color}44`,
      borderRadius: 6, fontSize: 10, fontWeight: 700,
      padding: '2px 8px', textTransform: 'uppercase',
    }}>{s.label}</span>
  );
}

function fmtCcy(n: number, code = 'GBP') {
  return `${code === 'GBP' ? '£' : code} ${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Invoice list ──────────────────────────────────────────────
export default function InvoicingModule() {
  const { can } = usePermission();
  const [filterStatus, setFilterStatus]   = useState('');
  const [filterClient, setFilterClient]   = useState('');
  const [editingId, setEditingId]         = useState<string | null | 'new'>( null);

  const { data, isLoading }    = useInvoices({ status: filterStatus || undefined, client_id: filterClient || undefined });
  const { data: clientsData }  = useClients({});
  const invoices: any[]        = (data as any)?.invoices ?? [];
  const clients: any[]         = (clientsData as any)?.clients ?? [];

  // Summary totals
  const totals = invoices.reduce((acc: any, inv: any) => {
    if (inv.status !== 'void') acc.total += inv.total ?? 0;
    if (inv.status === 'paid')    acc.paid   += inv.total ?? 0;
    if (inv.status === 'overdue') acc.overdue += inv.total ?? 0;
    return acc;
  }, { total: 0, paid: 0, overdue: 0 });

  if (editingId !== null) return (
    <InvoiceEditor
      invoiceId={editingId === 'new' ? null : editingId}
      onBack={() => setEditingId(null)}
    />
  );

  return (
    <div className="animate-fadeIn">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
        <div>
          <h2 style={{ color: C.text, fontSize: 20, fontWeight: 800, margin: 0 }}>Invoicing</h2>
          <p style={{ color: C.muted, fontSize: 12, margin: '4px 0 0' }}>Create, send and track client invoices</p>
        </div>
        <PermissionGate permission={PERMISSIONS.INV_CREATE}>
          <Btn onClick={() => setEditingId('new')}>+ New Invoice</Btn>
        </PermissionGate>
      </div>

      <MetricGrid>
        <MetricCard label="Total invoiced" value={`£${totals.total.toLocaleString('en-GB', { minimumFractionDigits: 0 })}`} icon="🧾" color={`linear-gradient(135deg,${C.primary},#8B5CF6)`} />
        <MetricCard label="Paid"           value={`£${totals.paid.toLocaleString('en-GB', { minimumFractionDigits: 0 })}`}  icon="✅" color={`linear-gradient(135deg,${C.success},${C.secondary})`} />
        <MetricCard label="Overdue"        value={`£${totals.overdue.toLocaleString('en-GB', { minimumFractionDigits: 0 })}`} icon="⚠️" color={`linear-gradient(135deg,${C.danger},${C.warning})`} />
        <MetricCard label="Invoices"       value={invoices.length}    icon="📄" color={`linear-gradient(135deg,${C.sky},${C.primary})`} />
      </MetricGrid>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <select style={{ ...selectStyle, width: 'auto' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select style={{ ...selectStyle, width: 'auto' }} value={filterClient} onChange={e => setFilterClient(e.target.value)}>
          <option value="">All clients</option>
          {clients.map((c: any) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
        </select>
      </div>

      {isLoading ? <Loading /> : (
        <>
          {invoices.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: C.dim }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🧾</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: C.text, marginBottom: 6 }}>No invoices yet</div>
              <div style={{ fontSize: 13, marginBottom: 20 }}>Create your first invoice and pull hours from approved timesheets.</div>
              <PermissionGate permission={PERMISSIONS.INV_CREATE}>
                <Btn onClick={() => setEditingId('new')}>+ New Invoice</Btn>
              </PermissionGate>
            </div>
          )}
          {invoices.length > 0 && (
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: C.elevated }}>
                    {['Invoice #', 'Client', 'Issued', 'Due', 'Amount', 'Status', ''].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: C.dim, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `1px solid ${C.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv: any) => (
                    <tr key={inv.id}
                      style={{ cursor: 'pointer', borderBottom: `1px solid ${C.border}` }}
                      onClick={() => setEditingId(inv.id)}
                      onMouseEnter={e => (e.currentTarget.style.background = C.elevated)}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}
                    >
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: C.text }}>{inv.invoice_number}</td>
                      <td style={{ padding: '12px 14px', color: C.muted }}>{inv.client_name}</td>
                      <td style={{ padding: '12px 14px', color: C.dim }}>{fmtDate(inv.issue_date)}</td>
                      <td style={{ padding: '12px 14px', color: inv.status === 'overdue' ? C.danger : C.dim }}>{fmtDate(inv.due_date)}</td>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: C.text }}>{fmtCcy(inv.total ?? 0, inv.currency_code)}</td>
                      <td style={{ padding: '12px 14px' }}><StatusPill status={inv.status} /></td>
                      <td style={{ padding: '12px 14px', color: C.dim, fontSize: 12 }}>→</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ── Invoice editor ────────────────────────────────────────────
function InvoiceEditor({ invoiceId, onBack }: { invoiceId: string | null; onBack: () => void }) {
  const isNew = !invoiceId;
  const qc    = useQueryClient();
  const { data: invoice, isLoading } = useInvoice(invoiceId ?? undefined);
  const { data: events }             = useInvoiceEvents(invoiceId ?? undefined);
  const { data: clientsData }        = useClients({});
  const clients: any[]               = (clientsData as any)?.clients ?? [];

  const createInvoice = useCreateInvoice();
  const updateInvoice = useUpdateInvoice();
  const markPaid      = useMarkInvoicePaid();
  const voidInvoice   = useVoidInvoice();

  const [showSend, setShowSend]   = useState(false);
  const [showPull, setShowPull]   = useState(false);
  const [savedMsg, setSavedMsg]   = useState('');
  const [currentId, setCurrentId] = useState<string | null>(invoiceId);

  const [form, setForm] = useState<any>({
    client_id: '', issue_date: today(), due_date: offsetDate(today(), 30),
    tax_rate: 20, notes_to_client: '', internal_notes: '', lines: [],
  });

  useEffect(() => {
    if (invoice) {
      setForm({
        client_id:       (invoice as any).client_id,
        issue_date:      (invoice as any).issue_date,
        due_date:        (invoice as any).due_date,
        tax_rate:        (invoice as any).tax_rate,
        notes_to_client: (invoice as any).notes_to_client ?? '',
        internal_notes:  (invoice as any).internal_notes  ?? '',
        lines: ((invoice as any).lines ?? []).map((l: any) => ({ ...l })),
      });
    }
  }, [invoice]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const subtotal  = form.lines.reduce((s: number, l: any) => s + (l.quantity ?? 0) * (l.unit_price ?? 0), 0);
  const taxAmount = subtotal * ((form.tax_rate ?? 0) / 100);
  const total     = subtotal + taxAmount;

  const addLine   = () => setForm((f: any) => ({ ...f, lines: [...f.lines, { _new: true, description: '', quantity: 1, unit_price: 0 }] }));
  const setLine   = (i: number, k: string, v: any) => setForm((f: any) => { const ls = [...f.lines]; ls[i] = { ...ls[i], [k]: v }; return { ...f, lines: ls }; });
  const removeLine = (i: number) => setForm((f: any) => ({ ...f, lines: f.lines.filter((_: any, j: number) => j !== i) }));

  const handleSave = async () => {
    if (currentId) {
      await updateInvoice.mutateAsync({ id: currentId, ...form } as any);
      setSavedMsg('Saved'); setTimeout(() => setSavedMsg(''), 2000);
    } else {
      const result: any = await createInvoice.mutateAsync(form as any);
      setCurrentId(result.id);
      qc.invalidateQueries({ queryKey: ['invoices'] });
      setSavedMsg('Created'); setTimeout(() => setSavedMsg(''), 2000);
    }
  };

  const isLocked = (invoice as any)?.status === 'void';

  if (!isNew && isLoading) return <Loading />;

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 12, padding: 0 }}>← Back</button>
        <h2 style={{ color: C.text, fontSize: 18, fontWeight: 800, margin: 0, flex: 1 }}>
          {isNew ? 'New invoice' : (invoice as any)?.invoice_number ?? 'Invoice'}
        </h2>
        {invoice && <StatusPill status={(invoice as any).status} />}
        <div style={{ display: 'flex', gap: 8 }}>
          {!isLocked && (
            <Btn variant="secondary" onClick={handleSave} disabled={createInvoice.isPending || updateInvoice.isPending}>
              {savedMsg || (createInvoice.isPending || updateInvoice.isPending ? 'Saving...' : 'Save draft')}
            </Btn>
          )}
          {currentId && !isLocked && (
            <PermissionGate permission={PERMISSIONS.INV_SEND}>
              <Btn onClick={() => setShowSend(true)}>Send invoice</Btn>
            </PermissionGate>
          )}
          {currentId && (invoice as any)?.status === 'sent' && (
            <PermissionGate permission={PERMISSIONS.INV_EDIT}>
              <Btn onClick={() => markPaid.mutate({ id: currentId } as any)}>Mark paid</Btn>
            </PermissionGate>
          )}
          {currentId && !isLocked && (
            <PermissionGate permission={PERMISSIONS.INV_VOID}>
              <button onClick={() => { if (confirm('Void this invoice?')) voidInvoice.mutate({ id: currentId! } as any); }}
                style={{ background: C.danger + '11', color: C.danger, border: `1px solid ${C.danger}33`, borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                Void
              </button>
            </PermissionGate>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20 }}>
        {/* Main */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Invoice details</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <FormField label="Client" required>
                <select style={selectStyle} value={form.client_id} onChange={e => set('client_id', e.target.value)} disabled={isLocked}>
                  <option value="">Select client…</option>
                  {clients.map((c: any) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                </select>
              </FormField>
              <FormField label="Issue date">
                <input style={inputStyle} type="date" value={form.issue_date} onChange={e => set('issue_date', e.target.value)} disabled={isLocked} />
              </FormField>
              <FormField label="Due date">
                <input style={inputStyle} type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} disabled={isLocked} />
              </FormField>
            </div>
            <div style={{ marginTop: 12, maxWidth: 150 }}>
              <FormField label="VAT rate %">
                <input style={inputStyle} type="number" min={0} max={100} step={0.5} value={form.tax_rate} onChange={e => set('tax_rate', +e.target.value)} disabled={isLocked} />
              </FormField>
            </div>
          </Card>

          {/* Line items */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Line items</div>
              {!isLocked && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setShowPull(true)} style={{ background: C.purple + '22', color: C.purple, border: `1px solid ${C.purple}44`, borderRadius: 8, padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                    ⬇ Pull timesheets
                  </button>
                  <Btn small onClick={addLine}>+ Add line</Btn>
                </div>
              )}
            </div>

            {form.lines.length === 0 && (
              <div style={{ color: C.dim, fontSize: 12, textAlign: 'center', padding: '20px 0' }}>
                No lines yet — add a line or pull from approved timesheets.
              </div>
            )}

            {form.lines.length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    {['Description', 'Qty', 'Unit price', 'Amount', ''].map(h => (
                      <th key={h} style={{ padding: '4px 6px', textAlign: 'left', color: C.dim, fontWeight: 600, fontSize: 11, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {form.lines.map((line: any, i: number) => (
                    <tr key={i}>
                      <td style={{ padding: '5px 4px' }}>
                        <input style={{ ...inputStyle, minWidth: 180 }} value={line.description} onChange={e => setLine(i, 'description', e.target.value)} disabled={isLocked} placeholder="Service description" />
                      </td>
                      <td style={{ padding: '5px 4px' }}>
                        <input style={{ ...inputStyle, width: 65, textAlign: 'right' }} type="number" min={0} step={0.5} value={line.quantity} onChange={e => setLine(i, 'quantity', +e.target.value)} disabled={isLocked} />
                      </td>
                      <td style={{ padding: '5px 4px' }}>
                        <input style={{ ...inputStyle, width: 90, textAlign: 'right' }} type="number" min={0} step={0.01} value={line.unit_price} onChange={e => setLine(i, 'unit_price', +e.target.value)} disabled={isLocked} />
                      </td>
                      <td style={{ padding: '5px 8px', fontWeight: 700, color: C.text, whiteSpace: 'nowrap' }}>
                        £{((line.quantity ?? 0) * (line.unit_price ?? 0)).toFixed(2)}
                      </td>
                      <td style={{ padding: '5px 4px' }}>
                        {!isLocked && (
                          <button onClick={() => removeLine(i)} style={{ background: 'none', border: 'none', color: C.danger, cursor: 'pointer', fontSize: 14 }}>✕</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Totals */}
            <div style={{ marginTop: 16, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
              {[
                { label: 'Subtotal', value: subtotal },
                { label: `VAT (${form.tax_rate}%)`, value: taxAmount },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 12, color: C.dim }}>
                  <span>{label}</span><span>£{value.toFixed(2)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 0', fontSize: 18, fontWeight: 800, color: C.text }}>
                <span>Total</span><span>£{total.toFixed(2)}</span>
              </div>
            </div>
          </Card>

          {/* Notes */}
          <Card>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Notes</div>
            <FormField label="Note to client (printed on invoice)">
              <textarea style={{ ...inputStyle, height: 64, resize: 'vertical' }} value={form.notes_to_client} onChange={e => set('notes_to_client', e.target.value)} disabled={isLocked} />
            </FormField>
            <div style={{ marginTop: 10 }}>
              <FormField label="Internal note (not printed)">
                <textarea style={{ ...inputStyle, height: 48, resize: 'vertical' }} value={form.internal_notes} onChange={e => set('internal_notes', e.target.value)} />
              </FormField>
            </div>
          </Card>
        </div>

        {/* Sidebar — activity */}
        <div>
          <Card>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Activity</div>
            {!events || (events as any[]).length === 0 ? (
              <div style={{ fontSize: 12, color: C.dim }}>No activity yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {(events as any[]).map((ev: any) => (
                  <div key={ev.id} style={{ borderLeft: `2px solid ${C.border}`, paddingLeft: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.text, textTransform: 'capitalize' }}>{ev.event_type}</div>
                    {ev.actor_name && <div style={{ fontSize: 11, color: C.dim }}>by {ev.actor_name}</div>}
                    {ev.note        && <div style={{ fontSize: 11, color: C.muted }}>{ev.note}</div>}
                    <div style={{ fontSize: 10, color: C.dim }}>{fmtDate(ev.created_at)}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {showSend && currentId && (
        <SendModal invoiceId={currentId} onClose={() => setShowSend(false)} onSent={onBack} />
      )}
      {showPull && (
        <PullModal
          clientId={form.client_id}
          onClose={() => setShowPull(false)}
          onApply={(lines: any[]) => { setForm((f: any) => ({ ...f, lines: [...f.lines, ...lines] })); setShowPull(false); }}
        />
      )}
    </div>
  );
}

// ── Send modal ────────────────────────────────────────────────
function SendModal({ invoiceId, onClose, onSent }: any) {
  const send = useSendInvoice();
  // Always fetch fresh detail — never rely on prop which may be stale
  const { data: inv, isLoading } = useInvoice(invoiceId);
  const invoice: any = inv;

  // client.invoice_email comes from the detail query's joined client object
  const [to, setTo]   = useState('');
  const [cc, setCc]   = useState('');
  const [err, setErr] = useState('');

  // Populate To/CC once invoice detail loads
  useEffect(() => {
    if (!invoice?.client) return;
    setTo(invoice.client.invoice_email ?? '');
    setCc(invoice.client.invoice_cc   ?? '');
  }, [invoice?.id]);

  const handleSend = async () => {
    if (!to.trim()) { setErr('Recipient email is required'); return; }
    setErr('');
    try {
      // Only send to/cc — let the worker build subject + HTML from DB data
      // This avoids any stale/undefined values from the frontend
      await send.mutateAsync({ id: invoiceId, to: to.trim(), cc: cc.trim() || undefined } as any);
      onSent();
    } catch (e: any) { setErr(e.message ?? 'Failed to send'); }
  };

  if (isLoading) return (
    <Modal title="Send invoice" onClose={onClose}>
      <Loading text="Loading invoice details..." />
    </Modal>
  );
  if (!invoice) return null;

  const num    = invoice.invoice_number ?? '—';
  const total  = `${invoice.currency_code ?? 'GBP'} ${Number(invoice.total ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;
  const due    = invoice.due_date ?? '—';
  const client = invoice.client?.company_name ?? '—';

  return (
    <Modal title={`Send ${num}`} onClose={onClose}>
      {err && <Alert type="error" message={err} />}

      {/* Preview card */}
      <div style={{ background: C.elevated, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Invoice summary</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 13 }}>
          <span style={{ color: C.dim }}>Invoice</span>   <span style={{ color: C.text, fontWeight: 700 }}>{num}</span>
          <span style={{ color: C.dim }}>Client</span>    <span style={{ color: C.text }}>{client}</span>
          <span style={{ color: C.dim }}>Amount</span>    <span style={{ color: C.primary, fontWeight: 700 }}>{total}</span>
          <span style={{ color: C.dim }}>Due</span>       <span style={{ color: C.text }}>{due}</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <FormField label="To (recipient email) *">
          <input style={inputStyle} type="email" value={to} onChange={e => setTo(e.target.value)} placeholder="client@company.com" />
        </FormField>
        <FormField label="CC (optional)">
          <input style={inputStyle} type="email" value={cc} onChange={e => setCc(e.target.value)} placeholder="finance@company.com" />
        </FormField>
      </div>

      <div style={{ fontSize: 11, color: C.dim, marginTop: 12, padding: '8px 12px', background: C.elevated, borderRadius: 8 }}>
        📧 The email will contain a full invoice breakdown including all line items, totals, VAT and your bank details.
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn onClick={handleSend} disabled={send.isPending || !to.trim()}>
          {send.isPending ? 'Sending...' : `Send ${num}`}
        </Btn>
      </div>
    </Modal>
  );
}

// ── Pull timesheets modal ─────────────────────────────────────
function PullModal({ clientId, onClose, onApply }: any) {
  const pull = usePullTimesheets();
  const [from, setFrom]     = useState('');
  const [to, setTo]         = useState('');
  const [groupBy, setGroupBy] = useState<'employee'|'project'>('employee');
  const [proposed, setProposed] = useState<any[] | null>(null);
  const [err, setErr]       = useState('');

  const handleFetch = async () => {
    if (!clientId) { setErr('Select a client on the invoice first'); return; }
    if (!from || !to) { setErr('Both dates are required'); return; }
    setErr('');
    try {
      const result: any = await pull.mutateAsync({ client_id: clientId, from_date: from, to_date: to, group_by: groupBy } as any);
      setProposed(result.proposed_lines);
    } catch (e: any) { setErr(e.message ?? 'Failed'); }
  };

  return (
    <Modal title="Pull from approved timesheets" onClose={onClose}>
      {err && <Alert type="error" message={err} />}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <FormField label="From date"><input style={inputStyle} type="date" value={from} onChange={e => setFrom(e.target.value)} /></FormField>
        <FormField label="To date"><input style={inputStyle} type="date" value={to} onChange={e => setTo(e.target.value)} /></FormField>
      </div>
      <FormField label="Group lines by">
        <select style={selectStyle} value={groupBy} onChange={e => setGroupBy(e.target.value as any)}>
          <option value="employee">Employee</option>
          <option value="project">Project</option>
        </select>
      </FormField>
      <div style={{ marginTop: 12 }}>
        <Btn onClick={handleFetch} disabled={pull.isPending}>{pull.isPending ? 'Fetching...' : 'Fetch timesheet data'}</Btn>
      </div>

      {proposed !== null && (
        <div style={{ marginTop: 16 }}>
          {proposed.length === 0 ? (
            <Alert type="info" message="No approved timesheets found for this client in the selected period." />
          ) : (
            <>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>Found {proposed.length} proposed line{proposed.length !== 1 ? 's' : ''}:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                {proposed.map((l: any, i: number) => (
                  <div key={i} style={{ background: C.elevated, borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 700, fontSize: 12, color: C.text }}>{l.description}</span>
                      <span style={{ fontWeight: 700, color: C.primary }}>£{Number(l.amount).toFixed(2)}</span>
                    </div>
                    <div style={{ fontSize: 11, color: C.dim, marginTop: 3 }}>{l.quantity}h × £{l.unit_price}/h</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
                <Btn onClick={() => onApply(proposed)}>Add {proposed.length} line{proposed.length !== 1 ? 's' : ''} to invoice</Btn>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

// ── Helpers ───────────────────────────────────────────────────
function today() { return new Date().toISOString().split('T')[0]; }
function offsetDate(from: string, days: number) {
  const d = new Date(from); d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}
