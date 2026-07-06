import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  HardDrive, Play, CheckCircle, XCircle, RefreshCcw, 
  Search, Cpu, ArrowRight, Server, Clock, AlertTriangle, 
  PlayCircle, Printer, Ticket, CheckCircle2, RotateCcw, HelpCircle,
  AlertCircle, ChevronRight, X, ArrowDown, Barcode, ListPlus, Trash2
} from 'lucide-react';
import { Disk, DataSource } from '../types';

interface ProcessingDeskProps {
  onTableUpdateNotification: (tableName: string, action: string, recordId: string) => void;
}

export default function ProcessingDesk({ onTableUpdateNotification }: ProcessingDeskProps) {
  const [disks, setDisks] = useState<Disk[]>([]);
  const [datasources, setDatasources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [deskPage, setDeskPage] = useState(1);
  const deskPageSize = 16; // 16 cards per page for clean, dense grid views
  const [selectedDisk, setSelectedDisk] = useState<Disk | null>(null);

  // Batch states & Scanner Terminal support
  const [activeTab, setActiveTab] = useState<'inspector' | 'batch_scanner'>('inspector');
  const [batchStatus, setBatchStatus] = useState<Disk['status']>('copying');
  const [scanInput, setScanInput] = useState('');
  const [scannedDisks, setScannedDisks] = useState<{ disk: Disk; status: 'success' | 'warning'; message?: string }[]>([]);
  const [isInstantScan, setIsInstantScan] = useState(true);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const multiScanStationRef = useRef<HTMLDivElement>(null);

  // Simulated live copy worker state
  const [copyProgress, setCopyProgress] = useState<number | null>(null);
  const [copyingDiskId, setCopyingDiskId] = useState<string | null>(null);
  const [simulationSpeed, setSimulationSpeed] = useState<number>(80); // ms per tick

  // Interactive replication outcome config
  const [expectedOutcome, setExpectedOutcome] = useState<'success' | 'failure' | 'random'>('success');
  
  // Custom in-UI error/status notifications (to bypass blocked alert() calls inside iframe)
  const [uiError, setUiError] = useState<string>('');
  const [uiSuccess, setUiSuccess] = useState<string>('');

  // Ticket Modal printer emulator state
  const [printedTicketDisk, setPrintedTicketDisk] = useState<Disk | null>(null);

  const fetchState = async () => {
    setLoading(true);
    setUiError('');
    try {
      const [disksRes, sourcesRes] = await Promise.all([
        fetch('/api/disks'),
        fetch('/api/datasources')
      ]);
      if (disksRes.ok) {
        const disksData = await disksRes.json();
        setDisks(disksData);
        // Sync selected disk if it is currently focused
        if (selectedDisk) {
          const freshSel = disksData.find((d: Disk) => d.id === selectedDisk.id);
          if (freshSel) setSelectedDisk(freshSel);
        }
      }
      if (sourcesRes.ok) {
        setDatasources(await sourcesRes.json());
      }
    } catch (err) {
      console.error('Failed to reload processing disks:', err);
      setUiError('Failed to refresh local database state from replication server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchState();
  }, []);

  // Simulated copy worker loop
  useEffect(() => {
    if (copyProgress !== null && copyingDiskId) {
      if (copyProgress < 100) {
        const timeout = setTimeout(() => {
          setCopyProgress(prev => Math.min((prev || 0) + Math.floor(Math.random() * 12) + 6, 100));
        }, simulationSpeed);
        return () => clearTimeout(timeout);
      } else {
        // Automatically decide outcome based on config selection
        let finalOutcome: 'completed' | 'failed' = 'completed';
        if (expectedOutcome === 'failure') {
          finalOutcome = 'failed';
        } else if (expectedOutcome === 'random') {
          finalOutcome = Math.random() < 0.75 ? 'completed' : 'failed';
        }
        finalizeSimulatedCopy(copyingDiskId, finalOutcome);
      }
    }
  }, [copyProgress, copyingDiskId, expectedOutcome, simulationSpeed]);

  const finalizeSimulatedCopy = async (diskId: string, resultingStatus: 'completed' | 'failed') => {
    try {
      const payload: Partial<Disk> = { status: resultingStatus };
      if (resultingStatus === 'completed') {
        payload.copy_complete_time = new Date().toISOString();
        payload.copy_fail_time = null;
      } else {
        payload.copy_fail_time = new Date().toISOString();
        payload.copy_complete_time = null;
      }

      const res = await fetch(`/api/disks/${diskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const updated = await res.json();
        setDisks(prev => prev.map(d => d.id === diskId ? updated : d));
        if (selectedDisk?.id === diskId) setSelectedDisk(updated);
        onTableUpdateNotification('disks', 'UPDATE', diskId);
        
        if (resultingStatus === 'completed') {
          setUiSuccess(`Verification duplication successful for drive ${diskId}! Dynamic success labels generated.`);
        } else {
          setUiError(`Duplication failed for drive ${diskId}. Flagged with update failure code.`);
        }
      }
    } catch (err) {
      console.error('Failed to complete simulated copy:', err);
      setUiError('Exception encountered finalizing duplication transaction.');
    } finally {
      setCopyProgress(null);
      setCopyingDiskId(null);
    }
  };

  const handleUpdateStatus = async (diskId: string, status: Disk['status'], customFields = {}) => {
    setUiError('');
    setUiSuccess('');
    const payload: Partial<Disk> = { status, ...customFields };
    
    // Auto-fill time properties based on target transition
    if (status === 'copying') {
      payload.copy_start_time = new Date().toISOString();
      payload.copy_complete_time = null;
      payload.copy_fail_time = null;
    } else if (status === 'completed') {
      payload.copy_complete_time = new Date().toISOString();
      payload.copy_fail_time = null;
    } else if (status === 'failed') {
      payload.copy_fail_time = new Date().toISOString();
      payload.copy_complete_time = null;
    } else if (status === 'received') {
      payload.copy_start_time = null;
      payload.copy_complete_time = null;
      payload.copy_fail_time = null;
      payload.pickup_time = null;
    }

    try {
      const res = await fetch(`/api/disks/${diskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const updated = await res.json();
        setDisks(prev => prev.map(d => d.id === diskId ? updated : d));
        if (selectedDisk?.id === diskId) setSelectedDisk(updated);
        onTableUpdateNotification('disks', 'UPDATE', diskId);
        setUiSuccess(`Disk "${diskId}" state changed to ${status.toUpperCase()} successfully.`);
      } else {
        setUiError('Failed to update disk state on the master database.');
      }
    } catch (err) {
      setUiError('Network error when transmitting state update.');
    }
  };

  const handleBatchUpdate = async (diskIds: string[], targetStatus: Disk['status']) => {
    setLoading(true);
    setUiError('');
    setUiSuccess('');
    
    let successCount = 0;
    let failedCount = 0;
    
    for (const diskId of diskIds) {
      const payload: Partial<Disk> = { status: targetStatus };
      
      if (targetStatus === 'copying') {
        payload.copy_start_time = new Date().toISOString();
        payload.copy_complete_time = null;
        payload.copy_fail_time = null;
      } else if (targetStatus === 'completed') {
        payload.copy_complete_time = new Date().toISOString();
        payload.copy_fail_time = null;
      } else if (targetStatus === 'failed') {
        payload.copy_fail_time = new Date().toISOString();
        payload.copy_complete_time = null;
      } else if (targetStatus === 'received') {
        payload.copy_start_time = null;
        payload.copy_complete_time = null;
        payload.copy_fail_time = null;
        payload.pickup_time = null;
      } else if (targetStatus === 'picked_up') {
        payload.pickup_time = new Date().toISOString();
      }

      try {
        const res = await fetch(`/api/disks/${diskId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          const updated = await res.json();
          setDisks(prev => prev.map(d => d.id === diskId ? updated : d));
          if (selectedDisk?.id === diskId) setSelectedDisk(updated);
          onTableUpdateNotification('disks', 'UPDATE', diskId);
          successCount++;
        } else {
          failedCount++;
        }
      } catch (err) {
        failedCount++;
      }
    }
    
    if (successCount > 0) {
      setUiSuccess(`Successfully batch-updated status of ${successCount} drives to ${targetStatus.toUpperCase()}${failedCount > 0 ? ` (${failedCount} failed)` : ''}.`);
    } else if (failedCount > 0) {
      setUiError(`Failed to batch update ${failedCount} drives.`);
    }
    
    setLoading(false);
  };

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanInput.trim()) return;
    
    const cleanedCode = scanInput.trim()
      .replace(/^\*|\*$/g, '') // strip surrounding asterisks *
      .replace(/^val-/i, '');  // strip leading val-
      
    // Look for matching disk id or serial
    const foundDisk = disks.find(d => 
      d.id.toLowerCase() === cleanedCode.toLowerCase() ||
      d.hd_serial.toLowerCase() === cleanedCode.toLowerCase()
    );
    
    if (foundDisk) {
      if (isInstantScan) {
        // If instant mode, trigger individual state update immediately
        handleUpdateStatus(foundDisk.id, batchStatus);
        
        // Add to scan trail as a success log
        setScannedDisks(prev => [
          {
            disk: foundDisk,
            status: 'success',
            message: `Instant updated -> ${batchStatus.toUpperCase()}`
          },
          ...prev
        ]);
      } else {
        // Queue committal mode
        const alreadyQueued = scannedDisks.some(item => item.disk.id === foundDisk.id);
        if (alreadyQueued) {
          setScannedDisks(prev => [
            {
              disk: foundDisk,
              status: 'warning',
              message: `Already in active update queue.`
            },
            ...prev
          ]);
        } else {
          setScannedDisks(prev => [
            {
              disk: foundDisk,
              status: 'success',
              message: `Queued for batch committal.`
            },
            ...prev
          ]);
        }
      }
    } else {
      // Create a mock temporary disk entry for display only, to show warning
      const mockUnknownDisk: Disk = {
        id: cleanedCode.toUpperCase(),
        source_requested_id: 'unknown',
        hd_manufacturer: 'UNKNOWN',
        hd_model: 'SERIAL / TAG ERROR',
        hd_serial: cleanedCode,
        hd_size: 'NOT FOUND',
        hd_speed: 'N/A',
        status: 'received', // dummy
        received_time: new Date().toISOString(),
        copy_start_time: null,
        copy_complete_time: null,
        copy_fail_time: null,
        pickup_time: null
      };
      
      setScannedDisks(prev => [
        {
          disk: mockUnknownDisk,
          status: 'warning',
          message: 'Code not located in Database inventory.'
        },
        ...prev
      ]);
    }
    
    setScanInput(''); // clear input
    // Keep focus
    setTimeout(() => {
      scanInputRef.current?.focus();
    }, 50);
  };

  // Trigger copy simulation run
  const triggerSimulationRun = (diskId: string) => {
    setUiError('');
    setUiSuccess('');
    // Set disk state to 'copying' first
    handleUpdateStatus(diskId, 'copying', { copy_start_time: new Date().toISOString() });
    
    // Launch simulation trackers
    setCopyingDiskId(diskId);
    setCopyProgress(1);
  };

  const cancelSimulation = () => {
    setCopyProgress(null);
    setCopyingDiskId(null);
  };

  const filteredDisks = disks.filter(d => 
    d.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.hd_serial.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.hd_manufacturer.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.hd_model.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusCounts = () => {
    const counts = { received: 0, copying: 0, completed: 0, failed: 0, picked_up: 0 };
    disks.forEach(d => {
      if (counts[d.status] !== undefined) counts[d.status]++;
    });
    return counts;
  };

  const counts = getStatusCounts();

  // Find requirements based on current selected disk datasource linked
  const activeDiskSource = selectedDisk 
    ? datasources.find(src => src.id === selectedDisk.source_requested_id) 
    : null;
  const recommendedSize = activeDiskSource?.required_specs?.size_options?.join('/') || '8TB / 6TB';

  return (
    <div className="space-y-6 font-sans">
      
      {/* REPLICATION_MULTI_SCAN_STATION AT THE TOP OF THE PROCESSING PAGE */}
      <div 
        ref={multiScanStationRef}
        className="bg-[#16161A] rounded-xl border border-[#2A2A2E] p-5 space-y-6 shadow-sm mb-6"
      >
        {/* 1. Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#2A2A2E] gap-2">
          <div>
            <h4 className="text-sm font-bold text-white font-mono tracking-wider flex items-center gap-2">
              <Barcode className="h-5 w-5 text-emerald-400 bg-emerald-500/10 p-1 rounded-md border border-emerald-500/30" />
              REPLICATION_MULTI_SCAN_STATION
            </h4>
            <p className="text-xs text-slate-400 mt-1 font-sans">
              Rapidly batch-update status transitions on multiple physical drives using hardware barcode readers or local simulations.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={fetchState}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-455 hover:text-white border border-[#2A2A2E] bg-[#0E0E10] hover:bg-slate-800 rounded-lg font-medium transition cursor-pointer"
            >
              <RefreshCcw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
              Reload Drives
            </button>
            <span className="self-start sm:self-center text-[9px] font-mono bg-[#3B82F6]/15 text-blue-400 border border-blue-900/30 px-2 py-1 rounded uppercase font-bold tracking-widest animate-pulse whitespace-nowrap">
              READY TO INGEST
            </span>
          </div>
        </div>

        {/* 2. Target Transition State Choice Cards */}
        <div className="space-y-2">
          <label className="block text-[10px] font-mono uppercase font-black text-slate-500 tracking-wider">
            STEP 1: SELECT TARGET PIPELINE STATUS
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {(['received', 'copying', 'completed', 'failed', 'picked_up'] as Disk['status'][]).map((status) => {
              const isActive = batchStatus === status;
              const colorMap = {
                received: { border: 'border-[#2A2A2E]', bg: 'bg-[#111113]', text: 'text-slate-400', active: 'border-slate-505 bg-slate-900/30 font-bold text-white shadow-sm' },
                copying: { border: 'border-blue-900/30', bg: 'bg-blue-955/5', text: 'text-blue-450', active: 'border-blue-500 bg-blue-955/20 font-bold text-blue-400 shadow-sm animate-pulse' },
                completed: { border: 'border-emerald-900/30', bg: 'bg-emerald-955/5', text: 'text-emerald-450', active: 'border-emerald-500 bg-emerald-955/20 font-bold text-emerald-400 shadow-sm' },
                failed: { border: 'border-rose-900/30', bg: 'bg-rose-955/5', text: 'text-rose-500', active: 'border-rose-500 bg-rose-955/20 font-bold text-rose-455 shadow-sm' },
                picked_up: { border: 'border-indigo-900/30', bg: 'bg-indigo-955/5', text: 'text-indigo-400', active: 'border-indigo-500 bg-indigo-900/20 font-bold text-indigo-300 shadow-sm' }
              };
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setBatchStatus(status)}
                  className={`py-3 px-1.5 border text-[11px] rounded-lg text-center transition-all cursor-pointer ${
                    isActive ? colorMap[status].active : `${colorMap[status].border} ${colorMap[status].bg} ${colorMap[status].text} hover:border-slate-705`
                  }`}
                >
                  <span className="block font-mono text-[9px] opacity-70 uppercase tracking-widest leading-none mb-1.5">
                    {status === 'copying' ? '⚙️ Process' : status === 'received' ? '📦 Stack' : status === 'completed' ? '✅ Verified' : status === 'failed' ? '❌ Fault' : '🚛 Release'}
                  </span>
                  <span className="truncate block font-semibold">{status.replace('_', ' ').toUpperCase()}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* STEP 2 and SIMULATION TRIGGERS side-by-side inside grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-6 space-y-4">
            {/* 3. Scan Command Laser Bar & Interactive Input Box */}
            <div className="bg-[#0E0E10] border border-[#2A2A2E] rounded-xl p-5 relative overflow-hidden space-y-4 shadow-inner h-full flex flex-col justify-between">
              {/* Pseudo neon laser line animation */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-emerald-500/80 animate-[bounce_3s_infinite] shadow-[0_0_10px_#10B981]" />

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-1 border-b border-[#2A2A2E]/50">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-[10px] font-mono uppercase font-black text-slate-400 tracking-wider">
                    STEP 2: SCAN PHYSICAL TAG BARCODE
                  </span>
                </div>
                {/* Execution mode toggle */}
                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                  <span className="text-[10px] font-mono text-slate-405 uppercase tracking-wide">Instant execution on scan</span>
                  <input
                    type="checkbox"
                    checked={isInstantScan}
                    onChange={(e) => setIsInstantScan(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="relative w-8 h-4 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-350 after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3.5 after:transition-all border-[#2A2A2E] peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <form onSubmit={handleScanSubmit} className="flex gap-2 my-2">
                <div className="relative flex-1">
                  <input
                    ref={scanInputRef}
                    type="text"
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    placeholder="Click here & scan barcode tag (e.g. DSK-001 or serial)..."
                    className="w-full bg-[#111113] border-2 border-emerald-950/60 rounded-xl px-4 py-3 text-xs text-emerald-450 placeholder-emerald-950/40 tracking-wide font-mono focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 border-dashed"
                    autoComplete="off"
                  />
                  {scanInput && (
                    <button
                      type="button"
                      onClick={() => setScanInput('')}
                      className="absolute right-3.5 top-3 text-emerald-700 hover:text-emerald-400 cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  className="px-5 bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-xs rounded-xl flex items-center gap-1.5 transition uppercase cursor-pointer"
                >
                  <ListPlus className="h-4 w-4" />
                  Register
                </button>
              </form>

              <div className="text-[10px] text-slate-500 leading-normal flex items-start gap-1 justify-between">
                <span>💡 Compatible with standard USB/Bluetooth barcode guns. Focuses automatically.</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 space-y-4">
            {/* 4. DEMO SIMULATOR STICKERS */}
            <div className="bg-[#111113]/80 border border-[#2A2A2E] rounded-xl p-4 space-y-3 h-full flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-[#2A2A2E]/55 pb-2">
                <span className="text-[10px] font-mono font-extrabold text-[#3B82F6] uppercase tracking-wider flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5 text-blue-400" />
                  🖥️ Barcode Simulation Laser Trigger
                </span>
                <span className="text-[9px] text-slate-500 font-mono">Click to simulate physical scan</span>
              </div>
              
              <div className="flex flex-wrap gap-2 pt-1 max-h-[110px] overflow-y-auto">
                {disks.map((d) => {
                  const isScannedCurrentSession = scannedDisks.some(s => s.disk.id === d.id);
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => {
                        const foundDisk = disks.find(x => x.id === d.id);
                        if (foundDisk) {
                          if (isInstantScan) {
                            handleUpdateStatus(foundDisk.id, batchStatus);
                            setScannedDisks(prev => [
                              {
                                disk: foundDisk,
                                status: 'success',
                                message: `Instant updated -> ${batchStatus.toUpperCase()}`
                              },
                              ...prev
                            ]);
                          } else {
                            const alreadyQueued = scannedDisks.some(item => item.disk.id === foundDisk.id);
                            if (alreadyQueued) {
                              setScannedDisks(prev => [
                                { disk: foundDisk, status: 'warning', message: 'Already in active update queue.' },
                                ...prev
                              ]);
                            } else {
                              setScannedDisks(prev => [
                                { disk: foundDisk, status: 'success', message: 'Queued for batch committal.' },
                                ...prev
                              ]);
                            }
                          }
                        }
                      }}
                      className={`px-2 py-1 text-[10px] font-mono border rounded hover:border-blue-450 hover:bg-blue-955/20 transition cursor-pointer flex items-center gap-1 select-none ${
                        isScannedCurrentSession
                          ? 'border-emerald-850 bg-emerald-950/15 text-emerald-450'
                          : 'border-[#2A2A2E] bg-[#0E0E10] text-slate-400'
                      }`}
                    >
                      <span className="font-extrabold uppercase bg-slate-900 border border-[#2A2A2E] px-0.5 rounded text-[7px]">|||</span>
                      <span>{d.id}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* 5. COMMITMENT AND ACTIVE SCANNED LIST VIEW */}
        <div className="border border-[#2A2A2E] rounded-xl overflow-hidden bg-[#0E0E10]">
          <div className="bg-[#111113] px-4.5 py-2.5 border-b border-[#2A2A2E] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase font-black text-slate-300">
                Scan Queue & Log History ({scannedDisks.length})
              </span>
            </div>
            
            <div className="flex gap-2">
              {scannedDisks.length > 0 && (
                <button
                  type="button"
                  onClick={() => setScannedDisks([])}
                  className="text-[10px] text-slate-500 hover:text-rose-455 font-mono cursor-pointer"
                >
                  [ Clear Queue / Logs ]
                </button>
              )}
            </div>
          </div>

          <div className="max-h-[140px] overflow-y-auto divide-y divide-[#2A2A2E]">
            {scannedDisks.length === 0 ? (
              <div className="p-5 text-center text-slate-600 text-[11px] font-mono">
                Awaiting initial drive codes. Scan sticker or select simulation triggers to register drive tracks.
              </div>
            ) : (
              scannedDisks.map((item, idx) => (
                <div key={idx} className="p-2 flex items-center justify-between text-xs font-mono hover:bg-[#111113]/30">
                  <div className="flex items-center gap-2.5">
                    <span className={`h-2 w-2 rounded-full ${item.status === 'success' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-205">{item.disk.id}</span>
                        <span className="text-[9px] text-slate-505">({item.disk.hd_serial})</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold border capitalize ${
                      item.status === 'success' 
                        ? 'bg-emerald-950/20 text-emerald-400 border-emerald-900/40' 
                        : 'bg-amber-955/20 text-amber-500 border-amber-900/40'
                    }`}>
                      {item.message}
                    </span>
                    
                    {!isInstantScan && item.status === 'success' && (
                      <button
                        type="button"
                        onClick={() => {
                          setScannedDisks(prev => prev.filter((_, i) => i !== idx));
                        }}
                        className="text-slate-600 hover:text-rose-500 transition cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Commit Controls for non-instant scan queue */}
          {!isInstantScan && scannedDisks.filter(s => s.status === 'success').length > 0 && (
            <div className="bg-[#111113] p-3 border-t border-[#2A2A2E] flex items-center justify-between">
              <span className="text-[10px] font-mono text-slate-400 uppercase font-black">
                {scannedDisks.filter(s => s.status === 'success').length} verified drives staged
              </span>
              <button
                type="button"
                onClick={() => {
                  const validIds = scannedDisks
                    .filter(s => s.status === 'success')
                    .map(s => s.disk.id);
                  handleBatchUpdate(validIds, batchStatus);
                  setScannedDisks([]);
                }}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-mono font-bold text-xs rounded-lg shadow transition uppercase cursor-pointer"
              >
                Commit Batch Update
              </button>
            </div>
          )}
        </div>
      </div>

      {/* NOTIFICATION BANNERS instead of alert() */}
      {uiError && (
        <div className="bg-rose-950/20 border border-rose-900/30 rounded-xl p-4 flex items-start gap-3 text-xs text-rose-300">
          <AlertCircle className="h-4.5 w-4.5 text-rose-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold uppercase font-mono text-rose-455">System Error Encountered</span>
            <p className="mt-0.5">{uiError}</p>
          </div>
          <button onClick={() => setUiError('')} className="text-rose-400 hover:text-white cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {uiSuccess && (
        <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-xl p-4 flex items-start gap-3 text-xs text-emerald-300">
          <CheckCircle className="h-4.5 w-4.5 text-emerald-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold uppercase font-mono text-emerald-450">Operation Logged</span>
            <p className="mt-0.5">{uiSuccess}</p>
          </div>
          <button onClick={() => setUiSuccess('')} className="text-emerald-400 hover:text-white cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* METRIC CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-[#16161A] border border-[#2A2A2E] p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-mono text-slate-500 font-bold block">1. Received</span>
            <span className="text-xl font-bold font-mono text-[#A1A1AA]">{counts.received}</span>
          </div>
          <span className="h-2 w-2 rounded-full bg-[#A1A1AA]"></span>
        </div>
        <div className="bg-[#16161A] border border-[#2A2A2E] p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-mono text-slate-500 font-bold block">2. Copying</span>
            <span className="text-xl font-bold font-mono text-[#3B82F6]">{counts.copying}</span>
          </div>
          <span className="h-2 w-2 rounded-full bg-[#3B82F6] animate-pulse"></span>
        </div>
        <div className="bg-[#16161A] border border-[#2A2A2E] p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-mono text-slate-500 font-bold block">3. Completed</span>
            <span className="text-xl font-bold font-mono text-[#10B981]">{counts.completed}</span>
          </div>
          <span className="h-2 w-2 rounded-full bg-[#10B981]"></span>
        </div>
        <div className="bg-[#16161A] border border-[#2A2A2E] p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-mono text-slate-500 font-bold block">4. Failed</span>
            <span className="text-xl font-bold font-mono text-[#EF4444]">{counts.failed}</span>
          </div>
          <span className="h-2 w-2 rounded-full bg-[#EF4444]"></span>
        </div>
        <div className="bg-[#16161A] border border-[#2A2A2E] p-4 rounded-xl flex items-center justify-between col-span-2 lg:col-span-1">
          <div>
            <span className="text-[10px] uppercase font-mono text-slate-500 font-bold block">5. Picked Up</span>
            <span className="text-xl font-bold font-mono text-[#6366F1]">{counts.picked_up}</span>
          </div>
          <span className="h-2 w-2 rounded-full bg-[#6366F1]"></span>
        </div>
      </div>

      <div className="bg-[#16161A] rounded-xl border border-[#2A2A2E] p-5 shadow-sm mt-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-[#2A2A2E] gap-4 mb-5">
          <div>
            <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-blue-405" />
              Drive Inventory Workspace
            </h3>
            <p className="text-xs text-slate-400 mt-1 font-sans">
              Perform high-speed duplications, print label tags, or bypass status machines right from the tracked devices below.
            </p>
          </div>
          <div className="w-full md:w-80 relative rounded-lg shadow-sm">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-3.5 w-3.5 text-slate-500" />
            </div>
            <input
              type="text"
              className="block w-full rounded-lg bg-[#0E0E10] border border-[#2A2A2E] pl-9 pr-4 py-2 text-xs text-white placeholder-slate-650 tracking-wide font-sans focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Search sequence, brand, model..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Responsive Grid list of active drives */}
        {(() => {
          const totalPages = Math.max(1, Math.ceil(filteredDisks.length / deskPageSize));
          const currentPage = Math.min(deskPage, totalPages);
          const startIndex = (currentPage - 1) * deskPageSize;
          const endIndex = startIndex + deskPageSize;
          const pagedDisks = filteredDisks.slice(startIndex, endIndex);

          return (
            <div>
              <div className="flex justify-between items-center mb-3 text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                <span>Showing {filteredDisks.length === 0 ? 0 : startIndex + 1} - {Math.min(endIndex, filteredDisks.length)} of {filteredDisks.length} matched (Total: {disks.length})</span>
                {filteredDisks.length > deskPageSize && (
                  <span>Page {currentPage} of {totalPages}</span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredDisks.length === 0 ? (
                  <div className="col-span-full text-center text-slate-600 font-mono py-16 text-xs bg-[#111113] rounded-xl border border-[#2A2A2E]/55">
                    No matching disks found.
                  </div>
                ) : (
                  pagedDisks.map((d) => {
                    const isDiskSimulated = copyingDiskId === d.id;
                    return (
                      <div
                        key={d.id}
                        className={`bg-[#111113] border rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition ${
                          isDiskSimulated ? 'border-blue-900/50 bg-blue-955/5 shadow-inner' : 'border-[#2A2A2E]/60'
                        }`}
                      >
                        {/* Card Header: Identifier, serial and active status badge */}
                        <div className="flex justify-between items-start gap-2 mb-3.5">
                          <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded-lg shrink-0 ${
                              d.status === 'completed' ? 'bg-emerald-950/40 text-emerald-450' :
                              d.status === 'copying' ? 'bg-blue-955/45 text-blue-400 animate-pulse' :
                              d.status === 'failed' ? 'bg-rose-955/45 text-rose-500' :
                              d.status === 'picked_up' ? 'bg-indigo-955/45 text-indigo-400' :
                              'bg-slate-900 border border-[#2A2A2E]/50 text-slate-500'
                            }`}>
                              <HardDrive className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="font-mono font-bold text-xs text-blue-400 leading-tight">{d.id}</div>
                              <div className="text-[9px] font-mono text-slate-500 leading-none mt-0.5">S/N: {d.hd_serial}</div>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[8px] font-extrabold font-mono tracking-widest border leading-none uppercase ${
                              d.status === 'completed' ? 'bg-emerald-955/35 text-emerald-400 border-emerald-900/40' :
                              d.status === 'copying' ? 'bg-blue-955/35 text-blue-400 border-blue-900/40' :
                              d.status === 'failed' ? 'bg-rose-955/35 text-rose-500 border-rose-905' :
                              d.status === 'picked_up' ? 'bg-indigo-955/35 text-indigo-400 border-indigo-905' :
                              'bg-slate-950/40 text-slate-400 border-[#2A2A2E]'
                            }`}>
                              {d.status === 'copying' && isDiskSimulated ? 'VERIFYING...' : d.status.replace('_', ' ')}
                            </span>
                          </div>
                        </div>

                        {/* Card Content: Specs */}
                        <div className="mb-4 text-xs space-y-1">
                          <div className="font-bold text-slate-200 truncate">{d.hd_manufacturer}</div>
                          <div className="text-slate-400 text-[11px] font-mono truncate">{d.hd_model}</div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-1.5 pt-1 uppercase font-mono">
                            <span>{d.hd_size}</span>
                            <span>&bull;</span>
                            <span>{d.hd_speed}</span>
                          </div>
                        </div>

                        {/* Built-in live progress bar for simulator */}
                        {isDiskSimulated && copyProgress !== null && (
                          <div className="mb-4 bg-[#0E0E10] border border-[#2A2A2E] p-2.5 rounded-lg space-y-2">
                            <div className="flex justify-between items-center text-[9px] font-mono">
                              <span className="text-blue-400 font-extrabold tracking-tight animate-pulse">DUPLICATING...</span>
                              <span className="text-white font-bold">{copyProgress}%</span>
                            </div>
                            <div className="w-full bg-[#16161A] h-2 rounded-full overflow-hidden border border-[#28282D]">
                              <div 
                                className="bg-blue-500 h-full rounded-full transition-all duration-300 shadow shadow-blue-500"
                                style={{ width: `${copyProgress}%` }}
                              ></div>
                            </div>
                            <div className="flex justify-between text-[8px] font-mono text-slate-500">
                              <button 
                                onClick={cancelSimulation}
                                className="text-rose-455 hover:text-rose-400 cursor-pointer text-slate-400 transition"
                              >
                                [ Abort ]
                              </button>
                              <span>{simulationSpeed === 50 ? 'FAST' : 'NORMAL'}</span>
                            </div>
                          </div>
                        )}

                        {/* Card Action Controls */}
                        <div className="border-t border-[#2A2A2E]/50 pt-3.5 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => triggerSimulationRun(d.id)}
                              disabled={d.status === 'completed' || d.status === 'picked_up' || isDiskSimulated}
                              className="py-1.5 px-2 bg-blue-600/10 hover:bg-blue-600 border border-blue-900/30 text-blue-400 hover:text-white disabled:opacity-30 disabled:hover:bg-blue-600/10 disabled:hover:text-blue-400 rounded-lg text-[10px] font-bold font-mono transition flex items-center justify-center gap-1 cursor-pointer"
                              title="Run block-level copier on drive"
                            >
                              <Play className="h-3 w-3" />
                              <span>Run Copier</span>
                            </button>

                            <button
                              onClick={() => setPrintedTicketDisk(d)}
                              className="py-1.5 px-2 bg-[#0E0E10] border border-[#2A2A2E] hover:border-slate-500 rounded-lg text-slate-400 hover:text-white text-[10px] font-bold font-mono transition flex items-center justify-center gap-1 cursor-pointer"
                              title="Print dispatch ticket and labels"
                            >
                              <Printer className="h-3 w-3" />
                              <span>Print Label</span>
                            </button>
                          </div>

                          {/* Integrated bypass dropdown selector */}
                          <div className="flex items-center justify-between gap-1 text-[10px] bg-[#0E0E10] border border-[#2A2A2E] rounded-lg px-2 py-1.5">
                            <span className="text-slate-550 font-mono uppercase font-bold text-[8.5px] tracking-tight shrink-0">Bypass state:</span>
                            <select
                              value={d.status}
                              disabled={isDiskSimulated}
                              onChange={(e) => {
                                const targetVal = e.target.value as Disk['status'];
                                handleUpdateStatus(d.id, targetVal);
                                setUiSuccess(`Manually updated drive ${d.id} status to ${targetVal.toUpperCase()}.`);
                              }}
                              className="bg-transparent text-slate-350 hover:text-white focus:outline-none cursor-pointer font-mono font-bold uppercase text-[9.5px] py-0.5"
                            >
                              <option value="received" className="bg-[#0E0E10] text-slate-300">1. Received</option>
                              <option value="copying" className="bg-[#0E0E10] text-blue-405">2. Copying</option>
                              <option value="completed" className="bg-[#0E0E10] text-emerald-405">3. Completed</option>
                              <option value="failed" className="bg-[#0E0E10] text-rose-405">4. Failed</option>
                              <option value="picked_up" className="bg-[#0E0E10] text-indigo-405">5. Picked Up</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Touchscreen-Optimized Pagination controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-[#2A2A2E]/60 pt-6 mt-8 flex-wrap gap-4">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setDeskPage(prev => Math.max(1, prev - 1))}
                    className="px-5 py-3 text-sm font-black rounded-xl bg-[#0E0E10] border border-[#2A2A2E] text-slate-200 disabled:opacity-45 hover:bg-slate-800 transition cursor-pointer select-none"
                  >
                    Prev Page
                  </button>
                  <div className="flex items-center gap-2 py-1 flex-wrap">
                    {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pageNum) => {
                      const isNearCurrent = Math.abs(pageNum - currentPage) <= 1;
                      const isFirstOrLast = pageNum === 1 || pageNum === totalPages;
                      
                      if (isFirstOrLast || isNearCurrent) {
                        return (
                          <button
                            key={pageNum}
                            type="button"
                            onClick={() => setDeskPage(pageNum)}
                            className={`w-12 h-12 flex items-center justify-center rounded-xl font-mono font-black text-sm cursor-pointer transition select-none ${currentPage === pageNum ? 'bg-blue-650 text-white shadow' : 'bg-[#0E0E10] border border-[#2A2A2E] text-slate-400 hover:text-white'}`}
                          >
                            {pageNum}
                          </button>
                        );
                      } else if (pageNum === 2 || pageNum === totalPages - 1) {
                        return <span key={pageNum} className="text-slate-600 px-2 select-none font-mono text-sm">...</span>;
                      }
                      return null;
                    })}
                  </div>
                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => setDeskPage(prev => Math.min(totalPages, prev + 1))}
                    className="px-5 py-3 text-sm font-black rounded-xl bg-[#0E0E10] border border-[#2A2A2E] text-slate-200 disabled:opacity-45 hover:bg-slate-800 transition cursor-pointer select-none"
                  >
                    Next Page
                  </button>
                </div>
              )}
            </div>
          );
        })()}
        </div>

      {/* PRINT PREVIEW / TICKET TAG DIALOG Overlay */}
      {printedTicketDisk && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#16161A] rounded-xl shadow-2xl overflow-hidden max-w-lg w-full border border-slate-700/50 flex flex-col">
            
            <div className="border-b border-[#2A2A2E] p-4 bg-slate-900/60 text-center relative">
              <span className="text-[10px] text-emerald-400 border border-emerald-900/40 rounded px-1.5 py-0.5 uppercase tracking-wider font-extrabold font-mono">DDV DISK DISPATCHED</span>
              <h4 className="font-bold text-lg block mt-1.5 font-sans tracking-tight text-white">Physical Asset Tag Label</h4>
              <button 
                onClick={() => setPrintedTicketDisk(null)}
                className="absolute top-3.5 right-3.5 text-xs text-slate-400 hover:text-slate-200 font-bold hover:bg-[#2A2A2E] px-2 py-1 rounded"
              >
                ✕
              </button>
            </div>

            <div className="p-6 bg-[#0E0E10] flex items-center justify-center">
              {/* MINIMIZED PHYSICAL ASSET TAG - U.S. DOLLAR BILL SIZE & FORM FACTOR */}
              <div className="w-full max-w-md aspect-[2.35/1] bg-white border border-slate-350 rounded-xl p-3.5 flex flex-row items-center justify-between gap-3 text-slate-900 font-mono shadow-md select-none relative animate-fade-in">
                <div className="absolute top-1 right-2 text-[7px] border border-blue-500 text-blue-600 font-bold uppercase rounded px-1 leading-none">Tag #1 (TO DRIVE)</div>
                
                {/* LEFT COLUMN - REQUIRED DATA ONLY */}
                <div className="flex flex-col justify-between h-full text-left flex-1 min-w-0">
                  <div>
                    <span className="text-[9px] text-slate-500 tracking-wider font-black block leading-none uppercase">PHYSICAL ASSET TAG</span>
                    <span className="text-[16px] md:text-[18px] font-black text-slate-900 block truncate mt-1 tracking-tight">{printedTicketDisk.id}</span>
                  </div>
                  
                  <div className="space-y-0.5 my-1 text-[9px] text-slate-700">
                    <div className="flex justify-between">
                      <span>SOURCE DATASET:</span>
                      <span className="font-extrabold text-blue-600">{printedTicketDisk.source_requested_id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>DRIVE S/N:</span>
                      <span className="font-extrabold text-slate-800 truncate max-w-[120px]">{printedTicketDisk.hd_serial || 'PENDING'}</span>
                    </div>
                  </div>

                  <span className="text-[7.5px] text-slate-500 font-sans leading-tight mt-1 border-t border-slate-200 pt-1 block">
                    AFFIX SECURELY TO PHYSICAL CASING
                  </span>
                </div>

                {/* RIGHT COLUMN - QR CODE ONLY */}
                <div className="flex flex-col items-center justify-center bg-slate-50 p-2 border border-slate-200 rounded-lg shrink-0 w-[95px] h-[95px]">
                  <QRCodeSVG value={printedTicketDisk.id} size={70} level="M" />
                  <span className="text-[8px] text-slate-700 mt-1.5 font-bold tracking-tight select-none">*VAL-{printedTicketDisk.id}*</span>
                </div>
              </div>
            </div>

            <div className="bg-[#111113] p-3 text-center border-t border-[#2A2A2E] flex gap-2">
              <button
                onClick={() => {
                  setPrintedTicketDisk(null);
                  setUiSuccess('Duplicator label printed and dispatched to physical drive tray.');
                }}
                className="flex-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 py-2 rounded-lg transition"
              >
                Mock Physical Print
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
