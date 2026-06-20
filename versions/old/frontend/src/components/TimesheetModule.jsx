import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Clock, RefreshCw, CheckCircle, AlertCircle, PlusCircle } from 'lucide-react';

export default function TimesheetModule() {
  const { token, user, backendUrl } = useAuth();
  const [timesheets, setTimesheets] = useState([]);
  const [myTasks, setMyTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Submission State Hooks
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [hours, setHours] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [customNotes, setCustomNotes] = useState('');

  const fetchTimesheetData = async () => {
    setLoading(true);
    try {
      const tsRes = await fetch(`${backendUrl}/api/timesheets`, { headers: { 'Authorization': `Bearer ${token}` } });
      const taskRes = await fetch(`${backendUrl}/api/my-tasks`, { headers: { 'Authorization': `Bearer ${token}` } });
      
      if (tsRes.ok) setTimesheets(await tsRes.json());
      if (taskRes.ok) setMyTasks(await taskRes.json());
    } catch (e) {
      console.error("Telemetry engine synchronization failure.", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchTimesheetData();
  }, [token]);

  const handleSubmitHours = async (e) => {
    e.preventDefault();
    if (!hours || !selectedTaskId) return;

    // Find the text metadata of the chosen task matching the ID
    const taskObj = myTasks.find(t => String(t.id) === String(selectedTaskId));
    const combinedDescription = `[Task #${selectedTaskId}] ${taskObj ? taskObj.task_name : 'Agile Task Operations'}${customNotes ? ` - Notes: ${customNotes}` : ''}`;

    try {
      const res = await fetch(`${backendUrl}/api/timesheets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ date, hours_worked: parseFloat(hours), description: combinedDescription })
      });
      if (res.ok) {
        setHours('');
        setCustomNotes('');
        setSelectedTaskId('');
        fetchTimesheetData();
      }
    } catch (e) {
      console.error("Failed to stream hours entry packet.", e);
    }
  };

  const handleProcessApproval = async (id, targetStatus) => {
    try {
      const res = await fetch(`${backendUrl}/api/timesheets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ status: targetStatus })
      });
      if (res.ok) fetchTimesheetData();
    } catch (e) {
      console.error("Approval state transition error.", e);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn text-gray-100">
      <div className="flex justify-between items-center">
        <div>
          <span className="text-xavvy-accent text-xs font-bold uppercase tracking-widest font-mono">Telemetry Processing</span>
          <h1 className="text-3xl font-black tracking-tight text-white mt-1">Timesheet Logging Console</h1>
          <p className="text-xavvy-textMuted text-sm mt-1">
            {user?.role === 'admin' 
              ? 'Global oversight ledger managing resource hours aggregation and approvals.' 
              : 'Log and map hours spent directly against your active lifecycle project tasks.'}
          </p>
        </div>
        <button onClick={fetchTimesheetData} disabled={loading} className="p-3 bg-xavvy-surface hover:bg-xavvy-elevated text-white rounded-xl border border-xavvy-border transition disabled:opacity-40">
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
        {/* TIME SUBMISSION CARD - Only displayed for standard employee profiles or configured admins */}
        {user?.role !== 'admin' || myTasks.length > 0 ? (
          <div className="bg-xavvy-surface border border-xavvy-border p-6 rounded-2xl shadow-premium">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white mb-5 flex items-center space-x-2">
              <Clock size={16} className="text-xavvy-accent" />
              <span>Record Sprint Operation</span>
            </h3>
            <form onSubmit={handleSubmitHours} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase text-xavvy-textMuted font-bold tracking-wider mb-1">Target Production Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="w-full bg-xavvy-bg border border-xavvy-border rounded-xl p-2.5 text-white text-xs focus:outline-none focus:border-xavvy-accent font-mono" />
              </div>

              <div>
                <label className="block text-[10px] uppercase text-xavvy-textMuted font-bold tracking-wider mb-1">Select Current Task Assignment</label>
                <select 
                  value={selectedTaskId} 
                  onChange={e => setSelectedTaskId(e.target.value)} 
                  required 
                  className="w-full bg-xavvy-bg border border-xavvy-border rounded-xl p-2.5 text-white text-xs font-sans focus:outline-none focus:border-xavvy-accent"
                >
                  <option value="">-- Choose Assigned Active Task Node --</option>
                  {myTasks.map(t => (
                    <option key={t.id} value={t.id}>[{t.sprint_name}] {t.task_name}</option>
                  ))}
                </select>
                {myTasks.length === 0 && (
                  <span className="text-[10px] text-amber-400 mt-1 block font-mono">⚠️ You have zero incomplete tasks allocated in XavvyPM.</span>
                )}
              </div>

              <div>
                <label className="block text-[10px] uppercase text-xavvy-textMuted font-bold tracking-wider mb-1">Quantity (Hours Input)</label>
                <input type="number" step="0.5" min="0.5" max="24" value={hours} onChange={e => setHours(e.target.value)} required className="w-full bg-xavvy-bg border border-xavvy-border rounded-xl p-2.5 text-white text-xs focus:outline-none focus:border-xavvy-accent font-mono" placeholder="E.g., 7.5" />
              </div>

              <div>
                <label className="block text-[10px] uppercase text-xavvy-textMuted font-bold tracking-wider mb-1">Supplementary Execution Notes (Optional)</label>
                <textarea value={customNotes} onChange={e => setCustomNotes(e.target.value)} className="w-full bg-xavvy-bg border border-xavvy-border rounded-xl p-2.5 text-white text-xs focus:outline-none focus:border-xavvy-accent font-sans h-20 resize-none" placeholder="Add optional details regarding progress milestones achieved..." />
              </div>

              <button type="submit" disabled={!selectedTaskId} className="w-full bg-xavvy-accent hover:bg-blue-500 text-white text-xs font-bold py-3 rounded-xl transition shadow-lg disabled:opacity-30 uppercase tracking-wider font-mono">
                Commit Time Allocation Packet
              </button>
            </form>
          </div>
        ) : (
          <div className="bg-xavvy-surface border border-purple-500/20 p-6 rounded-2xl text-center">
            <AlertCircle size={24} className="text-purple-400 mx-auto mb-2" />
            <h4 className="text-xs uppercase font-mono tracking-wider font-bold text-white">Administrative View Filter</h4>
            <p className="text-[11px] text-xavvy-textMuted mt-1 font-sans">System Root Account is active. Utilize the adjacent processing deck rows to authorize subordinate team hour logs.</p>
          </div>
        )}

        {/* TIME TRACKING HISTORICAL LEDGER GRID */}
        <div className="xl:col-span-2 bg-xavvy-surface border border-xavvy-border rounded-2xl shadow-premium overflow-hidden">
          <div className="p-6 border-b border-xavvy-border bg-xavvy-bg/30 flex justify-between items-center">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              {user?.role === 'admin' ? 'Global Operations Hours Ledger' : 'Your Personal Time Submissions'}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-xavvy-border/60 bg-xavvy-bg/20 text-[10px] font-bold uppercase tracking-wider text-xavvy-textMuted">
                  <th className="p-4 w-24">Log Date</th>
                  <th className="p-4">Resource Identity / Linked Task Execution Context</th>
                  <th className="p-4 w-16 text-center">Volume</th>
                  <th className="p-4 w-24">State</th>
                  {user?.role === 'admin' && <th className="p-4 text-center w-32">Governance</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-xavvy-border/40 font-mono text-xs text-gray-300">
                {timesheets.length === 0 ? (
                  <tr>
                    <td colSpan={user?.role === 'admin' ? 5 : 4} className="p-8 text-center text-xavvy-textMuted font-mono">
                      Zero operational telemetry packets currently stored in database buffer rows.
                    </td>
                  </tr>
                ) : (
                  timesheets.map((ts) => (
                    <tr key={ts.id} className="hover:bg-xavvy-elevated/20 transition duration-150">
                      <td className="p-4 font-bold text-gray-400">{ts.date}</td>
                      <td className="p-4 font-sans">
                        {user?.role === 'admin' && (
                          <div className="text-xs font-black text-xavvy-accent mb-0.5 uppercase tracking-wide">👤 Data Node: {ts.name}</div>
                        )}
                        <div className="text-white font-medium line-clamp-2 leading-relaxed text-xs">{ts.description}</div>
                      </td>
                      <td className="p-4 text-center text-emerald-400 font-bold">{ts.hours_worked}h</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${
                          ts.status === 'Approved' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                          ts.status === 'Rejected' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                          'bg-amber-500/10 border-amber-500/20 text-amber-400'
                        }`}>
                          {ts.status}
                        </span>
                      </td>
                      {user?.role === 'admin' && (
                        <td className="p-4 text-center flex items-center justify-center space-x-1.5 h-full pt-5">
                          {ts.status === 'Pending' ? (
                            <>
                              <button 
                                onClick={() => handleProcessApproval(ts.id, 'Approved')}
                                className="p-1 bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/30 rounded text-emerald-400 hover:text-white transition"
                                title="Authorize Pack"
                              >
                                <PlusCircle size={14} />
                              </button>
                              <button 
                                onClick={() => handleProcessApproval(ts.id, 'Rejected')}
                                className="p-1 bg-red-600/20 hover:bg-red-600 border border-red-500/30 rounded text-red-400 hover:text-white transition"
                                title="Drop Pack"
                              >
                                <AlertCircle size={14} />
                              </button>
                            </>
                          ) : (
                            <span className="text-[10px] text-gray-500 italic font-mono">Settled</span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}