# Drive-Ops Quad-Interface QA & Testing Process

This document defines the formal Quality Assurance (QA) and testing process for the **Drive-Ops Quad-Interface system** (spanning Admin, Volunteer, Processing, and Kiosk portals). Use this protocol to verify Django schema integrity, barcode scanning capabilities, Master/Replica sync triggers, and visual components under heavy workloads (1,000+ mock records).

---

## 1. QA Testing Strategy Overview

The testing suite consists of a **Dual-Verification Model**:
1. **Interactive Real-Time Simulation**: A live QA Control Panel built directly into the application header to trigger, automate, and inspect state transitions and API compliance under real-world conditions.
2. **Step-by-Step Manual Checklist**: Rigorous functional validation criteria across authorization gates, webcam scanning fallback loops, receipt template bounds, and data replication.

---

## 2. Portal 1: Volunteer Point of Sale (Intake) QA Process

The **Volunteer Portal** is the physical entry point for incoming drives. It is responsible for hardware intake, label OCR, database record registration, and printing physical labels.

### A. Core Test Cases

| Test Case ID | Test Target | Action / Input | Expected Result |
|---|---|---|---|
| **VOL-01** | Authorization Gate | Attempt login with `volunteer` / `vol123`. | Session established successfully. Redirected to Volunteer view. Header displays the "Volunteer Operator" badge. |
| **VOL-02** | Webcam Activation fallback | Click "Start Camera Feed". | Attempts to acquire webcam using sequential facing constraints. If camera is blocked/absent, the UI displays the programmatic Gemini fallback state or file-upload dropzone without throwing an unhandled runtime exception. |
| **VOL-03** | Gemini OCR Label Scanning | Upload/Simulate hard drive label image capture. | Sends base64 image data to `/api/disks/scan-label`. Gemini 3.5 Flash successfully parses and returns structured JSON: `hd_manufacturer`, `hd_model`, `hd_serial`, `hd_size`, `hd_speed`. UI populates form inputs with parsed values. |
| **VOL-04** | Target Source Alignment | Match the drive size options with Datasource specs. | The portal queries `/api/datasources` to populate selectable target datasets. Validates that size specifications match selected storage guidelines. |
| **VOL-05** | Label Generation & Timestamps | Generate Disk ID and view receipt. | A unique 16-character alphanumeric Disk ID is generated. Physical Asset Tag (Tag #1) and DDV Claim Ticket (Ticket #2) are rendered in a clean monospace template. The "Accepted At" field contains a real-time, non-null locale ISO string representing intake completion. |
| **VOL-06** | Formatting & Text-Wrap | Inspect long Alphanumeric IDs and dataset names. | Verify that long generated strings wrap correctly (using `break-all` and `whitespace-normal`) without clipping, spilling over bounds, or pushing QR code elements off the layout. |
| **VOL-07** | Label Printing Simulator | Click "Print Labels" trigger. | Triggers a simulated print completion event. Renders an interactive success modal confirming receipt delivery without calling browser blocking `window.print()` directly if iframe constraints are active. |

---

## 3. Portal 2: Processing Desk (Duplication Desk) QA Process

The **Processing Desk** is used by lab technicians to manage bitwise replication, track data duplication progress, and log hardware failure states.

### A. Core Test Cases

| Test Case ID | Test Target | Action / Input | Expected Result |
|---|---|---|---|
| **PROC-01** | Authorization Gate | Attempt login with `processing` / `proc123`. | Session established successfully. Denies access to Admin but redirects to Duplication Workspace. |
| **PROC-02** | Disk ID Search & Retrieval | Query a newly registered Disk ID (e.g. from VOL-05). | Searching for Disk ID or Serial instantly focuses the disk asset, showing manufacture brand, serial key, target dataset, and current "received" state. |
| **PROC-03** | Replication State Transition | Click "Start Copying Protocol". | Disk status changes to `copying`. Backend records `copy_start_time`. Master global banner fires a live "PUSH REPLICATION EVENT" alert informing that the sync replica is active. |
| **PROC-04** | Dynamic Progress Simulator | Monitor copying progress bar. | A fluid, percentage-based progress bar transitions from 0% to 100%. Technicians can adjust the simulation speed in real-time. |
| **PROC-05** | Bitwise Verification Success | Complete progress bar with "Expected Outcome: Success". | Disk status transitions to `completed`. Monospace log appends: "Duplication completed with bitwise integrity checksum verification: SUCCESS." `copy_complete_time` timestamp is saved. |
| **PROC-06** | Sector Write Failure | Abort copy process with "Expected Outcome: Failure". | Disk status transitions to `failed`. Monospace log appends: "Duplication process aborted with hardware write sector fault or IO read failure." `copy_fail_time` timestamp is saved. |
| **PROC-07** | Batch Scanning Station | Switch to "Batch Terminal Scanner" and input sequential IDs. | Simulates keyboard wedge barcode scanning. Verifies that sequential inputs instantly stage multiple drives into the processing queue without causing UI freeze. |

---

## 4. Portal 3: Status Kiosk Terminal (Donor Portal) QA Process

The **Status Kiosk Terminal** is a read-only public lookup display for physical owners to check live replication progress.

### A. Core Test Cases

| Test Case ID | Test Target | Action / Input | Expected Result |
|---|---|---|---|
| **KIOS-01** | Unauthenticated Access | Click "Status Kiosk" tab from an unauthenticated session. | Access granted immediately without requiring operator check-in credentials. |
| **KIOS-02** | Keyboard Wedge Simulator | Enter a registered Disk ID manually or with QR input wrapper. | Instantly queries `/api/kiosk/lookup-disk/:disk_id`. Pulls correlated status logs directly from the replicated schema partition. |
| **KIOS-03** | Replicated Logging History | Inspect the audit history of the queried disk. | The Kiosk displays a complete, chronological timeline of operations (e.g. "Drive registered", "Duplication process started", "Bitwise verification complete"). |
| **KIOS-04** | Non-existent Record Handling | Input a non-registered Disk ID (e.g., "VAL-FAKE"). | UI shows a clean, styled warning card: "Tracking ID or Serial number not registered in replicated database. Visit the volunteer check-in desk." No fatal API crashes. |
| **KIOS-05** | Claim Ticket Generation | Click "Print Replicated Receipt" in Kiosk. | Generates a U.S. dollar-bill sized claim ticket matching Ticket #2. Verify that long Disk IDs are wrapped properly, timestamps are correct, and no QR code labels are truncated. |

---

## 5. Portal 4: Admin Management Console QA Process

The **Admin Portal** is the central control center for database schemas, replication ledger audits, datasource management, and load-testing simulation.

### A. Core Test Cases

| Test Case ID | Test Target | Action / Input | Expected Result |
|---|---|---|---|
| **ADM-01** | Role-Based Access Control | Attempt Admin entry while logged as `volunteer`. | Intercepted by Admin Block restriction HUD. Displays "Interface Locked" and offers options to re-authenticate as admin. |
| **ADM-02** | Datasource CRUD Compliance | Create, edit, and delete a Datasource (e.g. "Source F"). | Django-compliant DataSource records are modified. API returns standard JSON, saving changes to the master file `db.json` and pushing updates to the layout. |
| **ADM-03** | Real-Time Replication Ledger | View "Replication Sync Logs" terminal. | Shows a live, scrollable feed of all ledger mutations. Displays correct SQLite/Django transaction syntax (e.g. `INSERT INTO disks`, `UPDATE disks SET status='completed' WHERE id=...`). |
| **ADM-04** | Central Disk Registry Search | Type a serial or ID in the Admin disks table search bar. | Instantly filters records. Verify that pagination is updated and sorting controls work. |

---

## 6. Load Testing & Seeding Verification (1,000+ Records)

This process tests UI rendering capacity, pagination, and API throughput under a heavy server payload of 1,000 to 2,000 active database entries.

### A. Load Verification Checklist

1. **Seeding Phase**:
   - Access the **Admin Portal** as `admin` (password: `admin123`).
   - Scroll to the **Load Testing Suite** section.
   - Click **Generate 1,000 Load Test Records**.
   - Verify the visual loading spinner. Upon completion, confirm that a success modal reports: *"Successfully generated 1000 mock load-test drives."*
2. **Table Pagination Phase**:
   - Navigate to the Admin Disks table. Verify that pagination controls divide the 1,000+ records into responsive, easily navigatable blocks.
   - Verify that jumping to last page or changing page sizes functions instantly without lagging or blocking the browser main thread.
3. **High-Volume Search Latency**:
   - In the search bar, type a generated mock serial (e.g. `SN-LT`).
   - Confirm that search queries execute quickly, returning matching records.
4. **Purging Phase**:
   - In the Admin Load Testing Suite, click **Purge Mock Load Test Data**.
   - Verify that all `disk-loadtest-` records are cleanly removed from `db.json`, restoring the database to its pristine, high-integrity state.

---

## 7. Edge Cases & Failure Mode Recovery Matrix

| Fail State / Edge Case | Test Procedure | Expected Safe Failure Outcome |
|---|---|---|
| **Camera Blocked** | Deny permission popup or turn off system hardware camera. | Camera panel recovers elegantly, displays an informative placeholder message, and suggests uploading a clear photo of the sticker label manually. |
| **Corrupted Image OCR** | Upload a blank, blurry, or non-hard-drive image to the Scanner. | Gemini API returns a graceful parsing exception. Heuristic Fallback system activates, generating a random preset and notifying: *"Utilizing Heuristic Match fallback system."* |
| **Missing Target Datasource** | Delete a Datasource that currently has registered disks. | Database prevents orphaned keys, or UI gracefully handles missing reference values, showing a styled placeholder name like `[DELETED SOURCE]` rather than throwing null-pointer exceptions. |
| **Duplicate Disk ID Collision** | Force creation of a Disk ID that already exists. | Backend checks `/api/disks` constraints and returns `400 Bad Request` with message: *"Disk ID Sequence already exists."* UI shows clear validation message. |
| **Extreme String Lengths** | Register a disk with a 100-character S/N or model. | Grid cards and monospace tickets expand dynamically (or wrap via `break-all`) without overflowing adjacent visual containers. |
