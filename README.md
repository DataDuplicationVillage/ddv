# Data Duplication Village web app

This repository currently contains two runnable DDV applications:

- The root Django app, which is the existing backend/admin/kiosk foundation.
- The `ddv-drive-tracker` React/Express prototype, which contains the richer four-portal workflow.

The Docker and Vagrant workflows run both apps side by side. They are not integrated yet.

# Native Django Setup

1. Get python, make sure it's in your path (Windows: `winget install python3`)
1. `python3 -m venv venv`
1. Activate the venv: `venv\Scripts\Activate.ps1` for powershell, `source venv/bin/activate` for unix
1. `pip3 install -r requirements.txt`
1. `python3 manage.py makemigrations`
1. `python3 manage.py migrate`
1. `python3 manage.py migrate --database=replica`
1. `python3 manage.py createsuperuser`
1. `python3 manage.py runserver`

# Docker

1. `docker compose up --build`
1. Open the Django app at `http://localhost:8000`
1. Open the drive tracker prototype at `http://localhost:3000`
1. In another terminal, create a Django admin user with `docker compose exec django python manage.py createsuperuser`

Useful commands:

```bash
docker compose up --build
docker compose up -d --build
docker compose logs -f
docker compose ps
docker compose down
docker compose exec django python manage.py createsuperuser
```

The Docker setup uses named volumes:

- `ddv_django-data` stores Django `db.sqlite3` and `replica.sqlite3`.
- `ddv_drive-tracker-data` stores the drive tracker prototype `db.json`.

Django migrations run automatically when the Django container starts. The drive tracker prototype works without `GEMINI_API_KEY`; if the key is not set, label scanning uses its built-in fallback behavior.

# Vagrant

The Vagrant setup is a VirtualBox VM wrapper around Docker Compose. It installs Docker inside the VM and starts the same Compose stack automatically.

1. Install Vagrant and VirtualBox.
1. `vagrant up`
1. Open the Django app at `http://localhost:8000`
1. Open the drive tracker prototype at `http://localhost:3000`

Useful commands:

```bash
vagrant up
vagrant ssh
vagrant ssh -c "cd /vagrant && docker compose ps"
vagrant ssh -c "cd /vagrant && docker compose logs -f"
vagrant halt
vagrant destroy
```

Vagrant forwards host port `8000` to the Django service and host port `3000` to the drive tracker service. If either host port is already in use, Vagrant may auto-correct the forwarded port and print the new mapping during `vagrant up`.

On native Linux and Intel/AMD macOS hosts, Vagrant uses the normal VirtualBox synced folder at `/vagrant`. File changes are visible to the VM without the WSL helper scripts.

When Vagrant is run from WSL, the repo is synced into the VM with `rsync` because Windows VirtualBox cannot mount WSL's native Linux filesystem as a shared folder. The Vagrantfile also routes SSH through a small PowerShell TCP proxy so WSL can communicate with Windows-hosted VirtualBox on localhost. The WSL sync helper runs automatically before provisioning; after changing files in WSL, run `scripts/vagrant-rsync-wsl.sh` before restarting services inside the VM.

Apple Silicon Macs are not covered by the current Vagrant baseline because the configured `ubuntu/jammy64` VirtualBox box targets x86_64. Use Docker Compose directly on Apple Silicon until a separate ARM-capable Vagrant provider and base box are added.
