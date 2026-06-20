import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import PMSModule from './components/PMSModule'; // 👈 FORCED PATH ALIGNMENT
import { LogOut, FolderKanban } from 'lucide-react';

export default function App() {
  const { user, token, login, signup, logout } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [isSignUp, setIsSignUp] = useState(false);
  const [regName, setRegName] = useState('');
  const [regDept, setRegDept] = useState('');
  const [regDesig, setRegDesig] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault(); setIsSubmitting(true);
    try { setError(''); await login(email, password); } catch (err) { setError('Invalid login credentials.'); } finally { setIsSubmitting(false); }
  };

  const handleSignUp = async (e) => {
    e.preventDefault(); setIsSubmitting(true);
    try { setError(''); await signup(regName, email, password, regDept, regDesig); } catch (err) { setError(err.message || 'User sign-up failure.'); } finally { setIsSubmitting(false); }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-xavvy-bg relative overflow-hidden font-sans text-gray-100">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="w-full max-w-md bg-xavvy-surface/60 backdrop-blur-xl rounded-2xl p-8 border border-xavvy-border/80 relative z-10">
          <div className="text-center mb-6">
            <div className="inline-flex p-2 bg-white rounded-xl mb-4 max-w-[180px] shadow-sm">
              <img src="/CompanyLogo.jpg" alt="Xavvy Brand Identity" className="w-full h-auto object-contain rounded-lg mix-blend-multiply" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white mb-0.5 uppercase">XavvyPM</h1>
            <p className="text-xavvy-textMuted text-[10px] uppercase tracking-widest font-bold">{isSignUp ? 'Project User Sign-up' : 'Project Gateway Login'}</p>
          </div>

          {error && <div className="p-3 bg-red-950/40 text-red-400 border border-red-800/50 rounded-xl text-xs font-medium mb-4">{error}</div>}

          <form onSubmit={isSignUp ? handleSignUp : handleLogin} className="space-y-4">
            {isSignUp && (
              <>
                <div>
                  <label className="block text-[10px] uppercase text-xavvy-textMuted font-bold tracking-wider mb-1">Full Legal Name</label>
                  <input type="text" value={regName} onChange={e => setRegName(e.target.value)} required className="w-full bg-xavvy-bg border border-xavvy-border rounded-xl p-2.5 text-white text-xs focus:outline-none" placeholder="Jane Doe"/>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase text-xavvy-textMuted font-bold tracking-wider mb-1">Department</label>
                    <input type="text" value={regDept} onChange={e => setRegDept(e.target.value)} required className="w-full bg-xavvy-bg border border-xavvy-border rounded-xl p-2.5 text-white text-xs focus:outline-none" placeholder="Engineering"/>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase text-xavvy-textMuted font-bold tracking-wider mb-1">Designation</label>
                    <input type="text" value={regDesig} onChange={e => setRegDesig(e.target.value)} required className="w-full bg-xavvy-bg border border-xavvy-border rounded-xl p-2.5 text-white text-xs focus:outline-none" placeholder="Developer"/>
                  </div>
                </div>
              </>
            )}
            <div>
              <label className="block text-[10px] uppercase text-xavvy-textMuted font-bold tracking-wider mb-1">User Identity Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-xavvy-bg border border-xavvy-border rounded-xl p-2.5 text-white text-xs focus:outline-none" placeholder="user@xavvy.uk"/>
            </div>
            <div>
              <label className="block text-[10px] uppercase text-xavvy-textMuted font-bold tracking-wider mb-1">Security Key</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full bg-xavvy-bg border border-xavvy-border rounded-xl p-2.5 text-white text-xs focus:outline-none" placeholder="••••••••"/>
            </div>
            <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-500 font-bold text-xs text-white py-3 rounded-xl transition shadow-lg disabled:opacity-50 font-mono uppercase tracking-wider">
              {isSubmitting ? 'Authorizing User...' : isSignUp ? 'Complete Sign-up' : 'Establish PM Session'}
            </button>
          </form>

          <div className="mt-6 text-center pt-4 border-t border-xavvy-border/40">
            <button onClick={() => { setIsSignUp(!isSignUp); setError(''); setEmail(''); setPassword(''); setRegName(''); setRegDept(''); setRegDesig(''); }} className="text-xs text-xavvy-textMuted hover:text-white transition-all">
              {isSignUp ? "Return to Identity Validation" : "Register Custom Project Profile Node"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-xavvy-bg text-gray-100 font-sans antialiased">
      <aside className="w-64 bg-xavvy-surface/40 backdrop-blur-md border-r border-xavvy-border/60 p-6 flex flex-col justify-between">
        <div>
          <div className="mb-8 px-2 flex flex-col space-y-3">
            <div className="p-2 bg-white border rounded-xl max-w-[130px] shadow-inner">
              <img src="/CompanyLogo.jpg" alt="Xavvy Identity" className="w-full h-auto object-contain mix-blend-multiply" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white flex items-center space-x-2 uppercase">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shadow-glow"></span>
                <span>XavvyPM</span>
              </h2>
            </div>
          </div>

          <nav className="space-y-1.5">
            <button className="w-full flex items-center space-x-3 p-3 rounded-xl text-xs uppercase font-bold tracking-wider transition-all bg-blue-600 text-white shadow-glow">
              <FolderKanban size={16}/> <span>Lifecycle Workspace</span>
            </button>
          </nav>
        </div>

        <div className="pt-4 border-t border-xavvy-border/60 px-2">
          <div className="mb-4">
            <p className="text-[11px] text-xavvy-textMuted truncate">{user?.email}</p>
            <p className="text-[10px] text-blue-400 font-bold uppercase mt-0.5">PM Session Node</p>
          </div>
          <button onClick={logout} className="w-full flex items-center justify-center space-x-2 p-2.5 bg-xavvy-elevated/40 hover:bg-red-950/30 text-red-400 rounded-xl text-xs font-bold uppercase tracking-wider">
            <LogOut size={14}/> <span>Disconnect</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 p-10 overflow-y-auto max-w-7xl mx-auto w-full relative">
        <PMSModule />
      </main>
    </div>
  );
}