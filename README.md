# Data Duplication Village web app

# Setup

1. Get python, make sure it's in your path
1. `python3 -m venv .`
1. Activate the venv: `venv\Scripts\Activate.ps1` for powershell, `source venv/bin/activate` for unix
1. `pip3 install django`
1. `python3 manage.py makemigrations`
1. `python3 manage.py migrate`
1. `python3 manage.py migrate --database=replica`
1. `python3 manage.py createsuperuser`
1. `python3 manage.py runserver`
