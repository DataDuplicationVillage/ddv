FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    DDV_DATABASE_DIR=/app/data \
    DJANGO_ALLOWED_HOSTS=*

WORKDIR /app

COPY requirements.txt .
RUN python -m pip install --upgrade pip \
    && python -m pip install -r requirements.txt

COPY . .
COPY docker-entrypoint.sh /usr/local/bin/ddv-entrypoint

RUN mkdir -p /app/data \
    && useradd --create-home --shell /bin/bash ddv \
    && chown -R ddv:ddv /app \
    && chmod +x /usr/local/bin/ddv-entrypoint

USER ddv

EXPOSE 8000

ENTRYPOINT ["ddv-entrypoint"]
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
