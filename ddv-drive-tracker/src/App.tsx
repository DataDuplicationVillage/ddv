import React, { useState, useEffect } from 'react';
import { 
  Database, Monitor, Shield, Layers, Server, RefreshCw, Barcode, 
  Activity, KeyRound, ShieldAlert, UserCheck
} from 'lucide-react';
import VolunteerPortal from './components/VolunteerPortal';
import AdminPortal from './components/AdminPortal';
import KioskTerminal from './components/KioskTerminal';
import ProcessingDesk from './components/ProcessingDesk';
import { UserRole } from './types';

export default function App() {
  // Switcher representing the four client-facing environments requested
  // 'admin' | 'volunteer' | 'processing' | 'kiosk'
  const [activeTab, setActiveTabTab] = useState<'admin' | 'volunteer' | 'processing' | 'kiosk'>('admin');
  
  // Tracking global master session auth
  const [currentUser, setCurrentUser] = useState<{ username: string; name: string; role: UserRole } | null>(null);

  // Login inputs inside App.tsx for unified authorization block
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);

  // Streaming state for replication alert pings (visual only triggers on mutation)
  const [replicationPing, setReplicationPing] = useState<{ active: boolean; description: string } | null>(null);

  // Load session from browser storage on boot
  useEffect(() => {
    const saved = localStorage.getItem('ddv_master_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCurrentUser(parsed);
        if (parsed.role === 'volunteer' || parsed.username === 'volunteer') {
          setActiveTabTab('volunteer');
        } else if (parsed.role === 'processing' || parsed.username === 'processing') {
          setActiveTabTab('processing');
        }
      } catch (err) {
        console.error('Failed to parse cached session', err);
      }
    }
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput || !passwordInput) return;
    setAuthError('');
    setIsSubmittingAuth(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput, password: passwordInput })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const userObj = { 
          username: data.user.username, 
          role: data.user.role as UserRole, 
          name: data.user.name
        };
        setCurrentUser(userObj);
        localStorage.setItem('ddv_master_session', JSON.stringify(userObj));
        if (data.user.username === 'volunteer' || data.user.role === 'volunteer') {
          setActiveTabTab('volunteer');
        } else if (data.user.username === 'processing' || data.user.role === 'processing') {
          setActiveTabTab('processing');
        } else if (data.user.role === 'admin') {
          setActiveTabTab('admin');
        }
        setUsernameInput('');
        setPasswordInput('');
        triggerVisualPing(`User ${data.user.username} successfully checked in.`);
      } else {
        setAuthError(data.message || 'Invalid static database password.');
      }
    } catch (err) {
      setAuthError('Connection network failure.');
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('ddv_master_session');
  };

  // Callback whenever any table undergoes CRUD changes which pushes to the replicated read-only kiosk DB
  const triggerVisualPing = (description: string) => {
    setReplicationPing({ active: true, description });
    setTimeout(() => {
      setReplicationPing(null);
    }, 4500);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-slate-200 flex flex-col font-sans">
      
      {/* GLOBAL ARCHITECTURE HUD */}
      <header className="bg-[#111113] border-b border-[#2A2A2E] shadow-xl shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col lg:flex-row items-center justify-between gap-4">
          
          {/* Logo & title */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg">
              <Server className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-white uppercase font-sans">
                  DRIVE-OPS
                </h1>
                <span className="text-blue-500 font-mono font-bold text-[9px] tracking-widest border border-blue-500/30 px-1.5 py-0.5 rounded leading-none uppercase">
                  QUAD-INTERFACE SYSTEM
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-medium font-sans">Django Schema compliance, Barcode labels scanner & Replicated Status Terminal</p>
            </div>
          </div>

          {/* Quad Interface Switching Tabs */}
          <div className="flex flex-wrap items-center bg-[#0E0E10] p-1 rounded-xl border border-[#2A2A2E] gap-1 self-stretch lg:self-auto">
            
            {(!currentUser || currentUser.role === 'admin') && (
              <button
                onClick={() => setActiveTabTab('admin')}
                className={`flex-1 lg:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  activeTab === 'admin' 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Shield className="h-3 w-3" />
                Admin
              </button>
            )}

            <button
              onClick={() => setActiveTabTab('volunteer')}
              className={`flex-1 lg:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'volunteer' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Activity className="h-3 w-3" />
              Volunteer Ops
            </button>

            {(!currentUser || currentUser.role === 'admin' || currentUser.role === 'processing') && (
              <button
                onClick={() => setActiveTabTab('processing')}
                className={`flex-1 lg:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  activeTab === 'processing' 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Server className="h-3 w-3" />
                Processing
              </button>
            )}

            <button
              onClick={() => setActiveTabTab('kiosk')}
              className={`flex-1 lg:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'kiosk' 
                  ? 'bg-emerald-600 text-white shadow-md font-black' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Barcode className="h-3 w-3 text-emerald-450" />
              Status Kiosk
            </button>
          </div>

          {/* ACTIVE LOGGED USER HUD */}
          {currentUser && (
            <div className="flex items-center gap-2.5 bg-[#0A0A0B] border border-[#2A2A2E] px-3.5 py-1.5 rounded-xl text-[11px] self-stretch sm:self-auto justify-between sm:justify-start">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-slate-400 font-medium">
                  Active: <strong className="text-white font-extrabold">{currentUser.name}</strong> 
                  <span className="bg-[#1C1C24] text-xs px-1.5 py-0.5 rounded font-mono text-blue-450 border border-blue-900/30 font-bold ml-1.5 uppercase tracking-wide">
                    {currentUser.role}
                  </span>
                </span>
              </div>
              
              <button
                onClick={handleLogout}
                className="px-2 py-0.5 text-[10px] font-bold text-rose-450 hover:text-white bg-rose-950/15 border border-rose-900/30 hover:bg-rose-600 rounded transition cursor-pointer font-mono"
              >
                LOGOUT
              </button>
            </div>
          )}

        </div>
      </header>

      {/* REPLICATION STREAM PINGER BANNER */}
      {replicationPing && (
        <div className="bg-emerald-950/60 border-b border-emerald-900/40 text-emerald-400 font-mono text-[10px] py-2 px-4 shadow-inner">
          <div className="max-w-7xl mx-auto flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            <Activity className="h-3.5 w-3.5 animate-pulse text-emerald-400" />
            <span>PUSH REPLICATION EVENT: <b className="text-white font-bold">{replicationPing.description}</b> - Pushed to read-only replica schema partition!</span>
          </div>
        </div>
      )}

      {/* CORE CONTENT SWITCHER WITH AUTHORIZATION FILTERS */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        
        {activeTab === 'kiosk' ? (
          /* Public unauthenticated status lookup kiosk */
          <KioskTerminal 
            onTableUpdateNotification={(table, action, id) => {
              triggerVisualPing(`Altered state of \`${table}\` via Public Kiosk check-in [ID: ${id}]`);
            }}
          />
        ) : !currentUser ? (
          /* Authentication wrapper for Admin, Volunteer & Processing interfaces */
          <div className="flex flex-col items-center justify-center min-h-[420px] py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-[#16161A] p-8 rounded-2xl shadow-xl border border-[#2A2A2E]">
              <div className="text-center">
                <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-blue-600 mx-auto shadow-lg shadow-blue-500/20">
                  <KeyRound className="h-6 w-6 text-white" />
                </div>
                <h2 className="mt-5 text-2xl font-black text-white tracking-tight">
                  Authorization Required
                </h2>
                <p className="mt-2 text-xs text-slate-500 font-mono uppercase tracking-wider">
                  Terminal holds secure records for: {activeTab.toUpperCase()}
                </p>
              </div>
              
              <form className="mt-8 space-y-5" onSubmit={handleLoginSubmit}>
                <div className="rounded-md space-y-4">
                  <div>
                    <label className="block text-xs font-mono uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Username</label>
                    <input
                      type="text"
                      required
                      className="appearance-none rounded-lg relative block w-full px-4 py-2.5 bg-[#0E0E10] border border-[#2A2A2E] placeholder-slate-650 text-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs font-mono font-bold"
                      placeholder="e.g. admin or volunteer"
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Password</label>
                    <input
                      type="password"
                      required
                      className="appearance-none rounded-lg relative block w-full px-4 py-2.5 bg-[#0E0E10] border border-[#2A2A2E] placeholder-slate-650 text-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs font-mono"
                      placeholder="••••••••"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                    />
                  </div>
                </div>

                {authError && (
                  <div className="rounded-lg bg-rose-955/10 p-3.5 border border-rose-900/30 flex gap-2">
                    <ShieldAlert className="h-4.5 w-4.5 text-rose-500 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-rose-350 font-medium leading-normal">{authError}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmittingAuth}
                  className="w-full flex justify-center py-2.5 px-4 border border-transparent text-xs font-bold uppercase tracking-wider rounded-lg text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition shadow-md cursor-pointer"
                >
                  {isSubmittingAuth ? 'Establishing Secure Handshake...' : 'Sign In To Interface'}
                </button>
              </form>

              {/* SIMULATION FAST CREDENTIAL PRESETS */}
              <div className="bg-[#0E0E10] p-4 rounded-xl border border-[#2A2A2E] space-y-2.5">
                <span className="block text-[10px] font-mono uppercase font-black text-slate-550 leading-none">Simulate operator credentials:</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      setUsernameInput('admin');
                      setPasswordInput('admin123');
                    }}
                    className="p-2.5 bg-[#16161A] hover:bg-slate-800 border border-[#2A2A2E] rounded-lg transition-colors font-semibold text-slate-300 text-left flex flex-col cursor-pointer"
                  >
                    <span className="text-white text-[11px] font-black block">👑 Admin Terminal</span>
                    <span className="text-[9px] text-slate-500 font-mono mt-0.5">user: admin / pass: admin123</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUsernameInput('volunteer');
                      setPasswordInput('vol123');
                    }}
                    className="p-2.5 bg-[#16161A] hover:bg-slate-800 border border-[#2A2A2E] rounded-lg transition-colors font-semibold text-slate-300 text-left flex flex-col cursor-pointer"
                  >
                    <span className="text-white text-[11px] font-black block">⚡ Volunteer Desk</span>
                    <span className="text-[9px] text-slate-500 font-mono mt-0.5">user: volunteer / pass: vol123</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUsernameInput('processing');
                      setPasswordInput('proc123');
                    }}
                    className="p-2.5 bg-[#16161A] hover:bg-slate-800 border border-[#2A2A2E] rounded-lg transition-colors font-semibold text-slate-300 text-left flex flex-col cursor-pointer"
                  >
                    <span className="text-white text-[11px] font-black block">🛠️ Processing Desk</span>
                    <span className="text-[9px] text-slate-500 font-mono mt-0.5">user: processing / pass: proc123</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Active session interfaces */
          <div>
            {activeTab === 'admin' && (
              currentUser.role === 'admin' ? (
                /* Admin Tables Portal */
                <AdminPortal
                  currentUser={currentUser}
                  onLogout={handleLogout}
                  onTableUpdateNotification={(table, action, id) => {
                    triggerVisualPing(`Modified \`${table}\` via ${action} [ID: ${id}]`);
                  }}
                />
              ) : (
                /* Admin Block restriction HUD */
                <div className="bg-[#16161A] border border-[#2A2A2E] rounded-2xl p-8 max-w-lg mx-auto text-center shadow-lg my-12 space-y-4 font-sans">
                  <div className="h-12 w-12 rounded-lg bg-rose-600/15 text-rose-500 flex items-center justify-center mx-auto border border-rose-900/30">
                    <ShieldAlert className="h-6 w-6" />
                  </div>
                  <h3 className="text-sm font-extrabold text-white uppercase font-mono tracking-wider">Interface Locked</h3>
                  <p className="text-xs text-slate-400 leading-relaxed font-medium">
                    The requested <strong>Admin Management Console</strong> requires a <code>System Administrator</code> level role session. Your currently logged role level is <strong>{currentUser.role.toUpperCase()}</strong>.
                  </p>
                  <div className="pt-2 flex flex-col sm:flex-row justify-center gap-2 text-xs">
                    <button
                      onClick={() => setActiveTabTab('volunteer')}
                      className="px-4 py-2 border border-[#2A2A2E] hover:bg-slate-800 text-slate-300 rounded-lg cursor-pointer font-bold tracking-wide transition"
                    >
                      Log In To Volunteer Ops
                    </button>
                    <button
                      onClick={() => {
                        handleLogout();
                        setUsernameInput('admin');
                        setPasswordInput('admin123');
                      }}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-lg cursor-pointer tracking-wide shadow-md transition"
                    >
                      Authorize as Admin (admin123)
                    </button>
                  </div>
                </div>
              )
            )}

            {activeTab === 'volunteer' && (
              (currentUser.role === 'admin' || currentUser.role === 'volunteer' || currentUser.role === 'processing') ? (
                /* Volunteer Point of Sale Guided Operations Flowchart */
                <VolunteerPortal
                  currentUser={currentUser}
                  onLogout={handleLogout}
                  onTableUpdateNotification={(table, action, id) => {
                    triggerVisualPing(`Modified \`${table}\` via POS Operator [ID: ${id}]`);
                  }}
                />
              ) : (
                /* General authorization message */
                <div className="bg-[#16161A] border border-[#2A2A2E] rounded-xl p-8 max-w-lg mx-auto text-center shadow-md my-12 font-sans space-y-3">
                  <ShieldAlert className="h-10 w-10 text-rose-500 mx-auto" />
                  <h3 className="text-xs font-bold text-white uppercase font-mono">Volunteer Access Restricted</h3>
                  <p className="text-xs text-slate-400">Regular viewer logs do not hold access keys for Volunteer Point-of-Sale desks.</p>
                  <button onClick={handleLogout} className="px-4 py-2 bg-blue-600 text-white rounded font-bold cursor-pointer">Login as Volunteer</button>
                </div>
              )
            )}

             {activeTab === 'processing' && (
              currentUser.role === 'admin' || currentUser.role === 'processing' ? (
                /* Processing dashboard to move drives */
                <ProcessingDesk 
                  onTableUpdateNotification={(table, action, id) => {
                    triggerVisualPing(`Copier action registered on \`${table}\` [ID: ${id}]`);
                  }}
                />
              ) : (
                <div className="bg-[#16161A] border border-[#2A2A2E] rounded-xl p-8 max-w-lg mx-auto text-center shadow-md my-12 font-sans space-y-3">
                  <ShieldAlert className="h-10 w-10 text-rose-500 mx-auto" />
                  <h3 className="text-xs font-bold text-white uppercase font-mono">Access Restricted</h3>
                  <p className="text-xs text-slate-400">Please establish an Administrator or Processing session to access duplication controllers.</p>
                </div>
              )
            )}
          </div>
        )}

      </main>

      {/* REPLICATING SCHEMATICS METRICS FOOTER */}
      <footer className="bg-[#111113] border-t border-[#2A2A2E] py-4 px-6 shrink-0 mt-auto text-slate-500 text-[10px]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 font-medium leading-normal">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Layers className="h-3.5 w-3.5 text-slate-500" />
            <span>Dual-Host protocol: <b className="text-slate-300 font-bold font-mono">NODE_MASTER & REPLICA_SYNC</b></span>
          </div>
          <div className="font-mono text-slate-500 uppercase">
             DATABASE STATUS: ONLINE | EXPRESS SERVICE PORT 3000 RW | SCHEMA VERSION v4.2
          </div>
        </div>
      </footer>

    </div>
  );
}
