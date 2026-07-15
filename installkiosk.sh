#!/bin/bash
cd ~
rm -rf ddv
git clone https://github.com/DataDuplicationVillage/ddv --branch kiosk
source venv/bin/activate
pip3 install django django-unfold django-guardian qrcode
cd ddv
if command -v npm >/dev/null 2>&1; then
	cd ddv-drive-tracker
	npm install
	npm run build
	cd ..
else
	echo "npm not found; skipping frontend build for ddv-drive-tracker"
fi
python3 manage.py makemigrations
python3 manage.py migrate
python3 manage.py migrate --database=replica
python3 manage.py createsuperuser
python3 manage.py runserver

