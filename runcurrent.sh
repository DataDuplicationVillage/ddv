#!/bin/bash
cd ~
source venv/bin/activate
pip3 install django django-unfold django-guardian qrcode
cd ~/ddv
git fetch
python3 manage.py makemigrations
python3 manage.py migrate
python3 manage.py migrate --database=replica
python3 manage.py runserver

