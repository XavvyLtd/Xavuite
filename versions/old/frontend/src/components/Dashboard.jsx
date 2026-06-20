import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, Search, Calendar, User, ArrowRight, Activity, Clock, ShieldAlert } from 'lucide-react';

export default function Dashboard({ currentUser, setActiveTab }) {
  const { token, backendUrl } = useAuth();
  const [historyLogs, setHistoryLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Bulletproof Admin Check: Persists privileges even if state hydration is delayed
  const isSystemAdmin = 
    currentUser?.role === 'admin' || 
    currentUser?.email === 'admin@xavvy.uk' ||
    localStorage.getItem('user_email') === 'admin@xavvy.uk'; // Direct cache fallback

  useEffect(() => {
    const fetchAuditLogs = async () => {
      if (!token || !isSystemAdmin) return;
      setLoading(true);
      try {
        const res = await fetch(`${backendUrl}/api/history`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setHistoryLogs(data || []);
        }
      } catch (err) {
        console.error("Failed to query immutable audit telemetry:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAuditLogs();
  }, [token, isSystemAdmin, backendUrl]);

  // Filter logs gracefully based on search inputs
  const filteredLogs = historyLogs.filter(log => 
    log.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.field_changed?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fadeIn text-gray-100 font-sans">
      {/* HEADER SECTION CONTAINER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-xavvy-border/40 pb-5">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-purple-400 font-mono font-bold mb-1">Security Operations Matrix</div>
          <h1 className="text-2xl font-black text-white tracking-tight">Immutable Enterprise Audit Core</h1>
          <p className="text-xs text-xavvy-textMuted mt-1">Cryptographic tamper-evident operational state changes across personnel nodes.</p>
        </div>

        {isSystemAdmin && (
          <div className="relative w-full md:w-72 text-xs">
            <Search size={14} className="absolute left-3 top-3 text-xavvy-textMuted" />
            <input
              type="text"
              placeholder="Filter records by name or field..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-xavvy-surface border border-xavvy-border rounded-xl pl-9 pr-4 py-2.5 text-white focus:outline-none focus:border-purple-500 transition-all placeholder:text-xavvy-textMuted"
            />
          </div>
        )}
      </div>

      {/* CORE LOG ENGINE DISPLAY PANELS */}
      <div className="bg-xavvy-surface border border-xavvy-border rounded-2xl shadow-premium overflow-hidden">
        <div className="p-5 border-b border-xavvy-border/60 bg-xavvy-bg/20 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity size={14} className="text-purple-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono">Global Event Ledger Logs</h3>
          </div>
          <span className="text-[9px] font-mono bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded border border-purple-500/20 uppercase tracking-widest font-black">
            Admin Secure Access
          </span>
        </div>

        <div className="p-6 space-y-4">
          {!isSystemAdmin ? (
            <div className="p-8 text-center bg-xavvy-bg/40 border border-dashed border-xavvy-border rounded-xl space-y-2">
              <ShieldAlert size={24} className="text-red-400 mx-auto" />
              <div className="text-sm font-bold text-white uppercase tracking-wider">Access Restrained</div>
              <p className="text-xs text-xavvy-textMuted max-w-sm mx-auto">This terminal stack handles confidential, immutable compliance operations. Standard user permissions do not cover audit log stream visibility.</p>
            </div>
          ) : loading ? (
            <div className="text-center py-12 font-mono text-xs text-xavvy-textMuted flex items-center justify-center space-x-2">
              <Clock size={14} className="animate-spin text-purple-400" />
              <span>Streaming system ledger blocks...</span>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-xs text-xavvy-textMuted italic">
              Zero immutable change-events mapped to the current filter query.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLogs.map((log) => (
                <div 
                  key={log.id} 
                  className="p-4 bg-xavvy-bg/40 border border-xavvy-border/60 hover:border-purple-500/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all group"
                >
                  <div className="space-y-1.5 max-w-2xl">
                    <div className="text-xs text-gray-300">
                      User node <span className="text-purple-400 font-bold">"{log.name}"</span> experienced an isolated <span className="text-amber-400 font-bold">{log.field_changed}</span> configuration shift.
                    </div>
                    
                    {/* FIXED: Standard font-weight styling blocks. Strikethroughs completely eliminated */}
                    <div className="flex items-center flex-wrap gap-x-2 text-[11px] text-gray-400 font-mono select-all">
                      <span className="text-xavvy-textMuted font-sans">Historical Anchor State:</span>
                      <span className="text-amber-500 font-bold bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/10">"{log.old_value}"</span>
                      <ArrowRight size={12} className="text-gray-600 shrink-0 mx-0.5 group-hover:translate-x-0.5 transition-transform" />
                      <span className="text-xavvy-textMuted font-sans">New Active State:</span>
                      <span className="text-emerald-400 font-bold bg-emerald-950/20 px-1.5 py-0.5 rounded border border-emerald-500/10">"{log.new_value}"</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5 text-[10px] font-mono text-xavvy-textMuted bg-xavvy-surface px-2.5 py-1 rounded-lg border border-xavvy-border/40 shrink-0 self-start sm:self-center">
                    <Calendar size={11} className="text-purple-400" />
                    <span>{log.change_date}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}