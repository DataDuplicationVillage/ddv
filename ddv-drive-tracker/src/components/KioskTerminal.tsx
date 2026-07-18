import React, { useEffect, useRef, useState } from 'react';
import {
  Search,
  HardDrive,
  Cpu,
  CheckCircle,
  XCircle,
  Clock,
  Database,
  QrCode,
  ChevronDown,
  ChevronUp,
  RotateCcw
} from 'lucide-react';
import { Disk } from '../types';

export default function KioskTerminal() {
  const [searchId, setSearchId] = useState('');
  const scannerInputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [searched, setSearched] = useState(false);
  const [isRecordsExpanded, setIsRecordsExpanded] = useState(false);
  const [autoResetSeconds, setAutoResetSeconds] = useState<number | null>(null);

  const [diskRecord, setDiskRecord] = useState<Disk | null>(null);
  const [statusLogs, setStatusLogs] = useState<any[]>([]);

  useEffect(() => {
    const keepFocus = () => scannerInputRef.current?.focus();
    keepFocus();
    const interval = setInterval(keepFocus, 800);
    return () => clearInterval(interval);
  }, []);

  const handleResetSearch = () => {
    setSearched(false);
    setSearchId('');
    setErrorMsg('');
    setDiskRecord(null);
    setStatusLogs([]);
    setAutoResetSeconds(null);
    setIsRecordsExpanded(false);
  };

  const resetProgressPct = autoResetSeconds === null
    ? 0
    : Math.max(0, Math.min(100, (autoResetSeconds / 30) * 100));

  useEffect(() => {
    if (!searched || loading || (!diskRecord && !errorMsg)) {
      setAutoResetSeconds(null);
      return;
    }

    setAutoResetSeconds(30);
    const timeoutId = setTimeout(() => {
      handleResetSearch();
    }, 30000);
    const countdownId = setInterval(() => {
      setAutoResetSeconds((prev) => {
        if (prev === null) return prev;
        return prev > 0 ? prev - 1 : 0;
      });
    }, 1000);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(countdownId);
    };
  }, [searched, loading, diskRecord, errorMsg]);

  const handleLookup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchId.trim()) return;

    setLoading(true);
    setErrorMsg('');
    setSearched(true);
    setDiskRecord(null);
    setStatusLogs([]);

    let cleanId = searchId.trim();
    if (cleanId.toUpperCase().startsWith('VAL-')) cleanId = cleanId.substring(4);
    if (cleanId.startsWith('*') && cleanId.endsWith('*')) cleanId = cleanId.slice(1, -1);
    if (cleanId.toUpperCase().startsWith('VAL-')) cleanId = cleanId.substring(4);

    try {
      const lookupRes = await fetch(`/api/kiosk/lookup-disk/${cleanId}`);
      if (!lookupRes.ok) {
        throw new Error('Barcode reference not located in replicated vault logs. Visit check-in desk.');
      }

      const lookupData = await lookupRes.json();
      if (lookupData?.status_logs) {
        setStatusLogs(lookupData.status_logs);
      }

      const disksRes = await fetch('/api/disks');
      if (disksRes.ok) {
        const allDisks: Disk[] = await disksRes.json();
        const targetDiskId = lookupData.disk_id || cleanId;
        const foundDisk = allDisks.find(
          d =>
            d.id.toLowerCase() === targetDiskId.toLowerCase() ||
            d.hd_serial.toLowerCase() === targetDiskId.toLowerCase() ||
            d.id.toLowerCase() === cleanId.toLowerCase() ||
            d.hd_serial.toLowerCase() === cleanId.toLowerCase()
        );

        if (foundDisk) {
          setDiskRecord(foundDisk);
        } else {
          setDiskRecord({
            id: targetDiskId.toUpperCase(),
            hd_manufacturer: 'Generic',
            hd_model: 'Ingested Media Node',
            hd_serial: 'S/N LOGGED',
            hd_size: '8TB',
            hd_speed: '7200 RPM',
            source_requested_id: 'DS-01',
            received_time: new Date().toISOString(),
            copy_start_time: null,
            copy_complete_time: null,
            copy_fail_time: null,
            pickup_time: null,
            status: 'received'
          });
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Asset sequence mismatch inside read-only disk replication.');
    } finally {
      setLoading(false);
    }
  };

  const currentStatusMsg = () => {
    if (!diskRecord) return '';
    switch (diskRecord.status) {
      case 'received':
        return 'READY IN INTAKE RACK: Core verification copy queued.';
      case 'copying':
        return 'REPLICATION ACTIVE: Performing bitwise integrity transfer to production array.';
      case 'completed':
        return 'COMPLETED: Duplication success. Please proceed to disbursement desk.';
      case 'failed':
        return 'EXAM DIRECTIVE: Copy failure logged. Handing off to bypass engineers.';
      case 'picked_up':
        return 'RELEASED: Physical asset returned to owner; signature records locked in ledger.';
      default:
        return 'Awaiting physical floor check.';
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-slate-100 flex flex-col font-sans select-none relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />

      <header className="border-b border-[#202023] bg-[#111113]/80 backdrop-blur-md px-6 py-4.5 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-sm font-black font-mono tracking-widest text-slate-150">DDV_REPLICA_STATUS_KIOSK</h1>
              <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block leading-none mt-1">Read-only physical intake tracer terminal</span>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 font-mono text-[10px] text-emerald-450 bg-emerald-950/15 border border-emerald-900/40 px-2.5 py-1 rounded-full">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>PUBLIC COURIER PORTAL</span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6">
        <div className="relative max-w-3xl w-full mx-auto bg-[#16161A] p-6 rounded-2xl border border-blue-900/30 shadow-2xl space-y-5">
          <form onSubmit={handleLookup} className="space-y-4">
            <div className="relative">
              <input
                ref={scannerInputRef}
                type="text"
                autoFocus
                className="block w-full rounded-2xl bg-[#0E0E10] border-2 border-blue-900/30 pl-14 pr-36 py-5 text-base md:text-lg text-white placeholder-slate-650 font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase text-center"
                placeholder="ENTER OR SCAN DISK ID..."
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
              />
              <div className="absolute inset-y-1.5 right-1.5 flex items-center gap-1.5">
                <button
                  type="submit"
                  disabled={loading || !searchId.trim()}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-white text-xs md:text-sm font-black px-6 py-3.5 rounded-xl transition-all shadow-md cursor-pointer h-full flex items-center uppercase"
                >
                  {loading ? 'READING...' : 'Search'}
                </button>
              </div>
              <div className="absolute inset-y-0 left-0 pl-4.5 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-slate-500" />
              </div>
            </div>

            <div className="rounded-xl border border-[#2A2A2E] bg-[#0E0E10] min-h-[300px] p-4 md:p-6 flex items-center justify-center">
              {!searched && (
                <div className="relative h-56 w-full rounded-xl border border-[#2A2A2E] flex flex-col items-center justify-center overflow-hidden bg-black/40">
                  <div className="absolute inset-x-0 h-0.5 bg-blue-500/80 shadow-[0_0_12px_#3b82f6] animate-bounce" style={{ animationDuration: '3s' }} />
                  <div className="absolute top-4 left-4 w-5 h-5 border-t-2 border-l-2 border-blue-500/40" />
                  <div className="absolute top-4 right-4 w-5 h-5 border-t-2 border-r-2 border-blue-500/40" />
                  <div className="absolute bottom-4 left-4 w-5 h-5 border-b-2 border-l-2 border-blue-500/40" />
                  <div className="absolute bottom-4 right-4 w-5 h-5 border-b-2 border-r-2 border-blue-500/40" />
                  <QrCode className="h-14 w-14 text-blue-500/30 animate-pulse" />
                  <div className="text-[10px] font-mono text-blue-450 tracking-widest uppercase font-extrabold mt-3 animate-pulse">
                    Awaiting Optical Hardware Trigger...
                  </div>
                </div>
              )}

              {searched && loading && (
                <div className="py-10 text-center space-y-3">
                  <div className="animate-spin inline-block w-8 h-8 border-[3px] border-current border-t-transparent text-blue-500 rounded-full" role="status" aria-label="loading" />
                  <p className="text-xs font-mono text-slate-450 animate-pulse">QUERYING REPLICATOR ARRAY V2...</p>
                </div>
              )}

              {searched && !loading && errorMsg && (
                <div className="w-full bg-rose-950/20 border border-rose-900/40 rounded-xl p-8 text-center space-y-4 max-w-xl mx-auto">
                  <XCircle className="h-12 w-12 text-rose-500 mx-auto" />
                  <div className="space-y-1">
                    <h4 className="font-extrabold text-white text-sm uppercase font-mono">Asset Sequence Mismatch</h4>
                    <p className="text-xs text-rose-350 leading-relaxed">{errorMsg}</p>
                  </div>
                </div>
              )}

              {searched && !loading && diskRecord && (
                <div className="w-full space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between gap-4 flex-wrap border-b border-[#2A2A2E] pb-3">
                    <div>
                      <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Drive Tracking Reference</div>
                      <div className="flex items-center gap-2 mt-1">
                        <HardDrive className="h-5 w-5 text-blue-400" />
                        <span className="text-2xl font-mono font-black text-white">{diskRecord.id}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleResetSearch}
                      className="px-4 py-2.5 text-xs font-bold text-slate-300 hover:text-white border border-[#2A2A2E] bg-[#0E0E10] hover:bg-slate-900 rounded-xl transition cursor-pointer flex items-center gap-1.5"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Search Another
                    </button>
                  </div>

                  <div className="py-1 text-center space-y-2">
                    <span className="text-[10px] font-mono tracking-widest text-[#22c55e] uppercase bg-emerald-950/30 px-3 py-1 rounded-full border border-emerald-900/40 font-bold">Current Disposition</span>
                    <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight pt-1">
                      {diskRecord.status === 'received' && 'Phase 01: Pending'}
                      {diskRecord.status === 'copying' && 'Phase 02: Duplication Active'}
                      {diskRecord.status === 'completed' && 'Phase 03: Copy Complete'}
                      {diskRecord.status === 'failed' && 'Phase 03: Copy Errored'}
                      {diskRecord.status === 'picked_up' && 'Phase 04: Returned'}
                    </h2>
                    <p className="text-xs text-slate-300 max-w-xl mx-auto pt-1 leading-relaxed">{currentStatusMsg()}</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    {[
                      { phase: 1, num: 'Phase 01', title: 'Pending', desc: 'Intake and registration' },
                      { phase: 2, num: 'Phase 02', title: 'Duplication Active', desc: 'Replication in progress' },
                      { phase: 3, num: 'Phase 03', title: diskRecord.status === 'failed' ? 'Copy Errored' : 'Copy Complete', desc: diskRecord.status === 'failed' ? 'Intervention needed' : 'Integrity checked ok' },
                      { phase: 4, num: 'Phase 04', title: 'Returned', desc: 'Released back to owner' }
                    ].map(step => {
                      const curIdx =
                        diskRecord.status === 'received' ? 1 :
                        diskRecord.status === 'copying' ? 2 :
                        (diskRecord.status === 'completed' || diskRecord.status === 'failed') ? 3 :
                        4;

                      const isCompleted = step.phase < curIdx;
                      const isActive = step.phase === curIdx;
                      const isFailed = step.phase === 3 && diskRecord.status === 'failed';

                      let cardStyle = 'bg-[#0E0E10]/85 border-[#2A2A2E] text-slate-500 opacity-60';
                      if (isActive) {
                        cardStyle = isFailed
                          ? 'bg-rose-950/20 border-rose-900/40 text-rose-200 ring-2 ring-rose-500/20'
                          : 'bg-blue-950/20 border-blue-900/40 text-blue-100 ring-2 ring-blue-500/20';
                      } else if (isCompleted) {
                        cardStyle = 'bg-emerald-955/15 border-emerald-900/30 text-emerald-100';
                      }

                      return (
                        <div key={step.phase} className={`p-4 rounded-xl border flex flex-col justify-between space-y-3 ${cardStyle}`}>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono tracking-wider font-extrabold">{step.num}</span>
                            {isCompleted ? (
                              <CheckCircle className="h-4 w-4 text-emerald-400" />
                            ) : isActive ? (
                              isFailed ? <XCircle className="h-4 w-4 text-rose-500 animate-pulse" /> : <Cpu className="h-4 w-4 text-blue-400 animate-spin" style={{ animationDuration: '3s' }} />
                            ) : (
                              <Clock className="h-4 w-4 text-slate-700" />
                            )}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white">{step.title}</div>
                            <div className="text-[10px] text-slate-400 leading-normal mt-0.5">{step.desc}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {searched && !loading && autoResetSeconds !== null && (
              <div className="space-y-2 px-1">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>Result stays visible for touch users.</span>
                  <span>Auto reset in {autoResetSeconds}s</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-[#0E0E10] border border-[#2A2A2E] overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-1000"
                    style={{ width: `${resetProgressPct}%` }}
                  />
                </div>
              </div>
            )}

            <div className="border-t border-[#2A2A2E] pt-2 text-center text-[10px] text-slate-500 font-mono">
              Wedge scanners emulate keyboard keypresses. Focus remains locked on the reader target.
            </div>
          </form>
        </div>

        {searched && !loading && (
          <div className="max-w-3xl mx-auto mt-4 bg-[#111113] border border-[#2A2A2E] rounded-2xl overflow-hidden shadow-md">
            <button
              type="button"
              onClick={() => setIsRecordsExpanded(!isRecordsExpanded)}
              className="w-full text-left p-5 flex items-center justify-between hover:bg-[#16161A] transition focus:outline-none cursor-pointer"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-blue-400" />
                  <h3 className="text-xs font-bold font-mono text-slate-300 uppercase tracking-widest">Detailed Core Ledger</h3>
                  <span className="inline-flex items-center rounded bg-slate-900 px-1.5 py-0.5 text-[9px] font-mono font-bold text-slate-400 border border-[#2A2A2E]">{statusLogs.length} Entries</span>
                </div>
                <p className="text-[11px] text-slate-400">Audit trail appears directly below the scan result.</p>
              </div>
              {isRecordsExpanded ? <ChevronUp className="h-5 w-5 text-slate-450" /> : <ChevronDown className="h-5 w-5 text-slate-450" />}
            </button>

            {isRecordsExpanded && (
              <div className="border-t border-[#2A2A2E]/50 p-4 bg-[#0E0E10]">
                <div className="text-[10px] font-mono uppercase text-slate-500 mb-2">Touch scroll available below</div>
                <div className="max-h-[280px] overflow-y-auto overflow-x-auto bg-[#111113] border border-[#2A2A2E]/70 rounded-xl p-3">
                  {statusLogs.length > 0 ? (
                    <table className="w-full text-left text-[11px] font-mono whitespace-nowrap lg:whitespace-normal">
                      <thead>
                        <tr className="border-b border-[#2A2A2E]/60 text-slate-500 uppercase text-[9px]">
                          <th className="pb-2.5 px-2">Timestamp</th>
                          <th className="pb-2.5 px-2">Status</th>
                          <th className="pb-2.5 px-2">Operator</th>
                          <th className="pb-2.5 px-2">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.02] text-slate-300">
                        {statusLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-white/[0.015] transition-colors">
                            <td className="py-2 px-2 text-slate-500 text-[10px] whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                            <td className="py-2 px-2 uppercase text-[10px]">{log.status}</td>
                            <td className="py-2 px-2 text-[10px]">{log.operator}</td>
                            <td className="py-2 px-2 text-[10px] break-words">{log.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="py-8 text-center text-slate-500 text-xs font-mono">No registered audit transitions identified for this sequence tag.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-[#202023] py-5 text-center text-[10px] text-slate-650 font-mono mt-8 bg-[#0E0E10]">
        <div>CONFIDENTIAL DISASTER DRIVE VERIFICATION PLATFORM | VERSION 2.0</div>
        <div className="mt-1 text-slate-600">ReadOnly replica node sync tracking: OK | Master cluster: ONLINE</div>
      </footer>
    </div>
  );
}
