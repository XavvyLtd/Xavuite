import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { CalendarDays, Send, Check, X } from 'lucide-react';

export default function LeaveModule() {
  const { user, token, backendUrl } = useAuth();
  const [leaves, setLeaves] = useState([]);
  const [form, setForm] = useState({ start_date: '', end_date: '', type: 'Vacation', reason: '' });

  const loadLeaves = async () => {
    const res = await fetch(`${backendUrl}/api/leaves`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    setLeaves(await res.json());
  };

  useEffect(() => { loadLeaves(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await fetch(`${backendUrl}/api/leaves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(form)
    });
    setForm({ start_date: '', end_date: '', type: 'Vacation', reason: '' });
    loadLeaves();
  };

  const handleAction = async (id, status) => {
    await fetch(`${backendUrl}/api/leaves/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ status })
    });
    loadLeaves();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Time Off / Leave Allocation Center</h1>
        <p className="text-gray-400 mt-1">Submit resource suspension requests and configure capacity management.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="bg-brand-card p-6 rounded-2xl border border-slate-800 shadow-xl h-fit">
          <h3 className="text-xl font-bold mb-6 flex items-center space-x-2 text-amber-400">
            <CalendarDays size={20}/> <span>Initiate Absence Flow</span>
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Start Date</label>
                <input type="date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} required className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white text-sm focus:border-brand-accent focus:outline-none"/>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1">End Date</label>
                <input type="date" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} required className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white text-sm focus:border-brand-accent focus:outline-none"/>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Leave Classification</label>
              <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white text-sm focus:border-brand-accent focus:outline-none">
                <option value="Vacation">Annual Vacation Break</option>
                <option value="Medical">Medical / Emergency Sick Node</option>
                <option value="Personal">Personal Asset Restructured Time</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Context / Business Rationale</label>
              <textarea value={form.reason} onChange={e => setForm({...form, reason: e.target.value})} required className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white text-sm focus:border-brand-accent focus:outline-none h-24 resize-none" placeholder="Provide context..."></textarea>
            </div>
            <button type="submit" className="w-full bg-amber-600 hover:bg-amber-500 font-bold p-3 rounded-xl transition shadow-lg shadow-amber-600/10 flex items-center justify-center space-x-2">
              <Send size={16}/> <span>Transmit Exemption Dispatch</span>
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 bg-brand-card rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
          <div className="p-6 border-b border-slate-800">
            <h3 className="text-xl font-bold">Organizational Exemption Matrix</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-slate-900 text-xs font-bold uppercase tracking-wider text-gray-400">
                <tr>
                  <th className="p-4">Node Profile</th>
                  <th className="p-4">Classification</th>
                  <th className="p-4">Temporal Bounds</th>
                  <th className="p-4">Context Note</th>
                  <th className="p-4">Lifecycle Status</th>
                  {user?.role === 'admin' && <th className="p-4 text-center">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {leaves.map(l => (
                  <tr key={l.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-4 font-bold text-white">{l.name}</td>
                    <td className="p-4 text-xs font-mono">{l.type}</td>
                    <td className="p-4 text-xs font-mono text-gray-400">{l.start_date} → {l.end_date}</td>
                    <td className="p-4 max-w-xs truncate text-gray-400">{l.reason}</td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${
                        l.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        l.status === 'Rejected' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>
                        {l.status}
                      </span>
                    </td>
                    {user?.role === 'admin' && (
                      <td className="p-4 flex items-center justify-center space-x-2">
                        {l.status === 'Pending' && (
                          <>
                            <button onClick={() => handleAction(l.id, 'Approved')} className="p-1 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded transition border border-emerald-500/30">
                              <Check size={14}/>
                            </button>
                            <button onClick={() => handleAction(l.id, 'Rejected')} className="p-1 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white rounded transition border border-red-500/30">
                              <X size={14}/>
                            </button>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}