import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { 
  Database, Plus, Trash2, Edit3, HelpCircle, RefreshCw, Barcode, HardDrive, 
  Layers, ShieldAlert, FileText, Check, Loader2, Info, ArrowUpRight, TrendingUp,
  Activity, Users, Lock, Unlock, Download
} from 'lucide-react';
import { Disk, DataSource, UserRole, User, Duplicator } from '../types';
import { DriveLookupEditPanel } from './VolunteerPortal';

interface AdminPortalProps {
  currentUser: { username: string; name: string; role: UserRole; owner_id?: string } | null;
  onLogout: () => void;
  onTableUpdateNotification: (tableName: string, action: string, recordId: string) => void;
}

export default function AdminPortal({
  currentUser,
  onLogout,
  onTableUpdateNotification
}: AdminPortalProps) {
  const normalizeDatasource = (raw: any): DataSource => {
    const fallbackId = `DS-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const sizeOptionsRaw = raw?.required_specs?.size_options;
    const normalizedSizeOptions = Array.isArray(sizeOptionsRaw)
      ? sizeOptionsRaw.filter((s: unknown) => typeof s === 'string' && s.trim())
      : typeof sizeOptionsRaw === 'string' && sizeOptionsRaw.trim()
        ? [sizeOptionsRaw.trim()]
        : [];

    return {
      id: String(raw?.id || fallbackId),
      name: String(raw?.name || 'Unnamed Source'),
      description: String(raw?.description || ''),
      required_specs: {
        interface: String(raw?.required_specs?.interface || 'SATA 3'),
        size_options: normalizedSizeOptions.length > 0 ? normalizedSizeOptions : ['8TB']
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

  // Active admin tab
  const [activeTab, setActiveTab] = useState<'disks' | 'datasources' | 'duplicators' | 'reports' | 'users'>('disks');

  // Duplicator Form State
  const [duplicatorForm, setDuplicatorForm] = useState({
    name: '',
    manufacturer: 'Systor',
    slots_total: 10,
    slots_status: [] as boolean[],
    year_in_service: new Date().getFullYear()
  });

  // Search & Filter States
  const [diskSearchQuery, setDiskSearchQuery] = useState('');
  const [diskStatusFilter, setDiskStatusFilter] = useState<string>('all');
  const [diskPage, setDiskPage] = useState(1);
  const [diskPageSizeOption, setDiskPageSizeOption] = useState<'10' | '50' | '100' | '200' | 'all'>('10');
  const [diskSortColumn, setDiskSortColumn] = useState<'id' | 'hd_serial' | 'hd_manufacturer' | 'hd_model' | 'hd_size' | 'hd_speed' | 'source_requested_id' | 'status' | 'location'>('id');
  const [diskSortDirection, setDiskSortDirection] = useState<'asc' | 'desc'>('asc');

  // Seeding States
  const [isLoadTesting, setIsLoadTesting] = useState(false);
  const [loadTestMsg, setLoadTestMsg] = useState('');
  const [selectedSeedCount, setSelectedSeedCount] = useState<10 | 100 | 500>(100);

  // Add/Edit Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDriveEditorModal, setShowDriveEditorModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Disk Form State
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
    copy_start_time: '',
    copy_complete_time: '',
    copy_fail_time: '',
    pickup_time: '',
  });

  // DataSource Form State
  const [sourceForm, setSourceForm] = useState({
    name: '',
    description: '',
    interface: 'SATA 3',
    size_options: '8TB'
  });

  const [reportComponent, setReportComponent] = useState<'all' | 'manufacturer' | 'speed' | 'size' | 'source' | 'model' | 'status' | 'duplicator'>('all');
  const [reportValue, setReportValue] = useState<string>('all');
  const [reportDriveId, setReportDriveId] = useState<string>('');

  // User Management State
  const [usersList, setUsersList] = useState<User[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({
    username: '',
    name: '',
    role: 'volunteer' as UserRole,
    password: '',
    isLocked: false
  });

  const openNewUser = () => {
    setEditingUser(null);
    setUserForm({
      username: '',
      name: '',
      role: 'volunteer',
      password: '',
      isLocked: false
    });
    setShowUserModal(true);
  };

  const openEditUser = (user: User) => {
    setEditingUser(user);
    setUserForm({
      username: user.username,
      name: user.name,
      role: user.role,
      password: user.password || '',
      isLocked: !!user.isLocked
    });
    setShowUserModal(true);
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isEdit = !!editingUser;
    const url = isEdit ? `/api/admin/users/${editingUser.username}` : '/api/admin/users';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userForm)
      });

      if (res.ok) {
        fetchAllData();
        setShowUserModal(false);
        setEditingUser(null);
      } else {
        const data = await res.json();
        alert(data.error || 'Server error saving user record.');
      }
    } catch (err) {
      alert('Network failure saving user record.');
    }
  };

  const handleDeleteUser = async (username: string) => {
    const normalizedUsername = username.toLowerCase().trim();
    const activeUsername = currentUser?.username?.toLowerCase().trim() || '';

    if (normalizedUsername === 'admin') {
      alert('The primary system admin account cannot be deleted.');
      return;
    }
    if (activeUsername && activeUsername === normalizedUsername) {
      alert('You cannot delete your own active administrator account.');
      return;
    }
    if (!window.confirm(`Are you absolutely sure you want to delete user "${username}"?`)) {
      return;
    }

    try {
      const encodedUsername = encodeURIComponent(username.trim());
      let res = await fetch(`/api/admin/users/${encodedUsername}`, {
        method: 'DELETE',
        headers: {
          'x-actor-username': currentUser?.username || ''
        }
      });

      // Fallback route for servers that only support payload-style deletion
      if (res.status === 404 || res.status === 405) {
        res = await fetch('/api/admin/users/delete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-actor-username': currentUser?.username || ''
          },
          body: JSON.stringify({ username: username.trim() })
        });
      }

      if (res.ok) {
        setUsersList(prev => prev.filter(user => user.username.toLowerCase().trim() !== normalizedUsername));
        fetchAllData();
      } else {
        const data = await res.json();
        alert(data.error || 'Server rejected user deletion.');
      }
    } catch (err) {
      alert('Network failure deleting user record.');
    }
  };

  // Fetch all tables
  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      const [disksRes, sourcesRes, usersRes, duplicatorsRes] = await Promise.allSettled([
        fetch('/api/disks', { cache: 'no-store' }),
        fetch('/api/datasources', { cache: 'no-store' }),
        fetch('/api/admin/users', { cache: 'no-store' }),
        fetch('/api/duplicators', { cache: 'no-store' })
      ]);

      if (disksRes.status === 'fulfilled' && disksRes.value.ok) setDisks(await disksRes.value.json());
      if (sourcesRes.status === 'fulfilled' && sourcesRes.value.ok) {
        const sourcePayload = await sourcesRes.value.json();
        const sourceRows = Array.isArray(sourcePayload)
          ? sourcePayload
          : Array.isArray(sourcePayload?.datasources)
            ? sourcePayload.datasources
            : [];

        setDatasources(sourceRows.map(normalizeDatasource));
      }
      if (usersRes.status === 'fulfilled' && usersRes.value.ok) setUsersList(await usersRes.value.json());
      if (duplicatorsRes.status === 'fulfilled' && duplicatorsRes.value.ok) setDuplicators(await duplicatorsRes.value.json());
    } catch (err) {
      console.error('Failed to query tables:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Generate sequence-based disk ID
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

  // Seeding Handlers
  const handleGenerateLoadTestData = async () => {
    setIsLoadTesting(true);
    setLoadTestMsg(`Seeding database with ${selectedSeedCount} load-test drives...`);
    try {
      const res = await fetch('/api/admin/generate-mock-load-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: selectedSeedCount })
      });
      const data = await res.json();
      if (data.success) {
        setLoadTestMsg(`Success: ${data.message}`);
        fetchAllData();
        setDiskPage(1);
      } else {
        setLoadTestMsg(`Error: ${data.error || 'Failed to seed load test.'}`);
      }
    } catch (e: any) {
      setLoadTestMsg(`Error: ${e.message}`);
    } finally {
      setIsLoadTesting(false);
    }
  };

  const handlePurgeLoadTestData = async () => {
    if (!window.confirm("Are you absolutely sure you want to purge all load-test mock data?")) {
      return;
    }
    setIsLoadTesting(true);
    setLoadTestMsg('Purging mock load-test drives from database...');
    try {
      const res = await fetch('/api/admin/purge-mock-load-test', {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        setLoadTestMsg(`Success: ${data.message}`);
        fetchAllData();
        setDiskPage(1);
      } else {
        setLoadTestMsg(`Error: ${data.error || 'Failed to purge load test.'}`);
      }
    } catch (e: any) {
      setLoadTestMsg(`Error: ${e.message}`);
    } finally {
      setIsLoadTesting(false);
    }
  };

  // Delete handlers
  const handleDelete = async (tableName: string, recordId: string) => {
    if (!window.confirm(`Are you absolutely sure you want to delete this record from table \`${tableName}\`?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/${tableName}/${recordId}`, { method: 'DELETE' });
      if (res.ok) {
        onTableUpdateNotification(tableName, 'DELETE', recordId);
        fetchAllData();
      } else {
        alert('Deletion rejected by server constraints.');
      }
    } catch (err) {
      alert('Network communication failure.');
    }
  };

  // Inline Status updates
  const handleInlineStatusChange = async (diskId: string, newStatus: Disk['status']) => {
    try {
      const disk = disks.find(d => d.id === diskId);
      if (!disk) return;

      const payload = {
        status: newStatus,
        copy_start_time: newStatus === 'copying' && !disk.copy_start_time ? new Date().toISOString() : disk.copy_start_time,
        copy_complete_time: newStatus === 'completed' && !disk.copy_complete_time ? new Date().toISOString() : disk.copy_complete_time,
        copy_fail_time: newStatus === 'failed' && !disk.copy_fail_time ? new Date().toISOString() : disk.copy_fail_time,
        pickup_time: newStatus === 'picked_up' && !disk.pickup_time ? new Date().toISOString() : disk.pickup_time,
      };

      const res = await fetch(`/api/disks/${diskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        onTableUpdateNotification('disks', 'UPDATE', diskId);
        fetchAllData();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to update disk status');
      }
    } catch (err) {
      console.error('Network error updating status:', err);
    }
  };

  // Form submission: Disk
  const handleDiskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isEdit = !!editingId;
    const url = isEdit ? `/api/disks/${editingId}` : '/api/disks';
    const method = isEdit ? 'PUT' : 'POST';

    const selectedSource = datasources.find(s => s.id === diskForm.source_requested_id);
    if (!isEdit && selectedSource) {
      const minTB = getSourceMinSizeTB(selectedSource);
      if (!meetsSourceMinimum(selectedSource, diskForm.hd_size)) {
        alert(`Invalid Specs! DataSource "${selectedSource.name}" requires minimum ${Number.isNaN(minTB) ? 'configured' : `${minTB}TB`} drives. Selected size is ${diskForm.hd_size}.`);
        return;
      }
    }

    try {
      const nextId = generateDiskID(disks);
      const payload = {
        ...diskForm,
        id: diskForm.id?.trim() && !disks.some(d => d.id === diskForm.id?.trim()) ? diskForm.id.trim() : nextId,
        received_time: diskForm.received_time || new Date().toISOString(),
        copy_start_time: diskForm.status === 'copying' && !diskForm.copy_start_time ? new Date().toISOString() : (diskForm.copy_start_time || null),
        copy_complete_time: diskForm.status === 'completed' && !diskForm.copy_complete_time ? new Date().toISOString() : (diskForm.copy_complete_time || null),
        copy_fail_time: diskForm.status === 'failed' && !diskForm.copy_fail_time ? new Date().toISOString() : (diskForm.copy_fail_time || null),
        pickup_time: diskForm.status === 'picked_up' && !diskForm.pickup_time ? new Date().toISOString() : (diskForm.pickup_time || null)
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const result = await res.json();
        onTableUpdateNotification('disks', isEdit ? 'UPDATE' : 'INSERT', result.id);
        setShowAddModal(false);
        setEditingId(null);
        fetchAllData();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Server rejected request');
      }
    } catch (err) {
      alert('Error saving disk entry.');
    }
  };

  // Form submission: DataSource
  const handleSourceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isEdit = !!editingId;
    const url = isEdit ? `/api/datasources/${editingId}` : '/api/datasources';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const payload = {
        name: sourceForm.name,
        description: sourceForm.description,
        required_specs: {
          interface: sourceForm.interface,
          size_options: [sourceForm.size_options.trim()]
        }
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const result = await res.json();
        onTableUpdateNotification('datasources', isEdit ? 'UPDATE' : 'INSERT', result.id);
        setShowAddModal(false);
        setEditingId(null);
        fetchAllData();
      } else {
        alert('Server rejected request');
      }
    } catch (err) {
      alert('Error saving source entry.');
    }
  };

  // Form submission: Duplicator
  const handleDuplicatorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isEdit = !!editingId;
    const url = isEdit ? `/api/duplicators/${editingId}` : '/api/duplicators';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(duplicatorForm)
      });

      if (res.ok) {
        const result = await res.json();
        onTableUpdateNotification('duplicators', isEdit ? 'UPDATE' : 'INSERT', result.id);
        setShowAddModal(false);
        setEditingId(null);
        fetchAllData();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Server rejected request');
      }
    } catch (err) {
      alert('Error saving duplicator entry.');
    }
  };

  // Open Edit Dialog
  const openEdit = (tabName: typeof activeTab, record: any) => {
    setEditingId(record.id);
    if (tabName === 'disks') {
      setShowAddModal(false);
      setShowDriveEditorModal(true);
      const r = record as Disk;
      setDiskForm({
        id: r.id,
        hd_manufacturer: r.hd_manufacturer,
        hd_model: r.hd_model,
        hd_serial: r.hd_serial,
        hd_size: r.hd_size,
        hd_speed: r.hd_speed,
        source_requested_id: r.source_requested_id,
        status: r.status,
        received_time: r.received_time,
        copy_start_time: r.copy_start_time || '',
        copy_complete_time: r.copy_complete_time || '',
        copy_fail_time: r.copy_fail_time || '',
        pickup_time: r.pickup_time || '',
      });
    } else if (tabName === 'datasources') {
      const r = normalizeDatasource(record);
      setSourceForm({
        name: r.name,
        description: r.description,
        interface: r.required_specs.interface,
        size_options: r.required_specs.size_options[0] || '8TB'
      });
    } else if (tabName === 'duplicators') {
      const r = record as Duplicator;
      setDuplicatorForm({
        name: r.name,
        manufacturer: r.manufacturer,
        slots_total: r.slots_total,
        slots_status: [...r.slots_status],
        year_in_service: r.year_in_service
      });
    }
    setShowAddModal(true);
  };

  // Open Add Dialog
  const openNewAdd = (tabName: typeof activeTab) => {
    setEditingId(null);
    if (tabName === 'disks') {
      setDiskForm({
        id: generateDiskID(disks),
        hd_manufacturer: 'Seagate',
        hd_model: 'IronWolf ST8000VN004',
        hd_serial: `SN-${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
        hd_size: '8TB',
        hd_speed: '7200 RPM',
        source_requested_id: datasources[0]?.id || 'DS-A',
        status: 'received',
        received_time: new Date().toISOString(),
        copy_start_time: '',
        copy_complete_time: '',
        copy_fail_time: '',
        pickup_time: '',
      });
    } else if (tabName === 'datasources') {
      setSourceForm({ name: '', description: '', interface: 'SATA 3', size_options: '8TB' });
    } else if (tabName === 'duplicators') {
      setDuplicatorForm({
        name: '',
        manufacturer: 'Systor',
        slots_total: 10,
        slots_status: Array(10).fill(true),
        year_in_service: new Date().getFullYear()
      });
    }
    setShowAddModal(true);
  };

  // Filter disks
  const filteredDisks = disks.filter(d => {
    const matchesSearch = 
      d.id.toLowerCase().includes(diskSearchQuery.toLowerCase()) ||
      d.hd_serial.toLowerCase().includes(diskSearchQuery.toLowerCase()) ||
      d.hd_manufacturer.toLowerCase().includes(diskSearchQuery.toLowerCase()) ||
      d.hd_model.toLowerCase().includes(diskSearchQuery.toLowerCase()) ||
      (d.hd_size && d.hd_size.toLowerCase().includes(diskSearchQuery.toLowerCase()));
    
    const matchesStatus = diskStatusFilter === 'all' || d.status === diskStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const getDiskLocation = (d: Disk) => {
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
  };

  const getDiskSortValue = (d: Disk, column: typeof diskSortColumn) => {
    if (column === 'location') return getDiskLocation(d);
    if (column === 'hd_size') return parseDriveSizeTB(d.hd_size);
    return (d[column] || '').toString().toLowerCase();
  };

  const sortedDisks = [...filteredDisks].sort((a, b) => {
    const aValue = getDiskSortValue(a, diskSortColumn);
    const bValue = getDiskSortValue(b, diskSortColumn);
    if (aValue < bValue) return diskSortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return diskSortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const pageSize = diskPageSizeOption === 'all' ? sortedDisks.length || 1 : Number(diskPageSizeOption);
  const totalPages = Math.max(1, Math.ceil(sortedDisks.length / pageSize));
  const currentPage = Math.min(diskPage, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const pagedDisks = sortedDisks.slice(startIndex, startIndex + pageSize);

  const toggleDiskSort = (column: typeof diskSortColumn) => {
    if (diskSortColumn === column) {
      setDiskSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
      return;
    }
    setDiskSortColumn(column);
    setDiskSortDirection('asc');
  };

  const sortIndicator = (column: typeof diskSortColumn) => {
    if (diskSortColumn !== column) return '⇅';
    return diskSortDirection === 'asc' ? '↑' : '↓';
  };

  const getReportComponentValue = (disk: Disk, component: typeof reportComponent) => {
    switch (component) {
      case 'manufacturer': return disk.hd_manufacturer || 'Unknown';
      case 'speed': return disk.hd_speed || 'Unknown';
      case 'size': return disk.hd_size || 'Unknown';
      case 'source': return disk.source_requested_id || 'Unknown';
      case 'model': return disk.hd_model || 'Unknown';
      case 'status': return disk.status || 'Unknown';
      case 'duplicator': return disk.duplicator_id || 'Unassigned';
      default: return 'all';
    }
  };

  const availableReportValues = Array.from(
    new Set(disks.map(d => getReportComponentValue(d, reportComponent)).filter(Boolean))
  ).sort();

  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const matchesDriveFilter = (diskId: string, filterText: string) => {
    const trimmed = filterText.trim();
    if (!trimmed) return true;

    const normalizedDiskId = diskId.toLowerCase();
    const normalizedFilter = trimmed.toLowerCase();

    if (normalizedFilter.includes('*') || normalizedFilter.includes('?')) {
      const regex = new RegExp(`^${escapeRegExp(normalizedFilter).replace(/\\\*/g, '.*').replace(/\\\?/g, '.')}$`);
      return regex.test(normalizedDiskId);
    }

    const rangeMatch = normalizedFilter.match(/^(.*?)((?:\d+))(?:\.\.|-|:)(\d+)$/);
    if (rangeMatch) {
      const [, prefix, startValue, endValue] = rangeMatch;
      const start = Number(startValue);
      const end = Number(endValue);
      if (Number.isNaN(start) || Number.isNaN(end)) return false;

      const idMatch = normalizedDiskId.match(new RegExp(`^${escapeRegExp(prefix)}(\\d+)$`));
      if (!idMatch) return false;

      const diskNumber = Number(idMatch[1]);
      const lower = Math.min(start, end);
      const upper = Math.max(start, end);
      return diskNumber >= lower && diskNumber <= upper;
    }

    return normalizedDiskId.includes(normalizedFilter);
  };

  const filteredReportDisks = disks.filter(disk => {
    const driveMatch = matchesDriveFilter(disk.id, reportDriveId);
    if (!driveMatch) return false;
    if (reportComponent === 'all' || reportValue === 'all') return true;
    return getReportComponentValue(disk, reportComponent) === reportValue;
  });

  const exportReportCsv = () => {
    const rows = filteredReportDisks.map(disk => ({
      id: disk.id,
      status: disk.status,
      hd_manufacturer: disk.hd_manufacturer,
      hd_model: disk.hd_model,
      hd_serial: disk.hd_serial,
      hd_size: disk.hd_size,
      hd_speed: disk.hd_speed,
      source_requested_id: disk.source_requested_id,
      received_time: disk.received_time || '',
      copy_start_time: disk.copy_start_time || '',
      copy_complete_time: disk.copy_complete_time || '',
      copy_fail_time: disk.copy_fail_time || '',
      pickup_time: disk.pickup_time || '',
      duplicator_id: disk.duplicator_id || '',
      location: getDiskLocation(disk)
    }));

    const headers = ['id', 'status', 'hd_manufacturer', 'hd_model', 'hd_serial', 'hd_size', 'hd_speed', 'source_requested_id', 'received_time', 'copy_start_time', 'copy_complete_time', 'copy_fail_time', 'pickup_time', 'duplicator_id', 'location'];

    const escapeCsvValue = (value: unknown) => {
      const text = String(value ?? '');
      if (text.includes(',') || text.includes('"') || text.includes('\n')) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    };

    const csvContent = [
      headers.join(','),
      ...rows.map(row => headers.map(header => escapeCsvValue(row[header as keyof typeof row])).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `drive-timeline-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Generate Reports Analytics in 4-hour increments
  const getReportsData = () => {
    const bucketMap: Record<string, { accepted: number; copying: number; completed: number; returned: number; failed: number }> = {};

    const toBucketKey = (isoStr: string | null | undefined) => {
      if (!isoStr) return null;
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return null;
      const bucketHour = Math.floor(d.getHours() / 4) * 4;
      const bucket = new Date(d);
      bucket.setMinutes(0, 0, 0);
      bucket.setHours(bucketHour);
      return bucket.toISOString();
    };

    const touchBucket = (bucket: string) => {
      if (!bucketMap[bucket]) {
        bucketMap[bucket] = { accepted: 0, copying: 0, completed: 0, returned: 0, failed: 0 };
      }
    };

    filteredReportDisks.forEach(disk => {
      const rKey = toBucketKey(disk.received_time);
      const sKey = toBucketKey(disk.copy_start_time);
      const cKey = toBucketKey(disk.copy_complete_time);
      const fKey = toBucketKey(disk.copy_fail_time);
      const pKey = toBucketKey(disk.pickup_time);

      if (rKey) { touchBucket(rKey); bucketMap[rKey].accepted += 1; }
      if (sKey) { touchBucket(sKey); bucketMap[sKey].copying += 1; }
      if (cKey) { touchBucket(cKey); bucketMap[cKey].completed += 1; }
      if (fKey) { touchBucket(fKey); bucketMap[fKey].failed += 1; }
      if (pKey) { touchBucket(pKey); bucketMap[pKey].returned += 1; }
    });

    const sortedKeys = Object.keys(bucketMap).sort();
    if (sortedKeys.length === 0) return [];

    let cumulativeAccepted = 0;
    let cumulativeCopying = 0;
    let cumulativeCompleted = 0;
    let cumulativeReturned = 0;
    let cumulativeFailed = 0;

    return sortedKeys.map(key => {
      const bucketData = bucketMap[key];
      cumulativeAccepted += bucketData.accepted;
      cumulativeCopying += bucketData.copying;
      cumulativeCompleted += bucketData.completed;
      cumulativeReturned += bucketData.returned;
      cumulativeFailed += bucketData.failed;

      const d = new Date(key);
      const label = `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${String(d.getHours()).padStart(2, '0')}:00`;

      return {
        date: key,
        label,
        "Accepted Drives": cumulativeAccepted,
        "In Progress (Copying)": cumulativeCopying,
        "Completed Duplications": cumulativeCompleted,
        "Returned to Clients": cumulativeReturned,
        "Failed Attempts": cumulativeFailed
      };
    });
  };

  const reportsData = getReportsData();

  const timelineDrive = filteredReportDisks.length === 1
    ? filteredReportDisks[0]
    : (reportDriveId.trim()
      ? disks.find(d => d.id.toLowerCase() === reportDriveId.trim().toLowerCase())
      : null);

  const singleDriveTimeline = timelineDrive
    ? [
        { key: 'received', label: 'Accepted', time: timelineDrive.received_time, status: 'received' },
        { key: 'copying', label: 'Copying Started', time: timelineDrive.copy_start_time, status: 'copying' },
        { key: 'completed', label: 'Copy Completed', time: timelineDrive.copy_complete_time, status: 'completed' },
        { key: 'failed', label: 'Copy Failed', time: timelineDrive.copy_fail_time, status: 'failed' },
        { key: 'picked_up', label: 'Returned', time: timelineDrive.pickup_time, status: 'picked_up' }
      ]
    : [];

  // Status Distribution Chart Data
  const getStatusDistribution = () => {
    const counts = { received: 0, copying: 0, completed: 0, failed: 0, picked_up: 0 };
    filteredReportDisks.forEach(d => {
      if (d.status in counts) {
        counts[d.status as keyof typeof counts] += 1;
      }
    });
    return [
      { name: 'Accepted', count: counts.received, fill: '#60A5FA' },
      { name: 'Copying', count: counts.copying, fill: '#3B82F6' },
      { name: 'Completed', count: counts.completed, fill: '#10B981' },
      { name: 'Failed', count: counts.failed, fill: '#EF4444' },
      { name: 'Returned', count: counts.picked_up, fill: '#8B5CF6' }
    ];
  };

  const statusDistribution = getStatusDistribution();

  const getSourceDistribution = () => {
    const counts: Record<string, number> = {};
    filteredReportDisks.forEach(d => {
      const source = (d.source_requested_id || 'Unspecified').trim() || 'Unspecified';
      counts[source] = (counts[source] || 0) + 1;
    });

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count], index) => ({
        name,
        count,
        fill: ['#60A5FA', '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#14B8A6', '#A78BFA'][index % 8]
      }));
  };

  const sourceDistribution = getSourceDistribution();

  const getManufacturerDistribution = () => {
    const counts: Record<string, number> = {};
    filteredReportDisks.forEach(d => {
      const manufacturer = (d.hd_manufacturer || 'Unknown').trim() || 'Unknown';
      counts[manufacturer] = (counts[manufacturer] || 0) + 1;
    });

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count], index) => ({
        name,
        count,
        fill: ['#60A5FA', '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#14B8A6', '#A78BFA'][index % 8]
      }));
  };

  const manufacturerDistribution = getManufacturerDistribution();

  return (
    <div className="space-y-6">
      {/* Top Banner & Tab Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-[#2A2A2E] gap-4 mb-6">
        <div>
          <h3 className="text-xs font-bold font-mono text-emerald-400 uppercase tracking-widest flex items-center gap-2">
            <span>ADMINISTRATIVE WORKSPACE LEDGER</span>
          </h3>
        </div>
        
        {/* Navigation Tab Switcher */}
        <div className="flex bg-[#0E0E10] border border-[#2A2A2E] p-0.5 rounded-lg self-stretch sm:self-auto shrink-0 shadow-inner">
          <button
            onClick={() => setActiveTab('disks')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-md transition-all cursor-pointer ${
              activeTab === 'disks' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            <HardDrive className="h-3.5 w-3.5" />
            <span>Storage Drives</span>
          </button>
          <button
            onClick={() => setActiveTab('datasources')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-md transition-all cursor-pointer ${
              activeTab === 'datasources' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Data Sources</span>
          </button>
          <button
            onClick={() => setActiveTab('duplicators')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-md transition-all cursor-pointer ${
              activeTab === 'duplicators' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            <Database className="h-3.5 w-3.5" />
            <span>Duplicator Systems</span>
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-md transition-all cursor-pointer ${
              activeTab === 'reports' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            <span>Performance Reports</span>
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-md transition-all cursor-pointer ${
              activeTab === 'users' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>User Accounts</span>
          </button>
        </div>
      </div>

      {activeTab === 'disks' && (
        <div className="space-y-6">
          {/* Controls Panel */}
          <div className="bg-[#111113] border border-[#2A2A2E] p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row gap-2 flex-1 max-w-xl">
              <input
                type="text"
                placeholder="Search drive sequence, capacity, brand, serial keys..."
                value={diskSearchQuery}
                onChange={(e) => { setDiskSearchQuery(e.target.value); setDiskPage(1); }}
                className="bg-[#0E0E10] border border-[#2A2A2E] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 flex-1 min-w-[200px]"
              />
              <select
                value={diskStatusFilter}
                onChange={(e) => { setDiskStatusFilter(e.target.value); setDiskPage(1); }}
                className="bg-[#0E0E10] border border-[#2A2A2E] rounded-lg px-2.5 py-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 shrink-0"
              >
                <option value="all">All Statuses</option>
                <option value="received">Accepted (received)</option>
                <option value="copying">Copying (copying)</option>
                <option value="completed">Completed (completed)</option>
                <option value="failed">Failed (failed)</option>
                <option value="picked_up">Returned (picked_up)</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-[10px] font-mono uppercase text-slate-500 font-bold">Rows</label>
              <select
                value={diskPageSizeOption}
                onChange={(e) => {
                  setDiskPageSizeOption(e.target.value as '10' | '50' | '100' | '200' | 'all');
                  setDiskPage(1);
                }}
                className="bg-[#0E0E10] border border-[#2A2A2E] rounded-lg px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 min-h-11"
              >
                <option value="10">10</option>
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="200">200</option>
                <option value="all">All</option>
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Load Testing Seeding Selector */}
              <div className="flex items-center bg-[#0E0E10] border border-[#2A2A2E] rounded-lg p-1 text-xs">
                <span className="text-[10px] font-mono text-slate-500 px-2 uppercase font-black">Seed Count</span>
                <select
                  value={selectedSeedCount}
                  onChange={(e) => setSelectedSeedCount(Number(e.target.value) as any)}
                  className="bg-slate-900 border border-[#2A2A2E] text-white text-xs rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                >
                  <option value={10}>10</option>
                  <option value={100}>100</option>
                  <option value={500}>500</option>
                </select>
                <button
                  type="button"
                  onClick={handleGenerateLoadTestData}
                  disabled={isLoadTesting}
                  className="ml-2 px-3 py-1 bg-emerald-700/80 hover:bg-emerald-600 disabled:opacity-50 text-white font-extrabold rounded text-[10px] uppercase transition cursor-pointer"
                >
                  Seed Drives
                </button>
              </div>

              <button
                type="button"
                onClick={handlePurgeLoadTestData}
                disabled={isLoadTesting}
                className="px-3 py-2 border border-rose-900/30 bg-rose-950/15 text-rose-400 font-bold hover:bg-rose-950/30 text-xs rounded-lg transition cursor-pointer"
              >
                Purge Seeding
              </button>

              <button
                type="button"
                onClick={() => openNewAdd('disks')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <Plus className="h-4 w-4" />
                Add Drive Record
              </button>
            </div>
          </div>

          {loadTestMsg && (
            <div className="p-3 bg-slate-900/45 border border-[#2A2A2E] text-slate-300 font-mono text-xs rounded-lg flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
                {loadTestMsg}
              </span>
              <button onClick={() => setLoadTestMsg('')} className="text-[10px] text-slate-500 hover:text-white uppercase font-black">Dismiss</button>
            </div>
          )}

          {/* Storage Drives List */}
          {pagedDisks.length > 0 ? (
            <div className="bg-[#16161A] border border-[#2A2A2E] rounded-xl overflow-hidden shadow-lg">
              <div className="max-h-[70vh] overflow-auto">
                <table className="w-full border-collapse text-left text-xs text-slate-300">
                  <thead className="sticky top-0 z-20 bg-[#0E0E10] border-b border-[#2A2A2E] text-[10px] font-mono uppercase font-black tracking-wider text-slate-400">
                    <tr>
                      <th className="py-4 px-4 cursor-pointer select-none" onClick={() => toggleDiskSort('id')}>Drive ID {sortIndicator('id')}</th>
                      <th className="py-4 px-4 cursor-pointer select-none" onClick={() => toggleDiskSort('hd_serial')}>Serial {sortIndicator('hd_serial')}</th>
                      <th className="py-4 px-4 cursor-pointer select-none" onClick={() => toggleDiskSort('hd_manufacturer')}>Manufacturer {sortIndicator('hd_manufacturer')}</th>
                      <th className="py-4 px-4 cursor-pointer select-none" onClick={() => toggleDiskSort('hd_model')}>Model {sortIndicator('hd_model')}</th>
                      <th className="py-4 px-4 cursor-pointer select-none" onClick={() => toggleDiskSort('hd_size')}>Size {sortIndicator('hd_size')}</th>
                      <th className="py-4 px-4 cursor-pointer select-none" onClick={() => toggleDiskSort('hd_speed')}>Speed {sortIndicator('hd_speed')}</th>
                      <th className="py-4 px-4 cursor-pointer select-none" onClick={() => toggleDiskSort('source_requested_id')}>Allocated Dataset {sortIndicator('source_requested_id')}</th>
                      <th className="py-4 px-4 cursor-pointer select-none" onClick={() => toggleDiskSort('status')}>Status {sortIndicator('status')}</th>
                      <th className="py-4 px-4 cursor-pointer select-none" onClick={() => toggleDiskSort('location')}>Location {sortIndicator('location')}</th>
                      <th className="py-4 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2A2A2E]/50">
                    {pagedDisks.map(d => {
                      const matchedSource = datasources.find(s => s.id === d.source_requested_id);
                      return (
                        <tr key={d.id} className="hover:bg-[#1D1D22]/40 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-mono font-bold text-slate-200">{d.id}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-mono text-[11px] text-slate-300">{d.hd_serial}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-white">{d.hd_manufacturer}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="text-slate-300 text-[11px] truncate max-w-[220px]" title={d.hd_model}>{d.hd_model}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-mono text-[10px] bg-slate-900 border border-[#2A2A2E] text-slate-300 px-1.5 py-0.5 rounded font-bold">{d.hd_size}</span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-mono text-[10px] bg-slate-900 border border-[#2A2A2E] text-slate-400 px-1.5 py-0.5 rounded">{d.hd_speed}</span>
                          </td>
                          <td className="py-3.5 px-4">
                            {matchedSource ? (
                              <div className="font-medium text-slate-300">{matchedSource.name}</div>
                            ) : (
                              <span className="text-slate-500 font-mono text-[10px]">—</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <select
                              value={d.status}
                              onChange={(e) => handleInlineStatusChange(d.id, e.target.value as any)}
                              className={`text-[10px] px-3 py-2 rounded-lg uppercase font-black font-mono border cursor-pointer focus:outline-none focus:ring-1 focus:ring-emerald-500 min-h-11 ${
                                d.status === 'completed' ? 'bg-emerald-950/45 text-emerald-400 border-emerald-900/30' :
                                d.status === 'copying' ? 'bg-blue-950/40 text-blue-400 border-blue-900/30' :
                                d.status === 'failed' ? 'bg-rose-950/30 text-rose-400 border-rose-900/30' :
                                d.status === 'picked_up' ? 'bg-purple-950/30 text-purple-400 border-purple-900/30' :
                                'bg-slate-900 text-slate-300 border-slate-700'
                              }`}
                            >
                              <option value="received">Accepted</option>
                              <option value="copying">Copying</option>
                              <option value="completed">Completed</option>
                              <option value="failed">Failed</option>
                              <option value="picked_up">Returned</option>
                            </select>
                          </td>
                          <td className="py-3.5 px-4 font-sans font-medium text-xs text-slate-200">
                            {getDiskLocation(d)}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => openEdit('disks', d)}
                                className="text-emerald-450 hover:text-emerald-400 p-2.5 hover:bg-emerald-950/20 rounded-lg transition min-h-11 min-w-11"
                                title="Edit Drive Entry"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete('disks', d.id)}
                                className="text-rose-400 hover:text-rose-300 p-2.5 hover:bg-rose-950/20 rounded-lg transition min-h-11 min-w-11"
                                title="Delete Record"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 bg-[#16161A] border border-[#2A2A2E] rounded-xl text-slate-500 font-mono text-sm">
              No matching storage drive records found in the database.
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && diskPageSizeOption !== 'all' && (
            <div className="flex items-center justify-center gap-4 mt-6">
              <button
                disabled={currentPage === 1}
                onClick={() => setDiskPage(currentPage - 1)}
                className="px-5 py-3 bg-[#16161A] hover:bg-[#202025] border border-[#2A2A2E] disabled:opacity-40 text-sm rounded-xl transition text-slate-300 font-bold min-h-11"
              >
                Previous
              </button>
              <span className="text-xs text-slate-400 font-mono font-bold">
                Page {currentPage} of {totalPages} ({sortedDisks.length} total)
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setDiskPage(currentPage + 1)}
                className="px-5 py-3 bg-[#16161A] hover:bg-[#202025] border border-[#2A2A2E] disabled:opacity-40 text-sm rounded-xl transition text-slate-300 font-bold min-h-11"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'datasources' && (
        <div className="space-y-6">
          <div className="bg-[#111113] border border-[#2A2A2E] p-4 rounded-xl flex items-center justify-between">
            <span className="text-xs text-slate-400 font-mono font-extrabold uppercase tracking-wider">Active Available Source Datasets</span>
            <button
              type="button"
              onClick={() => openNewAdd('datasources')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Plus className="h-4 w-4" />
              Add Source Dataset
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {datasources.map(s => (
              <div key={s.id} className="bg-[#16161A] border border-[#2A2A2E] hover:border-slate-700 rounded-xl p-5 space-y-4 transition-all">
                <div className="flex justify-between items-start border-b border-[#2A2A2E] pb-2.5">
                  <div>
                    <span className="text-[10px] font-mono text-emerald-450 block font-bold">{s.id}</span>
                    <h4 className="text-sm font-extrabold text-white">{s.name}</h4>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEdit('datasources', s)}
                      className="text-emerald-450 hover:text-emerald-400 p-1"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete('datasources', s.id)}
                      className="text-rose-400 hover:text-rose-300 p-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-400 min-h-[40px] leading-relaxed">{s.description}</p>

                <div className="bg-slate-900/60 p-3 rounded-lg border border-[#2A2A2E] text-[11px] font-mono space-y-1.5 text-slate-300">
                  <div className="flex justify-between">
                    <span>Required Interface:</span>
                    <span className="text-white font-extrabold">{s.required_specs.interface}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Minimum Drive Size:</span>
                    <span className="text-white font-extrabold">{s.required_specs.size_options[0] || 'N/A'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="bg-[#111113] border border-[#2A2A2E] p-4 rounded-xl grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1 md:col-span-2">
              <input
                type="text"
                value={reportDriveId}
                onChange={(e) => setReportDriveId(e.target.value)}
                placeholder="Filter drive IDs (wildcards * ? or ranges like 100-120)"
                className="w-full bg-[#0E0E10] border border-[#2A2A2E] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <p className="text-[10px] text-slate-500 font-mono">Supports wildcard matching and numeric ranges such as DRV-001..005 or 100-120.</p>
            </div>
            <select
              value={reportComponent}
              onChange={(e) => {
                const next = e.target.value as typeof reportComponent;
                setReportComponent(next);
                setReportValue('all');
              }}
              className="bg-[#0E0E10] border border-[#2A2A2E] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="all">All Components</option>
              <option value="manufacturer">Manufacturer</option>
              <option value="speed">Speed</option>
              <option value="size">Size</option>
              <option value="source">Source</option>
              <option value="model">Model</option>
              <option value="status">Status</option>
              <option value="duplicator">Duplicator</option>
            </select>
            <select
              value={reportValue}
              onChange={(e) => setReportValue(e.target.value)}
              disabled={reportComponent === 'all'}
              className="bg-[#0E0E10] border border-[#2A2A2E] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
            >
              <option value="all">All Values</option>
              {availableReportValues.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
            <div className="flex flex-col items-end justify-between gap-2">
              <div className="text-[10px] font-mono text-slate-400">
                Reporting on {filteredReportDisks.length} drives
              </div>
              <button
                type="button"
                onClick={exportReportCsv}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-700/50 bg-emerald-950/40 px-3 py-2 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-900/40"
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </button>
            </div>
          </div>

          {timelineDrive && (
            <div className="bg-[#16161A] border border-[#2A2A2E] rounded-xl p-4 space-y-3">
              <div>
                <h4 className="text-sm font-bold text-white">Drive Timeline: {timelineDrive.id}</h4>
                <p className="text-[11px] text-slate-400">Processing path for the selected single drive.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                {singleDriveTimeline.map((event) => {
                  const hasTime = !!event.time;
                  return (
                    <div
                      key={event.key}
                      className={`rounded-lg border p-3 ${hasTime ? 'border-emerald-900/40 bg-emerald-950/20' : 'border-[#2A2A2E] bg-[#0E0E10]'}`}
                    >
                      <div className="text-[10px] uppercase font-mono font-black text-slate-400">{event.label}</div>
                      <div className={`text-[11px] mt-1 font-mono ${hasTime ? 'text-emerald-300' : 'text-slate-500'}`}>
                        {hasTime ? new Date(event.time as string).toLocaleString() : 'Not reached'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Dashboard Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#16161A] border border-[#2A2A2E] rounded-xl p-4.5 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-500 font-mono block uppercase font-bold">Total Ingested</span>
                <span className="text-2xl font-black text-white block mt-1">{filteredReportDisks.length}</span>
              </div>
              <div className="h-10 w-10 bg-blue-950/40 border border-blue-900/30 rounded-lg flex items-center justify-center text-blue-400">
                <HardDrive className="h-5 w-5" />
              </div>
            </div>

            <div className="bg-[#16161A] border border-[#2A2A2E] rounded-xl p-4.5 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-500 font-mono block uppercase font-bold">Copy in Progress</span>
                <span className="text-2xl font-black text-white block mt-1">
                  {filteredReportDisks.filter(d => d.status === 'copying').length}
                </span>
              </div>
              <div className="h-10 w-10 bg-emerald-950/40 border border-emerald-900/30 rounded-lg flex items-center justify-center text-emerald-400">
                <Activity className="h-5 w-5" />
              </div>
            </div>

            <div className="bg-[#16161A] border border-[#2A2A2E] rounded-xl p-4.5 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-500 font-mono block uppercase font-bold">Completed (Not Picked)</span>
                <span className="text-2xl font-black text-white block mt-1">
                  {filteredReportDisks.filter(d => d.status === 'completed' || d.status === 'failed').length}
                </span>
              </div>
              <div className="h-10 w-10 bg-purple-950/40 border border-purple-900/30 rounded-lg flex items-center justify-center text-purple-400">
                <Barcode className="h-5 w-5" />
              </div>
            </div>

            <div className="bg-[#16161A] border border-[#2A2A2E] rounded-xl p-4.5 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-500 font-mono block uppercase font-bold">Returned & Closed</span>
                <span className="text-2xl font-black text-white block mt-1">
                  {filteredReportDisks.filter(d => d.status === 'picked_up').length}
                </span>
              </div>
              <div className="h-10 w-10 bg-slate-900/40 border border-[#2A2A2E] rounded-lg flex items-center justify-center text-slate-400">
                <Check className="h-5 w-5" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* CUMULATIVE FLOW AREA CHART */}
            <div className="lg:col-span-2 bg-[#16161A] border border-[#2A2A2E] rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[#2A2A2E] pb-3">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                    Replication Cumulative Growth Timeline
                  </h4>
                  <p className="text-[11px] text-slate-400">Historical sequence in 4-hour intervals with optional component and drive filters</p>
                </div>
              </div>

              {reportsData.length > 0 ? (
                <div className="h-[320px] w-full text-xs">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={reportsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorAccepted" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#60A5FA" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#60A5FA" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorCopying" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorReturned" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2E" />
                      <XAxis dataKey="label" stroke="#7F7F8F" interval="preserveStartEnd" minTickGap={32} />
                      <YAxis stroke="#7F7F8F" />
                      <Tooltip contentStyle={{ backgroundColor: '#111113', borderColor: '#2A2A2E', color: '#fff' }} />
                      <Legend />
                      <Area type="monotone" dataKey="Accepted Drives" stroke="#60A5FA" strokeWidth={2} fillOpacity={1} fill="url(#colorAccepted)" />
                      <Area type="monotone" dataKey="In Progress (Copying)" stroke="#3B82F6" strokeWidth={2} fillOpacity={1} fill="url(#colorCopying)" />
                      <Area type="monotone" dataKey="Completed Duplications" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorCompleted)" />
                      <Area type="monotone" dataKey="Returned to Clients" stroke="#8B5CF6" strokeWidth={2} fillOpacity={1} fill="url(#colorReturned)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-xs text-slate-500 font-mono bg-[#0E0E10] border border-dashed border-[#2A2A2E] rounded-xl">
                  Not enough historical database transactions to populate progression timeline.
                </div>
              )}
            </div>

            {/* STATUS DISTRIBUTION PIE/BAR CHART */}
            <div className="bg-[#16161A] border border-[#2A2A2E] rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[#2A2A2E] pb-3">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Activity className="h-4 w-4 text-emerald-400" />
                    Active Status Volume Breakdown
                  </h4>
                  <p className="text-[11px] text-slate-400">Total volume of storage units grouped by processing status</p>
                </div>
              </div>

              {filteredReportDisks.length > 0 ? (
                <div className="h-[320px] w-full text-xs flex flex-col justify-between">
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={statusDistribution} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2E" />
                        <XAxis dataKey="name" stroke="#7F7F8F" />
                        <YAxis stroke="#7F7F8F" />
                        <Tooltip cursor={{ fill: '#2A2A2E', opacity: 0.2 }} contentStyle={{ backgroundColor: '#111113', borderColor: '#2A2A2E', color: '#fff' }} />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {statusDistribution.map((entry, index) => (
                          <Cell key={`bar-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="grid grid-cols-5 gap-1 text-center font-mono text-[9px] text-slate-400 mt-2">
                    {statusDistribution.map((s, i) => (
                      <div key={i} className="space-y-1">
                        <div className="h-1.5 rounded-full mx-auto w-6" style={{ backgroundColor: s.fill }} />
                        <div className="font-extrabold text-white">{s.count}</div>
                        <div className="truncate">{s.name}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-xs text-slate-500 font-mono bg-[#0E0E10] border border-dashed border-[#2A2A2E] rounded-xl">
                  Empty physical catalog registry.
                </div>
              )}
            </div>

          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#16161A] border border-[#2A2A2E] rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[#2A2A2E] pb-3">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-emerald-400" />
                    Drives by Source
                  </h4>
                  <p className="text-[11px] text-slate-400">Count of drives grouped by the selected source request</p>
                </div>
              </div>

              {sourceDistribution.length > 0 ? (
                <div className="h-[300px] w-full text-xs">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sourceDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2E" />
                      <XAxis dataKey="name" stroke="#7F7F8F" angle={-15} textAnchor="end" interval={0} minTickGap={10} />
                      <YAxis stroke="#7F7F8F" />
                      <Tooltip contentStyle={{ backgroundColor: '#111113', borderColor: '#2A2A2E', color: '#fff' }} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {sourceDistribution.map((entry, index) => (
                          <Cell key={`source-bar-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-xs text-slate-500 font-mono bg-[#0E0E10] border border-dashed border-[#2A2A2E] rounded-xl">
                  No source data available for the current filter.
                </div>
              )}
            </div>

            <div className="bg-[#16161A] border border-[#2A2A2E] rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[#2A2A2E] pb-3">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <HardDrive className="h-4 w-4 text-emerald-400" />
                    Drives by Manufacturer
                  </h4>
                  <p className="text-[11px] text-slate-400">Count of drives grouped by manufacturer</p>
                </div>
              </div>

              {manufacturerDistribution.length > 0 ? (
                <div className="h-[300px] w-full text-xs">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={manufacturerDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2E" />
                      <XAxis dataKey="name" stroke="#7F7F8F" angle={-15} textAnchor="end" interval={0} minTickGap={10} />
                      <YAxis stroke="#7F7F8F" />
                      <Tooltip contentStyle={{ backgroundColor: '#111113', borderColor: '#2A2A2E', color: '#fff' }} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {manufacturerDistribution.map((entry, index) => (
                          <Cell key={`manufacturer-bar-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-xs text-slate-500 font-mono bg-[#0E0E10] border border-dashed border-[#2A2A2E] rounded-xl">
                  No manufacturer data available for the current filter.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="bg-[#111113] border border-[#2A2A2E] p-4 rounded-xl flex items-center justify-between">
            <span className="text-xs text-slate-400 font-mono font-extrabold uppercase tracking-wider">User Administration Directory</span>
            <button
              type="button"
              onClick={openNewUser}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Plus className="h-4 w-4" />
              Add System User
            </button>
          </div>

          <div className="bg-[#16161A] border border-[#2A2A2E] rounded-xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900/65 text-slate-400 font-mono text-[10px] uppercase font-black tracking-wider border-b border-[#2A2A2E]">
                    <th className="py-3.5 px-4.5">Full Name</th>
                    <th className="py-3.5 px-4.5">Username</th>
                    <th className="py-3.5 px-4.5">Access Permission Role</th>
                    <th className="py-3.5 px-4.5">Account Status</th>
                    <th className="py-3.5 px-4.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A2A2E]">
                  {usersList.map((user) => (
                    <tr key={user.username} className="hover:bg-slate-900/20 transition-colors">
                      <td className="py-3.5 px-4.5 font-bold text-white">{user.name}</td>
                      <td className="py-3.5 px-4.5 font-mono text-slate-300 font-bold">{user.username}</td>
                      <td className="py-3.5 px-4.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-extrabold uppercase ${
                          user.role === 'admin' ? 'bg-rose-950/40 text-rose-400 border border-rose-900/30' :
                          user.role === 'volunteer' ? 'bg-blue-950/40 text-blue-400 border border-blue-900/30' :
                          user.role === 'processing' ? 'bg-amber-950/40 text-amber-400 border border-amber-900/30' :
                          'bg-slate-900 text-slate-400 border border-slate-800'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4.5">
                        {user.isLocked ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-extrabold uppercase bg-red-950/40 text-red-400 border border-red-900/30">
                            <Lock className="h-3 w-3" />
                            Locked
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-extrabold uppercase bg-emerald-950/40 text-emerald-400 border border-emerald-900/30">
                            <Unlock className="h-3 w-3" />
                            Active
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4.5 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openEditUser(user)}
                            className="text-emerald-450 hover:text-emerald-400 p-1 hover:bg-emerald-950/20 rounded transition"
                            title="Edit User Details / Credentials"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.username)}
                            className="text-rose-400 hover:text-rose-300 p-1 hover:bg-rose-950/20 rounded transition"
                            title="Delete User"
                            disabled={user.username.toLowerCase() === 'admin' || Boolean(currentUser && currentUser.username.toLowerCase() === user.username.toLowerCase())}
                            style={{ opacity: user.username.toLowerCase() === 'admin' || Boolean(currentUser && currentUser.username.toLowerCase() === user.username.toLowerCase()) ? 0.3 : 1 }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'duplicators' && (
        <div className="space-y-6">
          <div className="bg-[#111113] border border-[#2A2A2E] p-4 rounded-xl flex items-center justify-between">
            <span className="text-xs text-slate-400 font-mono font-extrabold uppercase tracking-wider">Duplicator Hardware Systems</span>
            <button
              type="button"
              onClick={() => openNewAdd('duplicators')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Plus className="h-4 w-4" />
              Add Duplicator
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {duplicators.map(dup => {
              const functionalCount = dup.slots_status.filter(Boolean).length;
              return (
                <div key={dup.id} className="bg-[#16161A] border border-[#2A2A2E] hover:border-slate-700 rounded-xl p-5 space-y-4 transition-all flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex justify-between items-start border-b border-[#2A2A2E] pb-2.5">
                      <div>
                        <span className="text-[10px] font-mono text-emerald-450 block font-bold">{dup.manufacturer}</span>
                        <h4 className="text-sm font-extrabold text-white">{dup.name}</h4>
                        <span className="text-[10px] text-slate-400 font-mono">In service since: {dup.year_in_service}</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEdit('duplicators', dup)}
                          className="text-emerald-450 hover:text-emerald-400 p-1 rounded hover:bg-emerald-950/20 transition"
                          title="Edit Duplicator Settings"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete('duplicators', dup.id)}
                          className="text-rose-400 hover:text-rose-300 p-1 rounded hover:bg-rose-950/20 transition"
                          title="Delete Duplicator"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs font-mono bg-[#0E0E10] border border-[#2A2A2E] px-3 py-2 rounded-lg">
                      <span className="text-slate-400">Functional Slots:</span>
                      <span className={`font-extrabold ${functionalCount === dup.slots_total ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {functionalCount}/{dup.slots_total} slots functional
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[10px] font-mono uppercase font-black text-slate-400 block">Slot Status Layout (Click to toggle)</span>
                      <div className="grid grid-cols-5 gap-2">
                        {dup.slots_status.map((isFunctional, idx) => (
                          <button
                            key={idx}
                            onClick={async () => {
                              const newStatus = [...dup.slots_status];
                              newStatus[idx] = !newStatus[idx];
                              try {
                                const res = await fetch(`/api/duplicators/${dup.id}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ slots_status: newStatus })
                                });
                                if (res.ok) {
                                  fetchAllData();
                                }
                              } catch (e) {
                                console.error(e);
                              }
                            }}
                            className={`p-1.5 rounded text-[10px] font-mono font-bold border transition flex flex-col items-center justify-center cursor-pointer ${
                              isFunctional 
                                ? 'bg-emerald-950/25 text-emerald-400 border-emerald-900/30 hover:bg-emerald-900/20' 
                                : 'bg-rose-950/25 text-rose-400 border-rose-900/30 hover:bg-rose-950/10'
                            }`}
                            title={`Slot #${idx + 1}: ${isFunctional ? 'Functional' : 'Non-Functional'} (Click to toggle)`}
                          >
                            <span className="text-[8px] text-slate-400 block">SLOT</span>
                            <span className="text-xs font-extrabold">{idx + 1}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ADD / EDIT MODAL */}
      {(showAddModal || showDriveEditorModal) && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`bg-[#16161A] border border-slate-700/50 rounded-xl shadow-2xl overflow-hidden ${activeTab === 'disks' && showDriveEditorModal ? 'max-w-6xl w-full' : 'max-w-md w-full'}`}>
            <div className="bg-slate-900/60 p-4 border-b border-[#2A2A2E] flex justify-between items-center">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider font-sans">
                {activeTab === 'disks' && showDriveEditorModal
                  ? 'Edit Drive Record'
                  : editingId
                    ? `Edit ${activeTab === 'duplicators' ? 'Duplicator' : 'Dataset Source'}`
                    : `Create New ${activeTab === 'disks' ? 'Drive Record' : activeTab === 'duplicators' ? 'Duplicator' : 'Dataset Source'}`}
              </h4>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setShowDriveEditorModal(false);
                  setEditingId(null);
                }}
                className="text-slate-400 hover:text-slate-200 font-bold"
              >
                ✕
              </button>
            </div>

            {activeTab === 'disks' && showDriveEditorModal ? (
              <div className="p-4">
                <DriveLookupEditPanel
                  currentUser={currentUser}
                  datasources={datasources}
                  onTableUpdateNotification={onTableUpdateNotification}
                  onRefreshDisks={fetchAllData}
                  initialLookupQuery={editingId || ''}
                  onClose={() => {
                    setShowDriveEditorModal(false);
                    setEditingId(null);
                  }}
                />
              </div>
            ) : (
              <form onSubmit={activeTab === 'disks' ? handleDiskSubmit : activeTab === 'duplicators' ? handleDuplicatorSubmit : handleSourceSubmit} className="p-5 space-y-4">
                {activeTab === 'disks' ? (
                <>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-mono uppercase font-black text-slate-400">Disk Sequence ID</label>
                    <input
                      type="text"
                      disabled={!!editingId}
                      value={diskForm.id}
                      onChange={(e) => setDiskForm({...diskForm, id: e.target.value})}
                      className="w-full bg-[#0E0E10] border border-[#2A2A2E] disabled:opacity-50 rounded-lg px-3 py-2 text-xs text-white focus:ring-1 focus:ring-emerald-500 font-mono font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-mono uppercase font-black text-slate-400">Manufacturer</label>
                    <input
                      type="text"
                      list="admin-manufacturer-options"
                      required
                      value={diskForm.hd_manufacturer}
                      onChange={(e) => setDiskForm({...diskForm, hd_manufacturer: e.target.value})}
                      className="w-full bg-[#0E0E10] border border-[#2A2A2E] rounded-lg px-3 py-2 text-xs text-white focus:ring-1 focus:ring-emerald-500"
                    />
                    <datalist id="admin-manufacturer-options">
                      {['Seagate', 'Toshiba', 'Western Digital', 'Samsung', 'Dell', 'MDD'].map(option => (
                        <option key={option} value={option} />
                      ))}
                    </datalist>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-mono uppercase font-black text-slate-400">Model Name</label>
                    <input
                      type="text"
                      required
                      value={diskForm.hd_model}
                      onChange={(e) => setDiskForm({...diskForm, hd_model: e.target.value})}
                      className="w-full bg-[#0E0E10] border border-[#2A2A2E] rounded-lg px-3 py-2 text-xs text-white focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-mono uppercase font-black text-slate-400">Serial Number</label>
                    <input
                      type="text"
                      required
                      value={diskForm.hd_serial}
                      onChange={(e) => setDiskForm({...diskForm, hd_serial: e.target.value})}
                      className="w-full bg-[#0E0E10] border border-[#2A2A2E] rounded-lg px-3 py-2 text-xs text-white focus:ring-1 focus:ring-emerald-500 font-mono font-bold"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-mono uppercase font-black text-slate-400">Capacity Size</label>
                      <select
                        value={diskForm.hd_size}
                        onChange={(e) => setDiskForm({...diskForm, hd_size: e.target.value})}
                        className="w-full bg-[#0E0E10] border border-[#2A2A2E] rounded-lg px-2.5 py-2 text-xs text-white focus:ring-1 focus:ring-emerald-500"
                      >
                        {['4TB', '6TB', '8TB', '10TB', '12TB', '16TB', '18TB', '20TB', '24TB'].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-mono uppercase font-black text-slate-400">Spindle Speed</label>
                      <input
                        type="text"
                        value={diskForm.hd_speed}
                        onChange={(e) => setDiskForm({...diskForm, hd_speed: e.target.value})}
                        className="w-full bg-[#0E0E10] border border-[#2A2A2E] rounded-lg px-3 py-2 text-xs text-white focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-mono uppercase font-black text-slate-400">Allocated Source Dataset</label>
                    <select
                      value={diskForm.source_requested_id}
                      onChange={(e) => setDiskForm({...diskForm, source_requested_id: e.target.value})}
                      className="w-full bg-[#0E0E10] border border-[#2A2A2E] rounded-lg px-2.5 py-2 text-xs text-white focus:ring-1 focus:ring-emerald-500"
                    >
                      {datasources.map(s => <option key={s.id} value={s.id}>{s.name} ({s.id})</option>)}
                    </select>
                  </div>

                  {editingId && (
                    <div className="space-y-1">
                      <label className="block text-[10px] font-mono uppercase font-black text-slate-400">Active status</label>
                      <select
                        value={diskForm.status}
                        onChange={(e) => setDiskForm({...diskForm, status: e.target.value as any})}
                        className="w-full bg-[#0E0E10] border border-[#2A2A2E] rounded-lg px-2.5 py-2 text-xs text-white focus:ring-1 focus:ring-emerald-500"
                      >
                        <option value="received">Accepted</option>
                        <option value="copying">Copying</option>
                        <option value="completed">Completed</option>
                        <option value="failed">Failed</option>
                        <option value="picked_up">Returned</option>
                      </select>
                    </div>
                  )}
                </>
              ) : activeTab === 'duplicators' ? (
                <>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-mono uppercase font-black text-slate-400">Unique Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Systor-SYS-10-A"
                      value={duplicatorForm.name}
                      onChange={(e) => setDuplicatorForm({...duplicatorForm, name: e.target.value})}
                      className="w-full bg-[#0E0E10] border border-[#2A2A2E] rounded-lg px-3 py-2 text-xs text-white focus:ring-1 focus:ring-emerald-500 font-mono font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-mono uppercase font-black text-slate-400">Manufacturer</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Systor, Aleratec"
                      value={duplicatorForm.manufacturer}
                      onChange={(e) => setDuplicatorForm({...duplicatorForm, manufacturer: e.target.value})}
                      className="w-full bg-[#0E0E10] border border-[#2A2A2E] rounded-lg px-3 py-2 text-xs text-white focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-mono uppercase font-black text-slate-400">Duplication Slots</label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        required
                        value={duplicatorForm.slots_total}
                        onChange={(e) => {
                          const total = parseInt(e.target.value, 10) || 1;
                          const currentStatus = [...duplicatorForm.slots_status];
                          let newStatus = [...currentStatus];
                          if (newStatus.length < total) {
                            while (newStatus.length < total) newStatus.push(true);
                          } else if (newStatus.length > total) {
                            newStatus.length = total;
                          }
                          setDuplicatorForm({...duplicatorForm, slots_total: total, slots_status: newStatus});
                        }}
                        className="w-full bg-[#0E0E10] border border-[#2A2A2E] rounded-lg px-3 py-2 text-xs text-white focus:ring-1 focus:ring-emerald-500 font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-mono uppercase font-black text-slate-400">Year Put In Service</label>
                      <input
                        type="number"
                        min={1990}
                        max={2050}
                        required
                        value={duplicatorForm.year_in_service}
                        onChange={(e) => setDuplicatorForm({...duplicatorForm, year_in_service: parseInt(e.target.value, 10) || new Date().getFullYear()})}
                        className="w-full bg-[#0E0E10] border border-[#2A2A2E] rounded-lg px-3 py-2 text-xs text-white focus:ring-1 focus:ring-emerald-500 font-mono"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-mono uppercase font-black text-slate-400">Source Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Wikipedia Offline Mirror"
                      value={sourceForm.name}
                      onChange={(e) => setSourceForm({...sourceForm, name: e.target.value})}
                      className="w-full bg-[#0E0E10] border border-[#2A2A2E] rounded-lg px-3 py-2 text-xs text-white focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-mono uppercase font-black text-slate-400">Description</label>
                    <textarea
                      required
                      rows={3}
                      placeholder="Enter description of dataset contents..."
                      value={sourceForm.description}
                      onChange={(e) => setSourceForm({...sourceForm, description: e.target.value})}
                      className="w-full bg-[#0E0E10] border border-[#2A2A2E] rounded-lg px-3 py-2 text-xs text-white focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-mono uppercase font-black text-slate-400">Physical Interface</label>
                      <input
                        type="text"
                        required
                        value={sourceForm.interface}
                        onChange={(e) => setSourceForm({...sourceForm, interface: e.target.value})}
                        className="w-full bg-[#0E0E10] border border-[#2A2A2E] rounded-lg px-3 py-2 text-xs text-white focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-mono uppercase font-black text-slate-400">Minimum drive size</label>
                      <input
                        type="text"
                        required
                        value={sourceForm.size_options}
                        onChange={(e) => setSourceForm({...sourceForm, size_options: e.target.value})}
                        className="w-full bg-[#0E0E10] border border-[#2A2A2E] rounded-lg px-3 py-2 text-xs text-white focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                </>
              )}

                <div className="flex justify-end gap-2 pt-3 border-t border-[#2A2A2E]">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 bg-[#0E0E10] border border-[#2A2A2E] text-slate-300 hover:text-white text-xs font-bold rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg cursor-pointer shadow-md"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* USER MANAGEMENT MODAL */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#16161A] border border-slate-700/50 rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-slate-900/60 p-4 border-b border-[#2A2A2E] flex justify-between items-center">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider font-sans">
                {editingUser ? `Edit User Credentials: ${editingUser.username}` : 'Register New System User'}
              </h4>
              <button
                onClick={() => setShowUserModal(false)}
                className="text-slate-400 hover:text-slate-200 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUserSubmit} className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-mono uppercase font-black text-slate-400">Full Display Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={userForm.name}
                  onChange={(e) => setUserForm({...userForm, name: e.target.value})}
                  className="w-full bg-[#0E0E10] border border-[#2A2A2E] rounded-lg px-3 py-2 text-xs text-white focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-mono uppercase font-black text-slate-400">System Username</label>
                <input
                  type="text"
                  required
                  disabled={!!editingUser}
                  placeholder="e.g. jdoe"
                  value={userForm.username}
                  onChange={(e) => setUserForm({...userForm, username: e.target.value})}
                  className="w-full bg-[#0E0E10] border border-[#2A2A2E] disabled:opacity-50 rounded-lg px-3 py-2 text-xs text-white focus:ring-1 focus:ring-emerald-500 font-mono font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-mono uppercase font-black text-slate-400">Security Password</label>
                <input
                  type="password"
                  required={!editingUser}
                  placeholder={editingUser ? "Leave empty to retain current password" : "Enter account access password"}
                  value={userForm.password}
                  onChange={(e) => setUserForm({...userForm, password: e.target.value})}
                  className="w-full bg-[#0E0E10] border border-[#2A2A2E] rounded-lg px-3 py-2 text-xs text-white focus:ring-1 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-mono uppercase font-black text-slate-400">Access Role Permission Level</label>
                <select
                  value={userForm.role}
                  onChange={(e) => setUserForm({...userForm, role: e.target.value as UserRole})}
                  className="w-full bg-[#0E0E10] border border-[#2A2A2E] rounded-lg px-2.5 py-2 text-xs text-white focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="volunteer">Volunteer (Intake Portal)</option>
                  <option value="processing">Processing (Technician Desk)</option>
                  <option value="user">User (Standard Endpoint)</option>
                  <option value="admin">Admin (System Workspace Ledger)</option>
                </select>
              </div>

              <div className="flex items-center gap-2.5 pt-1.5">
                <input
                  type="checkbox"
                  id="user-locked"
                  checked={userForm.isLocked}
                  disabled={editingUser?.username.toLowerCase().trim() === 'admin'}
                  onChange={(e) => setUserForm({...userForm, isLocked: e.target.checked})}
                  className="h-3.5 w-3.5 rounded bg-slate-900 border-[#2A2A2E] text-emerald-600 focus:ring-0 focus:ring-offset-0"
                />
                <label htmlFor="user-locked" className="text-xs text-slate-300 font-medium select-none cursor-pointer">
                  Lock account access (suspends operational login authorization)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#2A2A2E]">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-4 py-2 bg-[#0E0E10] border border-[#2A2A2E] text-slate-300 hover:text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg cursor-pointer shadow-md"
                >
                  Save User Details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
