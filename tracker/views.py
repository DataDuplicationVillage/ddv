from django.shortcuts import render, redirect
from django.http import JsonResponse
from .models import DiskHavings

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
