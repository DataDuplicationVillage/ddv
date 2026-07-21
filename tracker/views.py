import mimetypes
import re
from pathlib import Path

from django.conf import settings
from django.http import FileResponse
from django.http import HttpResponse
from django.http import JsonResponse
from django.shortcuts import render, redirect
from .models import DiskHavings


def spa_index(request):
    dist_index = Path(settings.FRONTEND_DIST_DIR) / 'index.html'
    if not dist_index.exists():
        return HttpResponse(
            'Frontend build not found. Run "npm install" and "npm run build" in ddv-drive-tracker.',
            status=503,
            content_type='text/plain',
        )

    return HttpResponse(dist_index.read_text(encoding='utf-8'), content_type='text/html')


def spa_asset(request, asset_path):
    assets_root = (Path(settings.FRONTEND_DIST_DIR) / 'assets').resolve()
    requested = (assets_root / asset_path).resolve()

    # Prevent directory traversal and provide clear diagnostics when assets are missing.
    if not str(requested).startswith(str(assets_root)) or not requested.exists() or not requested.is_file():
        return HttpResponse(
            f'Frontend asset not found: {asset_path}. Rebuild frontend with "npm run build" in ddv-drive-tracker.',
            status=404,
            content_type='text/plain',
        )

    content_type = mimetypes.guess_type(str(requested))[0] or 'application/octet-stream'
    return FileResponse(open(requested, 'rb'), content_type=content_type)


def spa_health(request):
    dist_dir = Path(settings.FRONTEND_DIST_DIR)
    index_path = dist_dir / 'index.html'
    index_exists = index_path.exists()

    asset_checks = []
    missing_assets = []

    if index_exists:
        index_content = index_path.read_text(encoding='utf-8')
        referenced_assets = sorted(set(re.findall(r'/(assets/[^"\']+)', index_content)))

        for relative_asset in referenced_assets:
            asset_path = dist_dir / relative_asset
            exists = asset_path.exists() and asset_path.is_file()
            content_type = mimetypes.guess_type(str(asset_path))[0] or 'application/octet-stream'

            asset_checks.append(
                {
                    'asset': relative_asset,
                    'url': f'/{relative_asset}',
                    'exists': exists,
                    'content_type': content_type,
                    'size_bytes': asset_path.stat().st_size if exists else None,
                }
            )

            if not exists:
                missing_assets.append(relative_asset)

    status_ok = index_exists and not missing_assets
    response = {
        'status': 'ok' if status_ok else 'degraded',
        'dist_dir': str(dist_dir),
        'index': {
            'path': str(index_path),
            'exists': index_exists,
        },
        'assets': asset_checks,
        'missing_assets': missing_assets,
        'message': (
            'Frontend build and referenced assets are available.'
            if status_ok
            else 'Frontend build is incomplete. Run "npm run build" in ddv-drive-tracker.'
        ),
    }

    return JsonResponse(response, status=200 if status_ok else 503)

def kiosk_home(request):
    if request.method == 'POST':
        disk_id = request.POST.get('disk_id', '').strip()
        if disk_id:
            return redirect('kiosk_scan', disk_id=disk_id)
    return render(request, 'kiosk/home.html')

def kiosk_scan(request, disk_id):
    history = DiskHavings.objects.using('replica').filter(disk_id=disk_id).order_by('-when')
    if not history.exists():
        return render(request, 'kiosk/results.html', {'error': 'No entries found or disk unknown in replica dataset.', 'scanned_disk_id': disk_id})
        
    latest_entry = history.first()
    owner = latest_entry.disk_haver
    
    owner_history = DiskHavings.objects.using('replica').filter(disk_haver_id=owner.id).order_by('-when')
    
    context = {
        'owner': owner,
        'history': owner_history,
        'scanned_disk_id': disk_id,
    }
    return render(request, 'kiosk/results.html', context)
