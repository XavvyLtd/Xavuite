import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  useLeaveRequests, useLeaveDecision, useCreateLeave,
  useTimesheets, useTimesheetDecision, useBulkTimesheetDecision, useSubmitTimesheet,
  useExpenses, useExpenseDecision, useCreateExpense,
  useCompliance, useCreateRTW,
  useEmployees, useTasks,
  useLeaveTypes, useLeaveBalances, useEmployeeLeaveBalances, usePublicHolidays, useLeaveCalendar,
  useInitialiseLeaveBalances,
  type LeaveRequest, type Timesheet, type ExpenseClaim, type RTWCheck,
} from '../../hooks/api';
import {
  Card, DataTable, Tabs, Btn, Avatar, StatusBadge,
  Modal, InfoRow, MetricCard, MetricGrid, Loading, Alert,
  FormField, inputStyle, selectStyle, ProgressBar, C, fmtDate, ColDef
} from '../../components/ui';
import { useQueryClient } from '@tanstack/react-query';

function FormActions({ onCancel, onSave, saving, saveLabel='Save' }: { onCancel:()=>void; onSave:()=>void; saving:boolean; saveLabel?:string }) {
  return (
    <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:24 }}>
      <button onClick={onCancel} style={{background:'transparent',color:C.muted,border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:600,cursor:'pointer'}}>Cancel</button>
      <button onClick={onSave} disabled={saving} style={{background:saving?C.primary+'99':C.primary,color:'#fff',border:'none',borderRadius:8,padding:'8px 18px',fontSize:13,fontWeight:700,cursor:saving?'wait':'pointer'}}>{saving?'Saving...':saveLabel}</button>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// LEAVE
// ════════════════════════════════════════════════════════════════════════════
function AddLeaveModal({ onClose }: { onClose:()=>void }) {
  const create = useCreateLeave();
  const { user } = useAuth();
  const { data: balances } = useEmployeeLeaveBalances(user?.employeeId ?? '');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ leaveType:'annual', startDate:'', endDate:'', reason:'', halfDay:false });
  const set = (k:string,v:any) => setForm(f=>({...f,[k]:v}));
  const currentBalance = (balances??[]).find(b => b.code === form.leaveType || b.leave_type_name?.toLowerCase().includes(form.leaveType));
  const handleSave = async () => {
    if (!form.startDate||!form.endDate) { setErr('Start and end date are required'); return; }
    if (new Date(form.endDate)<new Date(form.startDate)) { setErr('End date must be after start date'); return; }
    setSaving(true); setErr('');
    try { await create.mutateAsync(form); onClose(); }
    catch(e:any) { setErr(e.message??'Failed'); } finally { setSaving(false); }
  };
  return (
    <Modal title="Request Leave" onClose={onClose}>
      {err && <Alert type="error" message={err} />}
      <FormField label="Leave Type" required>
        <select style={selectStyle} value={form.leaveType} onChange={e=>set('leaveType',e.target.value)}>
          <option value="annual">Annual Leave</option><option value="sick">Sick Leave</option>
          <option value="maternity">Maternity Leave</option><option value="paternity">Paternity Leave</option>
          <option value="compassionate">Compassionate Leave</option><option value="unpaid">Unpaid Leave</option>
        </select>
      </FormField>
      {currentBalance && (
        <div style={{ display:'flex', gap:16, background:C.surface, borderRadius:8, padding:'8px 14px', marginBottom:4, fontSize:12 }}>
          <span style={{ color:C.dim }}>Entitlement: <strong style={{color:C.text}}>{currentBalance.entitlement}d</strong></span>
          <span style={{ color:C.dim }}>Taken: <strong style={{color:C.danger}}>{currentBalance.taken}d</strong></span>
          <span style={{ color:C.dim }}>Remaining: <strong style={{color:currentBalance.remaining>5?C.success:currentBalance.remaining>0?C.warning:C.danger}}>{currentBalance.remaining}d</strong></span>
        </div>
      )}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <FormField label="From" required><input style={inputStyle} type="date" value={form.startDate} onChange={e=>set('startDate',e.target.value)} /></FormField>
        <FormField label="To" required><input style={inputStyle} type="date" value={form.endDate} onChange={e=>set('endDate',e.target.value)} /></FormField>
      </div>
      <FormField label="Reason"><textarea style={{...inputStyle,height:80,resize:'vertical'}} value={form.reason} onChange={e=>set('reason',e.target.value)} /></FormField>
      <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13,color:C.muted,cursor:'pointer'}}>
        <input type="checkbox" checked={form.halfDay} onChange={e=>set('halfDay',e.target.checked)} /> Half day
      </label>
      <FormActions onCancel={onClose} onSave={handleSave} saving={saving} saveLabel="Submit Request" />
    </Modal>
  );
}

export function LeaveModule() {
  const [tab, setTab] = useState('all');
  const [selected, setSelected] = useState<LeaveRequest|null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const params: Record<string,string> | undefined = tab==='mine'?{mine:'true'}:tab==='pending'?{status:'pending'}:undefined;
  const { data:leaves, isLoading, refetch } = useLeaveRequests(params);
  const decision = useLeaveDecision(selected?.id??'');
  const items = leaves??[];
  const pending = items.filter(l=>l.status==='pending');
  const approved = items.filter(l=>l.status==='approved');
  const now = new Date();
  const onLeaveNow = items.filter(l=>l.status==='approved'&&new Date(l.start_date)<=now&&new Date(l.end_date)>=now);
  const handleDecision = async (dec:'approved'|'declined') => {
    if (!selected) return;
    try { await decision.mutateAsync({decision:dec}); setSelected(null); refetch(); } catch(e:any) { alert(e.message); }
  };
  const cols: ColDef<LeaveRequest>[] = [
    { key:'employee_name', label:'Employee', render:v=><div style={{display:'flex',alignItems:'center',gap:8}}><Avatar name={v} size={28}/><span style={{fontWeight:600}}>{v}</span></div> },
    { key:'leave_type', label:'Type', render:v=>v?.replace(/_/g,' ') },
    { key:'start_date', label:'From', render:v=>fmtDate(v) },
    { key:'end_date',   label:'To',   render:v=>fmtDate(v) },
    { key:'days',       label:'Days', muted:true },
    { key:'status',     label:'Status', render:v=><StatusBadge status={v} /> },
  ];
  return (
    <div className="animate-fadeIn">
      <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',marginBottom:20}}>
        <div><h2 style={{color:C.text,fontSize:20,fontWeight:800,margin:0}}>Leave Management</h2>
        <p style={{color:C.muted,fontSize:12,margin:'4px 0 0'}}>Requests, approvals and balances</p></div>
        <button onClick={()=>setShowAdd(true)} style={{background:C.primary,color:'#fff',border:'none',borderRadius:8,padding:'8px 18px',fontSize:13,fontWeight:700,cursor:'pointer'}}>+ Request Leave</button>
      </div>
      <MetricGrid>
        <MetricCard label="Pending"      value={pending.length}    icon="⏳" color={`linear-gradient(135deg,${C.warning},${C.danger})`} />
        <MetricCard label="Approved"     value={approved.length}   icon="✅" color={`linear-gradient(135deg,${C.success},${C.secondary})`} />
        <MetricCard label="On Leave Now" value={onLeaveNow.length} icon="🌴" color={`linear-gradient(135deg,${C.sky},${C.primary})`} />
        <MetricCard label="Total"        value={items.length}      icon="📋" color={`linear-gradient(135deg,${C.primary},#8B5CF6)`} />
      </MetricGrid>
      <Tabs tabs={[{key:'all',label:'All'},{key:'pending',label:`Pending (${pending.length})`},{key:'mine',label:'Mine'}]} active={tab} onChange={setTab} />
      <Card>{isLoading?<Loading />:<DataTable cols={cols} rows={items} onRow={setSelected} emptyText="No leave requests" />}</Card>
      {showAdd && <AddLeaveModal onClose={()=>{setShowAdd(false);refetch();}} />}
      {selected && (
        <Modal title="Leave Request" onClose={()=>setSelected(null)}>
          <InfoRow label="Employee" value={selected.employee_name} />
          <InfoRow label="Type"     value={selected.leave_type?.replace(/_/g,' ')} />
          <InfoRow label="From"     value={fmtDate(selected.start_date)} />
          <InfoRow label="To"       value={fmtDate(selected.end_date)} />
          <InfoRow label="Days"     value={selected.days} />
          <InfoRow label="Status"   value={<StatusBadge status={selected.status} />} />
          {selected.status==='pending' && (
            <div style={{marginTop:16,display:'flex',gap:8}}>
              <button onClick={()=>handleDecision('approved')} style={{background:C.success,color:'#fff',border:'none',borderRadius:8,padding:'8px 18px',fontSize:13,fontWeight:700,cursor:'pointer'}}>✓ Approve</button>
              <button onClick={()=>handleDecision('declined')} style={{background:C.danger+'22',color:C.danger,border:`1px solid ${C.danger}44`,borderRadius:8,padding:'8px 18px',fontSize:13,fontWeight:700,cursor:'pointer'}}>✗ Decline</button>
              <button onClick={()=>setSelected(null)} style={{background:'transparent',color:C.muted,border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 14px',fontSize:13,cursor:'pointer'}}>Close</button>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// LEAVE BALANCES
// ════════════════════════════════════════════════════════════════════════════
export function LeaveBalancesModule() {
  const year = new Date().getFullYear();
  const [empFilter, setEmpFilter] = useState('');
  const { data:balances, isLoading, refetch } = useLeaveBalances(empFilter?{year:String(year),employeeId:empFilter}:{year:String(year)});
  const { data:employees } = useEmployees();
  const initialise = useInitialiseLeaveBalances();
  const qc = useQueryClient();
  const items = balances??[];

  // Group by employee
  const byEmployee = items.reduce((acc, b) => {
    if (!acc[b.employee_id]) acc[b.employee_id] = { name:b.employee_name, balances:[] };
    acc[b.employee_id].balances.push(b);
    return acc;
  }, {} as Record<string, {name:string;balances:typeof items}>);

  const handleInitialise = async () => {
    await initialise.mutateAsync({});
    qc.invalidateQueries({queryKey:['leave','balances']});
  };

  return (
    <div className="animate-fadeIn">
      <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',marginBottom:20}}>
        <div>
          <h2 style={{color:C.text,fontSize:20,fontWeight:800,margin:0}}>Leave Balances {year}</h2>
          <p style={{color:C.muted,fontSize:12,margin:'4px 0 0'}}>Entitlements, taken, pending and remaining</p>
        </div>
        <div style={{display:'flex',gap:8}}>
          <select value={empFilter} onChange={e=>setEmpFilter(e.target.value)} style={{background:C.elevated,border:`1px solid ${C.border}`,borderRadius:8,padding:'7px 12px',color:C.text,fontSize:12,outline:'none'}}>
            <option value="">All employees</option>
            {(employees?.items??[]).map(e=><option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
          </select>
          <button onClick={handleInitialise} disabled={initialise.isPending} style={{background:C.elevated,color:C.muted,border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 14px',fontSize:12,fontWeight:700,cursor:'pointer'}}>
            {initialise.isPending?'Initialising...':'⚙️ Initialise'}
          </button>
        </div>
      </div>

      {items.length===0 && !isLoading && (
        <Card>
          <div style={{textAlign:'center',padding:'40px 20px',color:C.dim}}>
            <div style={{fontSize:36,marginBottom:12}}>📊</div>
            <div style={{fontWeight:700,color:C.muted,marginBottom:8}}>No balances found for {year}</div>
            <div style={{fontSize:12,color:C.dim,marginBottom:16}}>Click Initialise to create leave balances for all active employees based on their leave policies.</div>
            <button onClick={handleInitialise} style={{background:C.primary,color:'#fff',border:'none',borderRadius:8,padding:'10px 20px',fontSize:13,fontWeight:700,cursor:'pointer'}}>⚙️ Initialise Leave Balances</button>
          </div>
        </Card>
      )}

      {isLoading?<Loading />:Object.entries(byEmployee as Record<string,{name:string;balances:any[]}>).map(([empId,{name,balances}])=>(
        <Card key={empId} style={{marginBottom:16}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16,paddingBottom:12,borderBottom:`1px solid ${C.border}`}}>
            <Avatar name={name} size={36} />
            <div style={{fontWeight:800,color:C.text,fontSize:15}}>{name}</div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:12}}>
            {balances.map(b=>{
              const total = b.entitlement + b.carried_forward + b.adjusted;
              const usedPct = total>0 ? Math.round((b.taken/total)*100) : 0;
              const remaining = total - b.taken - b.pending;
              return (
                <div key={b.id} style={{background:C.surface,borderRadius:12,padding:14,border:`1px solid ${C.border}`,borderTop:`3px solid ${b.colour}`}}>
                  <div style={{fontWeight:700,color:C.text,fontSize:13,marginBottom:10}}>{b.leave_type_name}</div>
                  <div style={{marginBottom:8}}>
                    <ProgressBar value={usedPct} color={b.colour} />
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,fontSize:11}}>
                    <div style={{color:C.dim}}>Entitlement</div><div style={{color:C.text,fontWeight:700,textAlign:'right'}}>{b.entitlement}d</div>
                    {b.carried_forward>0 && <><div style={{color:C.dim}}>Carried fwd</div><div style={{color:C.secondary,fontWeight:700,textAlign:'right'}}>+{b.carried_forward}d</div></>}
                    <div style={{color:C.dim}}>Taken</div><div style={{color:C.danger,fontWeight:700,textAlign:'right'}}>{b.taken}d</div>
                    {b.pending>0 && <><div style={{color:C.dim}}>Pending</div><div style={{color:C.warning,fontWeight:700,textAlign:'right'}}>{b.pending}d</div></>}
                    <div style={{color:C.dim,fontWeight:700,borderTop:`1px solid ${C.border}`,paddingTop:4,marginTop:4}}>Remaining</div>
                    <div style={{color:remaining>5?C.success:remaining>0?C.warning:C.danger,fontWeight:800,textAlign:'right',borderTop:`1px solid ${C.border}`,paddingTop:4,marginTop:4}}>{remaining}d</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// LEAVE CALENDAR
// ════════════════════════════════════════════════════════════════════════════
export function LeaveCalendarModule() {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth()+1);
  const [year,  setYear]  = useState(today.getFullYear());
  const { data, isLoading } = useLeaveCalendar(month, year);
  const { data:holidays } = usePublicHolidays(year);

  const leaves   = data?.leaves   ?? [];
  const bankHols = data?.holidays ?? [];

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay    = new Date(year, month-1, 1).getDay(); // 0=Sun
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;  // Mon-based

  const LEAVE_COLORS: Record<string,string> = { annual:C.primary, sick:C.danger, maternity:C.secondary, paternity:C.sky, compassionate:C.warning, unpaid:C.dim, toil:'#A855F7' };
  const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

  const getLeavesForDay = (day: number) => {
    const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    return leaves.filter(l=>l.start_date<=dateStr&&l.end_date>=dateStr);
  };
  const getHolidayForDay = (day: number) => {
    const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    return bankHols.find(h=>h.date===dateStr);
  };

  const navigate = (dir: number) => {
    let m = month+dir, y = year;
    if (m>12) { m=1; y++; } if (m<1) { m=12; y--; }
    setMonth(m); setYear(y);
  };

  return (
    <div className="animate-fadeIn">
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
        <div><h2 style={{color:C.text,fontSize:20,fontWeight:800,margin:0}}>Leave Calendar</h2>
        <p style={{color:C.muted,fontSize:12,margin:'4px 0 0'}}>Team leave and public holidays</p></div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <button onClick={()=>navigate(-1)} style={{background:C.elevated,color:C.muted,border:`1px solid ${C.border}`,borderRadius:8,padding:'6px 12px',fontSize:13,cursor:'pointer'}}>←</button>
          <span style={{fontWeight:700,color:C.text,fontSize:14,minWidth:140,textAlign:'center'}}>{MONTHS[month-1]} {year}</span>
          <button onClick={()=>navigate(1)} style={{background:C.elevated,color:C.muted,border:`1px solid ${C.border}`,borderRadius:8,padding:'6px 12px',fontSize:13,cursor:'pointer'}}>→</button>
          <button onClick={()=>{setMonth(today.getMonth()+1);setYear(today.getFullYear());}} style={{background:C.primary+'22',color:C.primary,border:`1px solid ${C.primary}33`,borderRadius:8,padding:'6px 12px',fontSize:12,fontWeight:700,cursor:'pointer'}}>Today</button>
        </div>
      </div>

      <Card>
        {/* Day headers */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2,marginBottom:4}}>
          {DAY_LABELS.map(d=>(
            <div key={d} style={{textAlign:'center',fontSize:10,fontWeight:700,color:C.dim,textTransform:'uppercase',letterSpacing:'0.08em',padding:'6px 0'}}>{d}</div>
          ))}
        </div>

        {isLoading?<Loading />:(
          <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2}}>
            {/* Empty cells before month start */}
            {Array.from({length:startOffset}).map((_,i)=>(
              <div key={`e${i}`} style={{minHeight:80,background:C.surface,borderRadius:8,opacity:0.3}} />
            ))}
            {/* Day cells */}
            {Array.from({length:daysInMonth},(_,i)=>{
              const day = i+1;
              const isToday = day===today.getDate()&&month===today.getMonth()+1&&year===today.getFullYear();
              const dayLeaves = getLeavesForDay(day);
              const holiday = getHolidayForDay(day);
              const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
              const dow = new Date(dateStr).getDay();
              const isWeekend = dow===0||dow===6;

              return (
                <div key={day} style={{
                  minHeight:80, borderRadius:8, padding:'6px 8px',
                  background: holiday ? C.warning+'11' : isWeekend ? C.surface : C.elevated,
                  border: `1px solid ${isToday ? C.primary : C.border}`,
                  boxShadow: isToday ? `0 0 0 2px ${C.primary}44` : 'none',
                  opacity: isWeekend&&!holiday ? 0.6 : 1,
                }}>
                  <div style={{
                    fontSize:12, fontWeight: isToday?800:500,
                    color: isToday?C.primary:isWeekend?C.dim:C.muted,
                    marginBottom:4,
                  }}>{day}</div>
                  {holiday && (
                    <div style={{fontSize:8,fontWeight:700,color:C.warning,background:C.warning+'22',borderRadius:3,padding:'1px 4px',marginBottom:3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={holiday.name}>
                      🏦 {holiday.name}
                    </div>
                  )}
                  {dayLeaves.slice(0,3).map((l,li)=>(
                    <div key={li} style={{
                      fontSize:8, fontWeight:700, borderRadius:3, padding:'1px 4px', marginBottom:2,
                      background:(LEAVE_COLORS[l.leave_type]??C.primary)+'33',
                      color: LEAVE_COLORS[l.leave_type]??C.primary,
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                    }} title={`${l.employee_name} — ${l.leave_type}`}>
                      {l.employee_name?.split(' ')[0]}
                    </div>
                  ))}
                  {dayLeaves.length>3 && <div style={{fontSize:8,color:C.dim}}>+{dayLeaves.length-3} more</div>}
                </div>
              );
            })}
          </div>
        )}

        {/* Legend */}
        <div style={{display:'flex',gap:16,marginTop:16,paddingTop:12,borderTop:`1px solid ${C.border}`,flexWrap:'wrap'}}>
          {Object.entries(LEAVE_COLORS).map(([type,color])=>(
            <div key={type} style={{display:'flex',alignItems:'center',gap:4}}>
              <div style={{width:10,height:10,borderRadius:2,background:color+'66'}} />
              <span style={{fontSize:10,color:C.dim,textTransform:'capitalize'}}>{type}</span>
            </div>
          ))}
          <div style={{display:'flex',alignItems:'center',gap:4}}>
            <div style={{width:10,height:10,borderRadius:2,background:C.warning+'44'}} />
            <span style={{fontSize:10,color:C.dim}}>Bank holiday</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TIMESHEETS
// ════════════════════════════════════════════════════════════════════════════
function SubmitTimesheetModal({ onClose }: { onClose:()=>void }) {
  const submit = useSubmitTimesheet();
  const { user } = useAuth();
  const { data:myTasks } = useTasks(user?.employeeId?{assigneeId:user.employeeId}:undefined);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [weekStarting, setWeekStarting] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const DAYS = ['Mon','Tue','Wed','Thu','Fri'];
  const [entries, setEntries] = useState(DAYS.map(()=>({hours:7,description:'',billable:true})));
  const setEntry = (i:number,k:string,v:any) => setEntries(es=>es.map((e,idx)=>idx===i?{...e,[k]:v}:e));

  const handleTaskSelect = (taskId:string) => {
    setSelectedTaskId(taskId);
    if (!taskId) return;
    const task = (myTasks??[]).find((t:any)=>t.id===taskId);
    if (task) setEntries(es=>es.map(e=>({...e,description:task.name,billable:true})));
  };

  const getDateForDay = (weekStart:string,dayIndex:number) => {
    if (!weekStart) return '';
    const d = new Date(weekStart); d.setDate(d.getDate()+dayIndex);
    return d.toISOString().split('T')[0];
  };

  const totalHours    = entries.reduce((a,e)=>a+Number(e.hours),0);
  const billableHours = entries.filter(e=>e.billable).reduce((a,e)=>a+Number(e.hours),0);
  const activeTasks = (myTasks??[]).filter((t:any)=>!['done','cancelled'].includes(t.status));

  const handleSave = async () => {
    if (!weekStarting) { setErr('Please select the week starting date'); return; }
    setSaving(true); setErr('');
    try {
      await submit.mutateAsync({ weekStarting, entries: entries.map((e,i)=>({ date:getDateForDay(weekStarting,i), hoursWorked:Number(e.hours), description:e.description, billable:e.billable })).filter(e=>e.hoursWorked>0) });
      onClose();
    } catch(e:any) { setErr(e.message??'Failed'); } finally { setSaving(false); }
  };

  return (
    <Modal title="Submit Timesheet" onClose={onClose} wide>
      {err && <Alert type="error" message={err} />}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
        <FormField label="Week Starting (Monday)" required>
          <input style={inputStyle} type="date" value={weekStarting} onChange={e=>setWeekStarting(e.target.value)} />
        </FormField>
        <FormField label="Primary Task">
          <select style={selectStyle} value={selectedTaskId} onChange={e=>handleTaskSelect(e.target.value)}>
            <option value="">Select task...</option>
            {activeTasks.map((t:any)=><option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </FormField>
      </div>
      <div style={{display:'flex',gap:16,marginBottom:10,fontSize:12,color:C.muted,padding:'8px 0',borderTop:`1px solid ${C.border}33`,borderBottom:`1px solid ${C.border}33`}}>
        <span>⏱ Total: <strong style={{color:C.text}}>{totalHours}h</strong></span>
        <span>💰 Billable: <strong style={{color:C.secondary}}>{billableHours}h</strong></span>
        {totalHours>0&&<span>📊 Util: <strong style={{color:C.primary}}>{Math.round(billableHours/totalHours*100)}%</strong></span>}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'48px 80px 1fr 80px',gap:6,marginBottom:6}}>
        {['Day','Hours','Task / Description','Billable'].map(h=><span key={h} style={{fontSize:9,fontWeight:700,color:C.dim,textTransform:'uppercase'}}>{h}</span>)}
      </div>
      {DAYS.map((day,i)=>(
        <div key={i} style={{display:'grid',gridTemplateColumns:'48px 80px 1fr 80px',gap:6,alignItems:'center',marginBottom:6}}>
          <span style={{fontSize:13,fontWeight:700,color:C.muted}}>{day}</span>
          <input style={inputStyle} type="number" min="0" max="24" step="0.5" value={entries[i].hours} onChange={ev=>setEntry(i,'hours',ev.target.value)} />
          <input style={inputStyle} placeholder="What did you work on?" value={entries[i].description} onChange={ev=>setEntry(i,'description',ev.target.value)} />
          <label style={{display:'flex',alignItems:'center',gap:6,fontSize:11,color:entries[i].billable?C.secondary:C.muted,cursor:'pointer'}}>
            <input type="checkbox" checked={entries[i].billable} onChange={ev=>setEntry(i,'billable',ev.target.checked)} /> Billable
          </label>
        </div>
      ))}
      <FormActions onCancel={onClose} onSave={handleSave} saving={saving} saveLabel="Submit Timesheet" />
    </Modal>
  );
}

export function TimesheetsModule() {
  const [tab, setTab] = useState('all');
  const [selected, setSelected] = useState<Timesheet|null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const params: Record<string,string> | undefined = tab==='mine'?{mine:'true'}:tab==='pending'?{status:'pending'}:undefined;
  const { data:timesheets, isLoading, refetch } = useTimesheets(params);
  const tsDecision = useTimesheetDecision(selected?.id??'');
  const bulkDecision = useBulkTimesheetDecision();
  const items = timesheets??[];
  const pending = items.filter(t=>t.status==='pending');
  const totalHours    = items.reduce((a,t)=>a+(t.total_hours??0),0);
  const billableHours = items.reduce((a,t)=>a+(t.billable_hours??0),0);
  const handleDecision = async (dec:'approved'|'rejected') => {
    if (!selected) return;
    try { await tsDecision.mutateAsync({decision:dec}); setSelected(null); refetch(); } catch(e:any) { alert(e.message); }
  };
  const cols: ColDef<Timesheet>[] = [
    { key:'employee_name', label:'Employee', render:v=><div style={{display:'flex',alignItems:'center',gap:8}}><Avatar name={v} size={28}/><span style={{fontWeight:600}}>{v}</span></div> },
    { key:'week_starting',  label:'Week of',  render:v=>fmtDate(v) },
    { key:'total_hours',    label:'Hours',    render:v=><span style={{fontWeight:700}}>{v??0}h</span> },
    { key:'billable_hours', label:'Billable', render:v=><span style={{color:C.secondary,fontWeight:700}}>{v??0}h</span> },
    { key:'status',         label:'Status',   render:v=><StatusBadge status={v} /> },
    { key:'submitted_at',   label:'Submitted',render:v=>fmtDate(v), muted:true },
  ];
  return (
    <div className="animate-fadeIn">
      <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',marginBottom:20}}>
        <div><h2 style={{color:C.text,fontSize:20,fontWeight:800,margin:0}}>Timesheets</h2>
        <p style={{color:C.muted,fontSize:12,margin:'4px 0 0'}}>Track and approve team hours</p></div>
        <div style={{display:'flex',gap:8}}>
          {pending.length>0&&<button onClick={()=>bulkDecision.mutateAsync({ids:pending.map(t=>t.id),decision:'approved'}).then(()=>refetch())} style={{background:C.success,color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',fontSize:12,fontWeight:700,cursor:'pointer'}}>✓ Approve All ({pending.length})</button>}
          <button onClick={()=>setShowAdd(true)} style={{background:C.primary,color:'#fff',border:'none',borderRadius:8,padding:'8px 18px',fontSize:13,fontWeight:700,cursor:'pointer'}}>+ Submit Hours</button>
        </div>
      </div>
      <MetricGrid>
        <MetricCard label="Pending"     value={pending.length} icon="⏱" color={`linear-gradient(135deg,${C.warning},${C.danger})`} />
        <MetricCard label="Total Hours" value={totalHours}     icon="🕐" color={`linear-gradient(135deg,${C.primary},#8B5CF6)`} />
        <MetricCard label="Billable"    value={billableHours}  icon="💰" color={`linear-gradient(135deg,${C.secondary},${C.sky})`} />
        <MetricCard label="Utilisation" value={totalHours>0?`${Math.round(billableHours/totalHours*100)}%`:'—'} icon="📊" color={`linear-gradient(135deg,#8B5CF6,${C.primary})`} />
      </MetricGrid>
      <Tabs tabs={[{key:'all',label:'All'},{key:'pending',label:`Pending (${pending.length})`},{key:'mine',label:'Mine'}]} active={tab} onChange={setTab} />
      <Card>{isLoading?<Loading />:<DataTable cols={cols} rows={items} onRow={setSelected} emptyText="No timesheets" />}</Card>
      {showAdd && <SubmitTimesheetModal onClose={()=>{setShowAdd(false);refetch();}} />}
      {selected && (
        <Modal title={`Timesheet — ${selected.employee_name}`} onClose={()=>setSelected(null)}>
          <InfoRow label="Employee"  value={selected.employee_name} />
          <InfoRow label="Week"      value={fmtDate(selected.week_starting)} />
          <InfoRow label="Hours"     value={`${selected.total_hours??0}h`} />
          <InfoRow label="Billable"  value={`${selected.billable_hours??0}h`} />
          <InfoRow label="Status"    value={<StatusBadge status={selected.status} />} />
          {selected.status==='pending' && (
            <div style={{marginTop:16,display:'flex',gap:8}}>
              <button onClick={()=>handleDecision('approved')} style={{background:C.success,color:'#fff',border:'none',borderRadius:8,padding:'8px 18px',fontSize:13,fontWeight:700,cursor:'pointer'}}>✓ Approve</button>
              <button onClick={()=>handleDecision('rejected')} style={{background:C.danger+'22',color:C.danger,border:`1px solid ${C.danger}44`,borderRadius:8,padding:'8px 18px',fontSize:13,fontWeight:700,cursor:'pointer'}}>✗ Reject</button>
              <button onClick={()=>setSelected(null)} style={{background:'transparent',color:C.muted,border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 14px',fontSize:13,cursor:'pointer'}}>Close</button>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// EXPENSES
// ════════════════════════════════════════════════════════════════════════════
function AddExpenseModal({ onClose }: { onClose:()=>void }) {
  const create = useCreateExpense();
  const [errMsg, setErrMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ category:'travel', amount:'', currency:'GBP', description:'', expenseDate:new Date().toISOString().split('T')[0] });
  const set = (k:string,v:string) => setForm(f=>({...f,[k]:v}));
  const handleSave = async () => {
    if (!form.amount||!form.description) { setErrMsg('Amount and description are required'); return; }
    setSaving(true); setErrMsg('');
    try { await create.mutateAsync({...form,amount:Number(form.amount)}); onClose(); }
    catch(e:any) { setErrMsg(e.message??'Failed'); } finally { setSaving(false); }
  };
  return (
    <Modal title="Submit Expense Claim" onClose={onClose}>
      {errMsg && <Alert type="error" message={errMsg} />}
      <FormField label="Category" required>
        <select style={selectStyle} value={form.category} onChange={e=>set('category',e.target.value)}>
          <option value="travel">✈️ Travel</option><option value="accommodation">🏨 Accommodation</option>
          <option value="meals">🍽️ Meals</option><option value="equipment">💻 Equipment</option>
          <option value="training">🎓 Training</option><option value="other">📦 Other</option>
        </select>
      </FormField>
      <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:12}}>
        <FormField label="Amount" required><input style={inputStyle} type="number" min="0" step="0.01" value={form.amount} onChange={e=>set('amount',e.target.value)} placeholder="0.00" /></FormField>
        <FormField label="Currency">
          <select style={selectStyle} value={form.currency} onChange={e=>set('currency',e.target.value)}>
            <option value="GBP">GBP £</option><option value="USD">USD $</option><option value="EUR">EUR €</option>
          </select>
        </FormField>
      </div>
      <FormField label="Description" required><input style={inputStyle} value={form.description} onChange={e=>set('description',e.target.value)} /></FormField>
      <FormField label="Date" required><input style={inputStyle} type="date" value={form.expenseDate} onChange={e=>set('expenseDate',e.target.value)} /></FormField>
      <FormActions onCancel={onClose} onSave={handleSave} saving={saving} saveLabel="Submit Claim" />
    </Modal>
  );
}

export function ExpensesModule() {
  const [tab, setTab] = useState('all');
  const [selected, setSelected] = useState<ExpenseClaim|null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const params: Record<string,string> | undefined = tab==='mine'?{mine:'true'}:tab==='pending'?{status:'pending'}:undefined;
  const { data:expenses, isLoading, refetch } = useExpenses(params);
  const decision = useExpenseDecision(selected?.id??'');
  const items = expenses??[];
  const pending = items.filter(e=>e.status==='pending');
  const ICONS: Record<string,string> = {travel:'✈️',accommodation:'🏨',meals:'🍽️',equipment:'💻',training:'🎓',other:'📦'};
  const handleDecision = async (dec:'approved'|'rejected') => {
    if (!selected) return;
    try { await decision.mutateAsync({decision:dec}); setSelected(null); refetch(); } catch(e:any) { alert(e.message); }
  };
  const cols: ColDef<ExpenseClaim>[] = [
    { key:'employee_name', label:'Employee', render:v=><div style={{display:'flex',alignItems:'center',gap:8}}><Avatar name={v} size={28}/><span style={{fontWeight:600}}>{v}</span></div> },
    { key:'category',     label:'Category', render:v=>`${ICONS[v]??'📦'} ${v}` },
    { key:'description',  label:'Description', muted:true },
    { key:'expense_date', label:'Date', render:v=>fmtDate(v), muted:true },
    { key:'amount',       label:'Amount', render:(v,r)=><span style={{fontWeight:700}}>£{Number(v).toFixed(2)}</span> },
    { key:'status',       label:'Status', render:v=><StatusBadge status={v} /> },
  ];
  return (
    <div className="animate-fadeIn">
      <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',marginBottom:20}}>
        <div><h2 style={{color:C.text,fontSize:20,fontWeight:800,margin:0}}>Expenses</h2>
        <p style={{color:C.muted,fontSize:12,margin:'4px 0 0'}}>Claims, approvals and spend</p></div>
        <button onClick={()=>setShowAdd(true)} style={{background:C.primary,color:'#fff',border:'none',borderRadius:8,padding:'8px 18px',fontSize:13,fontWeight:700,cursor:'pointer'}}>+ Submit Claim</button>
      </div>
      <MetricGrid>
        <MetricCard label="Pending Claims" value={pending.length} icon="📋" color={`linear-gradient(135deg,${C.warning},${C.danger})`} />
        <MetricCard label="Pending Value"  value={`£${pending.reduce((a,e)=>a+e.amount,0).toFixed(0)}`} icon="💷" color={`linear-gradient(135deg,${C.primary},#8B5CF6)`} />
        <MetricCard label="Approved MTD"   value={`£${items.filter(e=>e.status==='approved').reduce((a,e)=>a+e.amount,0).toFixed(0)}`} icon="✅" color={`linear-gradient(135deg,${C.success},${C.secondary})`} />
        <MetricCard label="Rejected"       value={items.filter(e=>e.status==='rejected').length} icon="❌" color={`linear-gradient(135deg,${C.danger},#7F1D1D)`} />
      </MetricGrid>
      <Tabs tabs={[{key:'all',label:'All'},{key:'pending',label:`Pending (${pending.length})`},{key:'mine',label:'Mine'}]} active={tab} onChange={setTab} />
      <Card>{isLoading?<Loading />:<DataTable cols={cols} rows={items} onRow={setSelected} emptyText="No expense claims" />}</Card>
      {showAdd && <AddExpenseModal onClose={()=>{setShowAdd(false);refetch();}} />}
      {selected && (
        <Modal title="Expense Claim" onClose={()=>setSelected(null)}>
          <InfoRow label="Employee"    value={selected.employee_name} />
          <InfoRow label="Category"    value={selected.category} />
          <InfoRow label="Description" value={selected.description} />
          <InfoRow label="Amount"      value={`£${Number(selected.amount).toFixed(2)} ${selected.currency}`} />
          <InfoRow label="Status"      value={<StatusBadge status={selected.status} />} />
          {selected.status==='pending' && (
            <div style={{marginTop:16,display:'flex',gap:8}}>
              <button onClick={()=>handleDecision('approved')} style={{background:C.success,color:'#fff',border:'none',borderRadius:8,padding:'8px 18px',fontSize:13,fontWeight:700,cursor:'pointer'}}>✓ Approve</button>
              <button onClick={()=>handleDecision('rejected')} style={{background:C.danger+'22',color:C.danger,border:`1px solid ${C.danger}44`,borderRadius:8,padding:'8px 18px',fontSize:13,fontWeight:700,cursor:'pointer'}}>✗ Reject</button>
              <button onClick={()=>setSelected(null)} style={{background:'transparent',color:C.muted,border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 14px',fontSize:13,cursor:'pointer'}}>Close</button>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

export default LeaveModule;
