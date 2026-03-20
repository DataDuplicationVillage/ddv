from django.shortcuts import render
from django.http import JsonResponse
from .models import DiskHavings

def index(request):
    return JsonResponse({'status': 'Django backend initialized', 'message': 'Go to /admin to access the Full Web Interface'})

def kiosk_scan(request, disk_id):
    # Kiosk exclusively reads from replica
    history = DiskHavings.objects.using('replica').filter(disk_id=disk_id).order_by('-when')
    
    if not history.exists():
        return JsonResponse({'error': 'No entries found or disk unknown in replica dataset.'}, status=404)
        
    latest_entry = history.first()
    owner_id = latest_entry.disk_haver_id
    
    owner_history = DiskHavings.objects.using('replica').filter(disk_haver_id=owner_id).order_by('-when')
    
    data = []
    for entry in owner_history:
        data.append({
            'disk_id': entry.disk_id,
            'havings_type': entry.havings_type,
            'datasource_id': entry.datasource_id,
            'when': entry.when.isoformat(),
        })
        
    return JsonResponse({'diskhaver_id': owner_id, 'history': data})
