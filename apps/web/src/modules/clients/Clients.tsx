import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  useClients, useClient,
  useCreateClient, useUpdateClient, useDeactivateClient,
  useCreateClientContact, useUpdateClientContact, useDeleteClientContact,
} from '../../hooks/api';
import {
  Card, Modal, FormField, Avatar, Loading, Alert, Btn,
  inputStyle, selectStyle, C, fmtDate,
} from '../../components/ui';
import { PermissionGate, usePermission, PERMISSIONS } from '../../platform/permissions/index';
import { useQueryClient } from '@tanstack/react-query';

const INDUSTRIES = [
  'Technology', 'Manufacturing', 'Logistics & Supply Chain', 'Healthcare',
  'Financial Services', 'Retail', 'Construction', 'Education',
  'Professional Services', 'Energy & Utilities', 'Media', 'Other',
];

const CONTACT_TYPE_LABELS: Record<string, string> = {
  liaison: 'Liaison', finance: 'Finance', technical: 'Technical',
  executive: 'Executive', other: 'Other',
};

const CONTACT_TYPE_COLORS: Record<string, string> = {
  liaison: C.primary, finance: C.success, technical: C.purple,
  executive: C.amber, other: C.muted,
};

// ── Clients list ──────────────────────────────────────────────
// ── Shared layout helpers (module-level so they have stable identity) ──────────
function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{children}</div>;
}

// ── Client form modal ─────────────────────────────────────────
function ClientFormModal({ client, onClose }: { client?: any; onClose: () => void }) {
  const qc     = useQueryClient();
  const create = useCreateClient();
  const update = useUpdateClient();

  const [errMsg, setErrMsg] = useState('');
  const [saving, setSaving] = useState(false);
  // Freeze the client prop in a ref — parent re-renders won't change this
  const clientRef = useRef(client);
  const cl = clientRef.current;

  const [form, setForm] = useState({
    company_name: cl?.company_name ?? '', trading_name: cl?.trading_name ?? '',
    industry: cl?.industry ?? '', website: cl?.website ?? '',
    reg_address_line1: cl?.reg_address_line1 ?? '', reg_address_line2: cl?.reg_address_line2 ?? '',
    reg_city: cl?.reg_city ?? '', reg_county: cl?.reg_county ?? '',
    reg_postcode: cl?.reg_postcode ?? '', reg_country: cl?.reg_country ?? 'United Kingdom',
    company_reg_number: cl?.company_reg_number ?? '', vat_number: cl?.vat_number ?? '',
    payment_terms_days: cl?.payment_terms_days ?? 30, currency_code: cl?.currency_code ?? 'GBP',
    invoice_email: cl?.invoice_email ?? '', invoice_cc: cl?.invoice_cc ?? '',
    notes: cl?.notes ?? '', is_active: cl?.is_active !== false,
  });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.company_name.trim()) { setErrMsg('Company name is required'); return; }
    setSaving(true); setErrMsg('');
    try {
      if (client?.id) {
        await update.mutateAsync({ id: client.id, ...form } as any);
      } else {
        await create.mutateAsync(form as any);
      }
      qc.invalidateQueries({ queryKey: ['clients'] });
      if (client?.id) qc.invalidateQueries({ queryKey: ['client', client.id] });
      onClose();
    } catch (e: any) { setErrMsg(e.message ?? 'Failed to save'); }
    finally { setSaving(false); }
  };

  // Portal renders outside parent DOM tree — parent re-renders can't unmount this
  return createPortal(
    <Modal title={clientRef.current ? 'Edit client' : 'New client'} onClose={onClose} wide>
      {errMsg && <Alert type="error" message={errMsg} />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Company</div>
        <Row>
          <FormField label="Company name" required><input style={inputStyle} value={form.company_name} onChange={e => set('company_name', e.target.value)} /></FormField>
          <FormField label="Trading name"><input style={inputStyle} value={form.trading_name} onChange={e => set('trading_name', e.target.value)} /></FormField>
        </Row>
        <Row>
          <FormField label="Industry">
            <select style={selectStyle} value={form.industry} onChange={e => set('industry', e.target.value)}>
              <option value="">Select…</option>
              {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </FormField>
          <FormField label="Website"><input style={inputStyle} type="url" value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://" /></FormField>
        </Row>

        <div style={{ fontSize: 11, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }}>Registered address</div>
        <FormField label="Address line 1"><input style={inputStyle} value={form.reg_address_line1} onChange={e => set('reg_address_line1', e.target.value)} /></FormField>
        <FormField label="Address line 2"><input style={inputStyle} value={form.reg_address_line2} onChange={e => set('reg_address_line2', e.target.value)} /></FormField>
        <Row>
          <FormField label="City"><input style={inputStyle} value={form.reg_city} onChange={e => set('reg_city', e.target.value)} /></FormField>
          <FormField label="County"><input style={inputStyle} value={form.reg_county} onChange={e => set('reg_county', e.target.value)} /></FormField>
        </Row>
        <Row>
          <FormField label="Postcode"><input style={inputStyle} value={form.reg_postcode} onChange={e => set('reg_postcode', e.target.value)} /></FormField>
          <FormField label="Country"><input style={inputStyle} value={form.reg_country} onChange={e => set('reg_country', e.target.value)} /></FormField>
        </Row>

        <div style={{ fontSize: 11, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }}>Statutory & billing</div>
        <Row>
          <FormField label="Company reg. no."><input style={inputStyle} value={form.company_reg_number} onChange={e => set('company_reg_number', e.target.value)} /></FormField>
          <FormField label="VAT number"><input style={inputStyle} value={form.vat_number} onChange={e => set('vat_number', e.target.value)} /></FormField>
        </Row>
        <Row>
          <FormField label="Currency">
            <select style={selectStyle} value={form.currency_code} onChange={e => set('currency_code', e.target.value)}>
              <option value="GBP">GBP £</option><option value="EUR">EUR €</option>
              <option value="USD">USD $</option><option value="INR">INR ₹</option>
            </select>
          </FormField>
          <FormField label="Payment terms (days)"><input style={inputStyle} type="number" min={0} max={365} value={form.payment_terms_days} onChange={e => set('payment_terms_days', +e.target.value)} /></FormField>
        </Row>
        <Row>
          <FormField label="Invoice email"><input style={inputStyle} type="email" value={form.invoice_email} onChange={e => set('invoice_email', e.target.value)} /></FormField>
          <FormField label="Invoice CC"><input style={inputStyle} type="email" value={form.invoice_cc} onChange={e => set('invoice_cc', e.target.value)} /></FormField>
        </Row>
        <FormField label="Notes"><textarea style={{ ...inputStyle, height: 64, resize: 'vertical' }} value={form.notes} onChange={e => set('notes', e.target.value)} /></FormField>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : client ? 'Save changes' : '+ Create client'}</Btn>
      </div>
    </Modal>,
    document.body
  );
}

// ── Contact form modal ────────────────────────────────────────
function ContactFormModal({ clientId, contact, onClose }: { clientId: string; contact?: any; onClose: () => void }) {
  const qc     = useQueryClient();
  const create = useCreateClientContact();
  const update = useUpdateClientContact();

  const [errMsg, setErrMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const contactRef = useRef(contact);
  const ct = contactRef.current;

  const [form, setForm] = useState({
    full_name: ct?.full_name ?? '', job_title: ct?.job_title ?? '',
    email: ct?.email ?? '', phone: ct?.phone ?? '',
    contact_type: ct?.contact_type ?? 'liaison',
    is_primary_liaison: ct?.is_primary_liaison ?? false,
    is_primary_finance:  ct?.is_primary_finance  ?? false,
    notes: ct?.notes ?? '',
  });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.full_name.trim()) { setErrMsg('Full name is required'); return; }
    setSaving(true); setErrMsg('');
    try {
      if (contactRef.current?.id) {
        await update.mutateAsync({ clientId, contactId: contactRef.current.id, ...form } as any);
      } else {
        await create.mutateAsync({ clientId, ...form } as any);
      }
      qc.invalidateQueries({ queryKey: ['client', clientId] });
      onClose();
    } catch (e: any) { setErrMsg(e.message ?? 'Failed to save'); }
    finally { setSaving(false); }
  };

  return createPortal(
    <Modal title={contactRef.current ? 'Edit contact' : 'Add contact'} onClose={onClose}>
      {errMsg && <Alert type="error" message={errMsg} />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Full name" required><input style={inputStyle} value={form.full_name} onChange={e => set('full_name', e.target.value)} /></FormField>
          <FormField label="Job title"><input style={inputStyle} value={form.job_title} onChange={e => set('job_title', e.target.value)} /></FormField>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Email"><input style={inputStyle} type="email" value={form.email} onChange={e => set('email', e.target.value)} /></FormField>
          <FormField label="Phone"><input style={inputStyle} value={form.phone} onChange={e => set('phone', e.target.value)} /></FormField>
        </div>
        <FormField label="Contact type">
          <select style={selectStyle} value={form.contact_type} onChange={e => set('contact_type', e.target.value)}>
            {Object.entries(CONTACT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </FormField>
        <div style={{ display: 'flex', gap: 20 }}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: C.muted, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.is_primary_liaison} onChange={e => set('is_primary_liaison', e.target.checked)} /> Primary liaison
          </label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: C.muted, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.is_primary_finance} onChange={e => set('is_primary_finance', e.target.checked)} /> Primary finance
          </label>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : contact ? 'Save changes' : '+ Add contact'}</Btn>
      </div>
    </Modal>,
    document.body
  );
}

export default function ClientsModule() {
  const { can } = usePermission();
  const [search, setSearch]             = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [selectedId, setSelectedId]     = useState<string | null>(null);
  const [showCreate, setShowCreate]     = useState(false);

  // Debounce search so typing doesn't trigger re-renders/re-fetches on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useClients({ search: debouncedSearch, active: !showInactive });
  const clients: any[] = (data as any)?.clients ?? [];

  if (selectedId) return (
    <ClientDetail clientId={selectedId} onBack={() => setSelectedId(null)} />
  );

  return (
    <div className="animate-fadeIn">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
        <div>
          <h2 style={{ color: C.text, fontSize: 20, fontWeight: 800, margin: 0 }}>Clients</h2>
          <p style={{ color: C.muted, fontSize: 12, margin: '4px 0 0' }}>
            Company records, contacts and invoice history
          </p>
        </div>
        <PermissionGate permission={PERMISSIONS.CLIENT_CREATE}>
          {can(PERMISSIONS.CLIENT_CREATE) && <Btn onClick={() => setShowCreate(true)}>+ New Client</Btn>}
        </PermissionGate>
      </div>

      {/* Search + filter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          style={{ ...inputStyle, flex: 1, maxWidth: 320 }}
          placeholder="Search clients…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.muted, cursor: 'pointer' }}>
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
          Show inactive
        </label>
      </div>

      {isLoading ? <Loading /> : (
        <>
          {clients.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: C.dim }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🏢</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: C.text, marginBottom: 6 }}>No clients yet</div>
              <div style={{ fontSize: 13, marginBottom: 20 }}>Add your first client to start linking projects and generating invoices.</div>
              <PermissionGate permission={PERMISSIONS.CLIENT_CREATE}>
                {can(PERMISSIONS.CLIENT_CREATE) && <Btn onClick={() => setShowCreate(true)}>+ New Client</Btn>}
              </PermissionGate>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {clients.map((c: any) => (
              <ClientCard key={c.id} client={c} onClick={() => setSelectedId(c.id)} />
            ))}
          </div>
        </>
      )}

      {showCreate && <ClientFormModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}

// ── Client card ───────────────────────────────────────────────
function ClientCard({ client: c, onClick }: { client: any; onClick: () => void }) {
  return (
    <Card onClick={onClick} style={{ cursor: 'pointer', transition: 'border-color 0.15s' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 10 }}>
        <Avatar name={c.company_name} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {c.company_name}
          </div>
          {c.trading_name && (
            <div style={{ fontSize: 11, color: C.dim }}>t/a {c.trading_name}</div>
          )}
        </div>
        {!c.is_active && (
          <span style={{ fontSize: 10, padding: '2px 8px', background: C.elevated, borderRadius: 20, color: C.dim }}>Inactive</span>
        )}
      </div>

      {c.industry && (
        <span style={{ fontSize: 11, padding: '2px 10px', background: C.primary + '22', color: C.primary, borderRadius: 20 }}>
          {c.industry}
        </span>
      )}

      <div style={{ marginTop: 10, display: 'flex', gap: 16 }}>
        {c.primary_liaison_name && (
          <div>
            <div style={{ fontSize: 10, color: C.dim }}>Liaison</div>
            <div style={{ fontSize: 12, color: C.text }}>{c.primary_liaison_name}</div>
          </div>
        )}
        {c.primary_finance_name && (
          <div>
            <div style={{ fontSize: 10, color: C.dim }}>Finance</div>
            <div style={{ fontSize: 12, color: C.text }}>{c.primary_finance_name}</div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}`, display: 'flex', gap: 16 }}>
        <span style={{ fontSize: 11, color: C.dim }}>{c.project_count ?? 0} projects</span>
        <span style={{ fontSize: 11, color: C.dim }}>{c.invoice_count ?? 0} invoices</span>
      </div>
    </Card>
  );
}

// ── Client detail ─────────────────────────────────────────────
function ClientDetail({ clientId, onBack }: { clientId: string; onBack: () => void }) {
  const [tab, setTab]     = useState<'overview'|'contacts'|'projects'>('overview');
  const [editing, setEditing]           = useState(false);
  const [showContact, setShowContact]   = useState(false);
  const [editContact, setEditContact]   = useState<any>(null);
  const { data: client, isLoading }     = useClient(clientId);

  if (isLoading) return <Loading />;
  if (!client)   return <Alert type="error" message="Client not found" />;

  const TABS = [
    { key: 'overview',  label: 'Overview' },
    { key: 'contacts',  label: `Contacts (${(client as any).contacts?.length ?? 0})` },
    { key: 'projects',  label: `Projects (${(client as any).projects?.length ?? 0})` },
  ];

  return (
    <div className="animate-fadeIn">
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 12, marginBottom: 16, padding: 0 }}>
        ← Back to clients
      </button>

      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 20 }}>
        <Avatar name={(client as any).company_name} size={52} />
        <div style={{ flex: 1 }}>
          <h2 style={{ color: C.text, fontSize: 20, fontWeight: 800, margin: 0 }}>{(client as any).company_name}</h2>
          {(client as any).trading_name && <div style={{ fontSize: 12, color: C.dim }}>t/a {(client as any).trading_name}</div>}
          {(client as any).industry && <div style={{ fontSize: 12, color: C.primary, marginTop: 2 }}>{(client as any).industry}</div>}
        </div>
        <PermissionGate permission={PERMISSIONS.CLIENT_EDIT}>
          <Btn variant="secondary" onClick={() => setEditing(true)}>Edit</Btn>
        </PermissionGate>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)} style={{
            background: tab === t.key ? C.primary : C.elevated,
            color:      tab === t.key ? '#fff'    : C.muted,
            border: `1px solid ${tab === t.key ? C.primary : C.border}`,
            borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'overview' && <ClientOverview client={client as any} />}
      {tab === 'contacts' && (
        <ClientContacts
          client={client as any}
          onAdd={() => setShowContact(true)}
          onEdit={ct => setEditContact(ct)}
        />
      )}
      {tab === 'projects' && <ClientProjects projects={(client as any).projects ?? []} />}

      {editing    && <ClientFormModal client={client as any} onClose={() => setEditing(false)} />}
      {showContact && <ContactFormModal clientId={clientId} onClose={() => setShowContact(false)} />}
      {editContact && <ContactFormModal clientId={clientId} contact={editContact} onClose={() => setEditContact(null)} />}
    </div>
  );
}

function InfoPair({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>
      <span style={{ fontSize: 12, color: C.dim }}>{label}</span>
      <span style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function ClientOverview({ client: c }: { client: any }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <Card>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Registered address</div>
        <InfoPair label="Address"  value={[c.reg_address_line1, c.reg_address_line2].filter(Boolean).join(', ')} />
        <InfoPair label="City"     value={c.reg_city} />
        <InfoPair label="County"   value={c.reg_county} />
        <InfoPair label="Postcode" value={c.reg_postcode} />
        <InfoPair label="Country"  value={c.reg_country} />
      </Card>
      <Card>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Statutory & billing</div>
        <InfoPair label="Co. reg. no."     value={c.company_reg_number} />
        <InfoPair label="VAT number"       value={c.vat_number} />
        <InfoPair label="Currency"         value={c.currency_code} />
        <InfoPair label="Payment terms"    value={c.payment_terms_days ? `${c.payment_terms_days} days` : null} />
        <InfoPair label="Invoice email"    value={c.invoice_email} />
      </Card>
    </div>
  );
}

function ClientContacts({ client, onAdd, onEdit }: { client: any; onAdd: () => void; onEdit: (c: any) => void }) {
  const deleteContact = useDeleteClientContact();
  const contacts: any[] = client.contacts ?? [];
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <PermissionGate permission={PERMISSIONS.CLIENT_EDIT}>
          <Btn onClick={onAdd}>+ Add Contact</Btn>
        </PermissionGate>
      </div>
      {contacts.length === 0 && (
        <div style={{ color: C.dim, fontSize: 13, textAlign: 'center', padding: '30px 0' }}>No contacts yet.</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {contacts.map((ct: any) => (
          <Card key={ct.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <Avatar name={ct.full_name} size={40} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{ct.full_name}</span>
                <span style={{ fontSize: 10, padding: '1px 8px', borderRadius: 20, background: CONTACT_TYPE_COLORS[ct.contact_type] + '22', color: CONTACT_TYPE_COLORS[ct.contact_type] }}>
                  {CONTACT_TYPE_LABELS[ct.contact_type]}
                </span>
                {ct.is_primary_liaison ? <span style={{ fontSize: 10, color: C.primary }}>● Primary liaison</span> : null}
                {ct.is_primary_finance ? <span style={{ fontSize: 10, color: C.success }}>● Primary finance</span> : null}
              </div>
              {ct.job_title && <div style={{ fontSize: 11, color: C.muted }}>{ct.job_title}</div>}
              <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                {ct.email && <a href={`mailto:${ct.email}`} style={{ fontSize: 11, color: C.primary }}>{ct.email}</a>}
                {ct.phone && <span style={{ fontSize: 11, color: C.dim }}>{ct.phone}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <PermissionGate permission={PERMISSIONS.CLIENT_EDIT}>
                <button onClick={() => onEdit(ct)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 14 }}>✏️</button>
                <button onClick={() => deleteContact.mutate({ clientId: client.id, contactId: ct.id } as any)} style={{ background: 'none', border: 'none', color: C.danger, cursor: 'pointer', fontSize: 14 }}>🗑</button>
              </PermissionGate>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ClientProjects({ projects }: { projects: any[] }) {
  if (projects.length === 0) return <div style={{ color: C.dim, fontSize: 13, textAlign: 'center', padding: '30px 0' }}>No projects linked.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {projects.map((p: any) => (
        <Card key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{p.name}</span>
          <span style={{ fontSize: 11, color: C.dim }}>{p.start_date} → {p.end_date}</span>
        </Card>
      ))}
    </div>
  );
}

