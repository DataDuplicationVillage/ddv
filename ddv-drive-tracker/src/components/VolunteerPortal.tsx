import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { toPng } from 'html-to-image';
import { 
  Plus, RefreshCw, Barcode, HardDrive, ShieldAlert, Loader2, Info, Camera, Check, Upload, ArrowRight, CheckCircle, Clock, Search, ZoomIn, ZoomOut, RotateCcw
} from 'lucide-react';
import { Disk, DataSource, UserRole, Duplicator } from '../types';

interface VolunteerPortalProps {
  currentUser: { username: string; name: string; role: UserRole; owner_id?: string } | null;
  onLogout: () => void;
  onTableUpdateNotification: (tableName: string, action: string, recordId: string) => void;
}

type LabelVariant = 'tag' | 'ticket';

type LabelCardData = {
  id: string;
  source_requested_id?: string;
  hd_serial?: string | null;
  received_time?: string | null;
  hd_image?: string | null;
};

const LABEL_CARD_STYLE = {
  width: '100mm',
  height: '62mm',
  maxWidth: '100%',
  aspectRatio: '100 / 62'
} as const;

const LABEL_CARD_CLASS_NAME = 'w-full aspect-[100/62] rounded-xl p-3.5 flex select-none relative mx-auto overflow-hidden';

const LABEL_VARIANT_CONFIG: Record<LabelVariant, {
  shellClassName: string;
  outlineClassName: string;
  insetBorderClassName: string;
  guideClassName: string;
  sizeMarkerClassName: string;
  ribbonClassName: string;
  titleClassName: string;
  badgeText: string;
  titleText: string;
  footerText: string;
  valueTextClassName: string;
  fieldLabelClassName: string;
  fieldValueClassName: string;
  fieldValueSecondaryClassName: string;
  fieldRowClassName: string;
  leftBlockClassName: string;
  leftBlockTextClassName: string;
  qrBorderClassName: string;
  imageFallbackClassName: string;
}> = {
  tag: {
    shellClassName: 'bg-white border border-slate-350 text-slate-900 font-mono shadow-md',
    outlineClassName: 'border-slate-300/70',
    insetBorderClassName: 'border-slate-200/40',
    guideClassName: 'bg-slate-200/40',
    sizeMarkerClassName: 'text-slate-400/90',
    ribbonClassName: 'border-blue-500 text-blue-600',
    titleClassName: 'text-slate-400',
    badgeText: 'Tag #1 (TO DRIVE)',
    titleText: 'PHYSICAL ASSET TAG',
    footerText: 'AFFIX SECURELY TO PHYSICAL DRIVE',
    valueTextClassName: 'text-slate-900',
    fieldLabelClassName: 'text-slate-500',
    fieldValueClassName: 'text-blue-600',
    fieldValueSecondaryClassName: 'text-slate-800',
    fieldRowClassName: 'text-slate-700',
    leftBlockClassName: 'bg-blue-600 text-white border-blue-700',
    leftBlockTextClassName: 'text-[46px]',
    qrBorderClassName: 'border-slate-300',
    imageFallbackClassName: 'bg-slate-100 border-slate-200 text-slate-400'
  },
  ticket: {
    shellClassName: 'bg-emerald-50/90 border border-slate-350 text-slate-900 font-mono shadow-md',
    outlineClassName: 'border-emerald-200/70',
    insetBorderClassName: 'border-emerald-200/40',
    guideClassName: 'bg-emerald-200/40',
    sizeMarkerClassName: 'text-emerald-700/80',
    ribbonClassName: 'border-emerald-600 text-emerald-700',
    titleClassName: 'text-emerald-800',
    badgeText: 'Ticket #2 (CLAIM COPY)',
    titleText: 'DDV Drive Ticket',
    footerText: 'Retain receipt to reclaim physical drive.',
    valueTextClassName: 'text-slate-900',
    fieldLabelClassName: 'text-slate-700',
    fieldValueClassName: 'text-emerald-800',
    fieldValueSecondaryClassName: 'text-emerald-700',
    fieldRowClassName: 'text-slate-700',
    leftBlockClassName: 'bg-white border-emerald-200',
    leftBlockTextClassName: 'text-[46px]',
    qrBorderClassName: 'border-emerald-200',
    imageFallbackClassName: 'bg-white border-emerald-200 text-slate-400'
  }
};

const PrintLabelCard = React.forwardRef<HTMLDivElement, {
  variant: LabelVariant;
  data: LabelCardData;
  imageSource?: string;
  className?: string;
  showSizeMarker?: boolean;
}>(({ variant, data, imageSource, className, showSizeMarker = true }, ref) => {
  const displayTime = data.received_time ? new Date(data.received_time).toLocaleString() : new Date().toLocaleString();
  const fallbackImage = imageSource || data.hd_image || '';
  const config = LABEL_VARIANT_CONFIG[variant];

  return (
    <div
      ref={ref}
      className={`${LABEL_CARD_CLASS_NAME} ${config.shellClassName} ${className ?? ''}`}
      style={LABEL_CARD_STYLE}
    >
      <div className={`pointer-events-none absolute inset-0 rounded-xl border ${config.outlineClassName}`} />
      <div className={`pointer-events-none absolute inset-2 rounded-lg border ${config.insetBorderClassName}`} />
      {variant === 'tag' ? (

        <>
          <div className="absolute top-1.5 left-2.5 text-left">
            <span className={`text-[8px] tracking-wider font-extrabold block leading-none uppercase ${config.titleClassName}`}>{config.titleText}</span>
            <span className={`text-xs sm:text-sm font-black block mt-0.5 tracking-tight leading-none ${config.valueTextClassName}`}>{data.id}</span>
          </div>
          <div className="flex h-full w-full items-stretch gap-2.5 pt-6">
            <div className="flex min-w-0 flex-1 flex-col justify-center pr-2">
              <div className="flex flex-col items-start justify-center gap-2">
                <div className="flex items-center justify-start self-start">
                  {fallbackImage ? (
                    <img
                      src={fallbackImage}
                      alt="Physical drive screenshot"
                      referrerPolicy="no-referrer"
                      className={`w-[82px] h-[82px] object-contain rounded border shadow bg-white p-0.5 ${config.qrBorderClassName}`}
                    />
                  ) : (
                    <div className={`w-[82px] h-[82px] rounded flex flex-col items-center justify-center text-[7px] text-center leading-tight ${config.imageFallbackClassName}`}>
                      NO IMAGE
                    </div>
                  )}
                </div>
                <div className={`space-y-1.5 text-[8.5px] ${config.fieldRowClassName}`}>
                  <div className="flex flex-wrap items-center gap-1">
                    <span className={`shrink-0 font-bold ${config.titleClassName}`}>SOURCE:</span>
                    <span className={`font-black ${config.fieldValueClassName}`}>{data.source_requested_id}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <span className={`shrink-0 font-bold ${config.titleClassName}`}>DRIVE S/N:</span>
                    <span className={`font-black ${config.fieldValueSecondaryClassName}`}>{data.hd_serial || 'PENDING'}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <span className={`shrink-0 font-bold ${config.titleClassName}`}>ACCEPTED:</span>
                    <span className={`font-black ${config.fieldValueSecondaryClassName}`}>{displayTime}</span>
                  </div>
                </div>
              </div>
              <span className={`mt-2 whitespace-nowrap border-t border-slate-200 pt-1.5 text-[7px] font-sans leading-none uppercase font-bold tracking-tight ${config.titleClassName}`}>
                {config.footerText}
              </span>
            </div>
            <div className="flex shrink-0 flex-col items-center justify-center gap-2 self-center pl-1">
              <div className={`flex items-center justify-center bg-white p-1.5 border rounded-lg shrink-0 w-[88px] h-[88px] shadow-sm ${config.qrBorderClassName}`}>
                <QRCodeSVG value={data.id} size={64} level="M" />
              </div>
              <div className={`flex items-center justify-center font-black leading-none rounded-lg w-[88px] h-[88px] shrink-0 shadow border select-none text-[42px] ${config.leftBlockClassName} ${config.leftBlockTextClassName}`}>
                {data.source_requested_id ? String(data.source_requested_id).trim().slice(-1).toUpperCase() : 'A'}
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="flex h-full w-full items-stretch justify-between gap-3 text-left flex-1 min-w-0">
            <div className="flex min-w-0 flex-1 flex-col justify-start pr-2">
              <div className="flex items-start gap-2">
                <span className={`text-[18px] tracking-wider font-black block leading-none uppercase ${config.titleClassName}`}>{config.titleText}</span>
              </div>
              <div className="flex flex-1 items-center">
                <div className="w-full">
                  <span className={`text-xs sm:text-sm font-black block mt-1 tracking-tight break-all leading-tight whitespace-normal ${config.valueTextClassName}`}>{data.id}</span>
                  <div className="space-y-0.5 my-1 text-[9px] text-slate-700">
                    <div className="flex items-start gap-1">
                      <span>SOURCE DATASET:</span>
                      <span className={`font-extrabold truncate ${config.fieldValueClassName}`}>{data.source_requested_id}</span>
                    </div>
                    <div className="flex items-start gap-1">
                      <span>ACCEPTED AT:</span>
                      <span className={`font-extrabold truncate ${config.fieldValueSecondaryClassName}`}>{displayTime}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className={`flex items-center justify-center bg-white p-2 border rounded-lg shrink-0 w-[100px] h-[100px] self-center ${config.qrBorderClassName}`}>
              <QRCodeSVG value={data.id} size={80} level="M" />
            </div>
          </div>
          <span className={`absolute bottom-2 left-2 right-2 whitespace-nowrap border-t border-emerald-600/30 pt-1 text-[15px] font-sans leading-none font-black uppercase ${config.titleClassName}`}>
            {config.footerText}
          </span>
        </>
      )}
    </div>
  );
});

PrintLabelCard.displayName = 'PrintLabelCard';

export function DriveLookupEditPanel({
  currentUser,
  datasources,
  onTableUpdateNotification,
  onRefreshDisks,
  initialLookupQuery = '',
  onClose
}: {
  currentUser: { username: string; name: string; role: UserRole; owner_id?: string } | null;
  datasources: DataSource[];
  onTableUpdateNotification: (tableName: string, action: string, recordId: string) => void;
  onRefreshDisks?: () => void;
  initialLookupQuery?: string;
  onClose?: () => void;
}) {
  const parseDriveSizeTB = (sizeValue: string) => {
    const match = String(sizeValue || '').toUpperCase().match(/(\d+(?:\.\d+)?)\s*TB/);
    return match ? Number(match[1]) : NaN;
  };

  const getSourceMinSizeTB = (source: DataSource | undefined) => {
    if (!source?.required_specs?.size_options?.length) return NaN;
    return parseDriveSizeTB(source.required_specs.size_options[0]);
  };

  const meetsSourceMinimum = (source: DataSource | undefined, driveSize: string) => {
    const minTB = getSourceMinSizeTB(source);
    const driveTB = parseDriveSizeTB(driveSize);
    if (Number.isNaN(minTB) || Number.isNaN(driveTB)) return true;
    return driveTB >= minTB;
  };

  const [lookupQuery, setLookupQuery] = useState(initialLookupQuery);
  const [lookupTarget, setLookupTarget] = useState<Disk | null>(null);
  const [lookupResult, setLookupResult] = useState<{ disk: Disk; status_logs: Array<{ id: string; status: string; timestamp: string; operator: string; description: string }> } | null>(null);
  const [lookupError, setLookupError] = useState('');
  const [isLookupLoading, setIsLookupLoading] = useState(false);
  const [isLookupSaving, setIsLookupSaving] = useState(false);
  const [lookupImageZoom, setLookupImageZoom] = useState(1);
  const [lookupForm, setLookupForm] = useState({
    id: '',
    hd_manufacturer: '',
    hd_model: '',
    hd_serial: '',
    hd_size: '8TB',
    hd_speed: '7200 RPM',
    source_requested_id: '',
    status: 'received' as Disk['status'],
    received_time: '',
    hd_image: ''
  });

  useEffect(() => {
    setLookupImageZoom(1);
  }, [lookupTarget?.id]);

  const runLookup = async (query: string) => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return;

    setIsLookupLoading(true);
    setLookupError('');
    setLookupTarget(null);
    setLookupResult(null);

    try {
      const lookupRes = await fetch(`/api/kiosk/lookup-disk/${encodeURIComponent(normalizedQuery)}`);
      if (!lookupRes.ok) {
        throw new Error('Drive record not found. Check the ID or serial number and try again.');
      }

      const lookupData = await lookupRes.json();
      if (!lookupData?.found || !lookupData?.disk) {
        throw new Error('Drive record could not be loaded.');
      }

      setLookupResult(lookupData);
      setLookupTarget(lookupData.disk);
      setLookupForm({
        id: lookupData.disk.id || '',
        hd_manufacturer: lookupData.disk.hd_manufacturer || '',
        hd_model: lookupData.disk.hd_model || '',
        hd_serial: lookupData.disk.hd_serial || '',
        hd_size: lookupData.disk.hd_size || '8TB',
        hd_speed: lookupData.disk.hd_speed || '7200 RPM',
        source_requested_id: lookupData.disk.source_requested_id || '',
        status: lookupData.disk.status || 'received',
        received_time: lookupData.disk.received_time || '',
        hd_image: lookupData.disk.hd_image || ''
      });
    } catch (err: any) {
      console.error(err);
      setLookupError(err.message || 'Lookup failed.');
    } finally {
      setIsLookupLoading(false);
    }
  };

  useEffect(() => {
    if (initialLookupQuery?.trim()) {
      setLookupQuery(initialLookupQuery);
      void runLookup(initialLookupQuery);
    }
  }, [initialLookupQuery]);

  const handleLookupDisk = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    await runLookup(lookupQuery);
  };

  const handleLookupSave = async () => {
    if (!lookupTarget) return;

    if (!lookupForm.hd_manufacturer || !lookupForm.hd_model || !lookupForm.hd_serial || !lookupForm.source_requested_id) {
      alert('Please complete the drive metadata and select a source before saving edits.');
      return;
    }

    setIsLookupSaving(true);
    try {
      const updateRes = await fetch(`/api/disks/${lookupTarget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hd_manufacturer: lookupForm.hd_manufacturer,
          hd_model: lookupForm.hd_model,
          hd_serial: lookupForm.hd_serial,
          hd_size: lookupForm.hd_size,
          hd_speed: lookupForm.hd_speed,
          source_requested_id: lookupForm.source_requested_id,
          status: lookupForm.status,
          received_time: lookupForm.received_time || null,
          hd_image: lookupForm.hd_image || null,
          operator: currentUser?.username || 'Volunteer Portal'
        })
      });

      if (!updateRes.ok) {
        const err = await updateRes.json().catch(() => ({}));
        throw new Error(err.error || 'Unable to save drive updates.');
      }

      const updatedDisk: Disk = await updateRes.json();
      setLookupTarget(updatedDisk);
      setLookupForm({
        id: updatedDisk.id || '',
        hd_manufacturer: updatedDisk.hd_manufacturer || '',
        hd_model: updatedDisk.hd_model || '',
        hd_serial: updatedDisk.hd_serial || '',
        hd_size: updatedDisk.hd_size || '8TB',
        hd_speed: updatedDisk.hd_speed || '7200 RPM',
        source_requested_id: updatedDisk.source_requested_id || '',
        status: updatedDisk.status || 'received',
        received_time: updatedDisk.received_time || '',
        hd_image: updatedDisk.hd_image || ''
      });
      setLookupResult(prev => prev ? { ...prev, disk: updatedDisk } : prev);
      onTableUpdateNotification('disks', 'UPDATE', updatedDisk.id);
      onRefreshDisks?.();
      alert(`Drive ${updatedDisk.id} was updated successfully.`);
      onClose?.();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to update drive record.');
    } finally {
      setIsLookupSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-[#2A2A2E] bg-[#111113] p-4">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-sm font-bold text-white">Drive record editor</h4>
          <p className="mt-1 text-xs text-slate-400">Lookup a drive by ID or serial number, review its image and metadata, then save corrections here.</p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#2A2A2E] bg-[#0E0E10] px-3 py-2 text-xs font-bold text-slate-300 transition hover:text-white"
          >
            Close
          </button>
        ) : null}
      </div>

      <form onSubmit={handleLookupDisk} className="mb-4 flex flex-col gap-3 sm:flex-row">
        <label className="flex-1">
          <span className="sr-only">Drive lookup</span>
          <input
            type="text"
            value={lookupQuery}
            onChange={(e) => setLookupQuery(e.target.value)}
            placeholder="Enter drive ID or serial number"
            className="w-full rounded-lg border border-[#2A2A2E] bg-[#0E0E10] px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </label>
        <button
          type="submit"
          disabled={isLookupLoading}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-500 disabled:opacity-50"
        >
          {isLookupLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          Lookup
        </button>
      </form>

      {lookupError ? (
        <div className="mb-4 rounded-lg border border-rose-900/40 bg-rose-950/20 p-3 text-xs text-rose-300">
          {lookupError}
        </div>
      ) : null}

      {lookupResult && lookupTarget ? (
        <div className="space-y-4 rounded-xl border border-[#2A2A2E] bg-[#16161A] p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Current status</span>
                <span className="rounded-full border border-blue-900/40 bg-blue-950/40 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-blue-300">
                  {lookupForm.status}
                </span>
              </div>
              <div className="text-sm font-black text-white">{lookupTarget.id}</div>
              <div className="text-xs text-slate-400">
                {lookupTarget.hd_manufacturer} {lookupTarget.hd_model} • S/N {lookupTarget.hd_serial}
              </div>
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              <div>Last updated: {lookupTarget.received_time ? new Date(lookupTarget.received_time).toLocaleString() : 'Unknown'}</div>
              <div className="mt-1">Current location: {lookupTarget.current_location || lookupTarget.location || 'Unknown'}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="rounded-xl border border-[#2A2A2E] bg-[#0E0E10] p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-black">Current drive image</span>
                {lookupTarget.hd_image ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setLookupImageZoom(value => Math.max(1, Number((value - 0.25).toFixed(2))))}
                      className="rounded border border-[#2A2A2E] bg-[#111113] p-1 text-slate-400 transition hover:text-white"
                      aria-label="Zoom out"
                    >
                      <ZoomOut className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setLookupImageZoom(1)}
                      className="rounded border border-[#2A2A2E] bg-[#111113] p-1 text-slate-400 transition hover:text-white"
                      aria-label="Reset zoom"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setLookupImageZoom(value => Number((value + 0.25).toFixed(2)))}
                      className="rounded border border-[#2A2A2E] bg-[#111113] p-1 text-slate-400 transition hover:text-white"
                      aria-label="Zoom in"
                    >
                      <ZoomIn className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : null}
              </div>
              {lookupTarget.hd_image ? (
                <div className="overflow-auto rounded-lg border border-[#2A2A2E] bg-[#060708] p-2">
                  <div className="flex min-h-[280px] items-center justify-center">
                    <img
                      src={lookupTarget.hd_image}
                      alt="Current drive image"
                      className="max-h-[280px] w-auto rounded object-contain shadow-sm transition-transform duration-200"
                      style={{ transform: `scale(${lookupImageZoom})` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[280px] items-center justify-center rounded-lg border border-dashed border-[#2A2A2E] bg-[#060708] p-4 text-center text-[11px] text-slate-500">
                  No drive image saved for this record.
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[10px] font-mono uppercase text-slate-400 font-black">Manufacturer</label>
                <input
                  type="text"
                  list="drive-manufacturer-options"
                  value={lookupForm.hd_manufacturer}
                  onChange={(e) => setLookupForm({ ...lookupForm, hd_manufacturer: e.target.value })}
                  className="w-full rounded-lg border border-[#2A2A2E] bg-[#0E0E10] px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <datalist id="drive-manufacturer-options">
                  {['Seagate', 'Toshiba', 'Western Digital', 'Samsung', 'Dell', 'MDD'].map(option => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-mono uppercase text-slate-400 font-black">Model</label>
                <input
                  type="text"
                  value={lookupForm.hd_model}
                  onChange={(e) => setLookupForm({ ...lookupForm, hd_model: e.target.value })}
                  className="w-full rounded-lg border border-[#2A2A2E] bg-[#0E0E10] px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-mono uppercase text-slate-400 font-black">Serial number</label>
                <input
                  type="text"
                  value={lookupForm.hd_serial}
                  onChange={(e) => setLookupForm({ ...lookupForm, hd_serial: e.target.value })}
                  className="w-full rounded-lg border border-[#2A2A2E] bg-[#0E0E10] px-3 py-2 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-mono uppercase text-slate-400 font-black">Capacity</label>
                <select
                  value={lookupForm.hd_size}
                  onChange={(e) => setLookupForm({ ...lookupForm, hd_size: e.target.value })}
                  className="w-full rounded-lg border border-[#2A2A2E] bg-[#0E0E10] px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {['4TB', '6TB', '8TB', '10TB', '12TB', '16TB', '18TB', '20TB', '24TB'].map(size => <option key={size} value={size}>{size}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-mono uppercase text-slate-400 font-black">Speed</label>
                <input
                  type="text"
                  value={lookupForm.hd_speed}
                  onChange={(e) => setLookupForm({ ...lookupForm, hd_speed: e.target.value })}
                  className="w-full rounded-lg border border-[#2A2A2E] bg-[#0E0E10] px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-mono uppercase text-slate-400 font-black">Source dataset</label>
                <select
                  value={lookupForm.source_requested_id}
                  onChange={(e) => setLookupForm({ ...lookupForm, source_requested_id: e.target.value })}
                  className="w-full rounded-lg border border-[#2A2A2E] bg-[#0E0E10] px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select a source…</option>
                  {(datasources.length > 0 ? datasources : ['A', 'B', 'C', 'D', 'E'].map(l => ({
                    id: `DS-${l}`,
                    name: `Source ${l}`,
                    description: 'External Allocation',
                    required_specs: { interface: 'SATA 3', size_options: [l === 'B' || l === 'C' ? '6TB' : '8TB'] }
                  }))).map(source => (
                    <option key={source.id} value={source.id}>{source.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-mono uppercase text-slate-400 font-black">Drive status</label>
                <select
                  value={lookupForm.status}
                  onChange={(e) => setLookupForm({ ...lookupForm, status: e.target.value as Disk['status'] })}
                  className="w-full rounded-lg border border-[#2A2A2E] bg-[#0E0E10] px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {['received','copying','completed','failed','picked_up'].map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {lookupForm.source_requested_id ? (() => {
            const matchingSource = datasources.find(src => src.id === lookupForm.source_requested_id);
            const isCompatible = meetsSourceMinimum(matchingSource, lookupForm.hd_size);
            const minTB = getSourceMinSizeTB(matchingSource);
            return (
              <div className={`rounded-lg border p-3 text-[11px] ${isCompatible ? 'border-emerald-900/40 bg-emerald-950/20 text-emerald-300' : 'border-amber-900/40 bg-amber-950/20 text-amber-300'}`}>
                {isCompatible ? 'Drive meets the source minimum size requirement.' : `Selected source requires a minimum drive size of ${Number.isNaN(minTB) ? 'the configured minimum' : `${minTB}TB`}.`}
              </div>
            );
          })() : null}

          <div className="flex flex-col gap-3 border-t border-[#2A2A2E] pt-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-[10px] text-slate-500 font-mono">
              {lookupResult?.status_logs?.slice(0, 3).map(log => (
                <div key={log.id} className="mt-1 first:mt-0">
                  <span className="text-slate-400">{new Date(log.timestamp).toLocaleString()}</span> • {log.status} • {log.operator}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {onClose ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex min-h-12 items-center justify-center rounded-lg border border-[#2A2A2E] bg-[#0E0E10] px-4 py-3 text-sm font-bold text-slate-300 transition hover:text-white"
                >
                  Cancel Changes
                </button>
              ) : null}
              <button
                type="button"
                disabled={isLookupSaving}
                onClick={handleLookupSave}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
              >
                {isLookupSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Save corrections
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function VolunteerPortal({
  currentUser,
  onLogout,
  onTableUpdateNotification
}: VolunteerPortalProps) {
  const normalizeDatasource = (raw: any): DataSource => {
    const specs = raw?.required_specs || {};
    const sizeOptionsRaw = specs.size_options;
    const minimumSizeTB = specs.minimum_size_tb;

    const sizeOptions = Array.isArray(sizeOptionsRaw)
      ? sizeOptionsRaw.filter((s: unknown) => typeof s === 'string' && s.trim())
      : typeof sizeOptionsRaw === 'string' && sizeOptionsRaw.trim()
        ? [sizeOptionsRaw.trim()]
        : typeof minimumSizeTB === 'number' && Number.isFinite(minimumSizeTB)
          ? [`${minimumSizeTB}TB`]
          : ['8TB'];

    return {
      id: String(raw?.id || `DS-${Date.now()}`),
      name: String(raw?.name || 'Unnamed Source'),
      description: String(raw?.description || ''),
      required_specs: {
        interface: String(specs.interface || 'SATA 3'),
        size_options: sizeOptions
      }
    };
  };

  const parseDriveSizeTB = (sizeValue: string) => {
    const match = String(sizeValue || '').toUpperCase().match(/(\d+(?:\.\d+)?)\s*TB/);
    return match ? Number(match[1]) : NaN;
  };

  const getSourceMinSizeTB = (source: DataSource | undefined) => {
    if (!source?.required_specs?.size_options?.length) return NaN;
    return parseDriveSizeTB(source.required_specs.size_options[0]);
  };

  const meetsSourceMinimum = (source: DataSource | undefined, driveSize: string) => {
    const minTB = getSourceMinSizeTB(source);
    const driveTB = parseDriveSizeTB(driveSize);
    if (Number.isNaN(minTB) || Number.isNaN(driveTB)) return true;
    return driveTB >= minTB;
  };

  // Database states
  const [disks, setDisks] = useState<Disk[]>([]);
  const [datasources, setDatasources] = useState<DataSource[]>([]);
  const [duplicators, setDuplicators] = useState<Duplicator[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Drive lookup/edit state for volunteer corrections
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupTarget, setLookupTarget] = useState<Disk | null>(null);
  const [lookupResult, setLookupResult] = useState<{ disk: Disk; status_logs: Array<{ id: string; status: string; timestamp: string; operator: string; description: string }> } | null>(null);
  const [lookupError, setLookupError] = useState('');
  const [isLookupLoading, setIsLookupLoading] = useState(false);
  const [isLookupSaving, setIsLookupSaving] = useState(false);
  const [lookupImageZoom, setLookupImageZoom] = useState(1);
  const [lookupForm, setLookupForm] = useState({
    id: '',
    hd_manufacturer: '',
    hd_model: '',
    hd_serial: '',
    hd_size: '8TB',
    hd_speed: '7200 RPM',
    source_requested_id: '',
    status: 'received' as Disk['status'],
    received_time: '',
    hd_image: ''
  });

  // Active sub-tab within POS: 'intake' | 'edit' | 'return' | 'reprint'
  const [posTab, setPosTab] = useState<'intake' | 'edit' | 'return' | 'reprint'>('intake');

  useEffect(() => {
    setLookupImageZoom(1);
  }, [lookupTarget?.id]);
  
  // Search state for print/reprint and return tabs
  const [reprintSearchQuery, setReprintSearchQuery] = useState('');
  const [returnDiskSearchQuery, setReturnDiskSearchQuery] = useState('');
  const [returnPage, setReturnPage] = useState(1);
  const [reprintPage, setReprintPage] = useState(1);

  // Intake Flow Step trackers
  const [intakeStep, setIntakeStep] = useState<1 | 2 | 4 | 5>(1);
  const [intakeSuccessRecord, setIntakeSuccessRecord] = useState<{ disk: Disk } | null>(null);
  const [showIntakePreview, setShowIntakePreview] = useState(false);

  // Webcam states for drive image capture
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [webcamError, setWebcamError] = useState('');
  const [isCameraSimulated, setIsCameraSimulated] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Scanning simulation and OCR states
  const [scanImageBase64, setScanImageBase64] = useState<string | null>(null);
  const [capturedImageDataUrl, setCapturedImageDataUrl] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanSkipWarning, setScanSkipWarning] = useState(false);
  const [adminOverrideDuplicateSerial, setAdminOverrideDuplicateSerial] = useState(false);
  const [barcodeHints, setBarcodeHints] = useState<string[]>([]);
  const [captureInfoTab, setCaptureInfoTab] = useState<'errors' | 'barcode' | 'ocr'>('errors');
  const BARCODE_CONFIDENCE_THRESHOLD = 0.5;

  // Intake Drive Form State
  const [diskForm, setDiskForm] = useState({
    id: '',
    hd_manufacturer: 'N/A',
    hd_model: 'N/A',
    hd_serial: 'N/A',
    hd_size: '8TB',
    hd_speed: '7200 RPM',
    source_requested_id: '',
    status: 'received' as Disk['status'],
    received_time: '',
    hd_image: ''
  });

  const intakePreviewImage = capturedImageDataUrl || diskForm.hd_image || scanImageBase64 || '';

  // Return Flow States
  const [selectedReturnDiskId, setSelectedReturnDiskId] = useState('');
  const [scannedTicketCode, setScannedTicketCode] = useState('');
  const [isReturnWebcamActive, setIsReturnWebcamActive] = useState(false);
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);
  const [returnSuccessRecord, setReturnSuccessRecord] = useState<{ diskName: string, diskId: string } | null>(null);

  // Ticket Modal state for printable tags
  const [printedTicketDisk, setPrintedTicketDisk] = useState<Disk | null>(null);
  const [printContentShiftMm, setPrintContentShiftMm] = useState(0);
  const [printContentShiftXMm, setPrintContentShiftXMm] = useState(0);
  const [printSheetOffsetMm, setPrintSheetOffsetMm] = useState(0);
  const [printSheetOffsetXMm, setPrintSheetOffsetXMm] = useState(0);
  const tagPrintCardRef = useRef<HTMLDivElement | null>(null);
  const ticketPrintCardRef = useRef<HTMLDivElement | null>(null);

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
      const [disksRes, sourcesRes, duplicatorsRes] = await Promise.all([
        fetch('/api/disks'),
        fetch('/api/datasources'),
        fetch('/api/duplicators')
      ]);

      if (disksRes.ok) setDisks(await disksRes.json());
      if (sourcesRes.ok) {
        const sourcePayload = await sourcesRes.json();
        const sourceRows = Array.isArray(sourcePayload)
          ? sourcePayload
          : Array.isArray(sourcePayload?.datasources)
            ? sourcePayload.datasources
            : [];
        setDatasources(sourceRows.map(normalizeDatasource));
      }
      if (duplicatorsRes.ok) setDuplicators(await duplicatorsRes.json());
    } catch (err) {
      console.error('Failed to load volunteer data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Reset selected source if the drive falls below the source minimum size
  useEffect(() => {
    if (diskForm.source_requested_id) {
      const selectedSource = datasources.find(s => s.id === diskForm.source_requested_id);
      if (selectedSource && !meetsSourceMinimum(selectedSource, diskForm.hd_size)) {
        setDiskForm(prev => ({ ...prev, source_requested_id: '' }));
      }
    }
  }, [diskForm.hd_size, datasources]);

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

  // Populate a fresh sequence-based ID once the current disk catalog is available.
  useEffect(() => {
    if (!disks.length) return;

    const currentId = diskForm.id?.trim();
    if (!currentId || disks.some(d => d.id === currentId)) {
      const nextId = generateDiskID(disks);
      if (nextId !== currentId) {
        setDiskForm(prev => ({ ...prev, id: nextId }));
      }
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

      let stream: MediaStream | null = null;
      const attempts = [
        // Attempt 1: High-res back/environment camera with portrait framing for label capture
        () => navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 720 }, height: { ideal: 1280 }, aspectRatio: { ideal: 0.75 } }, audio: false }),
        // Attempt 2: Standard back/environment camera with portrait preference
        () => navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 720 }, height: { ideal: 1280 }, aspectRatio: { ideal: 0.75 } }, audio: false }),
        // Attempt 3: User/front facing camera (common for webcams on desktops/laptops)
        () => navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false }),
        // Attempt 4: Any video source with audio explicitly turned off
        () => navigator.mediaDevices.getUserMedia({ video: true, audio: false }),
        // Attempt 5: Minimum fallback constraints
        () => navigator.mediaDevices.getUserMedia({ video: {} })
      ];

      let streamAcquired = false;
      for (let i = 0; i < attempts.length; i++) {
        try {
          console.log(`Webcam initialization attempt ${i + 1}...`);
          stream = await attempts[i]();
          streamAcquired = true;
          console.log(`Webcam initialization attempt ${i + 1} succeeded!`);
          break;
        } catch (err: any) {
          console.warn(`Webcam attempt ${i + 1} failed:`, err);
        }
      }

      if (!streamAcquired || !stream) {
        throw new Error('All camera initialization attempts failed. Please ensure camera access is allowed in Chrome and the webcam is not in use.');
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

  const isPlaceholderFieldValue = (value: unknown) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return true;
    if (normalized === 'n/a') return true;
    if (normalized.includes('unknown')) return true;
    if (normalized.includes('unreadable')) return true;
    if (normalized.includes('unresolved')) return true;
    if (normalized.includes('?')) return true;
    return false;
  };

  const normalizeExtractedField = (value: unknown) => {
    const cleaned = String(value || '').trim();
    return isPlaceholderFieldValue(cleaned) ? '' : cleaned;
  };

  const applyExtractedDriveMetadata = (
    candidate: { hd_manufacturer?: unknown; hd_model?: unknown; hd_serial?: unknown },
    confidence?: { hd_manufacturer?: number; hd_model?: number; hd_serial?: number }
  ) => {
    const manufacturerConfidence = Number(confidence?.hd_manufacturer ?? 0);
    const modelConfidence = Number(confidence?.hd_model ?? 0);
    const serialConfidence = Number(confidence?.hd_serial ?? 0);
    const manufacturer = normalizeExtractedField(candidate.hd_manufacturer);
    const model = normalizeExtractedField(candidate.hd_model);
    const serial = normalizeExtractedField(candidate.hd_serial);

    const qualifiedManufacturer = manufacturerConfidence >= BARCODE_CONFIDENCE_THRESHOLD ? manufacturer : '';
    const qualifiedModel = modelConfidence >= BARCODE_CONFIDENCE_THRESHOLD ? model : '';
    const qualifiedSerial = serialConfidence >= BARCODE_CONFIDENCE_THRESHOLD ? serial : '';

    if (!qualifiedManufacturer && !qualifiedModel && !qualifiedSerial) {
      return;
    }

    setDiskForm(prev => ({
      ...prev,
      hd_manufacturer: qualifiedManufacturer && isPlaceholderFieldValue(prev.hd_manufacturer) ? qualifiedManufacturer : prev.hd_manufacturer,
      hd_model: qualifiedModel && isPlaceholderFieldValue(prev.hd_model) ? qualifiedModel : prev.hd_model,
      hd_serial: qualifiedSerial && isPlaceholderFieldValue(prev.hd_serial) ? qualifiedSerial : prev.hd_serial
    }));

    setScanResult((prev: any) => {
      const previousData = prev?.data || {};
      return {
        ...(prev || {}),
        success: true,
        data: {
          ...previousData,
          hd_manufacturer: qualifiedManufacturer || previousData.hd_manufacturer || 'N/A',
          hd_model: qualifiedModel || previousData.hd_model || 'N/A',
          hd_serial: qualifiedSerial || previousData.hd_serial || 'N/A'
        }
      };
    });
  };

  const applyCapturedImageForIntake = (dataUrl: string, options?: { stopCamera?: boolean }) => {
    setScanImageBase64(dataUrl);
    setCapturedImageDataUrl(dataUrl);
    setScanResult(null);
    setScanSkipWarning(false);
    setAdminOverrideDuplicateSerial(false);
    setDiskForm(prev => ({
      ...prev,
      hd_manufacturer: 'N/A',
      hd_model: 'N/A',
      hd_serial: 'N/A',
      hd_image: dataUrl
    }));
    analyzeLabelForBarcodeMetadata(dataUrl);
    if (options?.stopCamera) {
      stopWebcam();
    }
    // Barcode-only intake mode: camera and browse follow the same barcode extraction path.
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
      const targetRatio = 3 / 4;
      const sourceWidth = video.videoWidth || 720;
      const sourceHeight = video.videoHeight || 1280;
      let cropX = 0;
      let cropY = 0;
      let cropWidth = sourceWidth;
      let cropHeight = sourceHeight;
      const sourceRatio = sourceWidth / sourceHeight;

      if (sourceRatio > targetRatio) {
        cropWidth = sourceHeight * targetRatio;
        cropX = (sourceWidth - cropWidth) / 2;
      } else if (sourceRatio < targetRatio) {
        cropHeight = sourceWidth / targetRatio;
        cropY = (sourceHeight - cropHeight) / 2;
      }

      canvas.width = 768;
      canvas.height = 1024;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        applyCapturedImageForIntake(dataUrl, { stopCamera: true });
      }
    }
  };

  const handleImageFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const mime = String(file.type || '').toLowerCase();
    const isHeicLike = mime.includes('heic') || mime.includes('heif') || /\.(heic|heif)$/i.test(file.name || '');

    setScanResult(null);
    setScanSkipWarning(false);
    setAdminOverrideDuplicateSerial(false);
    setBarcodeHints([]);

    const compressImageDataUrl = (dataUrl: string, maxEdgePx = 1800, jpegQuality = 0.86) => new Promise<string>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const srcWidth = img.width || 1;
        const srcHeight = img.height || 1;
        const scale = Math.min(1, maxEdgePx / Math.max(srcWidth, srcHeight));
        const outWidth = Math.max(1, Math.round(srcWidth * scale));
        const outHeight = Math.max(1, Math.round(srcHeight * scale));

        const canvas = document.createElement('canvas');
        canvas.width = outWidth;
        canvas.height = outHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, outWidth, outHeight);
        ctx.drawImage(img, 0, 0, outWidth, outHeight);
        resolve(canvas.toDataURL('image/jpeg', jpegQuality));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });

    const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed reading image blob'));
      reader.readAsDataURL(blob);
    });

    let uploadDataUrl = '';
    try {
      if (isHeicLike) {
        const heic2any = (await import('heic2any')).default as (
          options: { blob: Blob; toType: string; quality?: number }
        ) => Promise<Blob | Blob[]>;
        const converted = await heic2any({
          blob: file,
          toType: 'image/jpeg',
          quality: 0.9
        });
        const convertedBlob = Array.isArray(converted) ? converted[0] : converted;
        uploadDataUrl = await blobToDataUrl(convertedBlob);
      } else {
        uploadDataUrl = await blobToDataUrl(file);
      }
    } catch (error) {
      console.error('HEIC conversion failed:', error);
      alert('Unable to process this HEIC image. Please retry with another photo.');
      e.target.value = '';
      return;
    }

    const optimizedDataUrl = await compressImageDataUrl(uploadDataUrl);
    applyCapturedImageForIntake(optimizedDataUrl);
    // Allow selecting the same image file again on retry.
    e.target.value = '';
  };

  const analyzeLabelForBarcodeMetadata = async (imageDataUrl: string) => {
    setIsScanning(true);
    try {
      const BarcodeDetectorCtor = (window as any).BarcodeDetector;
      if (!BarcodeDetectorCtor) {
        setBarcodeHints(['Barcode detection is not available in this browser context.']);
        setScanResult({
          success: true,
          data: {
            hd_manufacturer: 'N/A',
            hd_model: 'N/A',
            hd_serial: 'N/A'
          }
        });
        return;
      }

      const preferredFormats = ['code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf', 'codabar', 'qr_code', 'data_matrix'];
      let supportedFormats: string[] = preferredFormats;
      if (typeof BarcodeDetectorCtor.getSupportedFormats === 'function') {
        try {
          const maybeFormats = await BarcodeDetectorCtor.getSupportedFormats();
          if (Array.isArray(maybeFormats)) {
            const filtered = maybeFormats.filter((f: string) => preferredFormats.includes(f));
            supportedFormats = filtered.length ? filtered : preferredFormats;
          }
        } catch {
          supportedFormats = preferredFormats;
        }
      }
      const detector = new BarcodeDetectorCtor({
        formats: supportedFormats.length ? supportedFormats : preferredFormats
      });

      const sourceImage = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Could not decode upload image for barcode scan'));
        img.src = imageDataUrl;
      });

      const maxEdgePx = 1800;
      const baseScale = Math.min(1, maxEdgePx / Math.max(sourceImage.width, sourceImage.height));
      const baseWidth = Math.max(1, Math.round(sourceImage.width * baseScale));
      const baseHeight = Math.max(1, Math.round(sourceImage.height * baseScale));
      const baseCanvas = document.createElement('canvas');
      baseCanvas.width = baseWidth;
      baseCanvas.height = baseHeight;
      const baseCtx = baseCanvas.getContext('2d');
      if (!baseCtx) {
        setBarcodeHints(['Unable to process barcode frame.']);
        setScanResult({
          success: true,
          data: {
            hd_manufacturer: 'N/A',
            hd_model: 'N/A',
            hd_serial: 'N/A'
          }
        });
        return;
      }
      baseCtx.drawImage(sourceImage, 0, 0, baseWidth, baseHeight);

      const buildContrastVariant = (canvas: HTMLCanvasElement) => {
        const out = document.createElement('canvas');
        out.width = canvas.width;
        out.height = canvas.height;
        const outCtx = out.getContext('2d');
        if (!outCtx) return canvas;
        outCtx.drawImage(canvas, 0, 0);
        const frame = outCtx.getImageData(0, 0, out.width, out.height);
        const pixels = frame.data;
        const contrast = 1.55;
        const intercept = 128 * (1 - contrast);
        for (let i = 0; i < pixels.length; i += 4) {
          const luminance = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
          const boosted = Math.max(0, Math.min(255, (luminance * contrast) + intercept));
          pixels[i] = boosted;
          pixels[i + 1] = boosted;
          pixels[i + 2] = boosted;
        }
        outCtx.putImageData(frame, 0, 0);
        return out;
      };

      const rotateCanvas = (canvas: HTMLCanvasElement, degrees: 90 | 180 | 270) => {
        const out = document.createElement('canvas');
        const outCtx = out.getContext('2d');
        if (!outCtx) return canvas;

        if (degrees === 180) {
          out.width = canvas.width;
          out.height = canvas.height;
          outCtx.translate(out.width, out.height);
          outCtx.rotate(Math.PI);
        } else if (degrees === 90) {
          out.width = canvas.height;
          out.height = canvas.width;
          outCtx.translate(out.width, 0);
          outCtx.rotate(Math.PI / 2);
        } else {
          out.width = canvas.height;
          out.height = canvas.width;
          outCtx.translate(0, out.height);
          outCtx.rotate(-Math.PI / 2);
        }

        outCtx.drawImage(canvas, 0, 0);
        return out;
      };

      const scanVariants: HTMLCanvasElement[] = [];
      const seenSizes = new Set<string>();
      const pushVariant = (canvas: HTMLCanvasElement) => {
        const key = `${canvas.width}x${canvas.height}:${scanVariants.length}`;
        if (!seenSizes.has(key)) {
          seenSizes.add(key);
          scanVariants.push(canvas);
        }
      };

      pushVariant(baseCanvas);
      pushVariant(buildContrastVariant(baseCanvas));
      pushVariant(rotateCanvas(baseCanvas, 90));
      pushVariant(rotateCanvas(baseCanvas, 180));
      pushVariant(rotateCanvas(baseCanvas, 270));
      pushVariant(buildContrastVariant(rotateCanvas(baseCanvas, 90)));
      pushVariant(buildContrastVariant(rotateCanvas(baseCanvas, 270)));

      const rawValueSet = new Set<string>();
      const rawValueFrequency = new Map<string, number>();
      for (const variant of scanVariants) {
        try {
          const detected = await detector.detect(variant);
          for (const item of detected || []) {
            const value = String((item as any)?.rawValue || '').trim();
            if (value) {
              rawValueSet.add(value);
              rawValueFrequency.set(value, (rawValueFrequency.get(value) || 0) + 1);
            }
          }
        } catch {
          // Continue scanning other variants.
        }
      }

      const rawValues = Array.from(rawValueSet);

      if (!rawValues.length) {
        setBarcodeHints(['No barcode payloads decoded from this image.']);
        setScanResult({
          success: true,
          data: {
            hd_manufacturer: 'N/A',
            hd_model: 'N/A',
            hd_serial: 'N/A'
          }
        });
        return;
      }

      const upperRawValues = rawValues.map(v => v.toUpperCase());
      const combined = rawValues.join(' | ').toUpperCase();

      const manufacturerSignals = [
        { value: 'Seagate', patterns: ['SEAGATE'] },
        { value: 'Western Digital', patterns: ['WESTERN DIGITAL', 'WDC', 'WD'] },
        { value: 'Toshiba', patterns: ['TOSHIBA'] },
        { value: 'Hitachi', patterns: ['HITACHI', 'HGST'] },
        { value: 'Samsung', patterns: ['SAMSUNG'] }
      ];

      const manufacturerMatches = manufacturerSignals
        .map(signal => ({
          value: signal.value,
          matches: upperRawValues.filter(raw => signal.patterns.some(pattern => raw.includes(pattern))).length
        }))
        .filter(entry => entry.matches > 0)
        .sort((a, b) => b.matches - a.matches);

      const manufacturer = manufacturerMatches[0]?.value || '';
      const manufacturerConfidence = manufacturerMatches.length === 1
        ? Math.min(0.95, 0.45 + (manufacturerMatches[0].matches * 0.2))
        : 0.3;

      const modelFromToken = combined.match(/\b(ST\d{4,}[A-Z0-9-]*)\b|\b(WD[A-Z0-9-]{5,})\b|\b(HDS[A-Z0-9-]{4,})\b|\b(MQ\d{2,}[A-Z0-9-]*)\b/i);
      const labeledModel = combined.match(/\bMODEL\s*[:#-]?\s*([A-Z0-9-]{5,})\b/i);
      const model = (modelFromToken?.[0] || labeledModel?.[1] || '').trim();

      const modelMentions = model
        ? upperRawValues.filter(raw => raw.includes(model.toUpperCase())).length
        : 0;
      const modelConfidence = !model
        ? 0
        : labeledModel
          ? Math.min(0.95, 0.65 + (modelMentions * 0.1))
          : modelMentions >= 2
            ? 0.65
            : 0.45;

      const labeledSerial = combined.match(/\b(SN|S\/N|SERIAL)\s*[:#-]?\s*([A-Z0-9-]{6,24})\b/i);
      const serialCandidate = combined
        .split(/[^A-Z0-9-]+/)
        .filter((token) => token.length >= 8 && token.length <= 24 && /[A-Z]/.test(token) && /\d/.test(token))
        .sort((a, b) => b.length - a.length)[0] || '';
      const serial = (labeledSerial?.[2] || serialCandidate || '').trim();

      const serialMentions = serial
        ? upperRawValues.filter(raw => raw.includes(serial.toUpperCase())).length
        : 0;
      const serialConfidence = !serial
        ? 0
        : labeledSerial
          ? Math.min(0.98, 0.7 + (serialMentions * 0.1))
          : serialMentions >= 2
            ? 0.65
            : 0.45;

      const barcodeResultData = {
        hd_manufacturer: manufacturerConfidence >= BARCODE_CONFIDENCE_THRESHOLD ? manufacturer : 'N/A',
        hd_model: modelConfidence >= BARCODE_CONFIDENCE_THRESHOLD ? model : 'N/A',
        hd_serial: serialConfidence >= BARCODE_CONFIDENCE_THRESHOLD ? serial : 'N/A'
      };

      setScanResult({
        success: true,
        data: barcodeResultData
      });

      const hints: string[] = [];
      if (manufacturer) hints.push(`Manufacturer from barcode: ${manufacturer} (${Math.round(manufacturerConfidence * 100)}%)`);
      if (model) hints.push(`Model from barcode: ${model} (${Math.round(modelConfidence * 100)}%)`);
      if (serial) hints.push(`Serial from barcode: ${serial} (${Math.round(serialConfidence * 100)}%)`);
      if (barcodeResultData.hd_manufacturer === 'N/A') hints.push('Manufacturer confidence below 50% -> kept as N/A');
      if (barcodeResultData.hd_model === 'N/A') hints.push('Model confidence below 50% -> kept as N/A');
      if (barcodeResultData.hd_serial === 'N/A') hints.push('Serial confidence below 50% -> kept as N/A');
      hints.push(`Barcode pass count: ${scanVariants.length}`);
      hints.push(`Decoded values: ${rawValues.length}`);
      hints.push(...rawValues.slice(0, 2).map(v => `Decoded barcode: ${v}`));
      setBarcodeHints(hints);
      applyExtractedDriveMetadata({
        hd_manufacturer: manufacturer,
        hd_model: model,
        hd_serial: serial
      }, {
        hd_manufacturer: manufacturerConfidence,
        hd_model: modelConfidence,
        hd_serial: serialConfidence
      });
    } catch (error) {
      console.warn('Barcode metadata extraction failed:', error);
      setBarcodeHints(['Barcode extraction failed for this image.']);
      setScanResult({
        success: true,
        data: {
          hd_manufacturer: 'N/A',
          hd_model: 'N/A',
          hd_serial: 'N/A'
        }
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleLoadMockLabel = (modelPreset: 'seagate_8tb' | 'wd_6tb' | 'mismatched_unrecognized') => {
    const fakeBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUHMgYVDC8m7V6zOwAAABl0RVh0Q29tbWVudABDcmVhdGVkIHdpdGggR0lNUO9kJW4AAAA/SURBVGje7cxBAQAADAIg9E+1ZHAHe0gGZECYfIAsWvYIskCWARkQJh8gixb9giwiYGaArP4BsmgZZIEMAzIgYpIsCqY7yQAAAABJRU5ErkJggg==";
    setScanImageBase64(fakeBase64);
    setCapturedImageDataUrl(fakeBase64);
    setScanSkipWarning(false);
    setAdminOverrideDuplicateSerial(false);
    setBarcodeHints([]);
    
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
  const handleLookupDisk = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const normalizedQuery = lookupQuery.trim();
    if (!normalizedQuery) return;

    setIsLookupLoading(true);
    setLookupError('');
    setLookupTarget(null);
    setLookupResult(null);

    try {
      const lookupRes = await fetch(`/api/kiosk/lookup-disk/${encodeURIComponent(normalizedQuery)}`);
      if (!lookupRes.ok) {
        throw new Error('Drive record not found. Check the ID or serial number and try again.');
      }

      const lookupData = await lookupRes.json();
      if (!lookupData?.found || !lookupData?.disk) {
        throw new Error('Drive record could not be loaded.');
      }

      setLookupResult(lookupData);
      setLookupTarget(lookupData.disk);
      setLookupForm({
        id: lookupData.disk.id || '',
        hd_manufacturer: lookupData.disk.hd_manufacturer || '',
        hd_model: lookupData.disk.hd_model || '',
        hd_serial: lookupData.disk.hd_serial || '',
        hd_size: lookupData.disk.hd_size || '8TB',
        hd_speed: lookupData.disk.hd_speed || '7200 RPM',
        source_requested_id: lookupData.disk.source_requested_id || '',
        status: lookupData.disk.status || 'received',
        received_time: lookupData.disk.received_time || '',
        hd_image: lookupData.disk.hd_image || ''
      });
    } catch (err: any) {
      console.error(err);
      setLookupError(err.message || 'Lookup failed.');
    } finally {
      setIsLookupLoading(false);
    }
  };

  const handleLookupSave = async () => {
    if (!lookupTarget) return;

    if (!lookupForm.hd_manufacturer || !lookupForm.hd_model || !lookupForm.hd_serial || !lookupForm.source_requested_id) {
      alert('Please complete the drive metadata and select a source before saving edits.');
      return;
    }

    setIsLookupSaving(true);
    try {
      const updateRes = await fetch(`/api/disks/${lookupTarget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hd_manufacturer: lookupForm.hd_manufacturer,
          hd_model: lookupForm.hd_model,
          hd_serial: lookupForm.hd_serial,
          hd_size: lookupForm.hd_size,
          hd_speed: lookupForm.hd_speed,
          source_requested_id: lookupForm.source_requested_id,
          status: lookupForm.status,
          received_time: lookupForm.received_time || null,
          hd_image: lookupForm.hd_image || null,
          operator: currentUser?.username || 'Volunteer Portal'
        })
      });

      if (!updateRes.ok) {
        const err = await updateRes.json().catch(() => ({}));
        throw new Error(err.error || 'Unable to save drive updates.');
      }

      const updatedDisk: Disk = await updateRes.json();
      setLookupTarget(updatedDisk);
      setLookupForm({
        id: updatedDisk.id || '',
        hd_manufacturer: updatedDisk.hd_manufacturer || '',
        hd_model: updatedDisk.hd_model || '',
        hd_serial: updatedDisk.hd_serial || '',
        hd_size: updatedDisk.hd_size || '8TB',
        hd_speed: updatedDisk.hd_speed || '7200 RPM',
        source_requested_id: updatedDisk.source_requested_id || '',
        status: updatedDisk.status || 'received',
        received_time: updatedDisk.received_time || '',
        hd_image: updatedDisk.hd_image || ''
      });
      setLookupResult(prev => prev ? { ...prev, disk: updatedDisk } : prev);
      onTableUpdateNotification('disks', 'UPDATE', updatedDisk.id);
      fetchAllData();
      alert(`Drive ${updatedDisk.id} was updated successfully.`);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to update drive record.');
    } finally {
      setIsLookupSaving(false);
    }
  };

  const handlePOSIntakeSubmit = async () => {
        const trimmedExistingId = diskForm.id?.trim();
        const effectiveDiskId = trimmedExistingId && !disks.some(d => d.id === trimmedExistingId)
          ? trimmedExistingId
          : generateDiskID(disks);
        const effectiveSerial = diskForm.hd_serial?.trim() ? diskForm.hd_serial.trim() : 'N/A';

        const selectedSource = datasources.find(s => s.id === diskForm.source_requested_id);
        if (selectedSource && !meetsSourceMinimum(selectedSource, diskForm.hd_size)) {
          const minTB = getSourceMinSizeTB(selectedSource);
          alert(`Selected source requires a minimum drive size of ${Number.isNaN(minTB) ? 'the configured minimum' : `${minTB}TB`}.`);
          return;
        }

    if (!diskForm.source_requested_id) {
      alert("Please select a source before registration.");
      return;
    }

    const serialForComparison = effectiveSerial.toLowerCase().trim();
    const serialExists = serialForComparison && serialForComparison !== 'n/a'
      ? disks.some(d => d.hd_serial.toLowerCase().trim() === serialForComparison && d.hd_serial.trim() !== '' && d.hd_serial.toLowerCase().trim() !== 'n/a')
      : false;
    if (serialExists && !(currentUser?.role === 'admin' && adminOverrideDuplicateSerial)) {
      // Guard is surfaced in Step 1 Capture screen; keep backend submit blocked as a fallback.
      return;
    }

    setIsLoading(true);
    try {
      const nextId = generateDiskID(disks);
      const diskPayload = {
        ...diskForm,
        id: effectiveDiskId && effectiveDiskId !== nextId ? effectiveDiskId : nextId,
        hd_serial: effectiveSerial,
        received_time: new Date().toISOString(),
        status: 'received',
        hd_image: capturedImageDataUrl || diskForm.hd_image || scanImageBase64 || null
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
      setDiskForm(prev => ({ ...prev, id: createdDisk.id }));
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

  // Handle scan input submit or barcode reader submission
  const handleScanInputSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = scannedTicketCode.trim();
    if (!code) return;

    // Search for a match in active return queue (by ID or exact serial)
    const matchedDisk = disks.find(d => 
      d.id.toLowerCase() === code.toLowerCase() || 
      d.hd_serial.toLowerCase() === code.toLowerCase()
    );

    if (matchedDisk) {
      if (matchedDisk.status === 'picked_up') {
        alert(`Drive ${matchedDisk.id} has already been returned/released!`);
      } else {
        setSelectedReturnDiskId(matchedDisk.id);
        setScannedTicketCode(''); // clear input for next scan
      }
    } else {
      alert(`No matching unreturned drive found for: "${code}"`);
    }
  };

  // Keyboard shortcuts for prompt confirmation & cancellation
  useEffect(() => {
    if (posTab !== 'return' || !selectedReturnDiskId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // If prompt is open, Enter confirms, Escape cancels
      if (e.key === 'Enter') {
        e.preventDefault();
        handlePOSReturnSubmit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setSelectedReturnDiskId('');
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [posTab, selectedReturnDiskId, disks]);

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

  const RETURN_PAGE_SIZE = 6;
  const REPRINT_PAGE_SIZE = 6;
  const returnTotalPages = Math.max(1, Math.ceil(filteredForReturn.length / RETURN_PAGE_SIZE));
  const reprintTotalPages = Math.max(1, Math.ceil(filteredForReprint.length / REPRINT_PAGE_SIZE));
  const safeReturnPage = Math.min(returnPage, returnTotalPages);
  const safeReprintPage = Math.min(reprintPage, reprintTotalPages);
  const pagedForReturn = filteredForReturn.slice((safeReturnPage - 1) * RETURN_PAGE_SIZE, safeReturnPage * RETURN_PAGE_SIZE);
  const pagedForReprint = filteredForReprint.slice((safeReprintPage - 1) * REPRINT_PAGE_SIZE, safeReprintPage * REPRINT_PAGE_SIZE);

  useEffect(() => {
    setReturnPage(1);
  }, [returnDiskSearchQuery]);

  useEffect(() => {
    setReprintPage(1);
  }, [reprintSearchQuery]);

  useEffect(() => {
    if (returnPage !== safeReturnPage) {
      setReturnPage(safeReturnPage);
    }
  }, [returnPage, safeReturnPage]);

  useEffect(() => {
    if (reprintPage !== safeReprintPage) {
      setReprintPage(safeReprintPage);
    }
  }, [reprintPage, safeReprintPage]);

  useEffect(() => {
    if (webcamError) {
      setCaptureInfoTab('errors');
      return;
    }
    if (isScanning || barcodeHints.length > 0 || scanResult) {
      setCaptureInfoTab('barcode');
      return;
    }
  }, [webcamError, barcodeHints, isScanning, scanResult]);

  const handleResetIntakeForm = () => {
    stopWebcam();
    setDiskForm({
      id: '',
      hd_manufacturer: 'N/A',
      hd_model: 'N/A',
      hd_serial: 'N/A',
      hd_size: '8TB',
      hd_speed: '7200 RPM',
      source_requested_id: '',
      status: 'received',
      received_time: '',
      hd_image: ''
    });
    setScanImageBase64(null);
    setCapturedImageDataUrl('');
    setScanResult(null);
    setScanSkipWarning(false);
    setBarcodeHints([]);
    setIntakeStep(1);
    setIntakeSuccessRecord(null);
    setShowIntakePreview(false);
  };

  const escapeHtml = (value: unknown) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const addWhiteBleed = (dataUrl: string, bleedPx = 5) => new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width + (bleedPx * 2);
      canvas.height = img.height + (bleedPx * 2);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context unavailable for white bleed'));
        return;
      }

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, bleedPx, bleedPx);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Failed to load label image for white bleed'));
    img.src = dataUrl;
  });

  const handleThermalPrint = async () => {
    if (!printedTicketDisk) return;

    if (!tagPrintCardRef.current || !ticketPrintCardRef.current) {
      alert('Print layout is not ready yet. Please try again.');
      return;
    }

    const renderLabelCardToPng = async (cardNode: HTMLDivElement, backgroundColor: string) => {
      const rect = cardNode.getBoundingClientRect();
      return toPng(cardNode, {
        cacheBust: true,
        pixelRatio: 2,
        skipAutoScale: true,
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height)),
        canvasWidth: Math.max(1, Math.round(rect.width)),
        canvasHeight: Math.max(1, Math.round(rect.height)),
        style: {
          margin: '0',
          boxShadow: 'none'
        },
        backgroundColor
      });
    };

    let tagPng = '';
    let ticketPng = '';
    try {
      tagPng = await renderLabelCardToPng(tagPrintCardRef.current, '#ffffff');
      ticketPng = await renderLabelCardToPng(ticketPrintCardRef.current, '#ecfdf5');
    } catch (err) {
      console.error('Failed to generate print images:', err);
      alert('Could not build label images for printing. Please retry.');
      return;
    }

    const rotateImageClockwise = (dataUrl: string) => new Promise<string>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.height;
        canvas.height = img.width;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }
        ctx.translate(canvas.width, 0);
        ctx.rotate(Math.PI / 2);
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('Failed to load label image for rotation'));
      img.src = dataUrl;
    });

    const trimVisibleMargins = (dataUrl: string) => new Promise<string>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable for trim'));
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const { data, width, height } = imageData;

        let minX = width;
        let minY = height;
        let maxX = -1;
        let maxY = -1;

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const alpha = data[i + 3];
            // Keep only visible printable content (non-transparent and not near-white).
            if (alpha > 8 && !(r > 248 && g > 248 && b > 248)) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }

        if (maxX < minX || maxY < minY) {
          // Fallback for mostly-white images: preserve original rather than over-cropping.
          resolve(dataUrl);
          return;
        }

        const croppedWidth = maxX - minX + 1;
        const croppedHeight = maxY - minY + 1;
        const outCanvas = document.createElement('canvas');
        outCanvas.width = croppedWidth;
        outCanvas.height = croppedHeight;
        const outCtx = outCanvas.getContext('2d');
        if (!outCtx) {
          reject(new Error('Canvas context unavailable for cropped output'));
          return;
        }

        outCtx.drawImage(canvas, minX, minY, croppedWidth, croppedHeight, 0, 0, croppedWidth, croppedHeight);
        resolve(outCanvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('Failed to load label image for visible-bound trim'));
      img.src = dataUrl;
    });

    const normalizeForThermalSize = (dataUrl: string, targetWidthMm = 80, targetHeightMm = 62) => new Promise<string>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        if (!img.width || !img.height) {
          reject(new Error('Invalid label dimensions for thermal normalization'));
          return;
        }

        const thermalDpi = 203;
        const targetWidthPx = Math.max(1, Math.round((targetWidthMm / 25.4) * thermalDpi));
        const targetHeightPx = Math.max(1, Math.round((targetHeightMm / 25.4) * thermalDpi));
        const canvas = document.createElement('canvas');
        canvas.width = targetWidthPx;
        canvas.height = targetHeightPx;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable for thermal normalization'));
          return;
        }

        // Paint opaque white first so thermal drivers do not reinterpret transparent edges.
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, targetWidthPx, targetHeightPx);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('Failed to load label image for thermal normalization'));
      img.src = dataUrl;
    });

    const applyPrintCalibrationShift = (dataUrl: string, shiftYmm = 0, shiftXmm = 0) => new Promise<string>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable for print calibration shift'));
          return;
        }

        // Requested calibration: move print content toward top of rotated image (left on ticket).
        const thermalDpi = 203;
        const requestedShiftYpx = Math.round((shiftYmm / 25.4) * thermalDpi);
        const requestedShiftXpx = Math.round((shiftXmm / 25.4) * thermalDpi);
        // Keep content shift as a fine adjustment only; large shifts clip most of the label image.
        const maxMagnitudeYpx = Math.floor(img.height * 0.16);
        const maxMagnitudeXpx = Math.floor(img.width * 0.95);
        const shiftYpx = Math.max(-maxMagnitudeYpx, Math.min(requestedShiftYpx, maxMagnitudeYpx));
        const shiftXpx = Math.max(-maxMagnitudeXpx, Math.min(requestedShiftXpx, maxMagnitudeXpx));
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // Positive X shift moves content left; positive Y shift moves content up.
        ctx.drawImage(img, -shiftXpx, -shiftYpx, img.width, img.height);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('Failed to load label image for print calibration'));
      img.src = dataUrl;
    });

    let rotatedTagPng = '';
    let rotatedTicketPng = '';
    let finalTagPng = '';
    let finalTicketPng = '';
    try {
      rotatedTagPng = await rotateImageClockwise(tagPng);
      rotatedTicketPng = await rotateImageClockwise(ticketPng);
      const trimmedTagPng = await trimVisibleMargins(rotatedTagPng);
      const trimmedTicketPng = await trimVisibleMargins(rotatedTicketPng);
      const normalizedTagPng = await normalizeForThermalSize(trimmedTagPng, 62, 100);
      const normalizedTicketPng = await normalizeForThermalSize(trimmedTicketPng, 62, 100);
      finalTagPng = await applyPrintCalibrationShift(normalizedTagPng, printContentShiftMm, printContentShiftXMm);
      finalTicketPng = await applyPrintCalibrationShift(normalizedTicketPng, printContentShiftMm, printContentShiftXMm);
    } catch (err) {
      console.error('Failed to prepare print images:', err);
      alert('Could not prepare label images for printing. Please retry.');
      return;
    }

    const printTopOffsetMm = printSheetOffsetMm;
    const printOffsetXmm = printSheetOffsetXMm;

    const createPrintWindow = (title: string, imageDataUrl: string, altText: string) => {
      const printWindow = window.open('', title, 'width=420,height=980');
      if (!printWindow) {
        throw new Error('Unable to open print window. Please allow popups and try again.');
      }

      const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page {
      size: 62mm 100mm;
      margin: 0;
    }
    html,
    body {
      margin: 0;
      padding: 0;
      width: 62mm;
      height: 100mm;
      min-width: 62mm;
      max-width: 62mm;
      min-height: 100mm;
      max-height: 100mm;
      overflow: hidden;
      background: #ffffff;
    }
    * {
      box-sizing: border-box;
    }
    body {
      font-family: Arial, Helvetica, sans-serif;
    }
    .sheet {
      display: block;
      width: 100%;
      margin: 0;
      padding: 0;
      position: relative;
      left: ${printOffsetXmm}mm;
      top: ${printTopOffsetMm}mm;
      border: 1px solid #e2e8f0;
      box-sizing: border-box;
    }
    .label {
      display: block;
      width: 100%;
      margin: 0;
      padding: 0;
      overflow: hidden;
      position: relative;
    }
    .label img {
      display: block;
      width: 62mm;
      height: 100mm;
      max-width: 62mm;
      max-height: 100mm;
      object-fit: cover;
      margin: 0;
      padding: 0;
      background: #ffffff;
    }
    .label::after {
      content: '62 mm × 100 mm';
      position: absolute;
      right: 1.5mm;
      bottom: 1.2mm;
      font-size: 2.4mm;
      letter-spacing: 0.08em;
      color: #64748b;
      background: rgba(255,255,255,0.85);
      padding: 0.4mm 1mm;
      border-radius: 0.8mm;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <div class="sheet">
    <section class="label"><img src="${escapeHtml(imageDataUrl)}" alt="${escapeHtml(altText)}" /></section>
  </div>
  <script>
    window.addEventListener('load', function () {
      window.focus();
      setTimeout(function () {
        window.print();
      }, 80);
      window.addEventListener('afterprint', function () {
        window.close();
      });
    });
  </script>
</body>
</html>`;

      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
    };

    try {
      const tagBleedPng = await addWhiteBleed(finalTagPng, 5);
      const ticketBleedPng = await addWhiteBleed(finalTicketPng, 5);
      createPrintWindow('ddv-thermal-print-tag', tagBleedPng, 'Tag');
      createPrintWindow('ddv-thermal-print-ticket', ticketBleedPng, 'Ticket');
    } catch (err) {
      console.error('Failed to create print jobs:', err);
      alert(err instanceof Error ? err.message : 'Unable to open print jobs. Please try again.');
    }
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
            className={`flex-1 sm:flex-initial min-h-12 flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-bold rounded-md transition-all cursor-pointer ${
              posTab === 'intake' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            <Plus className="h-3.5 w-3.5 text-blue-400" />
            <span>Intake Desk</span>
          </button>
          <button
            onClick={() => { setPosTab('edit'); }}
            className={`flex-1 sm:flex-initial min-h-12 flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-bold rounded-md transition-all cursor-pointer ${
              posTab === 'edit' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            <Search className="h-3.5 w-3.5 text-blue-400" />
            <span>Edit Existing Drive</span>
          </button>
          <button
            onClick={() => { setPosTab('return'); }}
            className={`flex-1 sm:flex-initial min-h-12 flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-bold rounded-md transition-all cursor-pointer ${
              posTab === 'return' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            <RefreshCw className="h-3.5 w-3.5 text-blue-400" />
            <span>Return & Release</span>
          </button>
          <button
            onClick={() => { setPosTab('reprint'); }}
            className={`flex-1 sm:flex-initial min-h-12 flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-bold rounded-md transition-all cursor-pointer ${
              posTab === 'reprint' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            <Barcode className="h-3.5 w-3.5 text-blue-400" />
            <span>Print Tags</span>
          </button>
        </div>
      </div>

      {posTab === 'edit' && (
        <div className="grid grid-cols-1 gap-6">
          <div className="bg-[#16161A] rounded-xl border border-[#2A2A2E] p-6 shadow-md">
            <div className="mb-6 rounded-xl border border-blue-900/40 bg-[#0E0E10] p-4 space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-200">Edit existing drive record</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Search by sequence ID or serial number to review the current status and correct drive metadata, source assignment, or workflow state.
                  </p>
                </div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-blue-400">VOLUNTEER CORRECTIONS</div>
              </div>

              <form onSubmit={handleLookupDisk} className="flex flex-col gap-3 sm:flex-row">
                <label className="flex-1">
                  <span className="sr-only">Drive lookup</span>
                  <input
                    type="text"
                    value={lookupQuery}
                    onChange={(e) => setLookupQuery(e.target.value)}
                    placeholder="Enter drive ID or serial number"
                    className="w-full bg-[#111113] border border-[#2A2A2E] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </label>
                <button
                  type="submit"
                  disabled={isLookupLoading}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-500 disabled:opacity-50"
                >
                  {isLookupLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                  Lookup
                </button>
              </form>

              {lookupError && (
                <div className="rounded-lg border border-rose-900/40 bg-rose-950/20 p-3 text-xs text-rose-300">
                  {lookupError}
                </div>
              )}

              {lookupResult && lookupTarget && (
                <div className="space-y-4 rounded-xl border border-[#2A2A2E] bg-[#111113] p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Current status</span>
                        <span className="rounded-full border border-blue-900/40 bg-blue-950/40 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-blue-300">
                          {lookupForm.status}
                        </span>
                      </div>
                      <div className="text-sm font-black text-white">{lookupTarget.id}</div>
                      <div className="text-xs text-slate-400">
                        {lookupTarget.hd_manufacturer} {lookupTarget.hd_model} • S/N {lookupTarget.hd_serial}
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      <div>Last updated: {lookupTarget.received_time ? new Date(lookupTarget.received_time).toLocaleString() : 'Unknown'}</div>
                      <div className="mt-1">Current location: {lookupTarget.current_location || lookupTarget.location || 'Unknown'}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                    <div className="rounded-xl border border-[#2A2A2E] bg-[#0E0E10] p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-black">Current drive image</span>
                        {lookupTarget.hd_image ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setLookupImageZoom(value => Math.max(1, Number((value - 0.25).toFixed(2))))}
                              className="rounded border border-[#2A2A2E] bg-[#111113] p-1 text-slate-400 transition hover:text-white"
                              aria-label="Zoom out"
                            >
                              <ZoomOut className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setLookupImageZoom(1)}
                              className="rounded border border-[#2A2A2E] bg-[#111113] p-1 text-slate-400 transition hover:text-white"
                              aria-label="Reset zoom"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setLookupImageZoom(value => Number((value + 0.25).toFixed(2)))}
                              className="rounded border border-[#2A2A2E] bg-[#111113] p-1 text-slate-400 transition hover:text-white"
                              aria-label="Zoom in"
                            >
                              <ZoomIn className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : null}
                      </div>
                      {lookupTarget.hd_image ? (
                        <div className="overflow-auto rounded-lg border border-[#2A2A2E] bg-[#060708] p-2">
                          <div className="flex min-h-[280px] items-center justify-center">
                            <img
                              src={lookupTarget.hd_image}
                              alt="Current drive image"
                              className="max-h-[280px] w-auto rounded object-contain shadow-sm transition-transform duration-200"
                              style={{ transform: `scale(${lookupImageZoom})` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="flex min-h-[280px] items-center justify-center rounded-lg border border-dashed border-[#2A2A2E] bg-[#060708] p-4 text-center text-[11px] text-slate-500">
                          No drive image saved for this record.
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="mb-1 block text-[10px] font-mono uppercase text-slate-400 font-black">Manufacturer</label>
                        <input
                          type="text"
                          list="volunteer-manufacturer-options"
                          value={lookupForm.hd_manufacturer}
                          onChange={(e) => setLookupForm({ ...lookupForm, hd_manufacturer: e.target.value })}
                          className="w-full rounded-lg border border-[#2A2A2E] bg-[#0E0E10] px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <datalist id="volunteer-manufacturer-options">
                          {['Seagate', 'Toshiba', 'Western Digital', 'Samsung', 'Dell', 'MDD'].map(option => (
                            <option key={option} value={option} />
                          ))}
                        </datalist>
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-mono uppercase text-slate-400 font-black">Model</label>
                        <input
                          type="text"
                          value={lookupForm.hd_model}
                          onChange={(e) => setLookupForm({ ...lookupForm, hd_model: e.target.value })}
                          className="w-full rounded-lg border border-[#2A2A2E] bg-[#0E0E10] px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-mono uppercase text-slate-400 font-black">Serial number</label>
                        <input
                          type="text"
                          value={lookupForm.hd_serial}
                          onChange={(e) => setLookupForm({ ...lookupForm, hd_serial: e.target.value })}
                          className="w-full rounded-lg border border-[#2A2A2E] bg-[#0E0E10] px-3 py-2 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-mono uppercase text-slate-400 font-black">Capacity</label>
                        <select
                          value={lookupForm.hd_size}
                          onChange={(e) => setLookupForm({ ...lookupForm, hd_size: e.target.value })}
                          className="w-full rounded-lg border border-[#2A2A2E] bg-[#0E0E10] px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          {['4TB', '6TB', '8TB', '10TB', '12TB', '16TB', '18TB', '20TB', '24TB'].map(size => <option key={size} value={size}>{size}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-mono uppercase text-slate-400 font-black">Speed</label>
                        <input
                          type="text"
                          value={lookupForm.hd_speed}
                          onChange={(e) => setLookupForm({ ...lookupForm, hd_speed: e.target.value })}
                          className="w-full rounded-lg border border-[#2A2A2E] bg-[#0E0E10] px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-mono uppercase text-slate-400 font-black">Source dataset</label>
                        <select
                          value={lookupForm.source_requested_id}
                          onChange={(e) => setLookupForm({ ...lookupForm, source_requested_id: e.target.value })}
                          className="w-full rounded-lg border border-[#2A2A2E] bg-[#0E0E10] px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">Select a source…</option>
                          {(datasources.length > 0 ? datasources : ['A', 'B', 'C', 'D', 'E'].map(l => ({
                            id: `DS-${l}`,
                            name: `Source ${l}`,
                            description: 'External Allocation',
                            required_specs: { interface: 'SATA 3', size_options: [l === 'B' || l === 'C' ? '6TB' : '8TB'] }
                          }))).map(source => (
                            <option key={source.id} value={source.id}>{source.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-mono uppercase text-slate-400 font-black">Drive status</label>
                        <select
                          value={lookupForm.status}
                          onChange={(e) => setLookupForm({ ...lookupForm, status: e.target.value as Disk['status'] })}
                          className="w-full rounded-lg border border-[#2A2A2E] bg-[#0E0E10] px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          {['received','copying','completed','failed','picked_up'].map(status => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {lookupForm.source_requested_id && (() => {
                    const matchingSource = datasources.find(src => src.id === lookupForm.source_requested_id);
                    const isCompatible = meetsSourceMinimum(matchingSource, lookupForm.hd_size);
                    const minTB = getSourceMinSizeTB(matchingSource);
                    return (
                      <div className={`rounded-lg border p-3 text-[11px] ${isCompatible ? 'border-emerald-900/40 bg-emerald-950/20 text-emerald-300' : 'border-amber-900/40 bg-amber-950/20 text-amber-300'}`}>
                        {isCompatible ? 'Drive meets the source minimum size requirement.' : `Selected source requires a minimum drive size of ${Number.isNaN(minTB) ? 'the configured minimum' : `${minTB}TB`}.`}
                      </div>
                    );
                  })()}

                  <div className="flex flex-col gap-3 border-t border-[#2A2A2E] pt-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-[10px] text-slate-500 font-mono">
                      {lookupResult.status_logs?.slice(0, 3).map(log => (
                        <div key={log.id} className="mt-1 first:mt-0">
                          <span className="text-slate-400">{new Date(log.timestamp).toLocaleString()}</span> • {log.status} • {log.operator}
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      disabled={isLookupSaving}
                      onClick={handleLookupSave}
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                    >
                      {isLookupSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      Save corrections
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {posTab === 'intake' && (
        <div className="grid grid-cols-1 gap-6">
          <div className="bg-[#16161A] rounded-xl border border-[#2A2A2E] p-6 shadow-md">
            {/* STEP 1: SCAN & OCR CAPTURE */}
            {intakeStep === 1 && (
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b border-[#2A2A2E] pb-3">
                  <h4 className="text-sm font-bold text-slate-200">Step 1: Capture Drive Information</h4>
                  <div className="flex items-center gap-2">
                    {(isWebcamActive || scanImageBase64 || scanResult || diskForm.hd_serial || diskForm.hd_model) && (
                      <button
                        type="button"
                        onClick={handleResetIntakeForm}
                        className="inline-flex items-center justify-center min-h-12 px-5 py-2.5 bg-[#0E0E10] border border-[#2A2A2E] hover:bg-slate-800 text-slate-200 font-black text-sm rounded-xl cursor-pointer"
                      >
                        Start Over
                      </button>
                    )}
                    <span className="text-[10px] font-mono bg-blue-950/50 text-blue-400 border border-blue-900/40 px-2 py-0.5 rounded">AUTO-SCANNER</span>
                  </div>
                </div>

                <div className="bg-[#0E0E10] border border-[#2A2A2E] rounded-xl p-4 text-center space-y-3">
                  {/* Webcam Interface */}
                  {isWebcamActive ? (
                    <div className="bg-[#111113] border border-blue-900/40 rounded-xl overflow-hidden p-3 max-w-[500px] mx-auto">
                      <div className="flex items-start gap-2.5">
                        <div className="flex-1 text-left">
                          <div className="relative bg-black rounded-lg border border-[#2A2A2E] flex items-center justify-center w-full max-w-[235px] h-[270px] mx-auto sm:mx-0">
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
                                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                                <div className="absolute inset-0 border-2 border-dashed border-blue-500/40 pointer-events-none m-4 rounded flex items-center justify-center">
                                  <div className="text-[10px] bg-blue-950/80 text-blue-400 font-mono px-2 py-1 rounded border border-blue-900/50 uppercase tracking-widest animate-pulse">
                                    Align Vertical Label In Frame
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="w-56 min-h-[270px] flex flex-col justify-between gap-2">
                          <div className="border border-[#2A2A2E] rounded-lg bg-[#0E0E10] p-2">
                            <div className="grid grid-cols-3 gap-1">
                              <button
                                type="button"
                                onClick={() => setCaptureInfoTab('errors')}
                                className={`min-h-8 px-1.5 py-1 text-[10px] font-bold rounded ${captureInfoTab === 'errors' ? 'bg-rose-900/40 text-rose-200 border border-rose-700/50' : 'bg-[#111113] text-slate-400 border border-[#2A2A2E]'}`}
                              >
                                Errors
                              </button>
                              <button
                                type="button"
                                onClick={() => setCaptureInfoTab('barcode')}
                                className={`min-h-8 px-1.5 py-1 text-[10px] font-bold rounded ${captureInfoTab === 'barcode' ? 'bg-blue-900/40 text-blue-200 border border-blue-700/50' : 'bg-[#111113] text-slate-400 border border-[#2A2A2E]'}`}
                              >
                                Barcode
                              </button>
                              <button
                                type="button"
                                onClick={() => setCaptureInfoTab('ocr')}
                                className={`min-h-8 px-1.5 py-1 text-[10px] font-bold rounded ${captureInfoTab === 'ocr' ? 'bg-emerald-900/40 text-emerald-200 border border-emerald-700/50' : 'bg-[#111113] text-slate-400 border border-[#2A2A2E]'}`}
                              >
                                OCR (Paused)
                              </button>
                            </div>

                            <div className="mt-2 h-36 overflow-y-auto pr-1 text-xs">
                              {captureInfoTab === 'errors' && (
                                webcamError ? (
                                  <div className="text-red-300 bg-red-950/20 border border-red-900/40 p-2.5 rounded-md flex items-start gap-2">
                                    <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0 text-red-400" />
                                    <span>{webcamError}</span>
                                  </div>
                                ) : (
                                  <div className="text-slate-400 bg-[#111113] border border-[#2A2A2E] p-2.5 rounded-md">No capture errors.</div>
                                )
                              )}

                              {captureInfoTab === 'barcode' && (
                                barcodeHints.length > 0 ? (
                                  <div className="text-blue-200 bg-blue-950/20 border border-blue-900/40 p-2.5 rounded-md space-y-1">
                                    <div className="font-bold text-blue-300 uppercase tracking-wider text-[10px]">Barcode Review</div>
                                    {barcodeHints.slice(0, 5).map((hint, idx) => (
                                      <div key={`${hint}-${idx}`} className="leading-snug">{hint}</div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-slate-400 bg-[#111113] border border-[#2A2A2E] p-2.5 rounded-md">No barcode data found yet.</div>
                                )
                              )}

                              {captureInfoTab === 'ocr' && (
                                <div className="text-slate-300 bg-[#111113] border border-[#2A2A2E] p-2.5 rounded-md">
                                  OCR extraction is paused. Intake currently uses barcode-only decoding.
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={captureWebcam}
                            className="min-h-12 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-sm font-bold text-white rounded-lg shadow cursor-pointer transition flex items-center justify-center gap-1.5"
                          >
                            <Camera className="h-3.5 w-3.5" />
                            Capture
                          </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-3 max-w-5xl mx-auto text-left">
                      <div className="bg-[#111113] border border-[#2A2A2E] rounded-xl p-3 space-y-2.5">
                        <div className="text-[10px] font-mono font-black uppercase tracking-wider text-slate-400">Captured Drive Image + Alerts</div>
                        <div className="w-full max-w-[220px] h-[294px] mx-auto rounded-lg border border-slate-700 bg-black/20 flex items-center justify-center overflow-hidden">
                          {intakePreviewImage ? (
                            <img
                              src={intakePreviewImage}
                              alt="Captured drive for intake review"
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <div className="text-center text-slate-500 px-4">
                              <div className="text-xs font-bold">No image captured yet</div>
                              <div className="text-[10px] mt-1 font-mono">Use camera scan or browse photo to load a sticker image.</div>
                            </div>
                          )}
                        </div>

                        {intakePreviewImage && (
                          <div className="bg-[#0E0E10] p-2 rounded-lg border border-[#2A2A2E] text-[11px]">
                            <div className="text-slate-200 font-semibold">Asset label photograph loaded</div>
                            <div className="text-slate-500 font-mono text-[10px]">Image retained for assignment review and final save.</div>
                          </div>
                        )}

                        {scanResult && getUncapturedFields(scanResult).length > 0 && !scanSkipWarning && (
                          <div className="bg-amber-950/35 border border-amber-900/40 text-amber-200 p-2.5 rounded-lg text-xs space-y-2">
                            <div className="font-extrabold flex items-center gap-2 text-[11px] text-amber-300 tracking-wider font-mono">
                              <ShieldAlert className="h-4 w-4 text-amber-400" />
                              SCAN WARNING: UNRESOLVED DRIVE COMPONENTS
                            </div>
                            <div className="bg-slate-900/50 p-2 rounded border border-amber-900/30 text-[11px]">
                              Missing fields identified: <strong className="text-amber-300">{getUncapturedFields(scanResult).join(', ')}</strong>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => setScanSkipWarning(true)}
                                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-black rounded text-[11px] uppercase cursor-pointer"
                              >
                                Force manual correction edit
                              </button>
                              <button
                                type="button"
                                onClick={() => { setScanResult(null); setScanImageBase64(null); setCapturedImageDataUrl(''); setDiskForm(prev => ({ ...prev, hd_image: '' })); }}
                                className="px-3 py-1.5 bg-[#16161A] border border-amber-900/30 text-amber-400 rounded text-[11px] font-bold"
                              >
                                Discard & Rescan
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-2 justify-center items-stretch">
                        <button
                          type="button"
                          onClick={startWebcam}
                          className="inline-flex min-h-12 items-center justify-center gap-2 px-4 py-3 border border-blue-900/50 bg-blue-950/30 text-blue-400 rounded-lg text-sm font-bold hover:bg-blue-950/50 cursor-pointer shadow-md transition"
                        >
                          <Camera className="h-3.5 w-3.5" />
                          Scan with Live Webcam...
                        </button>

                        <input type="file" accept="image/*,.heic,.heif,image/heic,image/heif" onChange={handleImageFileSelect} id="pos-disk-label-upload" className="hidden" />
                        <label htmlFor="pos-disk-label-upload" className="inline-flex min-h-12 items-center justify-center gap-2 px-4 py-3 border border-slate-700 bg-[#16161A] text-slate-200 rounded-lg text-sm font-bold hover:bg-[#1D1D22] cursor-pointer shadow-md transition">
                          <Upload className="h-3 w-3 text-slate-400" />
                          Browse Physical Photo...
                        </label>

                        <button
                          type="button"
                          onClick={() => handleLoadMockLabel('seagate_8tb')}
                          className="min-h-12 px-4 py-3 border border-dashed border-blue-900 bg-blue-950/20 text-blue-400 text-sm font-black rounded-lg hover:bg-blue-950/40 transition cursor-pointer"
                        >
                          Simulate Seagate 8TB Scan
                        </button>
                        <button
                          type="button"
                          onClick={() => handleLoadMockLabel('wd_6tb')}
                          className="min-h-12 px-4 py-3 border border-dashed border-purple-900 bg-purple-950/20 text-purple-400 text-sm font-black rounded-lg hover:bg-purple-950/40 transition cursor-pointer"
                        >
                          Simulate WD 6TB Scan
                        </button>
                        <button
                          type="button"
                          onClick={() => handleLoadMockLabel('mismatched_unrecognized')}
                          className="min-h-12 px-4 py-3 border border-dashed border-amber-900 bg-amber-950/20 text-amber-400 text-sm font-black rounded-lg hover:bg-amber-950/40 transition cursor-pointer"
                        >
                          Simulate Mismatched Scan
                        </button>
                      </div>
                    </div>
                  )}

                  {scanResult && (() => {
                    const uncaptured = getUncapturedFields(scanResult);
                    const normalizedSerial = String(diskForm.hd_serial || '').toLowerCase().trim();
                    const duplicateSerialDetected = normalizedSerial !== ''
                      && normalizedSerial !== 'n/a'
                      && disks.some(d => d.hd_serial.toLowerCase().trim() === normalizedSerial && d.hd_serial.trim() !== '' && d.hd_serial.toLowerCase().trim() !== 'n/a');
                    const duplicateNeedsAdminOverride = duplicateSerialDetected && !(currentUser?.role === 'admin' && adminOverrideDuplicateSerial);
                    if (uncaptured.length > 0 && !scanSkipWarning) {
                      return null;
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
                              list="volunteer-manufacturer-options"
                              value={diskForm.hd_manufacturer}
                              onChange={(e) => setDiskForm({...diskForm, hd_manufacturer: e.target.value})}
                              className="w-full bg-[#0E0E10] border border-[#2A2A2E] rounded-lg px-3 py-2 text-xs text-white focus:ring-1 focus:ring-blue-500"
                            />
                            <datalist id="volunteer-manufacturer-options">
                              {['Seagate', 'Toshiba', 'Western Digital', 'Samsung', 'Dell', 'MDD'].map(option => (
                                <option key={option} value={option} />
                              ))}
                            </datalist>
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
                            <div className="flex items-stretch gap-2">
                              <select
                                value={diskForm.hd_size}
                                onChange={(e) => setDiskForm({...diskForm, hd_size: e.target.value})}
                                className="flex-1 bg-[#0E0E10] border border-[#2A2A2E] rounded-lg px-3 py-2 text-xs text-white focus:ring-1 focus:ring-blue-500"
                              >
                                {['4TB', '6TB', '8TB', '10TB', '12TB', '16TB', '18TB', '20TB', '24TB'].map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                              <div className="grid grid-cols-2 gap-2 min-w-[166px]">
                                {['6TB', '8TB'].map(sizePreset => (
                                  <button
                                    key={sizePreset}
                                    type="button"
                                    onClick={() => setDiskForm({ ...diskForm, hd_size: sizePreset })}
                                    className={`min-h-10 rounded-lg border-2 px-2 text-[11px] font-black tracking-wide transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 ${
                                      diskForm.hd_size === sizePreset
                                        ? 'bg-cyan-300 border-cyan-100 text-slate-950 shadow-[0_0_0_1px_rgba(255,255,255,0.35),0_6px_16px_rgba(8,145,178,0.45)]'
                                        : 'bg-[#111113] border-[#3A3A40] text-slate-200 hover:border-slate-500 hover:bg-[#16161B]'
                                    }`}
                                  >
                                    {sizePreset}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Redundant Ingestion Safeguard */}
                        {duplicateSerialDetected && (
                          <div className="bg-rose-955/10 border border-rose-900/30 p-3.5 rounded-lg flex flex-col gap-2">
                            <div className="flex gap-2 text-rose-500 text-xs font-extrabold tracking-wider font-mono">
                              <ShieldAlert className="h-4.5 w-4.5" />
                              REDUNDANT INGESTION SAFEGUARD DETECTED
                            </div>
                            <p className="text-[11px] text-rose-300 leading-normal font-medium">
                              Redundant Ingestion Guard is active. Admin Authorization required to duplicate ingestion.
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
                            disabled={!diskForm.hd_serial || !diskForm.hd_manufacturer || duplicateNeedsAdminOverride}
                            onClick={() => setIntakeStep(2)}
                            className="inline-flex min-h-12 items-center gap-1 px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-bold text-white rounded-xl cursor-pointer shadow-md transition"
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
                  <h4 className="text-sm font-bold text-slate-200">Step 2:  Assign Source and Add to Database</h4>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleResetIntakeForm}
                      className="inline-flex items-center justify-center min-h-12 px-5 py-2.5 bg-[#0E0E10] border border-[#2A2A2E] hover:bg-slate-800 text-slate-200 font-black text-sm rounded-xl cursor-pointer"
                    >
                      Start Over
                    </button>
                    <span className="text-[10px] font-mono bg-blue-950/50 text-blue-400 border border-blue-900/40 px-2 py-0.5 rounded">100MM × 62MM LABEL PRINT READY</span>
                  </div>
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
                    {(() => {
                      const list = datasources.length > 0 ? datasources : ['A', 'B', 'C', 'D', 'E'].map(l => ({
                        id: `DS-${l}`,
                        name: `Source ${l}`,
                        description: 'External Allocation',
                        required_specs: { interface: 'SATA 3', size_options: [l === 'B' || l === 'C' ? '6TB' : '8TB'] }
                      }));

                      return list.map(source => {
                        const isSelected = diskForm.source_requested_id === source.id;
                        const isCompatible = meetsSourceMinimum(source, diskForm.hd_size);
                        const minTB = getSourceMinSizeTB(source);
                        
                        return (
                          <button
                            key={source.id}
                            type="button"
                            disabled={!isCompatible}
                            onClick={() => {
                              if (isCompatible) {
                                setDiskForm({...diskForm, source_requested_id: source.id});
                              }
                            }}
                            className={`min-h-28 p-5 rounded-xl border flex flex-col items-center justify-center gap-3 transition-all text-center relative ${
                              !isCompatible 
                                ? 'bg-rose-950/5 border-rose-955/20 opacity-40 cursor-not-allowed text-slate-500'
                                : isSelected 
                                  ? 'bg-blue-955/20 border-blue-500 ring-2 ring-blue-500/80 text-white cursor-pointer' 
                                  : 'bg-[#0E0E10] border-[#2A2A2E] hover:border-slate-700 text-slate-400 hover:text-white cursor-pointer'
                            }`}
                          >
                            <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-black transition-all ${
                              !isCompatible
                                ? 'bg-[#16161A] border border-[#2A2A2E] text-rose-450/60'
                                : isSelected ? 'bg-blue-600 text-white' : 'bg-[#16161A] border border-[#2A2A2E] text-slate-300'
                            }`}>
                              {source.name.replace('Source ', '')}
                            </div>
                            <div>
                              <span className="font-sans font-extrabold text-xs block">{source.name}</span>
                              {isCompatible ? (
                                <span className="text-[9px] text-slate-500 font-mono mt-0.5 block">Compatible</span>
                              ) : (
                                <span className="text-[8px] text-rose-450 font-bold font-mono mt-0.5 block leading-tight">
                                  Min {Number.isNaN(minTB) ? '?' : minTB}TB required
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      });
                    })()}
                  </div>
                </div>

                {diskForm.source_requested_id && (
                  <div className="space-y-3 border-t border-[#2A2A2E] pt-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-400 font-mono tracking-wider uppercase">Live Tag & Ticket Output Preview:</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowIntakePreview(prev => !prev)}
                          className="min-h-10 px-3 py-2 bg-[#16161A] border border-[#2A2A2E] text-xs font-bold text-slate-200 rounded-lg hover:bg-slate-800"
                        >
                          {showIntakePreview ? 'Hide Preview' : 'Show Preview'}
                        </button>
                        <span className="text-[9px] bg-amber-950/45 text-amber-400 font-mono px-2 py-0.5 rounded border border-amber-900/40">READY FOR PRINT</span>
                      </div>
                    </div>
                    {showIntakePreview && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center justify-center">
                        <PrintLabelCard
                          variant="tag"
                          data={{
                            id: diskForm.id || 'PREVIEW',
                            source_requested_id: diskForm.source_requested_id || 'PENDING',
                            hd_serial: diskForm.hd_serial || 'PENDING',
                            received_time: diskForm.received_time || new Date().toISOString(),
                            hd_image: intakePreviewImage || null
                          }}
                          imageSource={intakePreviewImage || undefined}
                          className="mx-auto"
                        />

                        <PrintLabelCard
                          variant="ticket"
                          data={{
                            id: diskForm.id || 'PREVIEW',
                            source_requested_id: diskForm.source_requested_id || 'PENDING',
                            received_time: diskForm.received_time || new Date().toISOString()
                          }}
                          className="mx-auto"
                        />
                      </div>
                    )}
                  </div>
                )}

                <div className="h-3" aria-hidden="true" />

                <div className="flex justify-between pt-4 border-t border-[#2A2A2E]">
                  <button
                    type="button"
                    onClick={() => setIntakeStep(1)}
                    className="min-h-12 px-5 py-3 bg-[#0E0E10] border border-[#2A2A2E] text-sm font-semibold text-slate-300 hover:text-white rounded-xl transition cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={!diskForm.source_requested_id || isLoading}
                    onClick={handlePOSIntakeSubmit}
                    className="inline-flex min-h-12 items-center gap-1.5 px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-bold text-white rounded-xl cursor-pointer transition shadow-md"
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

            {/* STEP 4: PRINT REVIEW + DECISION */}
            {intakeStep === 4 && intakeSuccessRecord && (
              <div className="space-y-5">
                <div className="border-b border-[#2A2A2E] pb-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div>
                    <h3 className="text-base font-black font-sans text-white uppercase tracking-tight">Tag & Ticket Printing</h3>
                    <p className="text-xs text-slate-400 mt-1">Review label output, print, then return to intake when done.</p>
                    {currentUser?.role === 'admin' && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-mono">
                        <span className="text-slate-400">Alignment</span>
                        <button
                          type="button"
                          onClick={() => {
                            setPrintContentShiftMm(0);
                            setPrintContentShiftXMm(0);
                            setPrintSheetOffsetMm(0);
                            setPrintSheetOffsetXMm(0);
                          }}
                          className="px-2 py-1 rounded border border-amber-900/40 bg-amber-950/20 text-amber-300 hover:bg-amber-900/30"
                        >
                          Reset Align
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-end">
                    <button
                      type="button"
                      onClick={handleThermalPrint}
                      autoFocus
                      className="inline-flex items-center justify-center min-h-12 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black text-sm rounded-xl cursor-pointer ring-2 ring-blue-300 shadow-lg shadow-blue-900/30"
                    >
                      🖨️ Print
                    </button>
                    <button
                      type="button"
                      onClick={handleResetIntakeForm}
                      className="px-6 py-3 min-h-12 bg-[#0E0E10] border border-[#2A2A2E] hover:bg-slate-800 text-slate-200 font-black text-sm rounded-xl cursor-pointer"
                    >
                      Back to Intake
                    </button>
                  </div>
                </div>

                {printedTicketDisk && (
                  <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start">
                    <div className="space-y-6">
                      <PrintLabelCard
                        ref={tagPrintCardRef}
                        variant="tag"
                        data={printedTicketDisk}
                        imageSource={printedTicketDisk.hd_image || capturedImageDataUrl || scanImageBase64 || undefined}
                        className="mx-auto"
                      />

                      <PrintLabelCard
                        ref={ticketPrintCardRef}
                        variant="ticket"
                        data={printedTicketDisk}
                        className="mx-auto"
                      />
                    </div>

                    <div className="bg-[#0E0E10] border border-[#2A2A2E] rounded-xl p-4 space-y-3">
                      <div className="inline-flex items-center justify-center p-2 rounded-full bg-emerald-950/45 text-emerald-400 border border-emerald-900/30">
                        <CheckCircle className="h-5 w-5 text-emerald-400" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-white uppercase tracking-tight">Ingestion Transaction Committed OK</h4>
                        <p className="text-[11px] text-slate-400 mt-1">Drive registered in the master ledger and ready for tag/ticket handoff.</p>
                      </div>
                      <div className="bg-[#111113] p-3 rounded-lg border border-[#2A2A2E] space-y-2 text-[11px] font-mono">
                        <div className="text-slate-500 font-bold border-b border-[#2A2A2E] pb-1 text-[10px] uppercase">Record Metrics</div>
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-400">Ledger ID:</span>
                          <span className="text-white font-bold text-right break-all">{printedTicketDisk.id}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-400">Serial:</span>
                          <span className="text-white font-bold text-right break-all">{printedTicketDisk.hd_serial || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-400">Status:</span>
                          <span className="text-emerald-400 font-bold uppercase">Received</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* STEP 5: SUCCESS SUMMARY */}
            {intakeStep === 5 && intakeSuccessRecord && (
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
                    onClick={() => setIntakeStep(4)}
                    className="inline-flex items-center justify-center min-h-12 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black text-sm rounded-xl cursor-pointer"
                  >
                    Re-open Label Layout
                  </button>
                  <button
                    type="button"
                    onClick={handleResetIntakeForm}
                    autoFocus
                    className="px-6 py-3 min-h-12 bg-emerald-600 border border-emerald-500 hover:bg-emerald-500 text-white font-black text-sm rounded-xl cursor-pointer shadow-lg shadow-emerald-900/30 ring-2 ring-emerald-400/60"
                  >
                    Start Next Ingestion ⚡
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {posTab === 'return' && (
        <div className="grid grid-cols-1 gap-6 animate-fadeIn">
          <div className="bg-[#16161A] rounded-xl border border-[#2A2A2E] p-6 shadow-md space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-[#2A2A2E] pb-3 gap-2">
              <div>
                <h4 className="text-sm font-bold text-slate-200">Reclaim physical drive owner release desk</h4>
                <p className="text-xs text-slate-400 mt-1 leading-normal">
                  Discharge the duplicated target hardware back into client possession. Discharges write signed-off transaction logs to the physical database.
                </p>
              </div>
              <span className="text-[10px] font-mono bg-blue-950/50 text-blue-400 border border-blue-900/40 px-2.5 py-1 rounded-full uppercase tracking-wider font-extrabold shrink-0">
                ⚡ Streamlined Release Operation
              </span>
            </div>

            {returnSuccessRecord && (
              <div className="p-4 bg-emerald-950/25 border border-emerald-900/30 text-emerald-400 rounded-xl text-xs space-y-2 animate-fadeIn text-center max-w-xl mx-auto">
                <span className="text-lg">✨</span>
                <h5 className="font-bold text-white uppercase font-mono text-[11px] tracking-wider">Discharge Transaction Logged</h5>
                <p className="text-slate-300">
                  Drive <b className="text-white font-mono">{returnSuccessRecord.diskId}</b> has been safely signed off and returned.
                </p>
                <div className="text-[10px] text-slate-400 font-mono">
                  Package details: {returnSuccessRecord.diskName}
                </div>
                <button
                  onClick={() => setReturnSuccessRecord(null)}
                  className="mt-2 text-[10px] bg-emerald-900/30 hover:bg-emerald-900/55 text-emerald-450 px-3 py-1 rounded border border-emerald-800 font-bold uppercase tracking-wide font-mono transition-all cursor-pointer inline-block"
                >
                  Clear Status & Scan Next Drive
                </button>
              </div>
            )}

            {/* IF A DRIVE IS SCANNED/SELECTED, SHOW LARGE CONFIRMATION PROMPT */}
            {selectedReturnDiskId ? (
              (() => {
                const activeDiskToReturn = disks.find(d => d.id === selectedReturnDiskId);
                if (!activeDiskToReturn) return null;
                const sourceDs = datasources.find(s => s.id === activeDiskToReturn.source_requested_id);
                const isCopyComplete = activeDiskToReturn.status === 'completed';

                return (
                  <div className="bg-[#111113] border-2 border-blue-500 rounded-xl p-6 shadow-2xl animate-scaleIn max-w-2xl mx-auto space-y-6">
                    <div className="flex items-center justify-between pb-3 border-b border-[#2A2A2E]">
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                        </span>
                        <h4 className="text-sm font-black font-mono text-blue-400 uppercase tracking-widest">
                          🔔 PROMPT: CONFIRM DRIVE RETURN & RELEASE
                        </h4>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 uppercase">
                        Ticket: {activeDiskToReturn.id.slice(0, 8)}...
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Left: Metadata */}
                      <div className="bg-[#0E0E10] p-4 rounded-lg border border-[#2A2A2E] space-y-3">
                        <div className="space-y-0.5">
                          <span className="text-[9px] font-mono uppercase text-slate-500 block">Sequence Disk ID</span>
                          <span className="text-xs font-black font-mono text-white block">{activeDiskToReturn.id}</span>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[9px] font-mono uppercase text-slate-500 block">Manufacturer / Model</span>
                          <span className="text-xs font-bold text-slate-200 block">
                            {activeDiskToReturn.hd_manufacturer} {activeDiskToReturn.hd_model}
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[9px] font-mono uppercase text-slate-500 block">Serial Number</span>
                          <span className="text-xs font-mono text-slate-300 block">{activeDiskToReturn.hd_serial}</span>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[9px] font-mono uppercase text-slate-500 block">Storage size / Speed</span>
                          <span className="text-xs text-slate-400 block">
                            {activeDiskToReturn.hd_size} | {activeDiskToReturn.hd_speed}
                          </span>
                        </div>
                      </div>

                      {/* Right: Operational Status */}
                      <div className="bg-[#0E0E10] p-4 rounded-lg border border-[#2A2A2E] flex flex-col justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-mono uppercase text-slate-500 block">Copy status</span>
                            <div className="text-[10px] font-mono text-slate-400 flex gap-1">
                              <span className="font-bold">Location:</span>
                              <span className="text-white">
                                {(() => {
                                  if (activeDiskToReturn.status === 'copying') {
                                    const dup = duplicators.find(dupItem => dupItem.id === activeDiskToReturn.duplicator_id);
                                    return dup ? dup.name : (activeDiskToReturn.duplicator_id || 'Duplicator Station');
                                  }
                                  switch (activeDiskToReturn.status) {
                                    case 'received': return 'Accepted Bin';
                                    case 'completed': return 'Complete Bin';
                                    case 'failed': return 'Failed Bin';
                                    case 'picked_up': return 'Returned';
                                    default: return 'Unknown';
                                  }
                                })()}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2.5 py-1 rounded font-black uppercase tracking-wider ${
                              isCopyComplete ? 'bg-emerald-950/80 text-emerald-450 border border-emerald-900/50' :
                              activeDiskToReturn.status === 'copying' ? 'bg-blue-950/80 text-blue-400 border border-blue-900/30' :
                              activeDiskToReturn.status === 'failed' ? 'bg-rose-950/80 text-rose-450 border border-rose-900/40 animate-pulse' :
                              'bg-slate-900 text-slate-350 border border-slate-800'
                            }`}>
                              {activeDiskToReturn.status}
                            </span>
                          </div>
                          
                          {/* Alert block if not completed */}
                          {!isCopyComplete && (
                            <div className="p-2.5 bg-amber-950/30 border border-amber-900/40 text-amber-400 rounded text-[10.5px] leading-relaxed flex gap-1.5">
                              <ShieldAlert className="h-4 w-4 shrink-0 text-amber-500" />
                              <span>
                                <b>Caution:</b> Copy status is <b>{activeDiskToReturn.status}</b>. Verify with tech desk before release!
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="space-y-1 text-left">
                          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5">
                            <span>Target:</span>
                            <span className="text-white font-extrabold truncate">{sourceDs ? sourceDs.name : 'None'}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            Ingested: {activeDiskToReturn.received_time ? new Date(activeDiskToReturn.received_time).toLocaleString() : 'Unknown'}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setSelectedReturnDiskId('')}
                        className="flex-1 min-h-12 py-3 bg-[#0E0E10] hover:bg-slate-800 border border-slate-700 hover:text-white text-slate-300 font-bold text-sm rounded-xl cursor-pointer transition uppercase tracking-wider text-center"
                      >
                        ❌ Cancel Return (Esc)
                      </button>
                      <button
                        type="button"
                        disabled={isSubmittingReturn}
                        onClick={handlePOSReturnSubmit}
                        className="flex-1 min-h-12 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-sm rounded-xl cursor-pointer transition uppercase tracking-wider text-center shadow-lg hover:shadow-emerald-900/30"
                      >
                        {isSubmittingReturn ? 'Writing Records...' : '✅ Confirm Return & Release (Enter)'}
                      </button>
                    </div>

                    <div className="text-center text-[9px] text-slate-500 font-mono">
                      Tip: Use keyboard hotkeys! Press <kbd className="bg-[#212124] px-1 py-0.5 rounded text-slate-300 font-bold text-[8px] border border-slate-700">Enter</kbd> to confirm, or <kbd className="bg-[#212124] px-1 py-0.5 rounded text-slate-300 font-bold text-[8px] border border-slate-700">Esc</kbd> to cancel.
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* LEFT HALF: THE SCANNER CONSOLE */}
                <div className="lg:col-span-5 bg-[#0E0E10] border border-[#2A2A2E] rounded-xl p-5 space-y-4">
                  <div className="border-b border-[#2A2A2E] pb-2 flex items-center justify-between">
                    <span className="text-xs font-black font-mono text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Barcode className="h-4 w-4" /> Tag Scanner Console
                    </span>
                    <span className="text-[8px] bg-blue-950/80 text-blue-400 font-mono px-1.5 py-0.5 rounded uppercase font-bold tracking-widest border border-blue-900/40">
                      LASER_READY
                    </span>
                  </div>

                  <form onSubmit={handleScanInputSubmit} className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-slate-400 font-bold mb-1.5 tracking-wider">
                        Scan Ticket or Asset Tag ID:
                      </label>
                      <div className="relative rounded-lg overflow-hidden border border-blue-900/40 bg-[#111113] focus-within:ring-2 focus-within:ring-blue-500/50 focus-within:border-blue-500 transition-all">
                        <input
                          type="text"
                          placeholder="Position cursor & scan barcode/QR..."
                          value={scannedTicketCode}
                          onChange={(e) => setScannedTicketCode(e.target.value)}
                          className="w-full bg-transparent px-3 py-3 text-xs text-white font-mono placeholder-slate-600 focus:outline-none"
                        />
                        <button
                          type="submit"
                          className="absolute right-1.5 top-1.5 min-h-9 bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white px-3 py-2 rounded transition uppercase tracking-wider cursor-pointer"
                        >
                          Scan
                        </button>
                      </div>
                      <p className="text-[9px] text-slate-500 font-mono mt-1 leading-normal">
                        Place cursor here to scan physical barcode or type/paste drive ID and press Enter.
                      </p>
                    </div>
                  </form>

                  {/* WEBCAM INTEGRATED SCANNER */}
                  <div className="border-t border-[#2A2A2E] pt-4 space-y-3">
                    <span className="text-[10px] font-mono uppercase text-slate-400 font-bold tracking-wider block">
                      Camera QR Code Reader
                    </span>

                    {isReturnWebcamActive ? (
                      <div className="bg-[#111113] border border-blue-900/30 rounded-lg p-3 space-y-3">
                        <div className="relative bg-black rounded aspect-video overflow-hidden border border-[#2A2A2E] flex flex-col items-center justify-center text-center">
                          {/* Pulsing Scanner Laser */}
                          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[2px] bg-red-500 shadow-[0_0_8px_#ef4444] animate-pulse z-10" />
                          <div className="absolute inset-4 border border-dashed border-blue-500/30 rounded pointer-events-none" />
                          
                          <span className="text-2xl mb-1">🎫</span>
                          <span className="text-[9px] font-mono text-blue-400 font-extrabold uppercase tracking-widest animate-pulse">
                            Ticket Camera Active
                          </span>
                          <p className="text-[8px] text-slate-500 max-w-[180px] mt-1 leading-normal">
                            Simulated camera active. Click a "Simulate QR Scan" button next to any drive on the right to test instant scanning.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsReturnWebcamActive(false)}
                          className="w-full min-h-12 py-3 bg-[#16161A] hover:bg-slate-800 text-slate-300 font-bold text-sm rounded border border-[#2A2A2E] cursor-pointer transition uppercase"
                        >
                          Turn Camera Off
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsReturnWebcamActive(true)}
                        className="w-full min-h-12 flex items-center justify-center gap-1.5 py-3 border border-dashed border-blue-900/50 bg-blue-950/20 text-blue-400 rounded-lg text-sm font-bold hover:bg-blue-950/40 transition cursor-pointer"
                      >
                        <Camera className="h-3.5 w-3.5" />
                        Scan Ticket with Live Webcam
                      </button>
                    )}
                  </div>
                </div>

                {/* RIGHT HALF: ELIGIBLE ACTIVE QUEUE */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-mono uppercase text-slate-400 font-bold tracking-wider block">
                        Active Ingest Queue
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {filteredForReturn.length} unreleased drive{filteredForReturn.length !== 1 ? 's' : ''} in queue • Page {safeReturnPage} / {returnTotalPages}
                      </span>
                    </div>

                    <input
                      type="text"
                      placeholder="Filter active list..."
                      value={returnDiskSearchQuery}
                      onChange={(e) => setReturnDiskSearchQuery(e.target.value)}
                      className="bg-[#0E0E10] border border-[#2A2A2E] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full sm:w-48 font-mono"
                    />
                  </div>

                  {filteredForReturn.length > 0 ? (
                    <div className="grid grid-cols-1 gap-2.5">
                      {pagedForReturn.map(d => {
                        const isSelected = selectedReturnDiskId === d.id;
                        return (
                          <div
                            key={d.id}
                            className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                              isSelected 
                                ? 'bg-blue-950/15 border-blue-500 ring-1 ring-blue-500/30' 
                                : 'bg-[#0E0E10] border-[#2A2A2E] hover:border-slate-750'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-mono text-[10.5px] font-black text-slate-200 truncate">{d.id}</span>
                                <span className={`text-[8px] px-1.5 py-0.5 rounded uppercase font-extrabold tracking-wider shrink-0 border ${
                                  d.status === 'completed' ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/40' :
                                  d.status === 'copying' ? 'bg-blue-950/40 text-blue-400 border-blue-900/30' :
                                  d.status === 'failed' ? 'bg-rose-950/30 text-rose-450 border-rose-900/30 animate-pulse' :
                                  'bg-[#1C1C24] text-slate-400 border-[#2A2A2E]'
                                }`}>
                                  {d.status}
                                </span>
                              </div>
                              <div className="text-xs font-bold text-slate-300 truncate">
                                {d.hd_manufacturer} {d.hd_model}
                              </div>
                              <div className="text-[10px] font-mono text-slate-500">
                                S/N: {d.hd_serial} | {d.hd_size}
                              </div>
                              <div className="text-[10px] font-mono text-slate-400 mt-0.5 flex gap-1">
                                <span className="font-bold">Location:</span>
                                <span>
                                  {(() => {
                                    if (d.status === 'copying') {
                                      const dup = duplicators.find(dupItem => dupItem.id === d.duplicator_id);
                                      return dup ? dup.name : (d.duplicator_id || 'Duplicator Station');
                                    }
                                    switch (d.status) {
                                      case 'received': return 'Accepted Bin';
                                      case 'completed': return 'Complete Bin';
                                      case 'failed': return 'Failed Bin';
                                      case 'picked_up': return 'Returned';
                                      default: return 'Unknown';
                                    }
                                  })()}
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setSelectedReturnDiskId(d.id);
                              }}
                              className="min-h-11 px-3.5 py-2.5 bg-[#16161A] border border-slate-700 hover:border-blue-500 hover:bg-blue-950/20 text-xs font-mono text-slate-300 hover:text-blue-400 rounded-lg cursor-pointer transition uppercase font-extrabold shrink-0"
                            >
                              ⚡ Simulate QR Scan
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-xs text-slate-500 font-mono bg-[#0E0E10] rounded-xl border border-[#2A2A2E]">
                      No matching unreleased drives found in intake queue.
                    </div>
                  )}

                  {filteredForReturn.length > 0 && returnTotalPages > 1 && (
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <button
                        type="button"
                        disabled={safeReturnPage <= 1}
                        onClick={() => setReturnPage(p => Math.max(1, p - 1))}
                        className="min-h-10 px-3 py-2 rounded-lg border border-[#2A2A2E] bg-[#0E0E10] text-xs font-bold text-slate-300 disabled:opacity-40"
                      >
                        Previous
                      </button>
                      <span className="text-[10px] text-slate-500 font-mono">Page {safeReturnPage} of {returnTotalPages}</span>
                      <button
                        type="button"
                        disabled={safeReturnPage >= returnTotalPages}
                        onClick={() => setReturnPage(p => Math.min(returnTotalPages, p + 1))}
                        className="min-h-10 px-3 py-2 rounded-lg border border-[#2A2A2E] bg-[#0E0E10] text-xs font-bold text-slate-300 disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {pagedForReprint.map(d => (
                    <div
                      key={d.id}
                      className="p-3.5 bg-[#0E0E10] border border-[#2A2A2E] hover:border-slate-700 rounded-xl flex items-center justify-between gap-4 transition-all"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-mono text-[10px] font-bold text-slate-400 block">{d.id}</span>
                        <span className="text-xs font-black text-white block truncate">{d.hd_manufacturer} {d.hd_model}</span>
                        <span className="text-[10px] font-mono text-slate-400 block">
                          S/N: {d.hd_serial} | Status: <b className="text-blue-400 uppercase">{d.status}</b> | Location: <b className="text-slate-300 font-normal">
                            {(() => {
                              if (d.status === 'copying') {
                                const dup = duplicators.find(dupItem => dupItem.id === d.duplicator_id);
                                return dup ? dup.name : (d.duplicator_id || 'Duplicator Station');
                              }
                              switch (d.status) {
                                case 'received': return 'Accepted Bin';
                                case 'completed': return 'Complete Bin';
                                case 'failed': return 'Failed Bin';
                                case 'picked_up': return 'Returned';
                                default: return 'Unknown';
                              }
                            })()}
                          </b>
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPrintedTicketDisk(d)}
                        className="inline-flex items-center justify-center min-h-12 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-sm rounded-xl shrink-0 transition"
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

              {filteredForReprint.length > 0 && reprintTotalPages > 1 && (
                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    disabled={safeReprintPage <= 1}
                    onClick={() => setReprintPage(p => Math.max(1, p - 1))}
                    className="min-h-10 px-3 py-2 rounded-lg border border-[#2A2A2E] bg-[#0E0E10] text-xs font-bold text-slate-300 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span className="text-[10px] text-slate-500 font-mono">Page {safeReprintPage} of {reprintTotalPages}</span>
                  <button
                    type="button"
                    disabled={safeReprintPage >= reprintTotalPages}
                    onClick={() => setReprintPage(p => Math.min(reprintTotalPages, p + 1))}
                    className="min-h-10 px-3 py-2 rounded-lg border border-[#2A2A2E] bg-[#0E0E10] text-xs font-bold text-slate-300 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TICKET / TAG PRINT OVERLAY */}
      {printedTicketDisk && posTab === 'reprint' && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#16161A] rounded-xl shadow-2xl overflow-hidden max-w-lg w-full border border-slate-700/50 flex flex-col">
            
            <div className="border-b border-[#2A2A2E] p-4 bg-slate-900/60 text-center relative">
              <span className="text-[10px] text-emerald-450 border border-emerald-900/40 rounded px-1.5 py-0.5 uppercase tracking-wider font-extrabold font-mono">100MM × 62MM THERMAL PRINTER</span>
              <h4 className="font-bold text-lg block mt-1.5 font-sans tracking-tight text-white">Tag & Ticket Printing</h4>
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
                <PrintLabelCard
                  ref={tagPrintCardRef}
                  variant="tag"
                  data={{
                    id: printedTicketDisk.id,
                    source_requested_id: printedTicketDisk.source_requested_id,
                    hd_serial: printedTicketDisk.hd_serial || 'PENDING',
                    received_time: printedTicketDisk.received_time,
                    hd_image: printedTicketDisk.hd_image || capturedImageDataUrl || scanImageBase64 || null
                  }}
                  imageSource={printedTicketDisk.hd_image || capturedImageDataUrl || scanImageBase64 || undefined}
                  className="mx-auto"
                />
              </div>

              {/* TICKET #2: DDV DRIVE TICKET (NO QR CODE LABEL, CONTAINS INTAKE DATE/TIME) */}
              <div className="space-y-1">
                <span className="text-[9px] text-emerald-450 uppercase font-mono tracking-wider font-extrabold block">GIVE TO PHYSICAL OWNER / REPRESENTATIVE (TICKET #2)</span>
                <PrintLabelCard
                  ref={ticketPrintCardRef}
                  variant="ticket"
                  data={{
                    id: printedTicketDisk.id,
                    source_requested_id: printedTicketDisk.source_requested_id,
                    received_time: printedTicketDisk.received_time
                  }}
                  className="mx-auto"
                />
              </div>

            </div>

            <div className="bg-[#111113] p-3 text-center border-t border-[#2A2A2E] space-y-2">
              {currentUser?.role === 'admin' && (
                <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] font-mono">
                  <span className="text-slate-400">Alignment</span>
                  <button
                    type="button"
                    onClick={() => {
                      setPrintContentShiftMm(0);
                      setPrintContentShiftXMm(0);
                      setPrintSheetOffsetMm(0);
                      setPrintSheetOffsetXMm(0);
                    }}
                    className="px-2 py-1 rounded border border-amber-900/40 bg-amber-950/20 text-amber-300 hover:bg-amber-900/30"
                  >
                    Reset Align
                  </button>
                </div>
              )}

              <div className="flex gap-2">
              <button
                onClick={handleThermalPrint}
                className="flex-1 min-h-12 text-sm font-black text-white bg-blue-600 hover:bg-blue-500 py-3 rounded-xl transition"
              >
                Print 100×62mm Labels (Tag + Ticket)
              </button>
              <button
                onClick={() => setPrintedTicketDisk(null)}
                className="px-5 min-h-12 text-sm font-bold text-slate-300 hover:text-white bg-[#0E0E10] border border-[#2A2A2E] py-3 rounded-xl transition"
              >
                Close View
              </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
