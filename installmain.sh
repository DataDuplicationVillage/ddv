#!/bin/bash
cd ~
rm -rf ddv
git clone https://github.com/DataDuplicationVillage/ddv
source venv/bin/activate
pip3 install django django-unfold django-guardian qrcode
cd ddv
python3 manage.py makemigrations
python3 manage.py migrate
python3 manage.py migrate --database=replica
python3 manage.py createsuperuser
python3 manage.py runserver

