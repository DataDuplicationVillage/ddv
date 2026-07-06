import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Plus, RefreshCw, Barcode, HardDrive, ShieldAlert, Loader2, Info, Camera, Check, Upload, ArrowRight, CheckCircle, Clock
} from 'lucide-react';
import { Disk, DataSource, UserRole } from '../types';

interface VolunteerPortalProps {
  currentUser: { username: string; name: string; role: UserRole; diskhaver_id?: string } | null;
  onLogout: () => void;
  onTableUpdateNotification: (tableName: string, action: string, recordId: string) => void;
}

export default function VolunteerPortal({
  currentUser,
  onLogout,
  onTableUpdateNotification
}: VolunteerPortalProps) {
  // Database states
  const [disks, setDisks] = useState<Disk[]>([]);
  const [datasources, setDatasources] = useState<DataSource[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Active sub-tab within POS: 'intake' | 'return' | 'reprint'
  const [posTab, setPosTab] = useState<'intake' | 'return' | 'reprint'>('intake');
  
  // Search state for print/reprint and return tabs
  const [reprintSearchQuery, setReprintSearchQuery] = useState('');
  const [returnDiskSearchQuery, setReturnDiskSearchQuery] = useState('');

  // Intake Flow Step trackers
  const [intakeStep, setIntakeStep] = useState<1 | 2 | 4>(1);
  const [intakeSuccessRecord, setIntakeSuccessRecord] = useState<{ disk: Disk } | null>(null);

  // Webcam states for drive image capture
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [webcamError, setWebcamError] = useState('');
  const [isCameraSimulated, setIsCameraSimulated] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Scanning simulation and OCR states
  const [scanImageBase64, setScanImageBase64] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanSkipWarning, setScanSkipWarning] = useState(false);
  const [adminOverrideDuplicateSerial, setAdminOverrideDuplicateSerial] = useState(false);

  // Intake Drive Form State
  const [diskForm, setDiskForm] = useState({
    id: '',
    hd_manufacturer: 'Seagate',
    hd_model: '',
    hd_serial: '',
    hd_size: '8TB',
    hd_speed: '7200 RPM',
    source_requested_id: '',
    status: 'received' as Disk['status'],
    received_time: '',
    hd_image: ''
  });

  // Return Flow States
  const [selectedReturnDiskId, setSelectedReturnDiskId] = useState('');
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);
  const [returnSuccessRecord, setReturnSuccessRecord] = useState<{ diskName: string, diskId: string } | null>(null);

  // Ticket Modal state for printable tags
  const [printedTicketDisk, setPrintedTicketDisk] = useState<Disk | null>(null);

  // Cleanup webcam stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Fetch initial data
  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      const [disksRes, sourcesRes] = await Promise.all([
        fetch('/api/disks'),
        fetch('/api/datasources')
      ]);

      if (disksRes.ok) setDisks(await disksRes.json());
      if (sourcesRes.ok) setDatasources(await sourcesRes.json());
    } catch (err) {
      console.error('Failed to load volunteer data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Generate a standard Disk Sequence ID
  const generateDiskID = (existingDisks: Disk[]) => {
    const lastSeqNum = existingDisks.reduce((max, d) => {
      const match = d.id.match(/(?:disk|DISK)-0*(\d+)/i);
      if (match) {
        const val = parseInt(match[1], 10);
        return val > max ? val : max;
      }
      return max;
    }, 0);
    const nextSeq = lastSeqNum + 1;
    const seqStr = nextSeq.toString().padStart(3, '0');
    
    // Generate standard 16 character alpha-numeric suffix
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let uuid = '';
    for (let i = 0; i < 16; i++) {
      uuid += chars[Math.floor(Math.random() * chars.length)];
    }
    return `disk-${seqStr}-${uuid}`;
  };

  // Populate dynamic ID once disks load
  useEffect(() => {
    if (disks.length > 0 && !diskForm.id) {
      setDiskForm(prev => ({
        ...prev,
        id: generateDiskID(disks)
      }));
    }
  }, [disks, diskForm.id]);

  // Webcam handlers
  const startWebcam = async () => {
    setIsCameraSimulated(false);
    try {
      setWebcamError('');
      
      // Check for API support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Webcam access is not supported or is blocked in this browser context (requires HTTPS or local development).');
      }

      let stream: MediaStream;
      try {
        // Attempt 1: High-resolution back/environment camera
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } 
        });
      } catch (firstErr: any) {
        console.warn("Attempt 1 (High-res environment) failed, attempting with simpler constraints...", firstErr);
        try {
          // Attempt 2: Standard environment camera
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
          });
        } catch (secondErr: any) {
          console.warn("Attempt 2 (Environment only) failed, attempting standard video capture...", secondErr);
          try {
            // Attempt 3: Any video source with no additional constraints
            stream = await navigator.mediaDevices.getUserMedia({ 
              video: true 
            });
          } catch (thirdErr: any) {
            console.error("All camera initialization attempts failed:", thirdErr);
            throw new Error(thirdErr.message || 'Could not start video source. It might be in use, blocked by system settings, or disconnected.');
          }
        }
      }

      setIsWebcamActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(e => {
            console.error("Video play failed:", e);
            setWebcamError('Camera source acquired, but video playback was blocked: ' + (e.message || e));
          });
        }
      }, 100);
      streamRef.current = stream;
    } catch (err: any) {
      console.warn("Physical camera startup failed, falling back to Simulated Scan Mode:", err);
      setIsWebcamActive(true);
      setIsCameraSimulated(true);
      setWebcamError('Physical camera unavailable (missing or blocked). Running in Simulated Scanner Mode.');
    }
  };

  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsWebcamActive(false);
    setIsCameraSimulated(false);
  };

  const captureWebcam = () => {
    if (isCameraSimulated) {
      // Gracefully capture Seagate 8TB mock label as the fallback scan
      handleLoadMockLabel('seagate_8tb');
      stopWebcam();
      return;
    }

    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        setScanImageBase64(dataUrl);
        setScanResult(null);
        setScanSkipWarning(false);
        setAdminOverrideDuplicateSerial(false);
        stopWebcam();
      }
    }
  };

  const handleImageFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanResult(null);
    setScanSkipWarning(false);
    setAdminOverrideDuplicateSerial(false);

    const reader = new FileReader();
    reader.onloadend = () => {
      setScanImageBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const runGeminiImageOcr = async () => {
    if (!scanImageBase64) return;
    setIsScanning(true);
    setScanResult(null);
    setScanSkipWarning(false);
    setAdminOverrideDuplicateSerial(false);

    try {
      const res = await fetch('/api/disks/scan-label', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: scanImageBase64, imageName: 'label.jpg' })
      });

      if (res.ok) {
        const responseData = await res.json();
        setScanResult(responseData);
        setDiskForm(prev => ({
          ...prev,
          hd_manufacturer: responseData.data.hd_manufacturer,
          hd_model: responseData.data.hd_model,
          hd_serial: responseData.data.hd_serial,
          hd_size: responseData.data.hd_size,
          hd_speed: responseData.data.hd_speed
        }));
      } else {
        alert('OCR engine reported an index exception or credentials failure.');
      }
    } catch (err) {
      alert('Internal connection failed during label scan.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleLoadMockLabel = (modelPreset: 'seagate_8tb' | 'wd_6tb' | 'mismatched_unrecognized') => {
    const fakeBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUHMgYVDC8m7V6zOwAAABl0RVh0Q29tbWVudABDcmVhdGVkIHdpdGggR0lNUO9kJW4AAAA/SURBVGje7cxBAQAADAIg9E+1ZHAHe0gGZECYfIAsWvYIskCWARkQJh8gixb9giwiYGaArP4BsmgZZIEMAzIgYpIsCqY7yQAAAABJRU5ErkJggg==";
    setScanImageBase64(fakeBase64);
    setScanSkipWarning(false);
    setAdminOverrideDuplicateSerial(false);
    
    if (modelPreset === 'seagate_8tb') {
      setScanResult({
        success: true,
        data: {
          hd_manufacturer: 'Seagate',
          hd_model: 'IronWolf ST8000VN004',
          hd_serial: 'S8TB-SEAGATE-991A',
          hd_size: '8TB',
          hd_speed: '7200 RPM'
        }
      });
      setDiskForm(prev => ({
        ...prev,
        hd_manufacturer: 'Seagate',
        hd_model: 'IronWolf ST8000VN004',
        hd_serial: 'S8TB-SEAGATE-991A',
        hd_size: '8TB',
        hd_speed: '7200 RPM'
      }));
    } else if (modelPreset === 'wd_6tb') {
      setScanResult({
        success: true,
        data: {
          hd_manufacturer: 'Western Digital',
          hd_model: 'WD Red Plus WD60EFAX',
          hd_serial: 'W6TB-WD-RED-442B',
          hd_size: '6TB',
          hd_speed: '5400 RPM'
        }
      });
      setDiskForm(prev => ({
        ...prev,
        hd_manufacturer: 'Western Digital',
        hd_model: 'WD Red Plus WD60EFAX',
        hd_serial: 'W6TB-WD-RED-442B',
        hd_size: '6TB',
        hd_speed: '5400 RPM'
      }));
    } else {
      setScanResult({
        success: true,
        data: {
          hd_manufacturer: 'Unknown Brand ?',
          hd_model: 'Model Unreadable',
          hd_serial: 'SN-UNRESOLVED-55X',
          hd_size: '8TB',
          hd_speed: '7200 RPM'
        }
      });
      setDiskForm(prev => ({
        ...prev,
        hd_manufacturer: 'Unknown Brand ?',
        hd_model: 'Model Unreadable',
        hd_serial: 'SN-UNRESOLVED-55X',
        hd_size: '8TB',
        hd_speed: '7200 RPM'
      }));
    }
  };

  const getUncapturedFields = (result: any) => {
    if (!result || !result.data) return [];
    const uncaptured: string[] = [];
    const data = result.data;

    if (!data.hd_manufacturer || data.hd_manufacturer.toLowerCase().includes('unknown') || data.hd_manufacturer.trim() === '') {
      uncaptured.push('Manufacturer');
    }
    if (!data.hd_model || data.hd_model.toLowerCase().includes('unknown') || data.hd_model.trim() === '' || data.hd_model.includes('?')) {
      uncaptured.push('Model Name');
    }
    if (!data.hd_serial || data.hd_serial.toLowerCase().includes('unknown') || data.hd_serial.trim() === '' || data.hd_serial.includes('?')) {
      uncaptured.push('Serial Number Code');
    }
    if (!data.hd_size || data.hd_size.toLowerCase().includes('unknown') || data.hd_size.trim() === '' || data.hd_size.includes('?')) {
      uncaptured.push('Storage Capacity');
    }
    if (!data.hd_speed || data.hd_speed.toLowerCase().includes('unknown') || data.hd_speed.trim() === '' || data.hd_speed.includes('?')) {
      uncaptured.push('Spindle Speed');
    }

    return uncaptured;
  };

  // Submit drive intake
  const handlePOSIntakeSubmit = async () => {
    if (!diskForm.id || !diskForm.hd_serial || !diskForm.source_requested_id) {
      alert("Missing required fields for Registration.");
      return;
    }

    const serialExists = diskForm.hd_serial 
      ? disks.some(d => d.hd_serial.toLowerCase().trim() === diskForm.hd_serial.toLowerCase().trim() && d.hd_serial.trim() !== '') 
      : false;
    if (serialExists && !(currentUser?.role === 'admin' && adminOverrideDuplicateSerial)) {
      alert("Redundant Ingestion Guard is active. Admin Authorization required to duplicate ingestion.");
      return;
    }

    setIsLoading(true);
    try {
      const diskPayload = {
        ...diskForm,
        received_time: new Date().toISOString(),
        status: 'received',
        hd_image: scanImageBase64 || null
      };

      const diskRes = await fetch('/api/disks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(diskPayload)
      });

      if (!diskRes.ok) {
        const err = await diskRes.json();
        alert(err.error || "Failed to register Disk in Master database.");
        setIsLoading(false);
        return;
      }

      const createdDisk: Disk = await diskRes.json();
      onTableUpdateNotification('disks', 'INSERT', createdDisk.id);

      setIntakeSuccessRecord({ disk: createdDisk });
      setIntakeStep(4);
      fetchAllData();
      setPrintedTicketDisk(createdDisk);

    } catch (err) {
      console.error(err);
      alert("Error executing full-stack transactional intake.");
    } finally {
      setIsLoading(false);
    }
  };

  // Submit drive release / return
  const handlePOSReturnSubmit = async () => {
    if (!selectedReturnDiskId) return;
    setIsSubmittingReturn(true);
    
    const targetDisk = disks.find(d => d.id === selectedReturnDiskId);
    if (!targetDisk) {
      alert("Selected drive asset reference not found in active catalog.");
      setIsSubmittingReturn(false);
      return;
    }

    try {
      const diskUpdateRes = await fetch(`/api/disks/${selectedReturnDiskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status: 'picked_up',
          pickup_time: new Date().toISOString(),
          operator: 'Intake Desk / Release Operator'
        })
      });

      if (diskUpdateRes.ok) {
        const updated = await diskUpdateRes.json();
        onTableUpdateNotification('disks', 'UPDATE', updated.id);
        setReturnSuccessRecord({
          diskName: `${updated.hd_manufacturer} ${updated.hd_model} (${updated.hd_serial})`,
          diskId: updated.id
        });
        setSelectedReturnDiskId('');
        fetchAllData();
      } else {
        alert("Failed to submit discharge transaction.");
      }
    } catch (err) {
      console.error(err);
      alert("Connection failure reporting discharge.");
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  // Filter disks for return and reprint lists
  const filteredForReturn = disks.filter(d => {
    if (d.status === 'picked_up') return false;
    const q = returnDiskSearchQuery.toLowerCase().trim();
    if (!q) return true;
    return d.id.toLowerCase().includes(q) || 
           d.hd_serial.toLowerCase().includes(q) || 
           d.hd_model.toLowerCase().includes(q) ||
           d.hd_manufacturer.toLowerCase().includes(q);
  });

  const filteredForReprint = disks.filter(d => {
    const q = reprintSearchQuery.toLowerCase().trim();
    if (!q) return true;
    return d.id.toLowerCase().includes(q) || 
           d.hd_serial.toLowerCase().includes(q) || 
           d.hd_model.toLowerCase().includes(q) ||
           d.hd_manufacturer.toLowerCase().includes(q);
  });

  const handleResetIntakeForm = () => {
    setDiskForm({
      id: '',
      hd_manufacturer: 'Seagate',
      hd_model: '',
      hd_serial: '',
      hd_size: '8TB',
      hd_speed: '7200 RPM',
      source_requested_id: '',
      status: 'received',
      received_time: '',
      hd_image: ''
    });
    setScanImageBase64(null);
    setScanResult(null);
    setScanSkipWarning(false);
    setIntakeStep(1);
    setIntakeSuccessRecord(null);
  };

  return (
    <div className="space-y-6">
      {/* Volunteer POS Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-[#2A2A2E] gap-4 mb-6">
        <div>
          <h3 className="text-xs font-bold font-mono text-blue-400 uppercase tracking-widest flex items-center gap-2">
            <span>VOLUNTEER OPERATIONS PORTAL</span>
          </h3>
        </div>
        {/* Navigation Tab Switcher */}
        <div className="flex bg-[#0E0E10] border border-[#2A2A2E] p-0.5 rounded-lg self-stretch sm:self-auto shrink-0 shadow-inner">
          <button
            onClick={() => { setPosTab('intake'); }}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-md transition-all cursor-pointer ${
              posTab === 'intake' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            <Plus className="h-3.5 w-3.5 text-blue-400" />
            <span>Intake Desk</span>
          </button>
          <button
            onClick={() => { setPosTab('return'); }}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-md transition-all cursor-pointer ${
              posTab === 'return' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            <RefreshCw className="h-3.5 w-3.5 text-blue-400" />
            <span>Return & Release</span>
          </button>
          <button
            onClick={() => { setPosTab('reprint'); }}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-md transition-all cursor-pointer ${
              posTab === 'reprint' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            <Barcode className="h-3.5 w-3.5 text-blue-400" />
            <span>Print Tags</span>
          </button>
        </div>
      </div>

      {posTab === 'intake' && (
        <div className="grid grid-cols-1 gap-6">
          <div className="bg-[#16161A] rounded-xl border border-[#2A2A2E] p-6 shadow-md">
            
            {/* STEP 1: SCAN & OCR CAPTURE */}
            {intakeStep === 1 && (
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b border-[#2A2A2E] pb-3">
                  <h4 className="text-sm font-bold text-slate-200">Step 1: Parse Hard Drive Label Frame</h4>
                  <span className="text-[10px] font-mono bg-blue-950/50 text-blue-400 border border-blue-900/40 px-2 py-0.5 rounded">AUTO-SCANNER</span>
                </div>

                <div className="bg-[#0E0E10] border border-[#2A2A2E] rounded-xl p-5 text-center space-y-4">
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Deploy real-time Gemini AI vision to automatically extract model codes, storage capacity, and serial keys from physical hard drive stickers:
                  </p>

                  {/* Webcam Interface */}
                  {isWebcamActive ? (
                    <div className="bg-[#111113] border border-blue-900/40 rounded-xl overflow-hidden p-4 space-y-4 max-w-md mx-auto">
                      <div className="relative bg-black rounded-lg aspect-video overflow-hidden border border-[#2A2A2E] flex items-center justify-center">
                        {isCameraSimulated ? (
                          <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-4 select-none">
                            <div className="w-20 h-20 bg-[#111113] border border-blue-500/30 rounded-lg shadow-inner flex flex-col items-center justify-center relative overflow-hidden">
                              <div className="absolute inset-x-0 top-0 h-0.5 bg-blue-500 shadow-[0_0_8px_#3b82f6] animate-bounce animate-duration-3000" style={{ animationDuration: '3s' }} />
                              <span className="text-3xl">📀</span>
                              <span className="text-[8px] font-mono text-blue-400 mt-1 uppercase font-black tracking-widest">INGEST CAM</span>
                            </div>
                            <div className="mt-3 text-center space-y-1">
                              <p className="text-[10px] font-mono text-emerald-400 font-extrabold uppercase tracking-wider">Simulated Scanner Active</p>
                              <p className="text-[9px] text-slate-500">Press Capture to parse mock Seagate 8TB</p>
                            </div>
                            <video ref={videoRef} className="hidden" />
                          </div>
                        ) : (
                          <>
                            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                            <div className="absolute inset-0 border-2 border-dashed border-blue-500/40 pointer-events-none m-6 rounded flex items-center justify-center">
                              <div className="text-[10px] bg-blue-950/80 text-blue-400 font-mono px-2 py-1 rounded border border-blue-900/50 uppercase tracking-widest animate-pulse">
                                Align Hard Drive Sticker Label
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                      
                      {webcamError && (
                        <p className="text-xs text-red-400 bg-red-950/20 border border-red-900/30 p-2 rounded text-left">
                          {webcamError}
                        </p>
                      )}

                      <div className="flex gap-2 justify-center">
                        <button
                          type="button"
                          onClick={captureWebcam}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white rounded-lg shadow cursor-pointer transition flex items-center gap-1.5"
                        >
                          <Camera className="h-3.5 w-3.5" />
                          Capture Sticker Label
                        </button>
                        <button
                          type="button"
                          onClick={stopWebcam}
                          className="px-4 py-2 bg-[#16161A] hover:bg-[#1D1D22] border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white rounded-lg cursor-pointer transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 justify-center items-center">
                      <button
                        type="button"
                        onClick={startWebcam}
                        className="inline-flex items-center gap-2 px-3.5 py-1.5 border border-blue-900/50 bg-blue-950/30 text-blue-400 rounded-lg text-xs font-bold hover:bg-blue-950/50 cursor-pointer shadow-md transition"
                      >
                        <Camera className="h-3.5 w-3.5" />
                        Scan with Live Webcam...
                      </button>

                      <input type="file" accept="image/*" onChange={handleImageFileSelect} id="pos-disk-label-upload" className="hidden" />
                      <label htmlFor="pos-disk-label-upload" className="inline-flex items-center gap-2 px-3.5 py-1.5 border border-slate-700 bg-[#16161A] text-slate-200 rounded-lg text-xs font-bold hover:bg-[#1D1D22] cursor-pointer shadow-md transition">
                        <Upload className="h-3 w-3 text-slate-400" />
                        Browse Physical Photo...
                      </label>

                      <button
                        type="button"
                        onClick={() => handleLoadMockLabel('seagate_8tb')}
                        className="px-3 py-1.5 border border-dashed border-blue-900 bg-blue-950/20 text-blue-400 text-xs font-black rounded-lg hover:bg-blue-950/40 transition cursor-pointer"
                      >
                        Simulate Seagate 8TB Scan
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLoadMockLabel('wd_6tb')}
                        className="px-3 py-1.5 border border-dashed border-purple-900 bg-purple-950/20 text-purple-400 text-xs font-black rounded-lg hover:bg-purple-950/40 transition cursor-pointer"
                      >
                        Simulate WD 6TB Scan
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLoadMockLabel('mismatched_unrecognized')}
                        className="px-3 py-1.5 border border-dashed border-amber-900 bg-amber-950/20 text-amber-400 text-xs font-black rounded-lg hover:bg-amber-950/40 transition cursor-pointer"
                      >
                        Simulate Mismatched Scan
                      </button>
                    </div>
                  )}

                  {scanImageBase64 && (
                    <div className="bg-[#111113] p-4 rounded-lg border border-[#2A2A2E] flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">📀</span>
                        <div>
                          <span className="text-xs font-semibold text-slate-200 block">Asset label photograph loaded</span>
                          <span className="text-[9px] text-slate-500 font-mono">Simulated frame-read buffers filled</span>
                        </div>
                      </div>
                      
                      {!scanResult && (
                        <button
                          type="button"
                          onClick={runGeminiImageOcr}
                          disabled={isScanning}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white rounded-lg cursor-pointer disabled:opacity-50 transition shadow-md"
                        >
                          {isScanning ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Running Gemini Vision OCR...
                            </>
                          ) : (
                            'Analyze with Gemini Vision'
                          )}
                        </button>
                      )}
                    </div>
                  )}

                  {scanResult && (() => {
                    const uncaptured = getUncapturedFields(scanResult);
                    if (uncaptured.length > 0 && !scanSkipWarning) {
                      return (
                        <div className="bg-amber-950/40 border border-amber-900/50 text-amber-200 p-4 rounded-xl text-left text-xs space-y-4 animate-fadeIn">
                          <div className="font-extrabold flex items-center gap-2 text-[11px] text-amber-400 tracking-wider font-mono">
                            <ShieldAlert className="h-4 w-4 text-amber-400" />
                            SCAN WARNING: UNRESOLVED DRIVE COMPONENTS
                          </div>
                          <p className="text-slate-300 leading-relaxed text-[11px]">
                            The label scanner was unable to clearly extract all physical parameters from the drive. 
                            Some identified attributes do not align with verified specification standards.
                          </p>
                          <div className="bg-slate-900/50 p-3 rounded border border-amber-900/30 text-[11px]">
                            Missing fields identified: <strong className="text-amber-300">{uncaptured.join(', ')}</strong>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setScanSkipWarning(true)}
                              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-black rounded text-[11px] uppercase cursor-pointer"
                            >
                              Force manual correction edit
                            </button>
                            <button
                              type="button"
                              onClick={() => { setScanResult(null); setScanImageBase64(null); }}
                              className="px-3.5 py-1.5 bg-[#16161A] border border-amber-900/30 text-amber-400 rounded text-[11px] font-bold"
                            >
                              Discard & Rescan
                            </button>
                          </div>
                        </div>
                      );
                    }

                    // Otherwise show success / review form
                    return (
                      <div className="space-y-4 text-left border-t border-[#2A2A2E] pt-4">
                        <span className="block text-xs font-bold text-slate-400 font-mono tracking-wider uppercase">REVIEW COGNITIVE EXTRACTED DETAILS:</span>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-mono text-slate-400 uppercase font-black mb-1">Manufacturer</label>
                            <input
                              type="text"
                              value={diskForm.hd_manufacturer}
                              onChange={(e) => setDiskForm({...diskForm, hd_manufacturer: e.target.value})}
                              className="w-full bg-[#0E0E10] border border-[#2A2A2E] rounded-lg px-3 py-2 text-xs text-white focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-mono text-slate-400 uppercase font-black mb-1">Model / Product Identifier</label>
                            <input
                              type="text"
                              value={diskForm.hd_model}
                              onChange={(e) => setDiskForm({...diskForm, hd_model: e.target.value})}
                              className="w-full bg-[#0E0E10] border border-[#2A2A2E] rounded-lg px-3 py-2 text-xs text-white focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-mono text-slate-400 uppercase font-black mb-1">Serial Number Code (Must match casing exactly)</label>
                            <input
                              type="text"
                              value={diskForm.hd_serial}
                              onChange={(e) => setDiskForm({...diskForm, hd_serial: e.target.value})}
                              className="w-full bg-[#0E0E10] border border-blue-900/50 rounded-lg px-3 py-2 text-xs text-white font-mono font-bold focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-mono text-slate-400 uppercase font-black mb-1">Drive Capacity Size</label>
                            <select
                              value={diskForm.hd_size}
                              onChange={(e) => setDiskForm({...diskForm, hd_size: e.target.value})}
                              className="w-full bg-[#0E0E10] border border-[#2A2A2E] rounded-lg px-3 py-2 text-xs text-white focus:ring-1 focus:ring-blue-500"
                            >
                              {['4TB', '6TB', '8TB', '10TB', '12TB', '16TB', '18TB', '20TB', '24TB'].map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </div>
                        </div>

                        {/* Redundant Ingestion Safeguard */}
                        {disks.some(d => d.hd_serial.toLowerCase().trim() === diskForm.hd_serial.toLowerCase().trim() && d.hd_serial.trim() !== '') && (
                          <div className="bg-rose-955/10 border border-rose-900/30 p-3.5 rounded-lg flex flex-col gap-2">
                            <div className="flex gap-2 text-rose-500 text-xs font-extrabold tracking-wider font-mono">
                              <ShieldAlert className="h-4.5 w-4.5" />
                              REDUNDANT INGESTION SAFEGUARD DETECTED
                            </div>
                            <p className="text-[11px] text-rose-300 leading-normal font-medium">
                              A physical storage media with serial <b>{diskForm.hd_serial}</b> already exists in our master ledger database. 
                              Admin override required to register duplicate ingestion instances.
                            </p>
                            {currentUser?.role === 'admin' && (
                              <label className="flex items-center gap-2 text-xs text-slate-300 select-none font-mono cursor-pointer bg-[#16161A] p-2 border border-[#2A2A2E] rounded w-fit">
                                <input
                                  type="checkbox"
                                  checked={adminOverrideDuplicateSerial}
                                  onChange={(e) => setAdminOverrideDuplicateSerial(e.target.checked)}
                                />
                                Admin Override: Register as new duplicate transaction
                              </label>
                            )}
                          </div>
                        )}

                        <div className="flex justify-end pt-2">
                          <button
                            type="button"
                            disabled={!diskForm.hd_serial || !diskForm.hd_manufacturer}
                            onClick={() => setIntakeStep(2)}
                            className="inline-flex items-center gap-1 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-bold text-white rounded-lg cursor-pointer shadow-md transition"
                          >
                            <span>Proceed to Assignment</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* STEP 2: SOURCE & COMPATIBILITY CHECK */}
            {intakeStep === 2 && (
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b border-[#2A2A2E] pb-3">
                  <h4 className="text-sm font-bold text-slate-200">Step 2: Assign Source & Client (Verify Output Tag & Ticket)</h4>
                  <span className="text-[10px] font-mono bg-blue-950/50 text-blue-400 border border-blue-900/40 px-2 py-0.5 rounded">INTAKE FLOWCHART REQUISITE</span>
                </div>

                <div className="bg-[#0E0E10] p-4 rounded-xl border border-[#2A2A2E] flex justify-between items-center text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 font-mono block">DRIVE BEING INTRODUCED</span>
                    <span className="font-bold text-white text-sm">{diskForm.hd_manufacturer} ({diskForm.hd_size})</span>
                    <span className="block text-[10px] text-slate-400 leading-tight">Serial: {diskForm.hd_serial} | Speed: {diskForm.hd_speed}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIntakeStep(1)}
                    className="text-[10px] text-blue-400 hover:underline border border-blue-900/10 px-2.5 py-1.5 rounded cursor-pointer font-bold font-mono"
                  >
                    Change Specs
                  </button>
                </div>

                <div className="space-y-4">
                  <label className="block text-xs font-bold text-slate-400 font-mono tracking-wider uppercase mb-1">SELECT INTENDED SOURCE DATASET:</label>
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                    {['A', 'B', 'C', 'D', 'E'].map(letter => {
                      const srcId = `DS-${letter}`;
                      const isSelected = diskForm.source_requested_id === srcId;
                      return (
                        <button
                          key={letter}
                          type="button"
                          onClick={() => setDiskForm({...diskForm, source_requested_id: srcId})}
                          className={`p-5 rounded-xl border flex flex-col items-center justify-center gap-3 transition-all cursor-pointer text-center ${
                            isSelected 
                              ? 'bg-blue-950/20 border-blue-500 ring-2 ring-blue-500/80 text-white' 
                              : 'bg-[#0E0E10] border-[#2A2A2E] hover:border-slate-700 text-slate-400 hover:text-white'
                          }`}
                        >
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-black transition-all ${
                            isSelected ? 'bg-blue-650 text-white' : 'bg-[#16161A] border border-[#2A2A2E] text-slate-300'
                          }`}>
                            {letter}
                          </div>
                          <div>
                            <span className="font-sans font-extrabold text-xs block">Source {letter}</span>
                            <span className="text-[9px] text-slate-500 font-mono mt-0.5 block">External Allocation</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {diskForm.source_requested_id && (
                  <div className="space-y-3 border-t border-[#2A2A2E] pt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400 font-mono tracking-wider uppercase">Live Tag & Ticket Output Preview:</span>
                      <span className="text-[9px] bg-amber-950/45 text-amber-400 font-mono px-2 py-0.5 rounded border border-amber-900/40">READY FOR PRINT</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center justify-center">
                      
                      {/* PHYSICAL ASSET TAG - WITH DRIVE CAMERA PHOTO */}
                      <div className="w-full max-w-md aspect-[2.35/1] bg-white border border-slate-350 rounded-xl p-3.5 flex flex-row items-center justify-between gap-3 text-slate-900 font-mono shadow-md select-none mx-auto relative">
                        <div className="absolute top-1 right-2 text-[7px] border border-blue-500 text-blue-600 font-bold uppercase rounded px-1 leading-none">Tag #1 (TO DRIVE)</div>
                        
                        {/* LEFT COLUMN - REQUIRED DATA */}
                        <div className="flex flex-col justify-between h-full text-left flex-1 min-w-0">
                          <div>
                            <span className="text-[9px] text-slate-500 tracking-wider font-black block leading-none uppercase">PHYSICAL ASSET TAG</span>
                            <span className="text-[16px] md:text-[18px] font-black text-slate-900 block truncate mt-1 tracking-tight">{diskForm.id}</span>
                          </div>
                          
                          <div className="space-y-0.5 my-1 text-[9px] text-slate-700">
                            <div className="flex justify-between">
                              <span>SOURCE DATASET:</span>
                              <span className="font-extrabold text-blue-600">{diskForm.source_requested_id}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>DRIVE S/N:</span>
                              <span className="font-extrabold text-slate-800 truncate max-w-[120px]">{diskForm.hd_serial || 'PENDING'}</span>
                            </div>
                          </div>

                          <span className="text-[7.5px] text-slate-500 font-sans leading-tight mt-1 border-t border-slate-200 pt-1 block">
                            AFFIX SECURELY TO PHYSICAL CASING
                          </span>
                        </div>

                        {/* RIGHT COLUMN - QR CODE & CAPTURED CAMERA IMAGE */}
                        <div className="flex items-center gap-2 bg-slate-50 p-1.5 border border-slate-200 rounded-lg shrink-0 h-[95px]">
                          <div className="flex flex-col items-center justify-center">
                            <QRCodeSVG value={diskForm.id} size={55} level="M" />
                            <span className="text-[7px] text-slate-700 mt-1 font-bold tracking-tight select-none">*VAL-{diskForm.id}*</span>
                          </div>
                          <div className="flex flex-col items-center justify-center border-l border-slate-200 pl-2 h-full">
                            {scanImageBase64 ? (
                              <img
                                src={scanImageBase64}
                                alt="Drive sticker snapshot"
                                referrerPolicy="no-referrer"
                                className="w-[50px] h-[50px] object-contain rounded border border-slate-300 shadow bg-white p-0.5"
                              />
                            ) : (
                              <div className="w-[50px] h-[50px] bg-slate-100 border border-slate-200 rounded flex flex-col items-center justify-center text-[6px] text-slate-400 text-center leading-tight">
                                <span>No Photo</span>
                                <span>Acquired</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* DDV DRIVE TICKET (CHANGED NAME & STORAGE FIELD, REMOVED QR LABEL) */}
                      <div className="w-full max-w-md aspect-[2.35/1] bg-emerald-50/90 border-2 border-dashed border-emerald-600 rounded-xl p-3.5 flex flex-row items-center justify-between gap-3 text-slate-900 font-mono shadow-md select-none mx-auto relative">
                        <div className="absolute top-1 right-2 text-[7px] border border-emerald-600 text-emerald-700 font-bold uppercase rounded px-1 leading-none">Ticket #2 (CLAIM COPY)</div>
                        
                        {/* LEFT COLUMN */}
                        <div className="flex flex-col justify-between h-full text-left flex-1 min-w-0">
                          <div>
                            <span className="text-[9px] text-emerald-800 tracking-wider font-black block leading-none uppercase">DDV Drive Ticket</span>
                            <span className="text-[16px] md:text-[18px] font-black text-slate-900 block truncate mt-1 tracking-tight">{diskForm.id}</span>
                          </div>
                          
                          <div className="space-y-0.5 my-1 text-[9px] text-slate-700">
                            <div className="flex justify-between">
                              <span>SOURCE DATASET:</span>
                              <span className="font-extrabold text-emerald-800">{diskForm.source_requested_id}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>ACCEPTED AT:</span>
                              <span className="font-extrabold text-emerald-700 truncate max-w-[120px]">
                                {new Date().toLocaleString()}
                              </span>
                            </div>
                          </div>

                          <span className="text-[7.5px] text-slate-650 font-sans leading-tight mt-1 border-t border-emerald-600/30 pt-1 block">
                            Retain receipt to reclaim physical drive.
                          </span>
                        </div>

                        {/* RIGHT COLUMN - QR CODE ONLY (NO TEXT LABEL) */}
                        <div className="flex flex-col items-center justify-center bg-white p-2 border border-emerald-200 rounded-lg shrink-0 w-[95px] h-[95px]">
                          <QRCodeSVG value={diskForm.id} size={70} level="M" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="p-4 bg-blue-950/25 border border-blue-900/40 text-blue-300 rounded-xl flex gap-3 text-xs leading-normal">
                  <Info className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-extrabold text-slate-200 block uppercase font-mono text-[11px] tracking-wider mb-0.5">EXTERNAL PHYSICAL COPY OPERATION</span>
                    <span>The replication duplication will be processed off-line. Affix the printed Physical Asset Tag onto the drive, and hand the DDV Drive Ticket to the physical client.</span>
                  </div>
                </div>

                <div className="flex justify-between pt-4 border-t border-[#2A2A2E]">
                  <button
                    type="button"
                    onClick={() => setIntakeStep(1)}
                    className="px-4 py-2 bg-[#0E0E10] border border-[#2A2A2E] text-xs font-semibold text-slate-300 hover:text-white rounded-lg transition cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={!diskForm.source_requested_id || isLoading}
                    onClick={handlePOSIntakeSubmit}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-bold text-white rounded-lg cursor-pointer transition shadow-md"
                  >
                    {isLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      '🚀 Confirm & Print both'
                    )}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: SUCCESS SUMMARY & RECEIPT PRINT */}
            {intakeStep === 4 && intakeSuccessRecord && (
              <div className="space-y-6 text-center">
                <div className="inline-flex items-center justify-center p-3 rounded-full bg-emerald-950/45 text-emerald-400 border border-emerald-900/30 mb-1">
                  <CheckCircle className="h-8 w-8 text-emerald-400" />
                </div>
                
                <div className="space-y-1">
                  <h3 className="text-lg font-black font-sans text-white uppercase tracking-tight">INGESTION TRANSACTION COMMITTED OK</h3>
                  <p className="text-xs text-slate-400">
                    Drive registered successfully in Master store, replication packets queued.
                  </p>
                </div>

                <div className="bg-[#0E0E10] p-4 rounded-xl border border-[#2A2A2E] max-w-sm mx-auto space-y-2 text-left text-xs font-mono">
                  <div className="text-slate-500 font-bold border-b border-[#2A2A2E] pb-1.5 text-[10px]">RECORD METRICS</div>
                  <div className="flex justify-between">
                    <span>Ledger ID:</span>
                    <span className="text-white font-bold">{intakeSuccessRecord.disk.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Serial:</span>
                    <span className="text-white font-bold">{intakeSuccessRecord.disk.hd_serial}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Status:</span>
                    <span className="text-emerald-400 font-bold uppercase">RECEIVED</span>
                  </div>
                </div>

                <div className="flex justify-center gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setPrintedTicketDisk(intakeSuccessRecord.disk)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg cursor-pointer"
                  >
                    🖨️ Re-open Ticket / Tag Printer
                  </button>
                  <button
                    type="button"
                    onClick={handleResetIntakeForm}
                    className="px-4 py-2 bg-[#0E0E10] border border-[#2A2A2E] hover:bg-slate-800 text-slate-300 font-bold text-xs rounded-lg cursor-pointer"
                  >
                    Start Next Intake Ingestion ⚡
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {posTab === 'return' && (
        <div className="grid grid-cols-1 gap-6">
          <div className="bg-[#16161A] rounded-xl border border-[#2A2A2E] p-6 shadow-md space-y-6">
            <div className="border-b border-[#2A2A2E] pb-3">
              <h4 className="text-sm font-bold text-slate-200">Reclaim physical drive owner release desk</h4>
              <p className="text-xs text-slate-400 mt-1 leading-normal">
                Discharge the duplicated duplication target hardware back into client possession. Discharges will write transaction timestamps in the physical catalog.
              </p>
            </div>

            {returnSuccessRecord && (
              <div className="p-4 bg-emerald-950/25 border border-emerald-900/30 text-emerald-450 rounded-xl text-xs space-y-2 animate-fadeIn text-center">
                <span className="text-lg">✅</span>
                <h5 className="font-bold text-white uppercase font-mono text-[11px] tracking-wider">Discharge Handshake Approved</h5>
                <p className="text-slate-350">
                  Drive <b>{returnSuccessRecord.diskId}</b> has been safely signed off.
                </p>
                <div>• Confirmed Package Release: <b className="text-white">{returnSuccessRecord.diskName}</b></div>
                <button
                  onClick={() => setReturnSuccessRecord(null)}
                  className="mt-2 text-[10px] text-emerald-400 hover:underline font-bold block mx-auto uppercase tracking-wide font-mono"
                >
                  Clear status
                </button>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 font-bold mb-1.5 tracking-wider">Search active intake queue:</label>
                <input
                  type="text"
                  placeholder="Enter disk Sequence ID, drive model, serial number..."
                  value={returnDiskSearchQuery}
                  onChange={(e) => setReturnDiskSearchQuery(e.target.value)}
                  className="w-full bg-[#0E0E10] border border-[#2A2A2E] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {filteredForReturn.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
                  {filteredForReturn.map(d => {
                    const isSelected = selectedReturnDiskId === d.id;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setSelectedReturnDiskId(d.id)}
                        className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                          isSelected 
                            ? 'bg-blue-950/25 border-blue-500 ring-2 ring-blue-500/50' 
                            : 'bg-[#0E0E10] border-[#2A2A2E] hover:border-slate-700'
                        }`}
                      >
                        <div className="flex justify-between items-start w-full gap-2">
                          <span className="font-mono text-[11px] font-black text-slate-250 truncate">{d.id}</span>
                          <span className={`text-[8px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider shrink-0 ${
                            d.status === 'completed' ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/40' :
                            d.status === 'copying' ? 'bg-blue-950/40 text-blue-400 border border-blue-900/30' :
                            d.status === 'failed' ? 'bg-rose-950/30 text-rose-400 border border-rose-900/30 animate-pulse' :
                            'bg-[#1C1C24] text-slate-400 border border-[#2A2A2E]'
                          }`}>
                            {d.status}
                          </span>
                        </div>
                        <div className="mt-2 space-y-0.5">
                          <div className="text-xs font-black text-white">{d.hd_manufacturer} {d.hd_model}</div>
                          <div className="text-[10px] font-mono text-slate-400">S/N: {d.hd_serial} | {d.hd_size}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-slate-500 font-mono bg-[#0E0E10] rounded-xl border border-[#2A2A2E]">
                  No matching unreleased drives in intake queue.
                </div>
              )}

              {selectedReturnDiskId && (
                <div className="border-t border-[#2A2A2E] pt-4 space-y-4 animate-fadeIn">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-400 font-mono">
                    <Info className="h-4 w-4" />
                    CONFIRMING DRIVE RELEASE AUTHORIZATION: {selectedReturnDiskId}
                  </div>
                  <button
                    type="button"
                    disabled={isSubmittingReturn}
                    onClick={handlePOSReturnSubmit}
                    className="w-full flex justify-center py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-bold text-white rounded-lg transition-all cursor-pointer uppercase tracking-wider"
                  >
                    {isSubmittingReturn ? 'Writing Discharge Records...' : 'Approve Discharge and Release Physical Package'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {posTab === 'reprint' && (
        <div className="grid grid-cols-1 gap-6">
          <div className="bg-[#16161A] rounded-xl border border-[#2A2A2E] p-6 shadow-md space-y-6">
            <div className="border-b border-[#2A2A2E] pb-3">
              <h4 className="text-sm font-bold text-slate-200">Re-print physical asset tags and client tickets</h4>
              <p className="text-xs text-slate-400 mt-1 leading-normal">
                Lookup any currently registered drive sequence record in the ledger database and re-open the physical tag printer dialog.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 font-bold mb-1.5 tracking-wider">Search active ledger database:</label>
                <input
                  type="text"
                  placeholder="Enter sequence ID, serial number, drive capacity..."
                  value={reprintSearchQuery}
                  onChange={(e) => setReprintSearchQuery(e.target.value)}
                  className="w-full bg-[#0E0E10] border border-[#2A2A2E] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {filteredForReprint.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[350px] overflow-y-auto pr-1">
                  {filteredForReprint.map(d => (
                    <div
                      key={d.id}
                      className="p-3.5 bg-[#0E0E10] border border-[#2A2A2E] hover:border-slate-700 rounded-xl flex items-center justify-between gap-4 transition-all"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-mono text-[10px] font-bold text-slate-400 block">{d.id}</span>
                        <span className="text-xs font-black text-white block truncate">{d.hd_manufacturer} {d.hd_model}</span>
                        <span className="text-[10px] font-mono text-slate-400 block">S/N: {d.hd_serial} | Status: <b className="text-blue-400 uppercase">{d.status}</b></span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPrintedTicketDisk(d)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] rounded-lg shrink-0 transition"
                      >
                        🖨️ Print
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-slate-500 font-mono bg-[#0E0E10] rounded-xl border border-[#2A2A2E]">
                  No matching database entries found.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TICKET / TAG PRINT OVERLAY */}
      {printedTicketDisk && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#16161A] rounded-xl shadow-2xl overflow-hidden max-w-lg w-full border border-slate-700/50 flex flex-col">
            
            <div className="border-b border-[#2A2A2E] p-4 bg-slate-900/60 text-center relative">
              <span className="text-[10px] text-emerald-450 border border-emerald-900/40 rounded px-1.5 py-0.5 uppercase tracking-wider font-extrabold font-mono">DDV INTENDED DESK PRINTER</span>
              <h4 className="font-bold text-lg block mt-1.5 font-sans tracking-tight text-white">Active Tag & Ticket Printer Layout</h4>
              <button 
                onClick={() => setPrintedTicketDisk(null)}
                className="absolute top-3.5 right-3.5 text-xs text-slate-400 hover:text-slate-200 font-bold hover:bg-[#2A2A2E] px-2 py-1 rounded"
              >
                ✕
              </button>
            </div>

            <div className="p-6 bg-[#0E0E10] space-y-6 max-h-[75vh] overflow-y-auto">
              
              {/* TAG #1: PHYSICAL ASSET TAG */}
              <div className="space-y-1">
                <span className="text-[9px] text-slate-450 uppercase font-mono tracking-wider font-extrabold block">AFFIX SECURELY TO DRIVE CASING (TAG #1)</span>
                <div className="w-full max-w-md aspect-[2.35/1] bg-white border border-slate-350 rounded-xl p-3.5 flex flex-row items-center justify-between gap-3 text-slate-900 font-mono shadow-md select-none relative mx-auto">
                  <div className="absolute top-1 right-2 text-[7px] border border-blue-500 text-blue-600 font-bold uppercase rounded px-1 leading-none">Tag #1 (TO DRIVE)</div>
                  
                  {/* LEFT COLUMN */}
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

                  {/* RIGHT COLUMN - QR CODE & IMAGED CAMERA PHOTO SIDE-BY-SIDE */}
                  <div className="flex items-center gap-2 bg-slate-50 p-1.5 border border-slate-200 rounded-lg shrink-0 h-[95px]">
                    <div className="flex flex-col items-center justify-center">
                      <QRCodeSVG value={printedTicketDisk.id} size={55} level="M" />
                      <span className="text-[7px] text-slate-700 mt-1 font-bold tracking-tight select-none">*VAL-{printedTicketDisk.id}*</span>
                    </div>
                    <div className="flex flex-col items-center justify-center border-l border-slate-200 pl-2 h-full">
                      {printedTicketDisk.hd_image || scanImageBase64 ? (
                        <img
                          src={printedTicketDisk.hd_image || scanImageBase64 || ''}
                          alt="Physical drive sticker screenshot"
                          referrerPolicy="no-referrer"
                          className="w-[50px] h-[50px] object-contain rounded border border-slate-300 shadow bg-white p-0.5"
                        />
                      ) : (
                        <div className="w-[50px] h-[50px] bg-slate-100 border border-slate-200 rounded flex flex-col items-center justify-center text-[6px] text-slate-400 text-center leading-tight">
                          <span>No Photo</span>
                          <span>Acquired</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* TICKET #2: DDV DRIVE TICKET (NO QR CODE LABEL, CONTAINS INTAKE DATE/TIME) */}
              <div className="space-y-1">
                <span className="text-[9px] text-emerald-450 uppercase font-mono tracking-wider font-extrabold block">GIVE TO PHYSICAL OWNER / REPRESENTATIVE (TICKET #2)</span>
                <div className="w-full max-w-md aspect-[2.35/1] bg-emerald-50/90 border-2 border-dashed border-emerald-600 rounded-xl p-3.5 flex flex-row items-center justify-between gap-3 text-slate-900 font-mono shadow-md select-none mx-auto relative">
                  <div className="absolute top-1 right-2 text-[7px] border border-emerald-600 text-emerald-700 font-bold uppercase rounded px-1 leading-none">Ticket #2 (CLAIM COPY)</div>
                  
                  {/* LEFT COLUMN - REQUIRED DATA */}
                  <div className="flex flex-col justify-between h-full text-left flex-1 min-w-0">
                    <div>
                      <span className="text-[9px] text-emerald-800 tracking-wider font-black block leading-none uppercase">DDV Drive Ticket</span>
                      <span className="text-[16px] md:text-[18px] font-black text-slate-900 block truncate mt-1 tracking-tight">{printedTicketDisk.id}</span>
                    </div>
                    
                    <div className="space-y-0.5 my-1 text-[9px] text-slate-700">
                      <div className="flex justify-between">
                        <span>SOURCE DATASET:</span>
                        <span className="font-extrabold text-emerald-800">{printedTicketDisk.source_requested_id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>ACCEPTED AT:</span>
                        <span className="font-extrabold text-emerald-700 truncate max-w-[120px]">
                          {printedTicketDisk.received_time ? new Date(printedTicketDisk.received_time).toLocaleString() : new Date().toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <span className="text-[7.5px] text-slate-650 font-sans leading-tight mt-1 border-t border-emerald-600/30 pt-1 block">
                      Retain receipt to reclaim physical drive.
                    </span>
                  </div>

                  {/* RIGHT COLUMN - QR CODE ONLY (NO LABELS) */}
                  <div className="flex flex-col items-center justify-center bg-white p-2 border border-emerald-200 rounded-lg shrink-0 w-[95px] h-[95px]">
                    <QRCodeSVG value={printedTicketDisk.id} size={70} level="M" />
                  </div>
                </div>
              </div>

            </div>

            <div className="bg-[#111113] p-3 text-center border-t border-[#2A2A2E] flex gap-2">
              <button
                onClick={() => {
                  setPrintedTicketDisk(null);
                  alert("Executing simulated print command... Physical tickets generated via thermal printer.");
                }}
                className="flex-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 py-2.5 rounded-lg transition"
              >
                Mock Physical Print (Both Labels)
              </button>
              <button
                onClick={() => setPrintedTicketDisk(null)}
                className="px-4 text-xs font-bold text-slate-300 hover:text-white bg-[#0E0E10] border border-[#2A2A2E] py-2.5 rounded-lg transition"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
