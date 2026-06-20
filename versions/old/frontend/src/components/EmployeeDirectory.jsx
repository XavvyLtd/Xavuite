import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Edit3, Shield, CheckCircle, AlertCircle, RefreshCw, User } from 'lucide-react';

export default function EmployeeDirectory() {
  const { token, user, backendUrl } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Access Permission Shortcuts
  const isSystemAdmin = user?.role === 'admin';
  const currentUserEmployeeId = user?.employeeId ? parseInt(user.employeeId, 10) : null;

  // Creation Fields State Controls (Admin Only)
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newMobile, setNewMobile] = useState('');
  const [newDesignation, setNewDesignation] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newDepartment, setNewDepartment] = useState('Engineering');
  const [newRole, setNewRole] = useState('employee');

  // Modifying Workbench Modal States 
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '', department: '', designation: '', status: 'Active',
    mobile: '', address: '', salary: 0, start_date: '', end_date: ''
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
        setError('Failed to download active personnel directory.');
      }
    } catch (err) {
      setError('Network exception encountered during directory lookup.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchEmployees();
  }, [token]);

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
          joining_date: todayStr, salary: 0, start_date: todayStr, end_date: ''
        })
      });

      if (res.ok) {
        setSuccess(`User node for ${newName} successfully provisioned.`);
        setNewName(''); setNewEmail(''); setNewMobile(''); setNewDesignation(''); setNewAddress('');
        fetchEmployees();
      } else {
        const errData = await res.json();
        setError(errData.error || 'Server rejected creation payload.');
      }
    } catch (err) { setError('Identity provisioning communication failure.'); }
  };

  const handleInlineFieldUpdate = async (emp, fieldName, value) => {
    if (!isSystemAdmin) return; // Prevent employees from utilizing dropdown events
    setError(''); setSuccess('');
    
    const updatedPayload = {
      name: emp.name,
      department: fieldName === 'department' ? value : emp.department,
      designation: emp.designation,
      status: fieldName === 'status' ? value : (emp.status || 'Active'),
      mobile: emp.mobile || '',
      address: emp.address || '',
      salary: Number(emp.salary || 0),
      start_date: emp.start_date || '',
      end_date: emp.end_date || ''
    };

    try {
      const response = await fetch(`${backendUrl}/api/employees/${emp.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(updatedPayload)
      });
      if (response.ok) {
        setSuccess(`Inline metadata updated for ${emp.name}.`);
        fetchEmployees();
      }
    } catch (err) { setError('Communication break during inline mutation.'); }
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
      salary: Number(emp.salary || 0),
      start_date: emp.start_date || '',
      end_date: emp.end_date || ''
    });
  };

  const handleUpdateEmployeeDetails = async (e) => {
    e.preventDefault();
    if (!editingEmployee) return;
    setError(''); setSuccess('');

    try {
      const response = await fetch(`${backendUrl}/api/employees/${editingEmployee.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(editForm)
      });

      if (response.ok) {
        setSuccess(`Profile configurations updated successfully.`);
        setEditingEmployee(null);
        fetchEmployees();
      } else {
        const errData = await response.json();
        setError(errData.error || 'Server rejected update sequence execution.');
      }
    } catch (err) { setError('Communication failure during workbench save routing.'); }
  };

  return (
    <div className="space-y-8 animate-fadeIn text-gray-100 font-sans">
      <div className="flex justify-between items-center">
        <div>
          <span className="text-blue-400 text-xs font-bold uppercase tracking-widest font-mono">System Directory Shell</span>
          <h1 className="text-3xl font-black tracking-tight text-white mt-1">Personnel Management Console</h1>
          <p className="text-gray-400 text-sm mt-1">
            {isSystemAdmin ? 'Full administrative write-access profile grid control board.' : 'Secure corporate user access and self-profile maintenance panel.'}
          </p>
        </div>
        <button onClick={fetchEmployees} disabled={loading} className="p-2.5 bg-[#0f172a] hover:bg-[#1e293b] border border-[#1e293b] rounded-xl text-gray-300 transition-all"><RefreshCw size={16} className={loading ? 'animate-spin' : ''}/></button>
      </div>

      {error && <div className="p-4 bg-red-950/40 text-red-400 border border-red-800/40 rounded-xl text-xs flex items-center space-x-2"><AlertCircle size={16}/><span>{error}</span></div>}
      {success && <div className="p-4 bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 rounded-xl text-xs flex items-center space-x-2"><CheckCircle size={16}/><span>{success}</span></div>}

      {/* ADMIN WORKBENCH PROVISION CARD (Hidden completely from non-admin logins) */}
      {isSystemAdmin && (
        <div className="bg-[#0f172a] border border-[#1e293b] p-6 rounded-2xl shadow-xl">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white mb-5 font-mono">Provision User Profile Node</h3>
          <form onSubmit={handleProvisionProfile} className="space-y-4 text-xs">
            <div>
              <label className="block text-[10px] uppercase text-gray-400 font-bold tracking-wider mb-1">Full Legal Name</label>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)} required className="w-full bg-[#020617] border border-[#1e293b] rounded-xl p-2.5 text-white focus:outline-none focus:border-blue-500" placeholder="Jane Doe"/>
            </div>
            <div>
              <label className="block text-[10px] uppercase text-gray-400 font-bold tracking-wider mb-1">Corporate Identity Email</label>
              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required className="w-full bg-[#020617] border border-[#1e293b] rounded-xl p-2.5 text-white focus:outline-none focus:border-blue-500" placeholder="jane@xavvy.uk"/>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase text-gray-400 font-bold tracking-wider mb-1">Mobile Line</label>
                <input type="text" value={newMobile} onChange={e => setNewMobile(e.target.value)} className="w-full bg-[#020617] border border-[#1e293b] rounded-xl p-2.5 text-white focus:outline-none" placeholder="+44 7700 900077"/>
              </div>
              <div>
                <label className="block text-[10px] uppercase text-gray-400 font-bold tracking-wider mb-1">Designation</label>
                <input type="text" value={newDesignation} onChange={e => setNewDesignation(e.target.value)} required className="w-full bg-[#020617] border border-[#1e293b] rounded-xl p-2.5 text-white focus:outline-none" placeholder="Senior Developer"/>
              </div>
            </div>
            <div>
              <label className="block text-[10px] uppercase text-gray-400 font-bold tracking-wider mb-1">Physical Residence Address</label>
              <input type="text" value={newAddress} onChange={e => setNewAddress(e.target.value)} className="w-full bg-[#020617] border border-[#1e293b] rounded-xl p-2.5 text-white focus:outline-none" placeholder="Street, City, Postal Code"/>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase text-gray-400 font-bold tracking-wider mb-1">Department</label>
                <select value={newDepartment} onChange={e => setNewDepartment(e.target.value)} className="w-full bg-[#020617] border border-[#1e293b] rounded-xl p-2.5 text-white focus:outline-none font-mono">
                  <option value="Engineering">Engineering</option>
                  <option value="Product">Product</option>
                  <option value="Executive">Executive</option>
                  <option value="Operations">Operations</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase text-gray-400 font-bold tracking-wider mb-1">Permission Tier</label>
                <select value={newRole} onChange={e => setNewRole(e.target.value)} className="w-full bg-[#020617] border border-[#1e293b] rounded-xl p-2.5 text-white focus:outline-none font-mono">
                  <option value="employee">Standard User</option>
                  <option value="admin">System Admin</option>
                </select>
              </div>
            </div>
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition font-mono uppercase tracking-wider">Inject Profile Record Node</button>
          </form>
        </div>
      )}

      {/* ACTIVE PERSONNEL LEDGER GRID */}
      <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl overflow-hidden shadow-xl">
        <div className="p-6 border-b border-[#1e293b] bg-[#020617]/10">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white">Active Global Directory Ledger</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#020617]/30 text-gray-400 uppercase font-mono border-b border-[#1e293b] text-[11px] tracking-wide">
                <th className="p-4 w-16">ID</th>
                <th className="p-4">User Metadata Profile</th>
                <th className="p-4">Department Node</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e293b]">
              {employees.map((emp) => {
                const isOwnRecordRow = currentUserEmployeeId === emp.id;
                const canUserEditThisRow = isSystemAdmin || isOwnRecordRow;

                return (
                  <tr key={emp.id} className={`transition-all ${isOwnRecordRow ? 'bg-blue-950/10 border-l-2 border-l-blue-500' : 'hover:bg-[#1e293b]/10'}`}>
                    <td className="p-4 font-mono font-black text-blue-500">#{String(emp.id).padStart(3, '0')}</td>
                    <td className="p-4 space-y-1">
                      <div className="text-sm font-sans font-bold text-white flex items-center space-x-1.5">
                        <span>{emp.name}</span>
                        {isOwnRecordRow && <span className="text-[9px] font-mono font-extrabold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase tracking-wider flex items-center gap-1"><User size={10}/> Self</span>}
                      </div>
                      <div className="text-xs text-gray-400">{emp.designation}</div>
                      <div className="text-[11px] text-gray-500 font-mono">
                        {emp.mobile && <div>📞 {emp.mobile}</div>}
                        {emp.address && <div>📍 {emp.address}</div>}
                      </div>
                    </td>
                    <td className="p-4 font-mono">
                      <select
                        disabled={!isSystemAdmin} // LOCKED from employee view alteration changes
                        value={emp.department || 'Engineering'}
                        onChange={(e) => handleInlineFieldUpdate(emp, 'department', e.target.value)}
                        className={`bg-[#020617] border border-[#1e293b] text-gray-200 text-xs rounded-xl p-1.5 font-sans font-bold ${!isSystemAdmin ? 'opacity-80 cursor-not-allowed border-transparent' : 'focus:border-blue-500'}`}
                      >
                        <option value="Engineering">Engineering</option>
                        <option value="Product">Product</option>
                        <option value="Executive">Executive</option>
                        <option value="Operations">Operations</option>
                      </select>
                    </td>
                    <td className="p-4 font-mono">
                      <select
                        disabled={!isSystemAdmin} // LOCKED from employee view alteration changes
                        value={emp.status || 'Active'}
                        onChange={(e) => handleInlineFieldUpdate(emp, 'status', e.target.value)}
                        className={`border text-[10px] font-black uppercase tracking-wider rounded-xl p-1.5 bg-[#020617] ${!isSystemAdmin ? 'border-transparent opacity-80 cursor-not-allowed' : ''} ${
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
                        {/* CONDITIONAL RENDER: Only allow editing if Admin OR it is the employee's own row record */}
                        {canUserEditThisRow ? (
                          <button
                            type="button"
                            onClick={() => openEditModal(emp)}
                            className="p-1.5 bg-[#1e293b] hover:bg-blue-600 border border-[#334155] rounded-lg text-gray-300 hover:text-white transition-all shadow-md"
                            title={isOwnRecordRow ? "Modify My Profile Info" : "Admin Edit Panel"}
                          >
                            <Edit3 size={13}/>
                          </button>
                        ) : (
                          <div className="w-7 h-7"></div> // Empty spacer matching layout bounds
                        )}
                        <button type="button" className="px-3 py-1.5 bg-[#1e293b] hover:bg-[#222e3f] border border-[#334155] rounded-lg text-blue-400 text-[10px] font-bold uppercase tracking-widest">Compliance</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* REGISTERED INTERACTIVE MODAL OVERLAY DATA SECTOR */}
      {editingEmployee && (
        <div className="fixed inset-0 bg-[#020617]/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-xl bg-[#0f172a] border border-[#1e293b] rounded-2xl shadow-2xl overflow-hidden animate-fadeIn text-xs">
            <div className="p-6 border-b border-[#1e293b] bg-[#020617]/30 flex justify-between items-center">
              <div>
                <h2 className="text-sm font-bold uppercase text-white flex items-center space-x-2">
                  <Shield size={14} className="text-blue-400"/>
                  <span>{isSystemAdmin ? 'Modify Corporate Identity Frame' : 'Update Self Profile Record Meta'}</span>
                </h2>
                <p className="text-[11px] text-gray-400 mt-0.5">{isSystemAdmin ? `Overwriting backend arrays for ID #${editingEmployee.id}` : 'Manage personal mobile link and physical address details.'}</p>
              </div>
              <button onClick={() => setEditingEmployee(null)} className="text-gray-400 hover:text-white font-bold text-sm">✕</button>
            </div>

            <form onSubmit={handleUpdateEmployeeDetails} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase text-gray-400 font-bold tracking-wider mb-1">Full Legal Name</label>
                  <input type="text" value={editForm.name} readOnly={!isSystemAdmin} onChange={e => setEditForm({...editForm, name: e.target.value})} required className={`w-full bg-[#020617] border border-[#1e293b] rounded-xl p-2.5 text-white focus:outline-none ${!isSystemAdmin ? 'opacity-60 cursor-not-allowed' : 'focus:border-blue-500'}`}/>
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-gray-400 font-bold tracking-wider mb-1">Employment State Status</label>
                  <select value={editForm.status} disabled={!isSystemAdmin} onChange={e => setEditForm({...editForm, status: e.target.value})} className={`w-full bg-[#020617] border border-[#1e293b] rounded-xl p-2.5 text-white focus:outline-none font-mono ${!isSystemAdmin ? 'opacity-60 cursor-not-allowed' : 'focus:border-blue-500'}`}>
                    <option value="Active">Active</option>
                    <option value="Terminated">Terminated</option>
                    <option value="On Leave">On Leave</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase text-gray-400 font-bold tracking-wider mb-1">Department Map</label>
                  <input type="text" value={editForm.department} readOnly={!isSystemAdmin} onChange={e => setEditForm({...editForm, department: e.target.value})} className={`w-full bg-[#020617] border border-[#1e293b] rounded-xl p-2.5 text-white focus:outline-none ${!isSystemAdmin ? 'opacity-60 cursor-not-allowed' : 'focus:border-blue-500'}`}/>
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-gray-400 font-bold tracking-wider mb-1">Designation Title</label>
                  <input type="text" value={editForm.designation} readOnly={!isSystemAdmin} onChange={e => setEditForm({...editForm, designation: e.target.value})} className={`w-full bg-[#020617] border border-[#1e293b] rounded-xl p-2.5 text-white focus:outline-none ${!isSystemAdmin ? 'opacity-60 cursor-not-allowed' : 'focus:border-blue-500'}`}/>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 font-mono">
                <div>
                  <label className="block text-[10px] uppercase text-gray-400 font-bold font-sans tracking-wider mb-1">Annual Remuneration Base</label>
                  <input type="number" value={editForm.salary} readOnly={!isSystemAdmin} onChange={e => setEditForm({...editForm, salary: e.target.value})} className={`w-full bg-[#020617] border border-[#1e293b] rounded-xl p-2.5 text-white focus:outline-none ${!isSystemAdmin ? 'opacity-60 cursor-not-allowed' : 'focus:border-blue-500'}`}/>
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-gray-400 font-bold font-sans tracking-wider mb-1">Mobile Secure Link (Editable)</label>
                  <input type="text" value={editForm.mobile} onChange={e => setEditForm({...editForm, mobile: e.target.value})} className="w-full bg-[#020617] border border-[#1e293b] rounded-xl p-2.5 text-white focus:outline-none focus:border-blue-500"/>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase text-gray-400 font-bold tracking-wider mb-1">Registered Address Frame (Editable)</label>
                <input type="text" value={editForm.address} onChange={e => setEditForm({...editForm, address: e.target.value})} className="w-full bg-[#020617] border border-[#1e293b] rounded-xl p-2.5 text-white focus:outline-none focus:border-blue-500"/>
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button type="button" onClick={() => setEditingEmployee(null)} className="px-4 py-2 bg-[#1e293b] hover:bg-[#334155] rounded-xl font-bold uppercase text-[10px] tracking-wider transition-all">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold uppercase text-[10px] tracking-wider rounded-xl transition-all shadow-lg shadow-blue-600/10">Commit Storage Write</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}