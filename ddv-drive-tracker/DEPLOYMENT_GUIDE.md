# Drive-Ops Quad-Interface Production Deployment Guide
### High-Integrity Installation Protocol for Isolated & Air-Gapped Ubuntu Environments

This deployment guide provides a comprehensive, step-by-step procedure for deploying, configuring, and maintaining the **Drive-Ops Quad-Interface system** on an Ubuntu Server (20.04 or 22.04 LTS) residing within an isolated, air-gapped, or low-connectivity local network.

---

## 1. Architectural Blueprint & Technical Stack

The Drive-Ops system is architected as an **extremely robust, self-contained full-stack application** designed to run without complex infrastructure overhead:

- **Frontend Core**: React 19 Single Page Application (SPA), styled with Tailwind CSS, utilizing Lucide vectors, Recharts, and QRCode generators. Pre-compiled during the build phase into optimized, client-side static assets inside the `/dist` directory.
- **Backend Service**: Express v4 server. In production, this server performs two vital duties:
  1. Serves the pre-compiled static frontend assets from `/dist` and handles HTML5 routing fallbacks.
  2. Exposes secure, high-throughput REST API routes `/api/*` for disk lookups, intake registration, and datasource management.
- **Production Asset Path Contract (Critical)**: The frontend build must target root hosting so `dist/index.html` references `/assets/...` (not `/static/assets/...`) when the app is served at `http://<server-ip>:3000`. A mismatch here is a primary cause of white-screen loads.
- **State & Database Layer**: Self-contained JSON-based filesystem database (`db.json`) residing in the application directory. No PostgreSQL, MySQL, or cloud dependencies are required. This ensures instantaneous startup and simple, file-based backup protocols.
- **Heuristic Air-Gap Fallbacks**: If the environment has no internet access, calls to the Gemini API (`@google/genai`) will fail gracefully. The backend automatically switches to the high-fidelity **Heuristic Match Fallback System**, keeping the webcam OCR form auto-population 100% operational with intelligent preset heuristics.

---

## 2. Browser Webcam Security Constraints (Critical Note)

Standard browser security engines (Chrome, Edge, Firefox, Safari) strictly enforce the **Secure Contexts** specification. This means that:
* **The webcam `getUserMedia` API is completely disabled on non-localhost, unencrypted HTTP connections.**
* If operators access the Volunteer Intake Portal over the local network via an IP address or raw domain name (e.g., `http://10.0.0.50:3000`), **the webcam feed will fail to load**.
* To use the hardware webcam scanner over the local network, you **MUST** serve the application over **HTTPS** (by configuring an SSL proxy like Nginx with self-signed certificates, as covered in Section 5) or use localhost directly on the server machine.

---

## 2.5 Pre-Deploy Go/No-Go Checklist (60 Seconds)

Run this checklist immediately before enabling production access:

1. Build completed on target host with no fatal errors:
   ```bash
   cd /var/www/drive-ops
   npm run build
   ```
2. `dist/index.html` asset paths are root-based:
   - Confirm script/link tags reference `/assets/...`
   - If you see `/static/assets/...`, stop and rebuild from latest source
3. Runtime service restarted after build:
   ```bash
   sudo systemctl restart drive-ops
   ```
4. Health check of HTML and JS asset responses:
   ```bash
   curl -I http://127.0.0.1:3000/
   curl -I http://127.0.0.1:3000/assets/index-*.js
   ```
5. Response sanity:
   - `/` returns `200 OK` with `Content-Type: text/html`
   - `/assets/...js` returns `200 OK` with `Content-Type: application/javascript`
6. Browser confirmation from an operator workstation:
   - Load `http://<server-ip>:3000`
   - Confirm the interface renders (not a blank white screen)

---

## 3. Preparation: Packaging the Application for Offline Transport

Since your target server is on a small, isolated network, you should build and package the application on an internet-connected **staging machine** first, then copy the compressed release package over to the production server.

### On the Connected Staging Machine:
1. **Clone/Download the repository** to your staging directory.
2. **Install all dependencies** (development and production):
   ```bash
   npm install
   ```
3. **Compile the production builds**:
   ```bash
   npm run build
   ```
   *This command runs two build tools in series:*
   - `vite build`: Compiles the React frontend files and saves them to `/dist`.
   - `esbuild server.ts --bundle...`: Bundles, compiles, and transpiles the Express server from TypeScript to a unified CommonJS file at `/dist/server.cjs`.
   - **Verification checkpoint (recommended):** open `dist/index.html` and confirm the script/link tags point to `/assets/...` paths.
4. **Clean up development dependencies** to keep the bundle small (optional, but recommended):
   - You can package the `node_modules` containing only production dependencies:
     ```bash
     npm prune --production
     ```
5. **Compress the production-ready bundle**:
   - Create a tarball containing only the files required to run the app:
     ```bash
     tar -czf drive-ops-release.tar.gz dist/ package.json db.json .env.example
     ```
6. **Transfer the package** (`drive-ops-release.tar.gz`) to your isolated Ubuntu server via USB drive, SSH (`scp`), or any other localized file transfer mechanism.

---

## 4. Ubuntu Server Installation & Setup

Perform the following steps on your target **Ubuntu Server** to extract, install, and run the service.

### Step 1: Install Node.js runtime (v20 LTS recommended)
Ensure Node.js is installed. If the server has local access to the Ubuntu official package archive, run:
```bash
sudo apt update
sudo apt install -y nodejs npm
```
*If you need to install a specific Node.js v20 LTS version offline, you can download the Node.js pre-compiled binary package (`node-v20.x.x-linux-x64.tar.xz`) from an online machine, transfer it, and extract it to `/usr/local`.*

Verify the installations:
```bash
node -v
npm -v
```

### Step 2: Unpack the Release Bundle
Create a dedicated application directory and extract the archive:
```bash
sudo mkdir -p /var/www/drive-ops
sudo chown -R $USER:$USER /var/www/drive-ops
cd /var/www/drive-ops

# Extract the release tarball
tar -xzf /path/to/drive-ops-release.tar.gz
```

### Step 3: Install Production Dependencies (If not pre-bundled)
If you chose not to pre-bundle `node_modules` on the staging machine, or are performing a clean install:
```bash
npm install --omit=dev
```

### Step 4: Configure Environment Variables
Copy the example environment file to `.env`:
```bash
cp .env.example .env
```
Open `.env` using your preferred text editor (e.g., `nano`):
```bash
nano .env
```
Configure the variables accordingly:
```env
# Production port for the web service (Default: 3000)
PORT=3000

# Set environment mode to production
NODE_ENV=production

# OPTIONAL: If your isolated network has an outbound proxy to reach the internet,
# you can supply your Gemini API Key here. Otherwise, leave blank to use Heuristic Fallbacks.
GEMINI_API_KEY=your_gemini_api_key_here
```

---

## 5. Setting Up a Persistent systemd Service Daemon

To ensure that the Drive-Ops application boots automatically when the server restarts and stays alive in the event of an unexpected crash, configure it as a **systemd service**.

### Step 1: Create the service configuration file
```bash
sudo nano /etc/systemd/system/drive-ops.service
```

### Step 2: Paste the following service configuration
```ini
[Unit]
Description=Drive-Ops Quad-Interface Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/drive-ops
ExecStart=/usr/bin/node dist/server.cjs
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000

# Security Hardening (Optional but recommended)
ReadOnlyDirectories=/
ReadWriteDirectories=/var/www/drive-ops

[Install]
WantedBy=multi-user.target
```

### Step 3: Configure File Ownership and Permissions
Ensure the service user (`www-data`) owns the application directory so it can write updates directly to the database file (`db.json`):
```bash
sudo chown -R www-data:www-data /var/www/drive-ops
```

### Step 4: Load and Start the Service
```bash
# Reload systemd configuration to register the new service
sudo systemctl daemon-reload

# Enable the service to launch automatically on system boot
sudo systemctl enable drive-ops

# Start the application immediately
sudo systemctl start drive-ops
```

### Step 5: Check Service Status & Logs
Verify the service is active and running:
```bash
sudo systemctl status drive-ops
```
To monitor the live console output and network server transactions:
```bash
sudo journalctl -u drive-ops -f -n 50
```

---

## 6. Configuring Nginx as an SSL/TLS Reverse Proxy (Highly Recommended)

As highlighted in Section 2, **HTTPS is mandatory** for browser webcam authorization. Configuring Nginx to handle SSL/TLS decryption on the server frontend is the industry standard approach for isolated networks.

### Step 1: Install Nginx
```bash
sudo apt update
sudo apt install -y nginx
```

### Step 2: Generate a Self-Signed SSL Certificate
If you do not have an official certificate authority on your local network, you can generate a strong 2048-bit self-signed certificate that remains valid for 10 years:
```bash
sudo mkdir -p /etc/nginx/ssl
sudo openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/drive-ops.key \
  -out /etc/nginx/ssl/drive-ops.crt
```
*Note: During prompt generation, enter your server's IP address (e.g., `192.168.1.50`) or local hostname as the "Common Name (CN)".*

### Step 3: Configure Nginx Site Block
Create a new server block configuration:
```bash
sudo nano /etc/nginx/sites-available/drive-ops
```
Paste the following reverse proxy template:
```nginx
server {
    listen 80;
    server_name _;
    # Redirect all insecure HTTP traffic to HTTPS automatically
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name _;

    ssl_certificate /etc/nginx/ssl/drive-ops.crt;
    ssl_certificate_key /etc/nginx/ssl/drive-ops.key;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Adjust client body size to allow high-resolution label snapshots to be uploaded
    client_max_body_size 12M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Step 4: Enable the Configuration and Restart Nginx
```bash
# Link the site to sites-enabled
sudo ln -sf /etc/nginx/sites-available/drive-ops /etc/nginx/sites-enabled/

# Disable default placeholder page
sudo rm -f /etc/nginx/sites-enabled/default

# Verify syntax is correct
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### Step 5: Trust the Certificate on Client Workstations (Optional but Recommended)
Because the certificate is self-signed, browsers will show a red *"Your connection is not private"* warning on first load.
- You can simply click **"Advanced"** -> **"Proceed to 192.168.1.50 (unsafe)"**.
- Alternatively, export the generated `/etc/nginx/ssl/drive-ops.crt` certificate and import it into the client workstation's **Trusted Root Certification Authorities** store. This will turn the browser address bar green and fully authorize webcam access automatically.

---

## 7. Automated Backups & Database Maintenance

Because the system uses a single, flat JSON database file (`db.json`), backups are extremely simple to perform.

### Set up a Daily Database Cron Backup
Create a daily cron job that copies `db.json` with a timestamp to prevent data loss:
1. Open the crontab configuration editor:
   ```bash
   sudo crontab -e
   ```
2. Add the following line to perform backups every night at 2:00 AM, keeping the last 30 backups:
   ```text
   0 2 * * * mkdir -p /var/backups/drive-ops && cp /var/www/drive-ops/db.json /var/backups/drive-ops/db-$(date +\%F).json
   ```

---

## 8. High-Level Troubleshooting & Diagnostics

### App is "Awaiting Application Startup" or Failing to Respond
Check the systemd logs to find the exact exception:
```bash
sudo journalctl -u drive-ops -e --no-pager
```
* **Port Conflict**: If port 3000 is occupied, set a different PORT in `/var/www/drive-ops/.env` (e.g., `PORT=3500`) and restart the service: `sudo systemctl restart drive-ops`.

### Permission Errors Writing Data
If the server reports `EACCES` when attempting to write to `db.json`, verify file ownership:
```bash
sudo chown -R www-data:www-data /var/www/drive-ops
```

### White Screen at `http://<server-ip>:3000` (No Visible Errors)
This is usually a frontend asset-path mismatch or stale build artifact.

Another common cause is **mode mismatch on the same port**:
- A development server (`npm run dev`) is bound to `:3000`.
- Browser or cache still requests production paths like `/assets/index-<hash>.js`.
- Dev server returns HTML for those paths, so the browser cannot execute the app bundle.

Run this quick verification flow:
1. Rebuild on the deployment host:
   ```bash
   cd /var/www/drive-ops
   npm run build
   ```
2. Confirm `dist/index.html` references root assets:
   - Expected: `/assets/...`
   - Problematic/stale: `/static/assets/...`
3. Restart the service:
   ```bash
   sudo systemctl restart drive-ops
   ```
4. Validate responses directly from the server:
   ```bash
   curl -I http://127.0.0.1:3000/
   curl -I http://127.0.0.1:3000/assets/index-*.js
   ```

### Troubleshooting URLs for Fast Isolation
Use these URLs to quickly determine whether the issue is HTML delivery, static assets, or API availability.

First, identify the current hashed asset filenames:
```bash
ls -1 /var/www/drive-ops/dist/assets/index-*.js
ls -1 /var/www/drive-ops/dist/assets/index-*.css
```

Direct Node/Express checks (server-local):
1. `http://127.0.0.1:3000/`
2. `http://127.0.0.1:3000/index.html`
3. `http://127.0.0.1:3000/assets/index-<hash>.js`
4. `http://127.0.0.1:3000/assets/index-<hash>.css`
5. `http://127.0.0.1:3000/api/disks`
6. `http://127.0.0.1:3000/static/assets/index-<hash>.js` (legacy compatibility path)

Django-hosted SPA checks (Codespaces / port 8000 path):
1. `http://127.0.0.1:8000/`
2. `http://127.0.0.1:8000/assets/index-<hash>.js`
3. `http://127.0.0.1:8000/assets/index-<hash>.css`
4. `http://127.0.0.1:8000/api/disks`
5. `http://127.0.0.1:8000/health/frontend` (frontend build + asset integrity report)

Reverse proxy checks (operator workstation):
1. `https://<server-ip>/`
2. `https://<server-ip>/assets/index-<hash>.js`
3. `https://<server-ip>/assets/index-<hash>.css`
4. `https://<server-ip>/api/disks`

Header/status validation examples:
```bash
curl -I http://127.0.0.1:3000/
curl -I http://127.0.0.1:3000/assets/index-<hash>.js
curl -I http://127.0.0.1:3000/assets/index-<hash>.css
curl -I http://127.0.0.1:3000/api/disks
curl -k -I https://<server-ip>/assets/index-<hash>.js
curl -s http://127.0.0.1:8000/health/frontend
```

Expected results:
1. `/` and `/index.html` return `200` with `Content-Type: text/html`.
2. `.../assets/index-<hash>.js` returns `200` with `Content-Type: application/javascript`.
3. `.../assets/index-<hash>.css` returns `200` with `Content-Type: text/css`.
4. `/api/disks` returns `200` and JSON content.
5. If JS/CSS URL returns HTML, the app will white-screen due to an asset routing/build mismatch.

If asset files return HTML instead of JavaScript, update to the latest server runtime where SPA fallback excludes file-extension requests and excludes `/api/*` routes.

### Detecting Dev/Prod Port Conflicts Quickly
1. Check what is listening on port 3000:
   ```bash
   lsof -iTCP:3000 -sTCP:LISTEN -n -P
   ```
2. If you see a dev command (`npm run dev`, `tsx server.ts` with Vite HMR), stop it before starting production.
3. Start only one runtime mode on that port:
   - Development: `npm run dev`
   - Production: `NODE_ENV=production node dist/server.cjs`
4. Re-test asset MIME type:
   ```bash
   curl -I http://127.0.0.1:3000/assets/index-<hash>.js
   ```
   Expected: `Content-Type: application/javascript`.

### Webcam Stream Fails to Start
- Ensure the user is accessing the application via a secure context: **localhost** or an **HTTPS (`https://`) URL**.
- Confirm that the workstation has camera drivers installed and that browser permissions for the camera are granted.
