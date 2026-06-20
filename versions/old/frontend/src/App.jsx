import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import Dashboard from './components/Dashboard';
import HRModule from './components/HRModule';
import TimesheetModule from './components/TimesheetModule';
import { Shield, Users, Calendar, Clock, LogOut, LayoutDashboard, User } from 'lucide-react';

export default function App() {
  const { token, logout, login, backendUrl, appContext } = useAuth();
  
  // Sniff out the domain context on runtime load
  const isTimesheetSubdomain = window.location.hostname.includes("timesheet");

  // Hydrates straight out of Storage Cache to persist across reloads cleanly
  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = localStorage.getItem('user_profile');
    try {
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (e) {
      console.error("Corrupted profile token cleared from storage cache arrays.");
      return null;
    }
  });

  // 🌟 FIX: Automatically fall back to timesheets workspace layout if accessed via timesheet subdomain
  const [activeTab, setActiveTab] = useState(() => {
    return isTimesheetSubdomain ? 'timesheets' : 'analytics';
  });

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Synchronize state changes over to localStorage whenever context alters
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('user_profile', JSON.stringify(currentUser));
      localStorage.setItem('user_email', currentUser.email || '');
    } else {
      localStorage.removeItem('user_profile');
      localStorage.removeItem('user_email');
    }
  }, [currentUser]);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const userProfile = await login(loginEmail, loginPassword);
      if (userProfile) {
        setCurrentUser(userProfile);
      } else {
        setAuthError('Invalid system access credentials provided.');
      }
    } catch (err) {
      setAuthError(err.message || 'Connection drop with corporate backend routing worker.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogoutAction = () => {
    setCurrentUser(null);
    logout();
  };

  // If there is no token or cached user session, serve the authentication terminal block
  if (!token || !currentUser) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center font-sans p-4 selection:bg-blue-500/30 selection:text-blue-200">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.05),transparent_45%)] pointer-events-none"></div>
        
        <div className="w-full max-w-sm bg-[#0f172a] border border-[#1e293b] rounded-2xl p-6 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col items-center mb-6 text-center">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/10 mb-3">
              <Shield size={20} className="text-white animate-pulse" />
            </div>
            <h2 className="text-lg font-black text-white uppercase tracking-tight">
              {isTimesheetSubdomain ? 'XavvyTimesheet' : 'XavvyHR'} Infrastructure
            </h2>
            <p className="text-[11px] text-[#94a3b8] font-mono mt-1 uppercase tracking-wider">Secure Access Authentication Node</p>
          </div>

          {authError && (
            <div className="mb-4 p-3 bg-red-950/40 border border-red-800/30 rounded-xl text-red-400 text-xs text-center font-medium animate-fadeIn">
              ⚠️ {authError}
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-[#94a3b8] mb-1">Corporate email identity</label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                className="w-full bg-[#020617] border border-[#1e293b] focus:border-blue-500 rounded-xl p-3 text-white transition-all focus:outline-none placeholder:text-[#475569]"
                placeholder="admin@xavvy.uk"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-[#94a3b8] mb-1">Access security key</label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                className="w-full bg-[#020617] border border-[#1e293b] focus:border-blue-500 rounded-xl p-3 text-white transition-all focus:outline-none placeholder:text-[#475569]"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-mono font-bold text-xs py-3 rounded-xl uppercase tracking-widest transition-all shadow-lg shadow-blue-600/20 mt-2"
            >
              {authLoading ? 'Verifying Node...' : 'Authenticate'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-gray-200 font-sans flex">
      
      {/* PERSISTENT ENTERPRISE CONTROL SIDEBAR */}
      <aside className="w-64 border-r border-[#1e293b] bg-[#0f172a] shrink-0 hidden md:flex flex-col justify-between p-5">
        <div className="space-y-6">
          <div className="flex items-center space-x-2.5 px-2">
            <div className="h-7 w-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <Shield size={14} className="text-white" />
            </div>
            <div className="text-xs font-black text-white uppercase tracking-wider font-mono">
              {isTimesheetSubdomain ? 'XavvyTimesheet Hub' : 'XavvyHR Hub'}
            </div>
          </div>

          <div className="bg-[#020617]/50 border border-[#1e293b] p-3 rounded-xl flex items-center space-x-2.5">
            <div className="h-8 w-8 rounded-full bg-[#1e293b] flex items-center justify-center text-blue-400 font-mono text-xs font-bold">
              <User size={14} />
            </div>
            <div className="truncate text-xs">
              <div className="font-bold text-white truncate">{currentUser.name || 'Admin Resource'}</div>
              <div className="text-[10px] font-mono text-[#94a3b8] capitalize truncate mt-0.5">{currentUser.role} session</div>
            </div>
          </div>

          {/* 🌟 FIX: Context-driven navigation tree switching based on domain resolution */}
          <nav className="space-y-1.5 text-xs">
            {isTimesheetSubdomain ? (
              <>
                <button
                  onClick={() => setActiveTab('timesheets')}
                  className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl font-bold uppercase tracking-wider transition-all ${activeTab === 'timesheets' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/10' : 'text-[#94a3b8] hover:bg-[#1e293b]/40 hover:text-white'}`}
                >
                  <Clock size={14} />
                  <span>Telemetry Engine</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setActiveTab('analytics')}
                  className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl font-bold uppercase tracking-wider transition-all ${activeTab === 'analytics' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/10' : 'text-[#94a3b8] hover:bg-[#1e293b]/40 hover:text-white'}`}
                >
                  <LayoutDashboard size={14} />
                  <span>Admin Audit Logs</span>
                </button>

                <button
                  onClick={() => setActiveTab('personnel')}
                  className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl font-bold uppercase tracking-wider transition-all ${activeTab === 'personnel' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/10' : 'text-[#94a3b8] hover:bg-[#1e293b]/40 hover:text-white'}`}
                >
                  <Users size={14} />
                  <span>Personnel Console</span>
                </button>

                <button
                  onClick={() => setActiveTab('timesheets')}
                  className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl font-bold uppercase tracking-wider transition-all ${activeTab === 'timesheets' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/10' : 'text-[#94a3b8] hover:bg-[#1e293b]/40 hover:text-white'}`}
                >
                  <Clock size={14} />
                  <span>Capacity Manager</span>
                </button>
              </>
            )}
          </nav>
        </div>

        <button
          onClick={handleLogoutAction}
          className="w-full flex items-center justify-center space-x-2 px-3 py-3 bg-[#1e293b]/30 hover:bg-red-950/20 text-[#94a3b8] hover:text-red-400 border border-[#1e293b] hover:border-red-900/30 rounded-xl text-xs font-mono font-bold uppercase tracking-widest transition-all"
        >
          <LogOut size={13} />
          <span>Exit Node</span>
        </button>
      </aside>

      {/* CORE ACTIVE WORKBENCH SCREEN ROUTER PORTAL */}
      <main className="flex-1 overflow-y-auto p-6 md:p-8 relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.02),transparent_40%)] pointer-events-none"></div>
        <div className="max-w-6xl mx-auto relative">
          {activeTab === 'analytics' && !isTimesheetSubdomain && <Dashboard currentUser={currentUser} setActiveTab={setActiveTab} />}
          {activeTab === 'personnel' && !isTimesheetSubdomain && <HRModule currentUser={currentUser} />}
          {activeTab === 'timesheets' && <TimesheetModule currentUser={currentUser} />}
        </div>
      </main>
    </div>
  );
}