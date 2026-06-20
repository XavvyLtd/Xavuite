import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { CalendarDays, Layers, PlusCircle, BarChart3, PieChart, Users, CheckCircle2, Clock } from 'lucide-react';

// --- NEW COMPONENT INTEGRATIONS SCOPED FOR XAVVY-PMS-APP ---
import RepoOverview from './RepoOverview';
import VaultModule from './VaultModule';

export default function PMSModule() {
  const { token, user, backendUrl } = useAuth();
  const [sprints, setSprints] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(false);

  // Administrative Workspace View State Extended for Repositories
  // Supported Modes: 'dashboard' | 'kanban' | 'vault-grid' | 'vault-detail'
  const [adminViewMode, setAdminViewMode] = useState('dashboard');
  const [selectedProjectId, setSelectedProjectId] = useState(null);

  // Task Creation Fields
  const [taskName, setTaskName] = useState('');
  const [selectedSprint, setSelectedSprint] = useState('');
  const [selectedPhase, setSelectedPhase] = useState('Development');
  const [selectedResource, setSelectedResource] = useState('');

  const fetchPMSData = async () => {
    setLoading(true);
    try {
      const sp = await fetch(`${backendUrl}/api/pms/sprints`, { headers: { 'Authorization': `Bearer ${token}` } });
      const ms = await fetch(`${backendUrl}/api/pms/milestones`, { headers: { 'Authorization': `Bearer ${token}` } });
      const tk = await fetch(`${backendUrl}/api/pms/tasks`, { headers: { 'Authorization': `Bearer ${token}` } });
      const rs = await fetch(`${backendUrl}/api/employees`, { headers: { 'Authorization': `Bearer ${token}` } });

      if (sp.ok) {
        const sprintsData = await sp.json();
        setSprints(sprintsData || []);
        if (sprintsData && sprintsData.length > 0 && !selectedSprint) {
          const today = new Date().toISOString().split('T')[0];

          const currentActive = sprintsData.find(
            s => s.start_date <= today && s.end_date >= today
          );
          setSelectedSprint(String(currentActive ? currentActive.id : sprintsData[0].id));
        }
      }
      if (ms.ok) setMilestones(await ms.json() || []);
      if (tk.ok) setTasks(await tk.json() || []);
      if (rs.ok) setResources(await rs.json() || []);
    } catch (e) {
      console.error("PMS analytics structural load failure.", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchPMSData();
  }, [token]);

  useEffect(() => {
    if (sprints && sprints.length > 0 && !selectedSprint) {
      setSelectedSprint(String(sprints[0].id));
    }
  }, [sprints, selectedSprint]);

  // --- SAFE TELEMETRY METRICS ENGINE (Defensive Default Anchors) ---
  const safeTasks = tasks || [];
  const safeSprints = sprints || [];
  const safeMilestones = milestones || [];
  const safeResources = resources || [];

const isAdminUser =
  user?.role === 'admin' ||
  user?.email === 'admin@xavvy.uk';

  const today = new Date().toISOString().split('T')[0];

  const activeSprint = safeSprints.find(
    s => s.start_date <= today && s.end_date >= today
  );

  const activeSprintTasks = activeSprint
    ? safeTasks.filter(t => t.sprint_id === activeSprint.id)
    : [];

const totalTasksCount = activeSprintTasks.length;

const completedTasksCount =
  activeSprintTasks.filter(
    t => t.status === 'Complete'
  ).length;

const inProgressTasksCount =
  activeSprintTasks.filter(
    t =>
      t.status === 'In Progress' ||
      t.status === 'In Review'
  ).length;
  
  const completionRatePercent = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  // Phase breakdown counts matrix calculation
  const phaseBreakdown = { Requirements: 0, Architecture: 0, Development: 0, Testing: 0, Deployment: 0 };
  activeSprintTasks.forEach(t => { 
    if (t.phase && phaseBreakdown[t.phase] !== undefined) phaseBreakdown[t.phase]++; 
  });

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!taskName || !selectedSprint) return;
    try {
      const res = await fetch(`${backendUrl}/api/pms/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          sprint_id: parseInt(selectedSprint),
          assigned_employee_id: selectedResource ? parseInt(selectedResource) : null,
          task_name: taskName,
          phase: selectedPhase
        })
      });
      if (res.ok) {
        setTaskName('');
        fetchPMSData();
      }
    } catch (e) { console.error(e); }
  };

  const handleUpdateTaskStatus = async (id, newStatus) => {
    try {
      const res = await fetch(`${backendUrl}/api/pms/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) fetchPMSData();
    } catch (e) { console.error(e); }
  };

  const handleSelectProject = (id) => {
    setSelectedProjectId(id);
    setAdminViewMode('vault-detail');
  };

  const handleInitializeSDLC = async () => {
    try {

      const response = await fetch(
        `${backendUrl}/api/pms/initialize-sdlc`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          }
        }
      );

      const result = await response.json();

      if (!response.ok) {

        alert(
          result.error ||
          'Failed to initialize SDLC tasks'
        );

        return;
      }

      alert(
            `Successfully generated ${
          result.totalCreated ||
          result.data?.totalCreated ||
          0
        } SDLC tasks`
      );

      await fetchPMSData();

    } catch (err) {

      console.error(err);

      alert(
        'Server error during SDLC initialization'
      );
    }
  };

  const handleForceSprintTransition = async () => {
  try {

    const response = await fetch(
      `${backendUrl}/api/pms/force-sprint-transition`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
    );

    const result = await response.json();

    if (!response.ok) {

      alert(
        result.error ||
        'Failed to execute sprint transition'
      );

      return;
    }

    alert(
      'Sprint lifecycle automation executed successfully'
    );

    await fetchPMSData();

    } catch (err) {

      console.error(err);

      alert(
        'Server error during sprint transition'
      );
    }
  };

  const triggerCron = async (cronType) => {

    try {

      const response = await fetch(
        `${backendUrl}/api/debug/trigger-cron?cron=${cronType}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const result = await response.json();

      if (!response.ok) {

        alert(
          result.error ||
          'Cron execution failed'
        );

        return;
      }

      alert(
        result.message ||
        'Cron executed successfully'
      );

    } catch (err) {

      console.error(err);

      alert(
        'Server error while executing cron'
      );
    }
  };

  const handleRunWeeklyDigest = async () => {
  await fetch(`${API_BASE}/api/debug/run-cron?cron=digest`, {
    method: 'POST',
    headers: authHeaders
  });

    alert('Weekly digest executed');
  };

const handleRunFridayReminder = async () => {
  await fetch(`${API_BASE}/api/debug/run-cron?cron=timesheet`, {
    method: 'POST',
    headers: authHeaders
  });

  alert('Friday reminder executed');
};

  return (
    <div className="space-y-8 animate-fadeIn text-gray-100">
      {/* Top Header Control Section */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <span className="text-blue-400 text-xs font-bold uppercase tracking-widest font-mono">Agile Workflow Management</span>
          <h1 className="text-3xl font-black tracking-tight text-white mt-1">Product Lifecycle Engine</h1>
          <p className="text-xavvy-textMuted text-sm mt-1">Comprehensive project telemetry monitoring the 3-year agile development lifecycle pipeline.</p>
        </div>

      {/* Dynamic View Controller Toggle Switcher */}
<div className="flex bg-xavvy-surface p-1 rounded-xl border border-xavvy-border self-start md:self-center font-mono text-[11px] font-bold z-20 relative">

  {/* Dashboard */}
  <button
    type="button"
    onClick={() => setAdminViewMode('dashboard')}
    className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg transition-all ${
      adminViewMode === 'dashboard'
        ? 'bg-blue-600 text-white shadow-glow'
        : 'text-xavvy-textMuted hover:text-white'
    }`}
  >
    <BarChart3 size={14}/>
    <span>Dashboard Hub</span>
  </button>

  {/* Kanban */}
  <button
    type="button"
    onClick={() => setAdminViewMode('kanban')}
    className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg transition-all ${
      adminViewMode === 'kanban'
        ? 'bg-blue-600 text-white shadow-glow'
        : 'text-xavvy-textMuted hover:text-white'
    }`}
  >
    <Layers size={14}/>
    <span>Task Kanban Board</span>
  </button>

  {/* Admin Actions */}
  {(
      isAdminUser 
    )  && (
    <>
      <button
        type="button"
        onClick={handleInitializeSDLC}
        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-semibold transition-all"
      >
        Initialize SDLC Tasks
      </button>

      <button
        type="button"
        onClick={handleForceSprintTransition}
        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-semibold transition-all"
      >
        Force Sprint Transition
      </button>
      <button
        type="button"
        onClick={() => triggerCron('tasks')}
        className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg font-semibold transition-all"
      >
        Run Weekly Digest
      </button>

      <button
        type="button"
        onClick={() => triggerCron('timesheet')}
        className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-semibold transition-all"
      >
        Trigger Friday Reminder
      </button>
    </>
  )}

  {/* Vaults */}
  <button
    type="button"
    onClick={() => setAdminViewMode('vault-grid')}
    className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg transition-all ${
      adminViewMode === 'vault-grid' || adminViewMode === 'vault-detail'
        ? 'bg-blue-600 text-white shadow-glow'
        : 'text-xavvy-textMuted hover:text-white'
    }`}
  >
    <span>📂</span>
    <span>Document Vaults</span>
  </button>

  </div>
</div>
      {/* Top Milestone Cards View Row (Always Displayed for Operational Baseline Visibility) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {safeMilestones.slice(0, 2).map((m) => (
          <div key={m.id} className="bg-xavvy-surface border border-xavvy-border p-5 rounded-xl shadow-premium relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 text-white/5"><CalendarDays size={48}/></div>
            <span className="text-[9px] font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full uppercase">Target: {m.target_date}</span>
            <h4 className="text-sm font-bold text-white mt-2 font-sans">{m.milestone_name}</h4>
            <p className="text-xavvy-textMuted text-xs mt-1 leading-relaxed font-sans">{m.description}</p>
          </div>
        ))}
      </div>

      {/* CORE RENDER GATEWAY MATRIX SWITCH */}
      
      {/* 1. DASHBOARD VIEW PANE */}
      {adminViewMode === 'dashboard' && (
        <div className="space-y-8">
          {/* Core Counter Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-xavvy-surface border border-xavvy-border p-5 rounded-2xl flex items-center space-x-4">
              <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl"><Layers size={20}/></div>
              <div>
                <div className="text-2xl font-black text-white">{totalTasksCount}</div>
                <div className="text-[11px] uppercase tracking-wider text-xavvy-textMuted font-bold mt-0.5">Total Task Nodes</div>
              </div>
            </div>
            <div className="bg-xavvy-surface border border-xavvy-border p-5 rounded-2xl flex items-center space-x-4">
              <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl"><Clock size={20}/></div>
              <div>
                <div className="text-2xl font-black text-white">{inProgressTasksCount}</div>
                <div className="text-[11px] uppercase tracking-wider text-xavvy-textMuted font-bold mt-0.5">Active In Flight</div>
              </div>
            </div>
            <div className="bg-xavvy-surface border border-xavvy-border p-5 rounded-2xl flex items-center space-x-4">
              <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl"><CheckCircle2 size={20}/></div>
              <div>
                <div className="text-2xl font-black text-white">{completedTasksCount}</div>
                <div className="text-[11px] uppercase tracking-wider text-xavvy-textMuted font-bold mt-0.5">Completed</div>
              </div>
            </div>
            <div className="bg-xavvy-surface border border-xavvy-border p-5 rounded-2xl flex items-center space-x-4">
              <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl"><PieChart size={20}/></div>
              <div>
                <div className="text-2xl font-black text-white">{completionRatePercent}%</div>
                <div className="text-[11px] uppercase tracking-wider text-xavvy-textMuted font-bold mt-0.5">Velocity Target</div>
              </div>
            </div>
          </div>

          {/* Charts & Allocation Matrices */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <div className="bg-xavvy-surface border border-xavvy-border p-6 rounded-2xl shadow-premium lg:col-span-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white mb-6 flex items-center space-x-2 font-mono">
                <PieChart size={16} className="text-blue-400" />
                <span>Lifecycle Phase Distribution Balance</span>
              </h3>
              <div className="space-y-4 font-mono text-xs">
                {Object.entries(phaseBreakdown).map(([phase, count]) => {
                  const maxCount = Math.max(...Object.values(phaseBreakdown), 1);
                  const widthPercentage = Math.round((count / maxCount) * 100);
                  return (
                    <div key={phase} className="space-y-1.5">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-gray-300 font-bold uppercase tracking-wide">{phase} Operations Phase</span>
                        <span className="text-blue-400 font-black">{count} Active Task Nodes</span>
                      </div>
                      <div className="w-full bg-xavvy-bg h-3 rounded-full overflow-hidden border border-xavvy-border/40">
                        <div 
                          style={{ width: `${widthPercentage}%` }} 
                          className="bg-gradient-to-r from-blue-600 to-indigo-500 h-full rounded-full transition-all duration-500"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-xavvy-surface border border-xavvy-border p-6 rounded-2xl shadow-premium">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white mb-6 flex items-center space-x-2 font-mono">
                <Users size={16} className="text-blue-400" />
                <span>Resource Allocation Limits Matrix</span>
              </h3>
              <div className="space-y-4">
                {safeResources.filter(r => r.id !== 1).map(resNode => {
                  const currentAllocationsCount = activeSprintTasks.filter(t => t.assigned_employee_id === resNode.id && t.status !== 'Complete').length;
                  return (
                    <div key={resNode.id} className="flex justify-between items-center bg-xavvy-bg/40 p-3 border border-xavvy-border/40 rounded-xl">
                      <div>
                        <div className="text-xs font-bold text-white font-sans">{resNode.name}</div>
                        <div className="text-[10px] text-xavvy-textMuted font-mono mt-0.5">{resNode.designation}</div>
                      </div>
                      <span className={`font-mono text-xs font-black px-2.5 py-1 rounded-lg border uppercase tracking-wider ${
                        currentAllocationsCount >= 3 ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                        currentAllocationsCount > 0 ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                        'bg-gray-500/10 border-xavvy-border text-gray-400'
                      }`}>
                        {currentAllocationsCount} Loaded
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Master 3-Year Sprints Roadmap */}
          <div className="bg-xavvy-surface border border-xavvy-border rounded-2xl shadow-premium overflow-hidden">
            <div className="p-6 border-b border-xavvy-border bg-xavvy-bg/30">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white font-mono">3-Year Long Range Agile Calendar Pipeline</h3>
            </div>
            <div className="p-6 overflow-x-auto">
              <div className="flex space-x-4 pb-2 font-mono text-xs">
                {safeSprints.map(s => {
                  const sprintTasks = safeTasks.filter(t => t.sprint_id === s.id);
                  const CompleteSprintCount = sprintTasks.filter(t => t.status === 'Complete').length;
                  return (
                    <div key={s.id} className={`p-4 border rounded-xl min-w-[210px] space-y-2 flex-shrink-0 ${
                      s.start_date <= today && s.end_date >= today ? 'bg-blue-950/20 border-blue-500/40 shadow-glow' : 'bg-xavvy-bg/60 border-xavvy-border/60'
                    }`}>
                      <div className="flex justify-between items-center">
                        <span className="font-black text-white text-xs">Sprint #{String(s.sprint_number).padStart(2, '0')}</span>
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase tracking-widest ${
                          s.start_date <= today && s.end_date >= today
                              ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                              : 'bg-gray-500/10 border-xavvy-border text-gray-400'
                        }`}>{s.start_date <= today && s.end_date >= today? 'ACTIVE': s.status}
                        </span>
                      </div>
                      <div className="text-[10px] text-xavvy-textMuted truncate font-sans font-bold">{s.sprint_name}</div>
                      <div className="text-[9px] text-gray-500">{s.start_date} $\rightarrow$ {s.end_date}</div>
                      <div className="pt-1 flex justify-between text-[10px] font-bold text-gray-400">
                        <span>Allocated: {sprintTasks.length}</span>
                        <span className="text-emerald-400">Settled: {CompleteSprintCount}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. KANBAN INTERACTIVE VIEW */}
      {adminViewMode === 'kanban' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
          {/* Form Creation Workbench */}
          <div className="bg-xavvy-surface border border-xavvy-border p-6 rounded-2xl shadow-premium">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white mb-5 flex items-center space-x-2 font-sans">
              <PlusCircle size={16} className="text-blue-400" />
              <span>Append Lifecycle Task</span>
            </h3>
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase text-xavvy-textMuted font-bold tracking-wider mb-1">Task Scope & Title</label>
                <input type="text" value={taskName} onChange={e => setTaskName(e.target.value)} required className="w-full bg-xavvy-bg border border-xavvy-border rounded-xl p-2.5 text-white text-xs focus:outline-none focus:border-blue-500 font-mono" placeholder="E.g., Write DB constraints validation migration script"/>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase text-xavvy-textMuted font-bold tracking-wider mb-1">Active Sprint Window</label>
                  <select value={selectedSprint} onChange={e => setSelectedSprint(e.target.value)} required className="w-full bg-xavvy-bg border border-xavvy-border rounded-xl p-2 text-white text-xs font-mono">
                    {safeSprints.map(s => (
                      <option key={s.id} value={s.id}>Sprint {s.sprint_number} ({s.status})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-xavvy-textMuted font-bold tracking-wider mb-1">Development Phase</label>
                  <select value={selectedPhase} onChange={e => setSelectedPhase(e.target.value)} className="w-full bg-xavvy-bg border border-xavvy-border rounded-xl p-2 text-white text-xs font-mono">
                    <option value="Requirements">Requirements Phase</option>
                    <option value="Architecture">Architecture Phase</option>
                    <option value="Development">Development Phase</option>
                    <option value="Testing">Testing & Verification</option>
                    <option value="Deployment">Production Deployment</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase text-xavvy-textMuted font-bold tracking-wider mb-1">Mapped HR Resource Allocation</label>
                <select value={selectedResource} onChange={e => setSelectedResource(e.target.value)} className="w-full bg-xavvy-bg border border-xavvy-border rounded-xl p-2.5 text-white text-xs font-sans font-bold">
                  <option value="">-- Unassigned Backlog Pool --</option>
                  {safeResources.filter(r => r.id !== 1).map(r => (
                    <option key={r.id} value={r.id}>{r.name} ({r.designation})</option>
                  ))}
                </select>
              </div>

              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-3 rounded-xl transition shadow-lg shadow-blue-600/10 mt-2 font-mono uppercase tracking-wider">
                Inject Agile Task Node
              </button>
            </form>
          </div>

          {/* Kanban Tracking Matrix */}
          <div className="xl:col-span-2 bg-xavvy-surface border border-xavvy-border rounded-2xl shadow-premium overflow-hidden">
            <div className="p-6 border-b border-xavvy-border bg-xavvy-bg/30 flex justify-between items-center">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white font-sans">Active Product Execution Board</h3>
              <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono font-bold px-2 py-0.5 rounded-full uppercase">Kanban Matrix Stream</span>
            </div>

            <div className="p-6 space-y-3 max-h-[520px] overflow-y-auto">
              {activeSprintTasks.length === 0 ? (
                <p className="text-xs text-xavvy-textMuted font-mono text-center py-6">Zero task node matrices currently initialized inside this production loop.</p>
              ) : (
                activeSprintTasks.map((t) => (
                  <div key={t.id} className="p-4 bg-xavvy-bg border border-xavvy-border rounded-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4 font-mono text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-xavvy-elevated border text-blue-400 border-xavvy-border uppercase tracking-wide">{t.sprint_name}</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-950/40 border border-purple-800/40 text-purple-300 uppercase tracking-wide">{t.phase}</span>
                      </div>
                      <p className="text-white font-sans font-bold text-sm pt-0.5">{t.task_name}</p>
                      <div className="text-[10px] text-xavvy-textMuted flex items-center space-x-1 font-sans">
                        <span className="text-gray-500">Resource:</span>
                        <span className={t.assigned_name ? 'text-xavvy-accent font-bold' : 'text-amber-400 font-bold'}>
                          {t.assigned_name ? `${t.assigned_name} [${t.assigned_designation}]` : '⚠️ Backlog Allocation Required'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 self-start md:self-center">
                      <span className="text-[10px] text-xavvy-textMuted hidden md:inline">Status:</span>
                      <select 
                        value={t.status} 
                        onChange={(e) => handleUpdateTaskStatus(t.id, e.target.value)}
                        className={`bg-xavvy-surface border rounded-xl px-2 py-1.5 text-[10px] font-black uppercase tracking-wider cursor-pointer ${
                          t.status === 'Complete' ? 'text-emerald-400 border-emerald-500/20' : t.status === 'In Progress' ? 'text-blue-400 border-blue-500/20' : 'text-gray-400 border-xavvy-border'
                        }`}
                      >
                        <option value="Backlog">Backlog</option>
                        <option value="In Progress">In Progress</option>
                        <option value="In Review">In Review</option>
                        <option value="Complete">Complete</option>
                      </select>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. NEW DISPATCH VIEWS FOR XAVVYREPO TRACKED CONTAINERS */}
      {adminViewMode === 'vault-grid' && (
        <RepoOverview 
          onSelectProject={handleSelectProject} 
          backendUrl={backendUrl}
          token={token}
        />
      )}

      {adminViewMode === 'vault-detail' && (
        <VaultModule 
          projectId={selectedProjectId} 
          onBack={() => setAdminViewMode('vault-grid')} 
          backendUrl={backendUrl}
          token={token}
        />
      )}
    </div>
  );
}