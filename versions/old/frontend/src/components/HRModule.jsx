import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Edit3, Shield, CheckCircle, AlertCircle, RefreshCw, User, ShieldAlert, Zap, Mail, FileSpreadsheet, FileText, ChevronDown, ChevronUp, Plus } from 'lucide-react';

export default function HRModule({ currentUser }) {
  const { token, backendUrl } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Local submission states for macro buttons
  const [runningMacro, setRunningMacro] = useState(null);

  // Expanded tracking array for showing compliance details per employee row
  const [expandedComplianceRows, setExpandedComplianceRows] = useState({});
  const [complianceLogs, setComplianceLogs] = useState([]);

  // Local state for logging a new audit check inside the drawer
  const [submittingAuditId, setSubmittingAuditId] = useState(null);
  const [auditForm, setAuditForm] = useState({
    compliance_name: 'Right to Work',
    is_compliant: '1'
  });

  // Permission Context Parsers
  const isSystemAdmin = currentUser?.role === 'admin';
  const currentUserEmployeeId = currentUser?.employeeId ? parseInt(currentUser.employeeId, 10) : null;

  // Provisioning Fields State Controls (Admin Only)
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newMobile, setNewMobile] = useState('');
  const [newDesignation, setNewDesignation] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newDepartment, setNewDepartment] = useState('Engineering');
  const [newRole, setNewRole] = useState('employee');
  
  // New Immigration Provisioning Fields State Controls
  const [newBRP, setNewBRP] = useState('');
  const [newVisaStart, setNewVisaStart] = useState('');
  const [newVisaEnd, setNewVisaEnd] = useState('');

  // Modifying Modal Frame Workbench States
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '', department: '', designation: '', status: 'Active',
    mobile: '', address: '', salary: 0, start_date: '', end_date: '',
    brp_no: '', visa_start_date: '', visa_end_date: ''
  });

  const fetchEmployees = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${backendUrl}/api/employees`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setEmployees(data || []);
      } else {
        setError('Failed to download personnel infrastructure rows.');
      }
    } catch (err) {
      setError('Network communication drop during directory load.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllComplianceLogs = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/compliance`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setComplianceLogs(data || []);
      }
    } catch (err) {
      console.error("Failed to sync audit data array:", err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchEmployees();
      fetchAllComplianceLogs();
    }
  }, [token]);

  // Toggle compliance drawer visibility per employee row index
  const toggleComplianceDrawer = (empId) => {
    setExpandedComplianceRows(prev => ({
      ...prev,
      [empId]: !prev[empId]
    }));
  };

  // --- HANDLER: LOG NEW COMPLIANCE RECORD ---
  const handleLogCompliance = async (e, employeeId) => {
    e.preventDefault();
    if (!isSystemAdmin) return;
    setSubmittingAuditId(employeeId);
    setError('');
    setSuccess('');

    const todayStr = new Date().toISOString().split('T')[0];

    try {
      const res = await fetch(`${backendUrl}/api/compliance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          employee_id: employeeId,
          compliance_name: auditForm.compliance_name,
          is_compliant: auditForm.is_compliant === '1' ? 1 : 0,
          date_checked: todayStr
        })
      });

      if (res.ok) {
        setSuccess(`Successfully logged updated compliance milestone row entry.`);
        await fetchAllComplianceLogs(); // Refresh the visual data log tree
      } else {
        setError('Database rejected compliance check parameters.');
      }
    } catch (err) {
      setError('Network error processing compliance validation drop.');
    } finally {
      setSubmittingAuditId(null);
    }
  };

  // --- HANDLER: ADMIN AUTOMATION MANUAL CRON TRIGGERS ---
  const handleTriggerMacro = async (macroKey) => {
    setRunningMacro(macroKey);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`${backendUrl}/api/debug/trigger-cron?cron=${macroKey}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(`Automation Succeeded: ${data.message || 'Event fired cleanly.'}`);
      } else {
        setError(data.error || 'Server rejected manual macro invocation pipeline.');
      }
    } catch (err) {
      setError('Failed to communicate with the edge API controller node.');
    } finally {
      setRunningMacro(null);
    }
  };

  const handleProvisionProfile = async (e) => {
    e.preventDefault();
    if (!isSystemAdmin) return;
    setError(''); setSuccess('');

    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const res = await fetch(`${backendUrl}/api/employees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          name: newName, email: newEmail, mobile: newMobile, designation: newDesignation,
          address: newAddress, department: newDepartment, role: newRole,
          joining_date: todayStr, salary: 0, start_date: todayStr, end_date: '',
          brp_no: newBRP, visa_start_date: newVisaStart, visa_end_date: newVisaEnd
        })
      });

      if (res.ok) {
        setSuccess(`Operational record created successfully for ${newName}.`);
        setNewName(''); setNewEmail(''); setNewMobile(''); setNewDesignation(''); setNewAddress('');
        setNewBRP(''); setNewVisaStart(''); setNewVisaEnd('');
        fetchEmployees();
      } else {
        const errData = await res.json();
        setError(errData.error || 'Server rejected profile injection parameters.');
      }
    } catch (err) { setError('Identity provisioning connection pipeline broken.'); }
  };

  const handleInlineFieldUpdate = async (emp, fieldName, value) => {
    if (!isSystemAdmin) return;
    if (emp[fieldName] === value) return;
    setError(''); setSuccess('');
    
    const updatedPayload = {
      name: emp.name,
      department: fieldName === 'department' ? value : (emp.department || 'Engineering'),
      designation: emp.designation,
      status: fieldName === 'status' ? value : (emp.status || 'Active'),
      mobile: emp.mobile || '',
      address: emp.address || '',
      salary: Number(emp.salary || 0),
      start_date: emp.start_date || '',
      end_date: emp.end_date || '',
      brp_no: emp.brp_no || '',
      visa_start_date: emp.visa_start_date || '',
      visa_end_date: emp.visa_end_date || ''
    };

    try {
      const response = await fetch(`${backendUrl}/api/employees/${emp.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(updatedPayload)
      });
      if (response.ok) {
        setSuccess(`Inline properties safely altered for ${emp.name}.`);
        fetchEmployees();
      }
    } catch (err) { setError('Communication drop during quick inline update.'); }
  };

  const openEditModal = (emp) => {
    setEditingEmployee(emp);
    setEditForm({
      name: emp.name || '',
      department: emp.department || '',
      designation: emp.designation || '',
      status: emp.status || 'Active',
      mobile: emp.mobile || '',
      address: emp.address || '',
      salary: emp.salary !== undefined && emp.salary !== null ? Number(emp.salary) : 0,
      start_date: emp.start_date || '',
      end_date: emp.end_date || '',
      brp_no: emp.brp_no || '',
      visa_start_date: emp.visa_start_date || '',
      visa_end_date: emp.visa_end_date || ''
    });
  };

  const handleUpdateEmployeeDetails = async (e) => {
    e.preventDefault();
    if (!editingEmployee) return;
    setError(''); setSuccess('');

    const preparedPayload = {
      ...editForm,
      salary: Number(editForm.salary || 0)
    };

    try {
      const response = await fetch(`${backendUrl}/api/employees/${editingEmployee.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(preparedPayload)
      });

      if (response.ok) {
        setSuccess(`Record updates for ${editForm.name} written cleanly.`);
        setEditingEmployee(null);
        fetchEmployees();
      } else {
        const errData = await response.json();
        setError(errData.error || 'Storage system rejected updating write parameters.');
      }
    } catch (err) { setError('Communication break with remote cluster backend worker.'); }
  };

  return (
    <div className="space-y-8 animate-fadeIn text-gray-100 font-sans">
      {error && <div className="p-4 bg-red-950/40 text-red-400 border border-red-800/40 rounded-xl text-xs flex items-center space-x-2"><AlertCircle size={16}/><span>{error}</span></div>}
      {success && <div className="p-4 bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 rounded-xl text-xs flex items-center space-x-2"><CheckCircle size={16}/><span>{success}</span></div>}

      {/* ADMIN EXCLUSIVE AUTOMATION PANEL */}
      {isSystemAdmin && (
        <div className="bg-gradient-to-r from-purple-950/20 to-xavvy-surface border border-purple-900/40 p-6 rounded-2xl shadow-premium relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-xl pointer-events-none"></div>
          <div className="flex items-center space-x-2 mb-4">
            <Zap size={16} className="text-purple-400" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-white font-mono">System Automation Suite</h3>
            <span className="text-[9px] font-mono bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded border border-purple-500/20 uppercase font-black tracking-widest ml-auto">Admin Controls</span>
          </div>
          <p className="text-xavvy-textMuted text-xs mb-5">Force-fire chronological pipeline operations directly at the live edge database instance container.</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <button
              type="button"
              disabled={runningMacro !== null}
              onClick={() => handleTriggerMacro('tasks')}
              className="flex items-center justify-center space-x-2.5 p-3.5 bg-xavvy-bg hover:bg-purple-950/30 border border-xavvy-border hover:border-purple-500/40 rounded-xl text-xs font-bold uppercase tracking-wider font-sans transition-all group disabled:opacity-50"
            >
              <Mail size={14} className="text-purple-400 group-hover:scale-110 transition-transform" />
              <span>{runningMacro === 'tasks' ? 'Processing...' : 'Run Tasks Digest'}</span>
            </button>

            <button
              type="button"
              disabled={runningMacro !== null}
              onClick={() => handleTriggerMacro('timesheet')}
              className="flex items-center justify-center space-x-2.5 p-3.5 bg-xavvy-bg hover:bg-purple-950/30 border border-xavvy-border hover:border-purple-500/40 rounded-xl text-xs font-bold uppercase tracking-wider font-sans transition-all group disabled:opacity-50"
            >
              <RefreshCw size={14} className={`text-purple-400 ${runningMacro === 'timesheet' ? 'animate-spin' : 'group-hover:rotate-45 transition-transform'}`} />
              <span>{runningMacro === 'timesheet' ? 'Processing...' : 'Run Timesheet Warning'}</span>
            </button>

            <button
              type="button"
              disabled={runningMacro !== null}
              onClick={() => handleTriggerMacro('compliance')}
              className="flex items-center justify-center space-x-2.5 p-3.5 bg-xavvy-bg hover:bg-purple-950/30 border border-xavvy-border hover:border-purple-500/40 rounded-xl text-xs font-bold uppercase tracking-wider font-sans transition-all group disabled:opacity-50"
            >
              <FileSpreadsheet size={14} className="text-purple-400 group-hover:scale-110 transition-transform" />
              <span>{runningMacro === 'compliance' ? 'Scanning...' : 'Run RTW Scan'}</span>
            </button>

            <button
              type="button"
              disabled={runningMacro !== null}
              onClick={() => handleTriggerMacro('visa')}
              className="flex items-center justify-center space-x-2.5 p-3.5 bg-xavvy-bg hover:bg-purple-950/30 border border-xavvy-border hover:border-purple-500/40 rounded-xl text-xs font-bold uppercase tracking-wider font-sans transition-all group disabled:opacity-50"
            >
              <ShieldAlert size={14} className="text-red-400 group-hover:scale-110 transition-transform" />
              <span>{runningMacro === 'visa' ? 'Analyzing...' : 'Run Visa Check'}</span>
            </button>
          </div>
        </div>
      )}

      {/* PROVISION INTERFACE (Admin Only) */}
      {isSystemAdmin && (
        <div className="bg-xavvy-surface border border-xavvy-border p-6 rounded-2xl shadow-premium">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white mb-5 font-mono">Provision User Profile Node</h3>
          <form onSubmit={handleProvisionProfile} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase text-xavvy-textMuted font-bold tracking-wider mb-1">Full Legal Name</label>
                <input type="text" value={newName} onChange={e => setNewName(e.target.value)} required className="w-full bg-xavvy-bg border border-xavvy-border rounded-xl p-2.5 text-white focus:outline-none focus:border-xavvy-accent" placeholder="Jane Doe"/>
              </div>
              <div>
                <label className="block text-[10px] uppercase text-xavvy-textMuted font-bold tracking-wider mb-1">Corporate Identity Email</label>
                <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required className="w-full bg-xavvy-bg border border-xavvy-border rounded-xl p-2.5 text-white focus:outline-none focus:border-xavvy-accent" placeholder="jane@xavvy.uk"/>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase text-xavvy-textMuted font-bold tracking-wider mb-1">Mobile Line</label>
                <input type="text" value={newMobile} onChange={e => setNewMobile(e.target.value)} className="w-full bg-xavvy-bg border border-xavvy-border rounded-xl p-2.5 text-white focus:outline-none" placeholder="+44 7700 900077"/>
              </div>
              <div>
                <label className="block text-[10px] uppercase text-xavvy-textMuted font-bold tracking-wider mb-1">Designation</label>
                <input type="text" value={newDesignation} onChange={e => setNewDesignation(e.target.value)} required className="w-full bg-xavvy-bg border border-xavvy-border rounded-xl p-2.5 text-white focus:outline-none" placeholder="Senior Developer"/>
              </div>
            </div>
            <div>
              <label className="block text-[10px] uppercase text-xavvy-textMuted font-bold tracking-wider mb-1">Physical Residence Address</label>
              <input type="text" value={newAddress} onChange={e => setNewAddress(e.target.value)} className="w-full bg-xavvy-bg border border-xavvy-border rounded-xl p-2.5 text-white focus:outline-none" placeholder="Street, City, Postal Code"/>
            </div>

            {/* IMMIGRATION TRACKING INJECTION INPUTS */}
            <div className="p-4 bg-xavvy-bg/50 border border-xavvy-border rounded-xl space-y-3">
              <div className="text-[10px] font-mono uppercase tracking-wider font-extrabold text-xavvy-accent flex items-center gap-1.5"><FileText size={12}/> Right to Work / Visa Infrastructure Data Mapping</div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-[9px] uppercase text-xavvy-textMuted font-bold mb-1">BRP / Document No</label>
                  <input type="text" value={newBRP} onChange={e => setNewBRP(e.target.value)} className="w-full bg-xavvy-bg border border-xavvy-border rounded-lg p-2 text-white focus:outline-none" placeholder="RE1234567"/>
                </div>
                <div>
                  <label className="block text-[9px] uppercase text-xavvy-textMuted font-bold mb-1">Visa Start Date</label>
                  <input type="date" value={newVisaStart} onChange={e => setNewVisaStart(e.target.value)} className="w-full bg-xavvy-bg border border-xavvy-border rounded-lg p-2 text-white focus:outline-none font-mono"/>
                </div>
                <div>
                  <label className="block text-[9px] uppercase text-xavvy-textMuted font-bold mb-1">Visa Expiration Date</label>
                  <input type="date" value={newVisaEnd} onChange={e => setNewVisaEnd(e.target.value)} className="w-full bg-xavvy-bg border border-xavvy-border rounded-lg p-2 text-white focus:outline-none font-mono"/>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase text-xavvy-textMuted font-bold tracking-wider mb-1">Department</label>
                <select value={newDepartment} onChange={e => setNewDepartment(e.target.value)} className="w-full bg-xavvy-bg border border-xavvy-border rounded-xl p-2.5 text-white focus:outline-none font-mono">
                  <option value="Engineering">Engineering</option>
                  <option value="Product">Product</option>
                  <option value="Executive">Executive</option>
                  <option value="Operations">Operations</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase text-xavvy-textMuted font-bold tracking-wider mb-1">Permission Tier</label>
                <select value={newRole} onChange={e => setNewRole(e.target.value)} className="w-full bg-xavvy-bg border border-xavvy-border rounded-xl p-2.5 text-white focus:outline-none font-mono">
                  <option value="employee">Standard User</option>
                  <option value="admin">System Admin</option>
                </select>
              </div>
            </div>
            <button type="submit" className="w-full bg-xavvy-accent hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition font-mono uppercase tracking-wider">Inject Profile Record Node</button>
          </form>
        </div>
      )}

      {/* CORE LIVE LEDGER DATA DIRECTORY TABLE */}
      <div className="bg-xavvy-surface border border-xavvy-border rounded-2xl overflow-hidden shadow-premium">
        <div className="p-6 border-b border-xavvy-border bg-xavvy-bg/20">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white">Active Global Directory</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-xavvy-bg/40 text-xavvy-textMuted uppercase font-mono border-b border-xavvy-border text-[11px] tracking-wide">
                <th className="p-4 w-16">ID</th>
                <th className="p-4">User Metadata Profile</th>
                <th className="p-4">Department Node</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-xavvy-border">
              {loading ? (
                <tr><td colSpan="5" className="p-8 text-center text-xavvy-textMuted font-mono">Streaming directory nodes...</td></tr>
              ) : (
                employees.map((emp) => {
                  const isOwnRecordRow = currentUserEmployeeId === emp.id;
                  const canUserEditThisRow = isSystemAdmin || isOwnRecordRow;
                  const isComplianceOpen = !!expandedComplianceRows[emp.id];
                  
                  const personalComplianceRecords = complianceLogs.filter(log => log.employee_id === emp.id);

                  return (
                    <React.Fragment key={emp.id}>
                      <tr className={`transition-all ${isOwnRecordRow ? 'bg-blue-950/10 border-l-2 border-l-xavvy-accent' : 'hover:bg-xavvy-elevated/10'}`}>
                        <td className="p-4 font-mono font-black text-xavvy-accent">#{String(emp.id).padStart(3, '0')}</td>
                        <td className="p-4 space-y-1">
                          <div className="text-sm font-sans font-bold text-white flex items-center space-x-1.5">
                            <span>{emp.name}</span>
                            {isOwnRecordRow && <span className="text-[9px] font-mono font-extrabold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase tracking-wider flex items-center gap-1"><User size={10}/> Self</span>}
                          </div>
                          <div className="text-xs text-xavvy-textMuted">{emp.designation}</div>
                          
                          <div className="text-[11px] font-mono space-y-0.5 select-none">
                            {isSystemAdmin || isOwnRecordRow ? (
                              <>
                                {emp.mobile && <div className="text-xavvy-accent/80">📞 {emp.mobile}</div>}
                                {emp.address && <div className="text-gray-400">📍 {emp.address}</div>}
                                {emp.brp_no && <div className="text-purple-400">🛂 BRP: {emp.brp_no} {emp.visa_end_date && `(Expires: ${emp.visa_end_date})`}</div>}
                              </>
                            ) : (
                              <>
                                <div className="text-gray-600 italic">📞 Contact Info Private</div>
                                <div className="text-gray-600 italic">📍 Address Redacted</div>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="p-4 font-mono">
                          <select
                            disabled={!isSystemAdmin}
                            value={emp.department || 'Engineering'}
                            onChange={(e) => handleInlineFieldUpdate(emp, 'department', e.target.value)}
                            className={`bg-xavvy-bg border border-xavvy-border text-gray-200 text-xs rounded-xl p-1.5 font-sans font-bold ${!isSystemAdmin ? 'opacity-80 cursor-not-allowed border-transparent pl-0' : 'focus:border-xavvy-accent'}`}
                          >
                            <option value="Engineering">Engineering</option>
                            <option value="Product">Product</option>
                            <option value="Executive">Executive</option>
                            <option value="Operations">Operations</option>
                          </select>
                        </td>
                        <td className="p-4 font-mono">
                          <select
                            disabled={!isSystemAdmin}
                            value={emp.status || 'Active'}
                            onChange={(e) => handleInlineFieldUpdate(emp, 'status', e.target.value)}
                            className={`border text-[10px] font-black uppercase tracking-wider rounded-xl p-1.5 bg-xavvy-bg ${!isSystemAdmin ? 'border-transparent opacity-80 cursor-not-allowed pl-0' : ''} ${
                              emp.status === 'Active' ? 'text-emerald-400 border-emerald-500/20' : 'text-red-400 border-red-500/20'
                            }`}
                          >
                            <option value="Active">Active</option>
                            <option value="Terminated">Terminated</option>
                            <option value="On Leave">On Leave</option>
                          </select>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            {canUserEditThisRow ? (
                              <button
                                type="button"
                                onClick={() => openEditModal(emp)}
                                className="p-1.5 bg-xavvy-elevated hover:bg-blue-600 border border-xavvy-border rounded-lg text-gray-300 hover:text-white transition-all shadow-md"
                                title="Edit Detailed Form Fields"
                              >
                                <Edit3 size={13}/>
                              </button>
                            ) : (
                              <div className="p-1.5 text-gray-600" title="Profile Row Restrained"><ShieldAlert size={14}/></div>
                            )}
                            
                            {/* 🔒 SECURITY OVERHAUL: Compliance button is hidden for standard users unless viewing their own row */}
                            {canUserEditThisRow ? (
                              <button 
                                type="button" 
                                onClick={() => toggleComplianceDrawer(emp.id)}
                                className={`px-3 py-1.5 border border-xavvy-border rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center space-x-1 transition-all ${
                                  isComplianceOpen ? 'bg-xavvy-accent text-white border-xavvy-accent' : 'bg-xavvy-elevated hover:bg-xavvy-bg text-xavvy-accent'
                                }`}
                              >
                                <span>Compliance</span>
                                {isComplianceOpen ? <ChevronUp size={10}/> : <ChevronDown size={10}/>}
                              </button>
                            ) : (
                              <div className="p-1.5 text-gray-600" title="Compliance Ledger Restrained"><Shield size={13}/></div>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* COMPLIANCE DRAWER PANEL (Double guarded by row permissions) */}
                      {isComplianceOpen && canUserEditThisRow && (
                        <tr className="bg-xavvy-bg/60 border-b border-xavvy-border">
                          <td colSpan="5" className="p-4 pl-12 animate-slideDown">
                            <div className="border border-xavvy-border/60 bg-xavvy-surface rounded-xl overflow-hidden p-5 space-y-4">
                              
                              {/* Admin Audit Logger Form Component Block */}
                              {isSystemAdmin && (
                                <form onSubmit={(e) => handleLogCompliance(e, emp.id)} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end p-3.5 bg-xavvy-bg/40 border border-xavvy-border rounded-xl">
                                  <div>
                                    <label className="block text-[9px] uppercase tracking-wider font-bold text-xavvy-textMuted mb-1">Verification Module</label>
                                    <select 
                                      value={auditForm.compliance_name}
                                      onChange={e => setAuditForm({...auditForm, compliance_name: e.target.value})}
                                      className="w-full bg-xavvy-bg border border-xavvy-border rounded-lg p-2 text-xs text-white focus:outline-none focus:border-xavvy-accent"
                                    >
                                      <option value="Right to Work">Right to Work</option>
                                      <option value="NDA Framework">NDA Framework</option>
                                      <option value="Background Screening">Background Screening</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-[9px] uppercase tracking-wider font-bold text-xavvy-textMuted mb-1">Audit Status Result</label>
                                    <select 
                                      value={auditForm.is_compliant}
                                      onChange={e => setAuditForm({...auditForm, is_compliant: e.target.value})}
                                      className="w-full bg-xavvy-bg border border-xavvy-border rounded-lg p-2 text-xs text-white focus:outline-none focus:border-xavvy-accent font-mono"
                                    >
                                      <option value="1">✅ PASS / COMPLIANT</option>
                                      <option value="0">❌ FAIL / NON-COMPLIANT</option>
                                    </select>
                                  </div>
                                  <button
                                    type="submit"
                                    disabled={submittingAuditId !== null}
                                    className="h-[34px] w-full bg-xavvy-accent hover:bg-blue-500 disabled:opacity-50 text-white text-[10px] uppercase font-mono font-bold tracking-widest rounded-lg flex items-center justify-center space-x-1 transition-all shadow-md"
                                  >
                                    <Plus size={12}/>
                                    <span>{submittingAuditId === emp.id ? 'Writing...' : 'Commit Audit Entry'}</span>
                                  </button>
                                </form>
                              )}

                              {/* Compliance Record Logs Viewer Table */}
                              <div className="space-y-2">
                                <div className="text-[10px] font-mono uppercase font-black tracking-wider text-xavvy-textMuted flex items-center justify-between px-1">
                                  <span>Historical Verification Audit Ledger Registry</span>
                                  <span className="text-xavvy-accent">Count: {personalComplianceRecords.length} node(s)</span>
                                </div>
                                
                                {personalComplianceRecords.length === 0 ? (
                                  <div className="text-xs text-xavvy-textMuted italic py-2 pl-1">Zero operational compliance validation check nodes logged for this employee profile context.</div>
                                ) : (
                                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                    {personalComplianceRecords.map((log) => (
                                      <div key={log.id} className="flex items-center justify-between p-2.5 bg-xavvy-bg rounded-lg border border-xavvy-border/40 text-xs font-sans">
                                        <div className="space-y-0.5">
                                          <div className="font-bold text-white capitalize">{log.compliance_name}</div>
                                          <div className="text-[10px] text-xavvy-textMuted font-mono">Audited Check Date: {log.date_checked}</div>
                                        </div>
                                        <div className="flex items-center space-x-1.5 font-mono text-[10px] font-bold uppercase tracking-wider select-none">
                                          {log.is_compliant === 1 || log.is_compliant === true ? (
                                            <span className="flex items-center space-x-1 text-emerald-400 bg-emerald-950/20 px-2 py-1 rounded border border-emerald-500/20">
                                              <CheckCircle size={10}/> <span>Cleared</span>
                                            </span>
                                          ) : (
                                            <span className="flex items-center space-x-1 text-red-400 bg-red-950/20 px-2 py-1 rounded border border-red-500/20">
                                              <AlertCircle size={10}/> <span>Breach</span>
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* EDIT MODAL WORKBENCH POPUP OVERLAY */}
      {editingEmployee && (
        <div className="fixed inset-0 bg-[#020617]/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-xl bg-xavvy-surface border border-xavvy-border rounded-2xl shadow-2xl overflow-hidden animate-fadeIn text-xs">
            <div className="p-6 border-b border-xavvy-border bg-xavvy-bg/30 flex justify-between items-center">
              <div>
                <h2 className="text-sm font-bold uppercase text-white flex items-center space-x-2">
                  <Shield size={14} className="text-blue-400"/>
                  <span>{isSystemAdmin ? 'Modify Corporate Identity Frame' : 'Update Self Profile Record Meta'}</span>
                </h2>
                <p className="text-[11px] text-xavvy-textMuted mt-0.5">{isSystemAdmin ? `Overwriting backend arrays for ID #${editingEmployee.id}` : 'Manage personal mobile links, address credentials, and visa profiles.'}</p>
              </div>
              <button type="button" onClick={() => setEditingEmployee(null)} className="text-xavvy-textMuted hover:text-white font-bold text-sm">✕</button>
            </div>

            <form onSubmit={handleUpdateEmployeeDetails} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase text-xavvy-textMuted font-bold tracking-wider mb-1">Full Legal Name</label>
                  <input type="text" value={editForm.name} readOnly={!isSystemAdmin} onChange={e => setEditForm({...editForm, name: e.target.value})} required className={`w-full bg-xavvy-bg border border-xavvy-border rounded-xl p-2.5 text-white focus:outline-none ${!isSystemAdmin ? 'opacity-60 cursor-not-allowed border-dashed' : 'focus:border-xavvy-accent'}`}/>
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-xavvy-textMuted font-bold tracking-wider mb-1">Employment Status</label>
                  <select value={editForm.status} disabled={!isSystemAdmin} onChange={e => setEditForm({...editForm, status: setEditForm({...editForm, status: e.target.value})})} className={`w-full bg-xavvy-bg border border-xavvy-border rounded-xl p-2.5 text-white focus:outline-none font-mono ${!isSystemAdmin ? 'opacity-60 cursor-not-allowed' : 'focus:border-xavvy-accent'}`}>
                    <option value="Active">Active</option>
                    <option value="Terminated">Terminated</option>
                    <option value="On Leave">On Leave</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase text-xavvy-textMuted font-bold tracking-wider mb-1">Department Map</label>
                  <input type="text" value={editForm.department} readOnly={!isSystemAdmin} onChange={e => setEditForm({...editForm, department: e.target.value})} className={`w-full bg-xavvy-bg border border-xavvy-border rounded-xl p-2.5 text-white focus:outline-none ${!isSystemAdmin ? 'opacity-60 cursor-not-allowed border-dashed' : 'focus:border-xavvy-accent'}`}/>
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-xavvy-textMuted font-bold tracking-wider mb-1">Designation Title</label>
                  <input type="text" value={editForm.designation} readOnly={!isSystemAdmin} onChange={e => setEditForm({...editForm, designation: e.target.value})} className={`w-full bg-xavvy-bg border border-xavvy-border rounded-xl p-2.5 text-white focus:outline-none ${!isSystemAdmin ? 'opacity-60 cursor-not-allowed border-dashed' : 'focus:border-xavvy-accent'}`}/>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 font-mono">
                <div>
                  <label className="block text-[10px] uppercase text-xavvy-textMuted font-bold font-sans tracking-wider mb-1">Annual Remuneration Base</label>
                  <input type="number" value={editForm.salary} readOnly={!isSystemAdmin} onChange={e => setEditForm({...editForm, salary: e.target.value})} className={`w-full bg-xavvy-bg border border-xavvy-border rounded-xl p-2.5 text-white focus:outline-none ${!isSystemAdmin ? 'opacity-60 cursor-not-allowed border-dashed' : 'focus:border-xavvy-accent'}`}/>
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-xavvy-textMuted font-bold font-sans tracking-wider mb-1">Mobile Secure Link (Editable)</label>
                  <input type="text" value={editForm.mobile || ''} onChange={e => setEditForm({...editForm, mobile: e.target.value})} className="w-full bg-xavvy-bg border border-xavvy-border rounded-xl p-2.5 text-white focus:outline-none focus:border-xavvy-accent"/>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase text-xavvy-textMuted font-bold tracking-wider mb-1">Registered Address Frame (Editable)</label>
                <input type="text" value={editForm.address || ''} onChange={e => setEditForm({...editForm, address: e.target.value})} className="w-full bg-xavvy-bg border border-xavvy-border rounded-xl p-2.5 text-white focus:outline-none focus:border-xavvy-accent"/>
              </div>

              {/* IMMIGRATION TRACKING IN MODAL VIEW */}
              <div className="p-4 bg-xavvy-bg/50 border border-xavvy-border rounded-xl space-y-3">
                <div className="text-[10px] font-mono uppercase tracking-wider font-extrabold text-xavvy-accent flex items-center gap-1.5"><FileText size={12}/> Right to Work Documentation Context Matrix</div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[9px] uppercase text-xavvy-textMuted font-bold mb-1">BRP Number</label>
                    <input type="text" value={editForm.brp_no || ''} onChange={e => setEditForm({...editForm, brp_no: e.target.value})} className="w-full bg-xavvy-bg border border-xavvy-border rounded-lg p-2 text-white focus:outline-none focus:border-xavvy-accent" placeholder="RE1234567"/>
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase text-xavvy-textMuted font-bold mb-1">Visa Start</label>
                    <input type="date" value={editForm.visa_start_date || ''} onChange={e => setEditForm({...editForm, visa_start_date: e.target.value})} className="w-full bg-xavvy-bg border border-xavvy-border rounded-lg p-2 text-white focus:outline-none focus:border-xavvy-accent font-mono"/>
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase text-xavvy-textMuted font-bold mb-1">Visa Expire</label>
                    <input type="date" value={editForm.visa_end_date || ''} onChange={e => setEditForm({...editForm, visa_end_date: e.target.value})} className="w-full bg-xavvy-bg border border-xavvy-border rounded-lg p-2 text-white focus:outline-none focus:border-xavvy-accent font-mono"/>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button type="button" onClick={() => setEditingEmployee(null)} className="px-4 py-2 bg-xavvy-elevated hover:bg-[#334155] rounded-xl font-bold uppercase text-[10px] tracking-wider transition-all">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-xavvy-accent hover:bg-blue-500 text-white font-bold uppercase text-[10px] tracking-wider rounded-xl transition-all shadow-lg shadow-blue-600/10">Commit Storage Write</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}