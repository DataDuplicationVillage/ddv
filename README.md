# Data Duplication Village web app

# TL;DR

CLICK THIS AND DO WHAT IT SAYS BELOW:

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/DataDuplicationVillage/ddv)

# Setup

1. Get python, make sure it's in your path (Windows: `winget install python3`)
1. `python3 -m venv venv`
1. Activate the venv: `venv\Scripts\Activate.ps1` for powershell, `source venv/bin/activate` for unix
1. `pip3 install django django-unfold django-guardian qrcode`
1. `python3 manage.py makemigrations`
1. `python3 manage.py migrate`
1. `python3 manage.py migrate --database=replica`
1. `python3 manage.py createsuperuser`
1. Build frontend SPA assets:
	- `cd ddv-drive-tracker`
	- `npm install`
	- `npm run build`
	- `cd ..`
1. `python3 manage.py runserver`

# Testing

Run API contract and integration checks:

1. Windows PowerShell:
	- `./run-tests.ps1`
1. Unix/macOS shell:
	- `./run-tests.sh`
1. Direct Django command:
	- `python3 manage.py test tracker.tests -v 2`

These tests cover:

1. Auth success and failure contracts
1. Disk lifecycle transitions and kiosk lookup
1. Replication stats contract shape
1. Negative-path API behavior (404/400 contract checks)
1. Frontend-to-backend bootstrap probes and SPA fallback route checks
