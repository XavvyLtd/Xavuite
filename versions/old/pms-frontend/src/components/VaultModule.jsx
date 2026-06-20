// pms-frontend/src/components/VaultModule.jsx
import React, { useState, useEffect } from 'react';

export default function VaultModule({ projectId, onBack, backendUrl, token }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);

  const baseUrl = backendUrl || '';

  const fetchFiles = () => {
    fetch(`${baseUrl}/api/projects/${projectId}/vault`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      const activeFiles = (data || []).filter(f => f.filename !== '.placeholder');
      setFiles(activeFiles);
    })
    .catch(err => console.error("Failed downloading remote manifest tree:", err));
  };

  useEffect(() => { if (projectId) fetchFiles(); }, [projectId, backendUrl, token]);

  // Inside pms-frontend/src/components/VaultModule.jsx -> handleFileUpload block
const handleFileUpload = async (e) => {
  const fileNode = e.target.files[0];
  if (!fileNode) return;

  setUploading(true);
  const formData = new FormData();
  formData.append('file', fileNode);
  
  // 🌟 APPEND USER EMAIL DIRECTLY TO MULTIPART FORM BOUNDARY DATA
  // This satisfies R2 bucket storage isolation rules completely without triggering CORS preflight handshakes!
  const sessionUser = localStorage.getItem('user_profile');
  if (sessionUser) {
    try {
      const profile = JSON.parse(sessionUser);
      formData.append('email', profile.email || 'admin@xavvy.uk');
    } catch(err) {
      formData.append('email', 'admin@xavvy.uk');
    }
  } else {
    formData.append('email', 'admin@xavvy.uk');
  }

  try {
    const response = await fetch(`${baseUrl}/api/projects/${projectId}/vault`, {
      method: 'POST',
      body: formData,
      headers: { 
        'Authorization': `Bearer ${token}`
        // Keep Content-Type header clear so browser calculates boundary parameters cleanly!
      }
    });
    if (response.ok) {
      fetchFiles();
    } else {
      alert("Upload verification breakdown triggered.");
    }
  } catch (err) {
    console.error("Pipeline transmit failure:", err);
  } finally {
    setUploading(false);
  }
};

  const extensionStats = files.reduce((acc, f) => {
    const ext = f.filename.split('.').pop().toUpperCase();
    acc[ext] = (acc[ext] || 0) + 1;
    return acc;
  }, {});

  const isCompany = projectId.toLowerCase() === 'company';

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {onBack && (
            <button 
              onClick={onBack} 
              className="px-3 py-1.5 bg-[#1e293b] hover:bg-[#334155] border border-[#334155] rounded-xl text-xs font-bold text-slate-300 font-mono transition-all"
            >
              ← OVERVIEW
            </button>
          )}
          <div>
            <h1 className="text-xl font-black text-white uppercase tracking-tight">
              {isCompany ? 'Company Operations Vault' : `Project Repository: ${projectId}`}
            </h1>
            <p className="text-slate-400 text-xs mt-0.5">
              {isCompany ? 'Central registry archive node for corporate documentation, guidelines, and compliance policy files.' : 'Project asset inventory control system engine.'}
            </p>
          </div>
        </div>

        <label className={`px-4 py-2 bg-blue-600 hover:bg-blue-500 border border-blue-500 rounded-xl text-xs font-black text-white font-mono uppercase tracking-wider transition-all cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
          {uploading ? 'Processing Transaction...' : isCompany ? 'Upload Company Policy' : 'Check In Asset'}
          <input type="file" onChange={handleFileUpload} className="hidden" disabled={uploading} />
        </label>
      </div>

      {files.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Object.entries(extensionStats).map(([ext, count]) => (
            <div key={ext} className="p-4 bg-[#0f172a] border border-[#1e293b] rounded-xl">
              <div className="text-xl font-black text-white font-mono">{count}</div>
              <div className="text-[10px] font-mono text-slate-400 uppercase mt-0.5">.{ext} Files</div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-[#020617] border border-[#1e293b] rounded-2xl overflow-hidden">
        <table className="w-full table-auto text-left border-collapse font-sans text-xs">
          <thead>
            <tr className="bg-[#0f172a] text-slate-400 font-mono text-[10px] uppercase border-b border-[#1e293b] tracking-wider">
              <th className="p-4">Filename Asset Parameter</th>
              <th className="p-4">Commit Hash Index Reference</th>
              <th className="p-4 text-center">Build Token Version</th>
              <th className="p-4">Author Key</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e293b]">
            {files.length === 0 ? (
              <tr>
                <td colSpan="4" className="p-8 text-center text-slate-500 font-mono text-xs bg-[#0f172a]/20">
                  {isCompany ? 'No corporate policy documents uploaded yet.' : 'Zero active file nodes tracked in this context segment.'}
                </td>
              </tr>
            ) : (
              files.map(file => (
                <tr key={file.id} className="hover:bg-[#0f172a]/50 text-slate-300">
                  <td className="p-4 font-bold text-white tracking-tight">{file.filename}</td>
                  <td className="p-4 font-mono text-slate-400 text-[11px] select-all">{file.file_key}</td>
                  <td className="p-4 text-center">
                    <span className="bg-[#1e1b4b] text-[#c084fc] border border-[#581c87] font-mono font-bold text-[10px] px-2 py-0.5 rounded-md">
                      v{file.version}
                    </span>
                  </td>
                  <td className="p-4 text-slate-400 font-mono text-[11px]">{file.user_email}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}