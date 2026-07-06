# DDV End-to-End Implementation Plan

This plan breaks the missing project work into reviewable pull requests. It is based on the current repo state, the root Django app, the copied `ddv-drive-tracker` React/Express app, and the workflow documents:

- `design.md`
- `schema.md`
- `ddv-drive-tracker/DDV Drive Acceptance - v1.5.pdf`
- `ddv-drive-tracker/Drive Pickup - v1.0.pdf`
- `ddv-drive-tracker/Drive Process Flow.pdf`
- `ddv-drive-tracker/Drive Tracking Description.pdf`

## Working Assumption

The React/Express app in `ddv-drive-tracker/` is the best expression of the desired product experience. The root Django app is the existing backend/admin/kiosk foundation. The recommended end state is:

- Django owns the canonical data model, auth, permissions, migrations, and durable API.
- React owns the four operational portals.
- Docker Compose is the reproducible runtime.
- Vagrant is a VM wrapper that installs Docker and runs Compose.
- The Express server remains a prototype/mock service only until Django API parity exists.

Do not merge the React and Django apps in the same PR as Docker/Vagrant. Make the environment reproducible first, then migrate the product behavior onto the chosen backend.

## Current State

### Root Django App

The root app currently provides:

- Django admin.
- `DiskModel`, `DiskHaver`, `DataSource`, `Disk`, and `DiskHavings`.
- Custom admin QR generation.
- A public kiosk form that looks up `DiskHavings` from the `replica` SQLite database.
- SQLite `default` and `replica` databases.
- Signal-based copying of tracker models into the replica database.
- Early Docker files on this branch.

Major Django gaps:

- No REST API.
- No four-portal workflow.
- No drive image field.
- No lifecycle status field or explicit phase model.
- No copy/pickup timestamp fields on the main drive record.
- No OCR endpoint.
- No label/ticket print system outside admin QR generation.
- No datasource compatibility metadata.
- No test suite.
- No production-grade auth/role mapping for Admin, Volunteer, Processing, and public Kiosk.

### Copied React/Express App

The `ddv-drive-tracker/` app currently provides:

- Admin portal.
- Volunteer intake/return/reprint portal.
- Processing portal.
- Public kiosk portal.
- Express API on port `3000`.
- `db.json` file-backed storage.
- Static local demo credentials.
- Gemini OCR endpoint with fallback behavior.
- Tag/ticket previews and QR generation.
- Mock load-test data endpoints.

Major React/Express gaps:

- It is not connected to Django.
- It uses `db.json`, not a real relational data model.
- Auth is static demo auth.
- Replica behavior is mostly simulated.
- The kiosk still fetches master disk data through `/api/disks`.
- The backend is not hardened for production/event use.
- No meaningful automated tests.

## PR Rules

Each PR should be independently reviewable and runnable. Avoid combining unrelated domains.

Good PR boundaries:

- Infrastructure separate from schema.
- Schema separate from API.
- API separate from frontend rewiring.
- Frontend behavior separate from visual polish.
- Auth separate from OCR.
- Replica/read-only kiosk work separate from general CRUD.

Each PR should include:

- Clear README or developer docs update when workflows change.
- Minimal tests for changed behavior.
- A smoke-test command in the PR description.
- No unrelated refactors.
- No deletion of the Express prototype until the Django replacement is verified.

## PR 1: Docker Compose And Vagrant Runtime Baseline

### Goal

Make the project reproducible with Docker, and make Vagrant a VM wrapper around Docker Compose.

### Scope

- Finish the root Django Docker setup.
- Add a Docker setup for `ddv-drive-tracker`.
- Expand `compose.yaml` to run both apps.
- Add `Vagrantfile`.
- Add Vagrant provisioning script.
- Forward ports from Vagrant to host.
- Document commands.

### Missing Pieces Addressed

- Reproducible local runtime.
- Docker inside Vagrant.
- Clear separation between Django app and React/Express prototype.

### Expected Services

- `django`: root Django app on container/guest port `8000`.
- `drive-tracker`: React/Express app on container/guest port `3000`.

### Expected Ports

- Host `8000` -> Vagrant guest `8000` -> Django container `8000`.
- Host `3000` -> Vagrant guest `3000` -> React/Express container `3000`.

### Files Likely Touched

- `Dockerfile`
- `compose.yaml`
- `docker-entrypoint.sh`
- `requirements.txt`
- `.dockerignore`
- `ddv-drive-tracker/Dockerfile`
- `ddv-drive-tracker/.dockerignore`
- `Vagrantfile`
- `scripts/provision-vagrant.sh`
- `README.md`

### Acceptance Criteria

- `docker compose config` passes.
- `docker compose up --build` starts both services.
- Django is reachable at `http://localhost:8000`.
- React/Express is reachable at `http://localhost:3000`.
- `vagrant up` provisions Docker and starts the same Compose stack.
- Vagrant does not install Django or Node directly as app runtimes.
- README explains native, Docker, and Vagrant workflows.

### Out Of Scope

- Porting Express APIs to Django.
- Reworking the data model.
- Production deployment.
- Real authentication.

## PR 2: Architecture Decision Records And API Contract

### Goal

Document the target architecture before starting the migration work.

### Scope

- Add a small `docs/` directory.
- Add an architecture decision record declaring Django as the canonical backend, if that remains the chosen path.
- Document the current React/Express API contract.
- Document the target Django API contract.
- Document the canonical drive lifecycle.
- Document what happens to the existing `DiskHavings` model.

### Missing Pieces Addressed

- The repo currently has two apps with different data models.
- The frontend and backend do not agree on the shape of a drive.
- The meaning of "replica" is inconsistent.

### Files Likely Touched

- `docs/adr/0001-canonical-backend.md`
- `docs/api-contract.md`
- `docs/lifecycle.md`
- `docs/replica-strategy.md`
- `README.md`

### Key Decisions To Capture

- Whether Django or Express owns durable data.
- Whether `DiskHavings` remains the canonical event ledger.
- Whether `Disk.status` is stored directly or derived from latest event.
- Whether the kiosk reads from the main database through a read-only API or from a physical replica.
- Whether `DiskModel` should remain normalized or whether drive manufacturer/model/size/speed should live directly on `Disk`.

### Acceptance Criteria

- The docs make it clear which backend is authoritative.
- The docs list every API route the React app needs.
- The docs map React status values to Django state/event values.
- The docs identify migration risks.

### Out Of Scope

- Code changes beyond docs.

## PR 3: Canonical Django Data Model

### Goal

Align Django with the drive lifecycle required by the PDFs and React prototype.

### Scope

Add or revise Django models so the backend can represent:

- Sequence ID.
- HD image.
- Manufacturer.
- Model.
- Serial number.
- Size.
- Speed.
- Source requested.
- Received time.
- Copy start time.
- Copy complete time.
- Copy fail time.
- Pickup time.
- Current status or derived current status.
- Status/audit log history.
- Source requirements.

### Missing Pieces Addressed

- Django cannot currently store the React app's drive record shape.
- Django cannot validate source compatibility.
- Django does not persist OCR images.
- Django does not store copy/pickup lifecycle timestamps.

### Suggested Model Direction

Keep the existing normalized model where useful, but add explicit lifecycle support:

- `Disk`
  - `id`
  - `disk_model`
  - `serial_number`
  - `firmware_version`
  - `image`
  - `source_requested`
  - `status`
  - `received_time`
  - `copy_start_time`
  - `copy_complete_time`
  - `copy_fail_time`
  - `pickup_time`

- `DiskModel`
  - `make`
  - `model`
  - `capacity`
  - `speed`
  - `interface`

- `DataSource`
  - `name`
  - `description`
  - `required_interface`
  - `allowed_sizes`

- `DiskStatusLog`
  - `disk`
  - `status`
  - `timestamp`
  - `operator`
  - `description`
  - `metadata`

If `DiskHavings` remains, define whether it is owner/transfer history, lifecycle history, or both.

### Files Likely Touched

- `tracker/models.py`
- `tracker/migrations/*`
- `tracker/admin.py`
- `schema.md`
- `design.md`
- `docs/lifecycle.md`

### Acceptance Criteria

- Migrations run on `default`.
- Migrations run on `replica` if replica still exists.
- The admin can view/edit the new fields.
- A disk can represent all fields listed in the PDFs.
- Source requirements can represent SATA 3 and allowed drive sizes like `8TB` and `6TB`.
- Tests cover model creation and basic status transitions.

### Out Of Scope

- REST API.
- React integration.
- OCR.

## PR 4: Seed Data, Fixtures, And Local Demo State

### Goal

Make repeatable demo/test data available for both local development and Vagrant demos.

### Scope

- Add Django fixtures or management commands for sample users, datasources, disk models, disks, and status logs.
- Add equivalent seed behavior for the React prototype if it continues to run independently.
- Document how to reset demo data.

### Missing Pieces Addressed

- The current Django app starts empty.
- The React app has mock data, but it is isolated in `db.json`.
- Local demos need predictable records and QR values.

### Files Likely Touched

- `tracker/management/commands/seed_demo_data.py`
- `tracker/fixtures/*.json`
- `README.md`
- `docs/demo-data.md`

### Acceptance Criteria

- `python manage.py seed_demo_data` creates useful demo records.
- Demo credentials are documented.
- Demo disk IDs can be scanned in kiosk.
- The command is idempotent or has a documented reset mode.

### Out Of Scope

- Production import/export.

## PR 5: Django API Foundation

### Goal

Add a structured JSON API layer to Django.

### Scope

- Add Django REST Framework or equivalent hand-written JSON views.
- Add `/api/` URL namespace.
- Add serializers or response builders.
- Add consistent validation errors.
- Add basic API smoke tests.

### Missing Pieces Addressed

- React cannot talk to Django today.
- Django has no API contract.

### Initial Endpoints

- `GET /api/health`
- `GET /api/disks`
- `POST /api/disks`
- `GET /api/disks/<id>`
- `PUT /api/disks/<id>`
- `DELETE /api/disks/<id>`
- `GET /api/datasources`
- `POST /api/datasources`
- `PUT /api/datasources/<id>`
- `DELETE /api/datasources/<id>`

### Files Likely Touched

- `requirements.txt`
- `ddv_project/urls.py`
- `tracker/api.py`
- `tracker/serializers.py`
- `tracker/tests/test_api.py`
- `README.md`

### Acceptance Criteria

- API responses match the documented contract.
- CRUD endpoints are tested.
- Validation errors are predictable JSON.
- Existing Django admin and kiosk pages still work.

### Out Of Scope

- Full auth.
- OCR.
- React migration.

## PR 6: Auth, Roles, And Portal Permissions

### Goal

Replace static demo auth with backend-backed roles and permissions.

### Scope

- Define role groups: Admin, Volunteer, Processing, User.
- Add login/logout/session endpoint or token endpoint.
- Enforce permissions server-side.
- Keep public kiosk endpoint unauthenticated.
- Add seed users for local demos.

### Missing Pieces Addressed

- React currently uses static credentials.
- Django permissions do not yet map cleanly to the four portals.
- Frontend route guards are not enough.

### Suggested Role Access

- Admin: all portals, all data, override duplicate serials.
- Volunteer: intake, return, reprint, kiosk.
- Processing: processing, volunteer read/assist, kiosk.
- User: limited personal status if retained.
- Public kiosk: read-only lookup only.

### Files Likely Touched

- `tracker/models.py`
- `tracker/api.py`
- `tracker/permissions.py`
- `tracker/tests/test_permissions.py`
- `docs/auth-and-roles.md`

### Acceptance Criteria

- Admin can perform all API actions.
- Volunteer can intake and release drives but cannot perform admin-only operations.
- Processing can update copy lifecycle state.
- Public kiosk can lookup status without login.
- Unauthorized writes fail with 401 or 403.

### Out Of Scope

- Frontend visual login rewiring, except small API contract docs if needed.

## PR 7: Datasource Requirements API

### Goal

Make datasource compatibility rules real.

### Scope

- Add fields for datasource requirements.
- Add API validation for source compatibility.
- Add tests for valid and invalid drive/source combinations.

### Missing Pieces Addressed

- The PDFs require drive specs to be checked against source requirements.
- React currently does some client-side validation only.

### Requirements From PDFs

- Source-specific requirements.
- Interface requirement such as SATA 3.
- Allowed sizes such as 8TB and 6TB.

### Acceptance Criteria

- Datasource CRUD supports requirement fields.
- Disk intake rejects incompatible specs unless an authorized override exists.
- Errors explain which requirement failed.
- Admin can configure requirements.

### Out Of Scope

- OCR.
- Print layouts.

## PR 8: Disk CRUD API Parity

### Goal

Make Django's disk API match the React prototype's expected disk shape.

### Scope

- Return disk fields using the frontend-compatible names or update the frontend contract.
- Support create, update, delete, list, detail.
- Support search/filter parameters used by Admin, Volunteer, Processing, and Kiosk.
- Add duplicate serial detection.
- Add admin override path.

### Missing Pieces Addressed

- React expects `hd_manufacturer`, `hd_model`, `hd_serial`, `hd_size`, `hd_speed`, `source_requested_id`, and timestamps.
- Django currently stores these differently or not at all.

### Acceptance Criteria

- React can fetch `/api/disks` from Django and render a list.
- Create validates required fields.
- Duplicate serial is rejected unless override is authorized.
- Updating disk fields creates an audit/status log when relevant.
- Tests cover create/update/delete and duplicate serial behavior.

### Out Of Scope

- Full portal rewiring.

## PR 9: Drive Lifecycle And Status Logs

### Goal

Implement the phase-locked drive lifecycle.

### Scope

- Define status values.
- Add transition validation.
- Add status log creation.
- Add status log API.
- Add processing-safe transition endpoints or update semantics.

### Lifecycle From PDFs

- Phase 01: Received / Pending.
- Phase 02: Duplication Active.
- Phase 03: Copy Complete / Dispatch Ready.
- Phase 03 alternate: Copy Failed.
- Phase 04: Drive returned.

### API Endpoints

- `GET /api/disks/<id>/status-logs`
- `POST /api/disks/<id>/transition`

Potential transition payload:

```json
{
  "status": "copying",
  "operator": "Processing Desk",
  "description": "Copy started"
}
```

### Acceptance Criteria

- Starting copy sets `copy_start_time`.
- Completing copy sets `copy_complete_time`.
- Failing copy sets `copy_fail_time`.
- Pickup sets `pickup_time`.
- Each transition creates an audit log.
- Invalid transitions return clear validation errors.

### Out Of Scope

- Physical copy automation.
- Hardware integration.

## PR 10: Public Kiosk Lookup API

### Goal

Implement a read-only kiosk API that does not expose the full master dataset.

### Scope

- Lookup by sequence ID.
- Lookup by QR value such as `VAL-<id>` or `*VAL-<id>*`.
- Lookup by serial number.
- Return current phase, source, safe public drive fields, and status logs.
- Avoid requiring frontend kiosk to fetch `/api/disks`.

### Missing Pieces Addressed

- React kiosk currently calls `/api/kiosk/lookup-disk/<id>` and then fetches `/api/disks`.
- Django kiosk currently renders server-side templates from `replica`.
- The read-only boundary is not consistent.

### Acceptance Criteria

- `GET /api/kiosk/lookup-disk/<value>` returns all kiosk data needed in one response.
- It works without authentication.
- It never exposes admin-only fields.
- It handles unknown IDs cleanly.
- Tests cover raw ID, `VAL-` ID, star-wrapped scanner ID, and serial lookup.

### Out Of Scope

- Physical replica database.

## PR 11: Replica Strategy Implementation

### Goal

Make the read-only kiosk data strategy real and documented.

### Scope

Choose one strategy:

- Strategy A: no physical replica, just a read-only kiosk API.
- Strategy B: physical `replica` SQLite database.
- Strategy C: denormalized `KioskDriveStatus` read model in the same DB.

Recommended first implementation: Strategy C or A. Avoid maintaining two SQLite files unless there is a real deployment requirement.

### Missing Pieces Addressed

- Current Django signals replicate all tracker models despite docs saying only kiosk data is replicated.
- React replica behavior is simulated.
- Kiosk isolation is unclear.

### Acceptance Criteria

- The chosen approach is documented.
- Kiosk reads only from the chosen read model/API.
- If a replica exists, its schema and sync behavior are tested.
- Admin/Processing updates refresh kiosk-visible status.

### Out Of Scope

- Multi-host replication.
- Disaster recovery.

## PR 12: OCR And Drive Image Backend

### Goal

Move OCR and image handling behind the canonical backend.

### Scope

- Add image upload endpoint.
- Add OCR endpoint equivalent to `/api/disks/scan-label`.
- Add Gemini API key config.
- Add fallback when Gemini is missing.
- Return parsed fields and unresolved/missing fields.
- Persist image proof when a disk is created.

### Missing Pieces Addressed

- Django has no OCR endpoint.
- Django has no drive image storage.
- React OCR currently depends on Express.

### Acceptance Criteria

- `POST /api/disks/scan-label` accepts base64 or multipart image upload.
- Response includes parsed manufacturer, model, serial, size, speed.
- Response includes missing/unresolved field list.
- Gemini-unavailable fallback is deterministic enough for local demos.
- Tests cover missing image, fallback response, and unresolved fields.

### Out Of Scope

- Perfect OCR accuracy.
- Long-term object storage.

## PR 13: Label And Ticket Generation

### Goal

Make asset tags and customer claim tickets a first-class product feature.

### Scope

- Define QR payload format.
- Implement printable layouts.
- Add print CSS.
- Add reprint support.
- Decide whether print events are logged.
- Include photo proof where required.

### Requirements From PDFs

Physical media asset tag:

- 2 inches wide by 4 inches long.
- Sequence ID.
- QR code.
- Source requested.
- Disk serial number.
- Photo proof from scanning.

Customer claim ticket:

- Sequence ID.
- QR code.
- Source requested.
- Plain-language claim instructions/disclaimers.

### Acceptance Criteria

- Volunteer intake can produce both outputs.
- Admin can reprint both outputs.
- Volunteer reprint flow works.
- QR scans back into kiosk lookup.
- Layouts are usable in browser print preview.

### Out Of Scope

- Direct printer driver integration.
- Thermal printer hardware support.

## PR 14: React Runtime Configuration And API Client

### Goal

Prepare the React app to talk to either Express or Django through configuration.

### Scope

- Add a central API client.
- Add `VITE_API_BASE_URL` or same-origin proxy config.
- Remove hard-coded assumptions where practical.
- Keep Express prototype working.
- Add frontend type definitions that match the documented API.

### Missing Pieces Addressed

- Fetch calls are scattered across portal components.
- The frontend assumes `/api` is served by Express.
- Migration to Django will be hard without an API abstraction.

### Acceptance Criteria

- All frontend API calls go through one client module.
- Local Express runtime still works.
- Docker can configure the API base URL.
- TypeScript check passes.

### Out Of Scope

- Rewiring every portal to Django behavior.

## PR 15: Admin Portal Integration

### Goal

Connect the Admin portal to Django-backed APIs.

### Scope

- Disk CRUD.
- Datasource CRUD.
- Status inline update.
- Reports from Django data.
- Seed/load-test replacement or admin-only management endpoint.

### Missing Pieces Addressed

- Admin portal currently depends on Express `db.json`.
- Django admin and React admin are separate worlds.

### Acceptance Criteria

- React Admin portal lists Django disks.
- Create/edit/delete works through Django.
- Datasource requirements are editable.
- Inline status changes create status logs.
- Reports use real API data.

### Out Of Scope

- OCR.
- Kiosk.
- Processing simulation.

## PR 16: Volunteer Intake, Return, And Reprint Integration

### Goal

Connect Volunteer workflows to Django-backed APIs.

### Scope

- Intake flow.
- Image/OCR flow.
- Missing-field warning.
- Manual correction.
- Duplicate serial guard.
- Source assignment.
- Spec validation.
- Create drive.
- Print tag/ticket.
- Return/release.
- Reprint.

### Missing Pieces Addressed

- The most important operational workflow is still prototype-only.
- Django cannot currently run the PDF-defined acceptance workflow.

### Acceptance Criteria

- Volunteer can intake a drive through Django.
- OCR results populate the form.
- Missing fields can be corrected or skipped.
- Duplicate serial requires admin override.
- Source requirement validation happens server-side.
- Return flow sets pickup timestamp.
- Reprint uses stored disk data.

### Out Of Scope

- Processing workflow.

## PR 17: Processing Portal Integration

### Goal

Connect Processing workflows to Django lifecycle APIs.

### Scope

- Processing queue.
- Apply selected source.
- Start copy.
- Complete copy.
- Fail copy.
- Retry path if time/space allows.
- Batch barcode scanning.
- Status logs.
- Print failure/success labels if required.

### Missing Pieces Addressed

- Processing is only represented in React/Express.
- Django has no transition rules for copy lifecycle.

### Acceptance Criteria

- Processing portal lists Django-backed drives.
- Batch scanner updates through Django.
- Copy success sets complete timestamp.
- Copy failure sets fail timestamp.
- Kiosk-visible status updates immediately after transition.
- Tests cover transition behavior.

### Out Of Scope

- Real copier automation.
- Filesystem/device integration.

## PR 18: Kiosk Portal Integration

### Goal

Connect the public React kiosk to the Django kiosk API.

### Scope

- Use single kiosk lookup endpoint.
- Remove master `/api/disks` fetch from kiosk.
- Render phase status from API response.
- Render public status logs.
- Keep no-auth behavior.
- Add auto-reset timer.

### Missing Pieces Addressed

- The current React kiosk breaks read-only separation by fetching all disks.
- Django and React kiosk experiences are separate.

### Acceptance Criteria

- Kiosk works without login.
- Kiosk can scan raw ID, `VAL-` ID, star-wrapped scanner ID, and serial.
- Kiosk shows Pending, Duplication Active, Copy Complete, Copy Failed, or Returned.
- Kiosk response does not expose private/admin fields.
- Existing Django server-side kiosk is either documented as legacy or removed in a later cleanup PR.

### Out Of Scope

- Physical kiosk OS/browser lockdown.

## PR 19: Frontend Cleanup After Django Parity

### Goal

Remove or demote the Express mock backend once Django owns the API.

### Scope

- Decide whether `server.ts` remains for local mock demos.
- Remove unused Express routes if no longer needed.
- Remove duplicated state logic.
- Update Docker/Compose accordingly.
- Update docs.

### Missing Pieces Addressed

- Two active backend implementations will confuse maintainers.
- `db.json` should not remain canonical after Django parity.

### Acceptance Criteria

- There is one documented source of truth for data.
- Docker Compose no longer requires Express as a backend if Django serves the API.
- React can still run in dev mode.
- Legacy mock server behavior is clearly marked or removed.

### Out Of Scope

- Product feature additions.

## PR 20: Automated Test Suite And CI

### Goal

Make the project safe to change.

### Scope

- Django unit/API tests.
- Frontend typecheck.
- Frontend build.
- Compose config validation.
- Optional Playwright smoke tests.
- GitHub Actions CI.

### Missing Pieces Addressed

- There are currently no meaningful tests.
- Infrastructure changes are not automatically verified.

### Minimum Test Matrix

- Django model tests.
- Django API CRUD tests.
- Permission tests.
- Lifecycle transition tests.
- Kiosk lookup tests.
- OCR fallback tests.
- Source requirement validation tests.
- Frontend `npm run lint`.
- Frontend `npm run build`.
- Docker Compose config test.

### Acceptance Criteria

- CI runs on pull requests.
- CI blocks failing backend tests.
- CI blocks frontend type/build failures.
- README documents local test commands.

### Out Of Scope

- Full browser coverage for every edge case.

## PR 21: Event Operations And Deployment Hardening

### Goal

Make the app operable during an event.

### Scope

- Event-day runbook.
- Backup/restore docs.
- Data reset docs.
- Admin user bootstrap.
- Environment variable docs.
- Port map docs.
- Kiosk station setup notes.
- Failure recovery notes.

### Missing Pieces Addressed

- The app currently has development setup instructions, not operational instructions.

### Acceptance Criteria

- A new operator can start the stack from README/runbook.
- A new operator can create or reset admin credentials.
- A new operator can back up and restore data.
- Vagrant and Docker workflows are documented.
- Known limitations are documented.

### Out Of Scope

- Cloud deployment.

## PR 22: Security And Production Configuration

### Goal

Remove development-only defaults before real deployment.

### Scope

- Secret key from env.
- Debug off by default outside dev.
- Allowed hosts from env.
- CSRF/CORS policy.
- Session/cookie settings.
- Uploaded image constraints.
- Auth hardening.
- Rate limits for public kiosk and OCR endpoints if needed.

### Missing Pieces Addressed

- Current Django settings are development-oriented.
- React/Express prototype has static credentials.
- Public endpoints need careful boundaries.

### Acceptance Criteria

- Production-like env can run without insecure defaults.
- Public kiosk remains usable but read-only.
- Upload size limits exist.
- Secrets are not committed.
- Security settings are documented.

### Out Of Scope

- External identity provider integration.

## PR 23: Migration And Data Import/Export

### Goal

Prepare for moving real event data safely.

### Scope

- Export current SQLite/JSON data.
- Import from `ddv-drive-tracker/db.json` into Django.
- Add CSV export for reports.
- Add backup command.
- Add restore instructions.

### Missing Pieces Addressed

- The prototype has useful sample data isolated in `db.json`.
- Event operators will need backup/restore.

### Acceptance Criteria

- `db.json` can be imported into Django without manual editing.
- Disk IDs, datasources, statuses, and timestamps survive import.
- Backup and restore are documented and tested locally.

### Out Of Scope

- Complex historical migrations from unknown production systems.

## PR 24: Final Product Polish And Accessibility Pass

### Goal

Make the portals reliable and usable on real workstations, tablets, and kiosk screens.

### Scope

- Responsive layout checks.
- Keyboard/scanner focus behavior.
- Print layout checks.
- Accessibility labels.
- Error state polish.
- Loading state consistency.
- Empty state consistency.
- Remove AI Studio/demo language.

### Missing Pieces Addressed

- The React prototype is feature-rich but still has demo/prototype wording.
- Kiosk and scanner flows need predictable focus behavior.
- Print layouts need real-world verification.

### Acceptance Criteria

- All four portals work at desktop and tablet widths.
- Scanner input is reliable.
- Text does not overflow critical controls.
- Print previews are usable.
- Demo-only credential hints are removed or gated to development mode.

### Out Of Scope

- New backend features.

## Dependency Order

Recommended order:

1. PR 1: Docker Compose And Vagrant Runtime Baseline.
2. PR 2: Architecture Decision Records And API Contract.
3. PR 3: Canonical Django Data Model.
4. PR 4: Seed Data, Fixtures, And Local Demo State.
5. PR 5: Django API Foundation.
6. PR 6: Auth, Roles, And Portal Permissions.
7. PR 7: Datasource Requirements API.
8. PR 8: Disk CRUD API Parity.
9. PR 9: Drive Lifecycle And Status Logs.
10. PR 10: Public Kiosk Lookup API.
11. PR 11: Replica Strategy Implementation.
12. PR 12: OCR And Drive Image Backend.
13. PR 13: Label And Ticket Generation.
14. PR 14: React Runtime Configuration And API Client.
15. PR 15: Admin Portal Integration.
16. PR 16: Volunteer Intake, Return, And Reprint Integration.
17. PR 17: Processing Portal Integration.
18. PR 18: Kiosk Portal Integration.
19. PR 19: Frontend Cleanup After Django Parity.
20. PR 20: Automated Test Suite And CI.
21. PR 21: Event Operations And Deployment Hardening.
22. PR 22: Security And Production Configuration.
23. PR 23: Migration And Data Import/Export.
24. PR 24: Final Product Polish And Accessibility Pass.

Some PRs can run in parallel after PR 2, but schema/API/frontend integration should not race without a stable API contract.

## Minimum Viable Event Build

If time is short, the minimum useful sequence is:

1. PR 1: Docker/Vagrant runtime.
2. PR 2: Architecture/API contract.
3. PR 3: Django data model.
4. PR 5: Django API foundation.
5. PR 8: Disk CRUD API parity.
6. PR 9: Drive lifecycle/status logs.
7. PR 10: Public kiosk lookup API.
8. PR 14: React API client.
9. PR 16: Volunteer intake/return.
10. PR 17: Processing portal.
11. PR 18: Kiosk portal.
12. PR 21: Event operations docs.

This gets the core physical flow working:

- Accept drive.
- Scan or enter specs.
- Assign source.
- Print tag/ticket.
- Process copy.
- Display public status.
- Return drive.

## Major Risks

### Risk: Two Backends Drift

The Express app and Django app already model drives differently. Keep Express as a prototype until Django parity exists, then remove or demote it.

### Risk: Schema Refactor Breaks Existing Django Admin

Keep migrations small. Add tests before replacing behavior. Avoid deleting `DiskHavings` until its replacement is proven.

### Risk: Kiosk Replica Is Overbuilt Too Early

Use a read-only API or denormalized read model first. Add physical database replication only if deployment needs it.

### Risk: OCR Consumes Too Much Time

Keep OCR behind a narrow endpoint. Support manual entry and deterministic fallback from day one.

### Risk: Printing Depends On Unknown Hardware

Start with browser print CSS and QR output. Direct printer integration should be a later hardware-specific PR.

### Risk: Vagrant Becomes A Second App Installer

Vagrant should install Docker and run Compose only. Do not duplicate Python/Node provisioning inside Vagrant.

## Definition Of Done For The Project

The project can be considered end-to-end complete when:

- A new developer can run the full stack with Docker.
- A new developer can run the full stack with Vagrant.
- Admin, Volunteer, Processing, and Kiosk portals all run against the canonical backend.
- Drive intake follows the acceptance PDF.
- Drive processing follows the process-flow PDF.
- Drive pickup follows the pickup PDF.
- Kiosk status is public and read-only.
- Tags and claim tickets print with QR codes.
- OCR works when configured and degrades gracefully when not configured.
- Source requirements are enforced.
- Duplicate serials are guarded.
- Role permissions are enforced server-side.
- Tests cover the main workflows.
- Event-day operations docs exist.
