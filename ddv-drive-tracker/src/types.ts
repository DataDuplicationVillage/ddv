/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// User Roles for authentication
export type UserRole = 'admin' | 'volunteer' | 'user' | 'processing';

// Database Models
export interface User {
  username: string;
  password?: string; // Stored server-side or masked
  role: UserRole;
  name: string;
  isLocked?: boolean;
}

export interface DataSource {
  id: string; // unique ID
  name: string; // e.g., "Project Core Archive"
  description: string;
  required_specs: {
    interface: string; // e.g., "SATA 3"
    size_options: string[]; // e.g., ["8TB", "6TB"]
  };
}

export interface Duplicator {
  id: string; // unique ID
  name: string; // e.g. "Dup-A" (Unique)
  manufacturer: string;
  slots_total: number;
  slots_status: boolean[]; // true = functional, false = non-functional
  year_in_service: number;
}

export interface DuplicatorHistoryEntry {
  duplicator_id: string;
  duplicator_name: string;
  timestamp: string;
}

export interface Disk {
  id: string; // Sequence Number (Unique, e.g., "ST8000-001")
  hd_manufacturer: string; // e.g., "Seagate"
  hd_model: string; // e.g., "ST8000VN004"
  hd_serial: string; // Serial number (Unique)
  hd_size: string; // e.g., "8TB"
  hd_speed: string; // e.g., "7200 RPM"
  source_requested_id: string; // Links to DataSource
  hd_image?: string; // Optional image identifier or custom URL

  // Time-based records
  received_time: string; // Date-string (Unique timestamp or identifier)
  copy_start_time: string | null; // Date-string or null
  copy_complete_time: string | null; // Date-string or null
  copy_fail_time: string | null; // Date-string or null
  pickup_time: string | null; // Date-string or null
  
  status: 'received' | 'copying' | 'completed' | 'failed' | 'picked_up';

  // Duplicator assignment tracking
  duplicator_id?: string; // Currently used duplicator ID
  duplicator_history?: DuplicatorHistoryEntry[];
}

// System Logs & Replica Info
export interface ReplicationLog {
  id: string;
  timestamp: string;
  action: string; // e.g., "INSERT", "UPDATE", "DELETE"
  table_name: string;
  description: string;
  record_id: string;
  payload: any;
}

export interface DiskStatusLog {
  id: string;
  disk_id: string;
  status: string;
  timestamp: string;
  operator: string;
  description: string;
}

export interface ServerState {
  users: User[];
  datasources: DataSource[];
  disks: Disk[];
  replication_logs: ReplicationLog[];
  disk_status_logs: DiskStatusLog[];
  duplicators: Duplicator[];
}
