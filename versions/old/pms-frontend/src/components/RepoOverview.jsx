// pms-frontend/src/components/RepoOverview.jsx
import React, { useState, useEffect } from 'react';

export default function RepoOverview({ onSelectProject, backendUrl, token }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Construct absolute target URI matching your backend worker domain strategy
    const targetUrl = backendUrl 
      ? `${backendUrl}/api/repo/projects-overview` 
      : '/api/repo/projects-overview';

    fetch(targetUrl, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      const projectList = data || [];
      const hasCompany = projectList.some(p => p.project_id.toLowerCase() === 'company');
      
      if (!hasCompany) {
        projectList.unshift({ project_id: 'Company', file_count: 0 });
      } else {
        const companyIdx = projectList.findIndex(p => p.project_id.toLowerCase() === 'company');
        const [companyNode] = projectList.splice(companyIdx, 1);
        projectList.unshift(companyNode);
      }
      setProjects(projectList);
      setLoading(false);
    })
    .catch(err => {
      console.error("Error pulling repository registry statistics:", err);
      // Fallback fallback to ensure 'Company' shows even if network connection times out
      setProjects([{ project_id: 'Company', file_count: 0 }]);
      setLoading(false);
    });
  }, [backendUrl, token]);

  if (loading) return <div className="p-6 text-slate-400 font-mono text-sm animate-pulse">Scanning Archive Hub Vectors...</div>;

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {projects.map(p => {
          const isCompany = p.project_id.toLowerCase() === 'company';
          return (
            <div 
              key={p.project_id} 
              onClick={() => onSelectProject(p.project_id)}
              className={`p-6 border rounded-2xl cursor-pointer hover:shadow-lg transition-all group ${
                isCompany 
                  ? 'bg-[#0f172a]/80 border-blue-500/40 hover:border-blue-500' 
                  : 'bg-[#0f172a] border-[#1e293b] hover:border-[#3b82f6]'
              }`}
            >
              <div className="flex justify-between items-start">
                <h3 className="text-white font-bold text-lg group-hover:text-blue-400 font-sans tracking-tight">
                  {isCompany ? '🏢 Corporate Policies & Docs' : p.project_id}
                </h3>
                <span className={`text-[10px] font-mono uppercase px-2 py-1 rounded border ${
                  isCompany 
                    ? 'bg-[#172554] text-blue-400 border-blue-500/30' 
                    : 'bg-[#1e1b4b] text-[#c084fc] border-[#581c87]'
                }`}>
                  {isCompany ? 'System Wide' : 'Project Vault'}
                </span>
              </div>
              <div className="mt-4 flex items-baseline space-x-2">
                <span className="text-3xl font-black text-white font-mono">{p.file_count}</span>
                <span className="text-xs text-slate-400 uppercase font-sans">Tracked Files</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}