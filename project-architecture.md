# DDV Project Architecture Overview

This document is written as a high-context handoff for an LLM or engineer joining the project. It explains what the project is, what currently exists in the repository, how the major parts relate, and what is still missing.

## Project Purpose

DDV stands for Data Duplication Village. The application tracks physical hard drives as they move through an event workflow:

1. A participant gives DDV a drive.
2. A volunteer accepts the drive, scans or enters the drive details, assigns the requested data source, and prints a physical asset tag plus customer claim ticket.
3. Processing staff move the drive through copying, success, failure, retry, or hold-for-pickup states.
4. A public kiosk lets participants scan their ticket or drive tag to check the current status.
5. The drive is returned to the participant and marked picked up.

The product is intended to support four operational portals:

- Admin Portal
- Volunteer Ops Portal
- Processing Portal
- Public Status Kiosk

The current repository contains two partially overlapping implementations:

- A root Django app that is the existing backend/admin/kiosk foundation.
- A copied React/Vite/Express app in `ddv-drive-tracker/` that better expresses the desired final user experience.

The recommended direction is to keep Django as the canonical backend and migrate the React portal experience onto Django APIs.

## Current Repository Layout

```text
.
├── README.md
├── design.md
├── schema.md
├── implementation-plan.md
├── project-architecture.md
├── Dockerfile
├── compose.yaml
├── docker-entrypoint.sh
├── requirements.txt
├── manage.py
├── ddv_project/
├── tracker/
└── ddv-drive-tracker/
```

Important root files:

- `design.md`: original feature/user-story sketch.
- `schema.md`: original Django-oriented schema sketch.
- `implementation-plan.md`: PR-by-PR execution plan for completing the project.
- `README.md`: current setup and Docker notes.
- `Dockerfile`, `compose.yaml`, `docker-entrypoint.sh`, `requirements.txt`: early Docker support for the root Django app.

Important Django directories:

- `ddv_project/`: Django project settings and URL routing.
- `tracker/`: Django app with models, admin, kiosk views, replica routing, and templates.

Important React/Express directories:

- `ddv-drive-tracker/src/`: React portals and UI.
- `ddv-drive-tracker/server.ts`: Express API prototype.
- `ddv-drive-tracker/db.json`: file-backed demo database.
- `ddv-drive-tracker/*.pdf`: workflow/product documents.

## Current Branch Context

The current branch is `add-docker`.

Local uncommitted branch work includes:

- Early root Django Docker setup.
- The copied `ddv-drive-tracker/` app.
- Workflow PDFs copied into `ddv-drive-tracker/`.
- `implementation-plan.md`.
- This architecture overview.

The root branch has pulled latest `origin/main` as of commit `daca324`.

## Root Django App

The Django app is the existing canonical-ish backend foundation, but it is not yet feature-complete.

### Django Project

`ddv_project/settings.py` currently configures:

- Django admin.
- `guardian` object permissions.
- `unfold` admin theme.
- `tracker.apps.TrackerConfig`.
- SQLite `default` database.
- SQLite `replica` database.
- Environment overrides for secret key, debug flag, allowed hosts, and database directory.

The root URL config exposes:

- `/admin/`
- tracker URLs at `/`

### Django Models

Current models live in `tracker/models.py`:

- `DiskModel`
  - make
  - model
  - capacity

- `DiskHaver`
  - optional Django `User`
  - name

- `DataSource`
  - name

- `Disk`
  - string primary key, same as QR code ID
  - disk model
  - serial number
  - firmware version

- `DiskHavings`
  - timestamp
  - disk
  - disk haver
  - havings type
  - optional datasource

`DiskHavings.HAVING_TYPE_CHOICES` currently includes:

- `give`
- `take`
- `copyready`
- `copysuccess`
- `copyfail`
- `broken`

### Django Admin

`tracker/admin.py` registers all tracker models.

Special behavior:

- `DiskHavingsAdmin` filters rows for non-superusers with guardian object permissions.
- `DiskAdmin` adds a custom `generate-qr/` admin view.
- The QR generation flow can create a disk, create or reuse a `DiskHaver`, create a `DiskHavings` row, and render a QR code.

### Django Kiosk

Current kiosk views:

- `kiosk_home`: hidden input form for scanner keyboard input.
- `kiosk_scan`: looks up `DiskHavings` in the `replica` database by `disk_id`.

Current kiosk behavior:

- A scan redirects to `/kiosk/<disk_id>/`.
- If no replica history is found, an error page is shown.
- If history is found, the latest `DiskHavings` row determines the owner.
- The kiosk displays all history for that owner from the replica database.

### Django Replica Behavior

The current `replica` implementation is basic:

- `settings.py` defines two SQLite databases: `default` and `replica`.
- `tracker/routers.py` allows migrations on both.
- `tracker/signals.py` copies saved/deleted tracker model instances into `replica`.

Important mismatch:

- The original design says only kiosk-needed data should be replicated.
- Current signals replicate `DiskModel`, `DataSource`, `DiskHaver`, `Disk`, and `DiskHavings`.
- This broader replication is partly necessary because `DiskHavings` has foreign keys to related models.

This should be revisited before production. A read-only kiosk API or denormalized kiosk read model may be simpler than maintaining a second SQLite DB.

## React/Express Prototype

The `ddv-drive-tracker/` app is a richer prototype of the desired product. It is currently separate from Django.

### Runtime

`ddv-drive-tracker/package.json` defines:

- React 19
- Vite
- Tailwind CSS v4
- Express
- TypeScript
- Gemini SDK
- `qrcode.react`
- `lucide-react`
- Recharts

The Express server runs on port `3000` and serves both:

- JSON API routes under `/api/...`
- The Vite-powered React frontend in development

### Express Prototype Backend

`ddv-drive-tracker/server.ts` currently owns:

- Static demo authentication.
- Disk CRUD.
- Datasource CRUD.
- Status log storage.
- Kiosk lookup.
- Mock load-test seeding.
- Gemini OCR endpoint with fallback presets.
- File-backed state in `db.json`.

Important routes:

- `POST /api/auth/login`
- `GET /api/disks`
- `POST /api/disks`
- `PUT /api/disks/:id`
- `DELETE /api/disks/:id`
- `GET /api/disks/:id/status-logs`
- `GET /api/datasources`
- `POST /api/datasources`
- `PUT /api/datasources/:id`
- `DELETE /api/datasources/:id`
- `GET /api/kiosk/lookup-disk/:disk_id`
- `GET /api/kiosk/replica-diskhavings`
- `POST /api/admin/generate-mock-load-test`
- `POST /api/admin/purge-mock-load-test`
- `POST /api/disks/scan-label`

This backend is useful as an API contract prototype but is not production-grade:

- It uses `db.json`.
- It uses hardcoded demo credentials.
- It does not enforce real permissions.
- It only simulates replica behavior.
- It is not integrated with Django.

### React App Shell

`ddv-drive-tracker/src/App.tsx` implements the top-level portal shell.

The four tabs are:

- Admin
- Volunteer Ops
- Processing
- Status Kiosk

Authentication behavior:

- Kiosk is public.
- Admin, Volunteer, and Processing require demo login.
- Session is stored in `localStorage` as `ddv_master_session`.

Demo credentials are defined in the Express server:

- `admin` / `admin123`
- `volunteer` / `vol123`
- `processing` / `proc123`
- `scott` / `user123`
- `flora` / `user123`

### Admin Portal

`ddv-drive-tracker/src/components/AdminPortal.tsx`

Current capabilities:

- List/search/filter/paginate disks.
- Create/edit/delete disks.
- Inline disk status changes.
- List/create/edit/delete datasources.
- Generate and purge mock load-test records.
- Display reports/charts by drive status and timeline.

This portal expects an API shape centered on a single `Disk` record with current `status` and lifecycle timestamps.

### Volunteer Portal

`ddv-drive-tracker/src/components/VolunteerPortal.tsx`

Current capabilities:

- Intake flow.
- Webcam capture or image upload.
- Gemini OCR call through `/api/disks/scan-label`.
- Mock scan buttons for demo flows.
- Missing/unresolved OCR field warning.
- Manual correction.
- Duplicate serial detection with admin override.
- Source assignment.
- Asset tag and customer ticket previews.
- Drive creation through `/api/disks`.
- Return/release workflow.
- Reprint tag/ticket workflow.

This portal most closely matches the drive acceptance PDF.

### Processing Portal

`ddv-drive-tracker/src/components/ProcessingDesk.tsx`

Current capabilities:

- List/search/paginate active drives.
- Batch barcode scan station.
- Instant or queued batch status updates.
- Simulated copier run.
- Configurable success/failure/random outcome.
- Manual bypass status changes.
- Label printing preview.
- Status metric cards.

This portal most closely matches the process-flow PDF.

### Kiosk Portal

`ddv-drive-tracker/src/components/KioskTerminal.tsx`

Current capabilities:

- Public scan/search form.
- On-screen keypad.
- Handles raw IDs, `VAL-` IDs, and star-wrapped barcode values.
- Calls `/api/kiosk/lookup-disk/:disk_id`.
- Displays four-phase status.
- Displays expandable status/audit log.
- Can print a status ticket preview.

Important current issue:

- The kiosk calls `/api/kiosk/lookup-disk/:disk_id`, then also fetches `/api/disks` to join full disk details.
- That violates the intended read-only kiosk boundary.
- Final architecture should return all kiosk-safe data from one public read-only endpoint.

## Product Workflow Documents

Four PDFs live in `ddv-drive-tracker/` and define the desired flow.

### Drive Acceptance

`DDV Drive Acceptance - v1.5.pdf`

High-level flow:

1. Start.
2. Scan for HD image.
3. Parse label info.
4. Determine whether this is a new drive.
5. If existing, update existing drive.
6. Enter source request.
7. Check drive specs.
8. If invalid, show invalid drive alert and allow changes.
9. Add/update drive in DB.
10. Print tag and ticket.
11. Display current status.
12. End.

The acceptance flow requires drive spec validation against source requirements.

### Drive Pickup

`Drive Pickup - v1.0.pdf`

High-level flow:

1. Start.
2. Scan ticket QR code.
3. Lookup drive status.
4. Determine if drive is ready.
5. If not ready, display drive status and return to scan after timer.
6. If ready, update drive in DB.
7. Display drive status.
8. End.

This requires a pickup timestamp and a clear ready/not-ready status.

### Drive Process Flow

`Drive Process Flow.pdf`

High-level flow:

1. Drive received.
2. Hold for processing.
3. Apply selected source.
4. Start copy.
5. Determine copy success.
6. If success, apply label for success, print tag/ticket, hold for pickup.
7. If failure, determine whether time and space are available to try again.
8. If retry is possible, start copy again.
9. If retry is not possible, update tag with failure.
10. Verify tag and return.

This requires lifecycle state transitions and failure handling.

### Drive Tracking Description

`Drive Tracking Description.pdf`

This is a compact product blueprint. It confirms:

- Four-portal architecture.
- React/Vite/Tailwind frontend.
- Express prototype backend on `0.0.0.0:3000`.
- Gemini OCR for label parsing.
- Physical media asset tag.
- Customer claim ticket.
- Redundant ingestion guard by serial number.
- Phase-locked progress routing.
- Dark operational UI paired with clean printable tag/ticket layouts.

## Canonical Product Data Shape

The PDFs and React prototype define a richer canonical drive shape than the current Django model.

Required static fields:

- Sequence ID / Disk ID.
- HD image.
- HD manufacturer.
- HD model.
- HD serial number.
- HD size.
- HD speed.
- Source requested.

Required time fields:

- Received time.
- Copy start time.
- Copy complete time.
- Copy fail time.
- Pickup time.

Required lifecycle states:

- Received / Pending.
- Duplication Active.
- Copy Complete / Dispatch Ready.
- Copy Failed.
- Returned / Picked Up.

Required datasource requirements:

- Interface requirement, such as SATA 3.
- Allowed size options, such as 8TB and 6TB.
- Requirements vary by source.

## Current Data Model Mismatch

The biggest architectural problem is that Django and React do not agree on the data shape.

React/Express expects:

- One `Disk` object with hardware fields, current status, source request, image, and lifecycle timestamps.
- `DataSource` records with descriptions and `required_specs`.
- `DiskStatusLog` records for audit/history.

Django currently has:

- `DiskModel` for make/model/capacity.
- `Disk` for disk ID, disk model, serial number, firmware version.
- `DiskHavings` as event/ownership/transfer rows.
- No direct image field.
- No direct current status field.
- No direct lifecycle timestamps on `Disk`.
- No source compatibility requirements.
- No REST API.

This mismatch must be resolved before the React portals can run against Django.

## Recommended Target Architecture

Recommended end state:

```text
Browser
  |
  |-- React SPA: Admin / Volunteer / Processing / Kiosk
        |
        |-- Django JSON API
              |
              |-- Django auth, groups, permissions
              |-- canonical relational data model
              |-- status/audit logs
              |-- OCR integration endpoint
              |-- label/ticket data endpoints
              |-- public read-only kiosk endpoint
              |
              |-- SQLite for local/event MVP or Postgres later
```

Docker Compose should run the services for development and event demos.

Vagrant should wrap Docker Compose for users who need a reproducible VM environment.

Express should eventually be removed or demoted to a mock prototype once Django API parity exists.

## Runtime Architecture

### Current Docker Direction

The current branch has early Docker support for the root Django app:

- Python 3.12 slim image.
- Installs `requirements.txt`.
- Runs migrations on `default` and `replica`.
- Runs Django dev server on `0.0.0.0:8000`.
- Stores SQLite files in a Docker volume.

### Recommended Compose Runtime

Short-term Compose should run both apps:

- `django`
  - root Django app.
  - port `8000`.
  - volume for SQLite data.

- `drive-tracker`
  - React/Express prototype.
  - port `3000`.
  - volume for `db.json` or app data.
  - optional `GEMINI_API_KEY`.

This lets reviewers compare current Django behavior with the richer target UX.

### Recommended Vagrant Runtime

Vagrant should not become a second app provisioning system.

Vagrant should:

- Boot a Linux VM.
- Install Docker and Docker Compose.
- Mount or sync the repo.
- Run `docker compose up --build`.
- Forward host ports to guest ports.

Recommended forwarded ports:

- host `8000` -> guest `8000` -> Django.
- host `3000` -> guest `3000` -> React/Express.

## Auth And Roles

Desired roles:

- Admin
- Volunteer
- Processing / Technician
- User / participant
- Public kiosk

Recommended permission boundaries:

- Admin can do everything, including duplicate serial override and manual corrections.
- Volunteer can perform intake, return, reprint, and kiosk lookups.
- Processing can update copy lifecycle, batch scan, and access kiosk/volunteer support views.
- User/participant, if retained, can only see their own history/status.
- Public kiosk can read status only and cannot mutate data.

Current state:

- Django uses Django auth plus guardian object permissions in a limited way.
- React/Express uses static demo credentials.
- The final system needs server-side role enforcement in Django APIs.

## Public Kiosk Boundary

The kiosk must be public and read-only.

Final kiosk endpoint should:

- Accept sequence ID, QR payload, or serial number.
- Normalize barcode scanner formats like `VAL-<id>` and `*VAL-<id>*`.
- Return current phase/status.
- Return safe public drive details.
- Return public status history.
- Avoid exposing full master records.
- Avoid requiring authentication.

Open architectural choice:

- Use a read-only API against the main DB.
- Use a denormalized kiosk read model.
- Use a physical replica DB.

Recommended first step:

- Use a read-only Django API or denormalized read model.
- Do not overbuild physical SQLite replication unless deployment requires it.

## OCR And Image Handling

Desired behavior:

- Volunteer captures or uploads a drive label image.
- Backend sends image to Gemini OCR when configured.
- Backend extracts manufacturer, model, serial, size, and speed.
- Backend detects missing or low-confidence fields.
- UI shows unresolved fields with image proof.
- Operator can manually correct or skip missing data.
- Created drive stores image proof.

Current state:

- React/Express implements `/api/disks/scan-label`.
- Django has no equivalent.

Final state:

- Django owns OCR endpoint and image persistence.
- React calls Django.
- Gemini API key is provided through environment.
- Fallback behavior works without Gemini for local demos.

## Label And Ticket Requirements

Two printable outputs are required.

Physical media asset tag:

- 2 inches wide by 4 inches long.
- Sequence ID.
- QR code.
- Source requested.
- Disk serial number.
- Photo proof from scanning.
- Affixed directly to the drive.

Customer claim ticket:

- Sequence ID.
- QR code.
- Source requested.
- Plain-language claim instructions.
- Given to the participant.

Current state:

- React prototype renders tag/ticket previews.
- Django admin can generate a QR code, but not the full final tag/ticket workflow.

Final state:

- Tag/ticket rendering should work from canonical Django data.
- Reprint should be available to Admin and Volunteer.
- QR payload format should be documented and stable.

## Main Missing Work

Infrastructure:

- Finish Docker Compose for both apps.
- Add Vagrant wrapper around Compose.
- Document runtime commands.

Backend:

- Decide canonical architecture.
- Align Django data model with product workflow.
- Add REST API.
- Add role-based authorization.
- Add source requirement validation.
- Add lifecycle transition model.
- Add status/audit logs.
- Add public kiosk API.
- Decide replica/read-only strategy.
- Add OCR/image endpoint.
- Add label/ticket data/rendering support.

Frontend:

- Centralize API client.
- Configure API base URL.
- Migrate portals from Express API to Django API.
- Remove static auth.
- Remove kiosk master-data fetch.
- Remove demo-only wording when production-ready.

Testing:

- Django model tests.
- Django API tests.
- Permission tests.
- Lifecycle transition tests.
- Kiosk lookup tests.
- OCR fallback tests.
- Frontend typecheck/build.
- Docker Compose validation.
- Optional Playwright smoke tests for four portals.

Operations:

- Event-day runbook.
- Admin bootstrap.
- Data backup/restore.
- Demo seed data.
- Import/export.
- Security hardening.

## Key Risks

### Two Backends Drift

Django and Express currently model different applications. Avoid adding major new features to both. Use Express as a prototype and migrate behavior into Django.

### Data Model Refactor Breaks Existing Admin

Django admin currently works for the small schema. Add fields/migrations carefully and keep tests around existing behavior.

### Replica Gets Overbuilt Too Early

Physical replication is not yet proven necessary. Prefer a read-only API or denormalized read model until event deployment needs are clearer.

### OCR Becomes A Blocking Dependency

Manual entry must always work. Gemini should improve speed and accuracy but not block intake.

### Printing Depends On Unknown Hardware

Browser print CSS and QR output should be the first target. Direct printer integration should wait until printer hardware is known.

### Vagrant Duplicates Docker Logic

Vagrant should only install Docker and run Compose. Do not create a parallel Python/Node install path inside the VM.

## Where To Start

The best immediate next step is infrastructure:

1. Finish Docker Compose for root Django.
2. Add Docker support for `ddv-drive-tracker`.
3. Add Vagrant that installs Docker and runs Compose.
4. Document both app URLs.

After that, decide the canonical backend and freeze the API contract before touching schema/API migration work.

For detailed PR sequencing, see `implementation-plan.md`.
