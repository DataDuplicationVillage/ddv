import random
import re
import uuid
from datetime import datetime

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.models import Group
from django.db import transaction
from django.http import JsonResponse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import (
    DataSource,
    Disk,
    DiskHaver,
    DiskHavings,
    DiskModel,
    DiskStatusLog,
    Duplicator,
    ReplicationLog,
)


STATUS_TO_HAVINGS = {
    'received': 'give',
    'copying': 'copyready',
    'completed': 'copysuccess',
    'failed': 'copyfail',
    'picked_up': 'take',
}

HAVINGS_TO_STATUS = {
    'give': 'received',
    'copyready': 'copying',
    'copysuccess': 'completed',
    'copyfail': 'failed',
    'broken': 'failed',
    'take': 'picked_up',
}


def _json_body(request):
    try:
        import json

        return json.loads(request.body or '{}')
    except Exception:
        return {}


def _parse_iso(value):
    if not value:
        return None
    dt = parse_datetime(value)
    if not dt:
        return None
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt, timezone=timezone.utc)
    return dt


def _iso(value):
    if not value:
        return None
    return value.isoformat()


def _role_for_user(user):
    if user.is_superuser or user.groups.filter(name='admin').exists():
        return 'admin'
    if user.groups.filter(name='processing').exists():
        return 'processing'
    if user.groups.filter(name='volunteer').exists():
        return 'volunteer'
    return 'user'


def _set_role(user, role):
    role = role or 'user'
    if role not in {'admin', 'volunteer', 'processing', 'user'}:
        role = 'user'
    user.groups.clear()
    if role != 'user':
        group, _ = Group.objects.get_or_create(name=role)
        user.groups.add(group)
    user.is_staff = role in {'admin', 'volunteer', 'processing'}
    user.is_superuser = role == 'admin'


def _seed_default_users():
    User = get_user_model()
    # Seed defaults only for first-time bootstrap.
    # If users already exist, do not recreate deleted accounts.
    # Exclude the django-guardian AnonymousUser which is always present.
    anon_name = getattr(settings, 'ANONYMOUS_USER_NAME', 'AnonymousUser')
    if User.objects.exclude(username=anon_name).exists():
        return

    defaults = [
        ('admin', 'admin123', 'System Administrator', 'admin'),
        ('volunteer', 'vol123', 'Volunteer Operator', 'volunteer'),
        ('processing', 'proc123', 'Processing Operator', 'processing'),
        ('scott', 'user123', 'Scott Martin', 'user'),
        ('flora', 'user123', 'Flora Vance', 'user'),
    ]
    for username, password, full_name, role in defaults:
        user, created = User.objects.get_or_create(username=username, defaults={'is_active': True})
        if created or not user.has_usable_password():
            user.set_password(password)
        if not user.first_name and full_name:
            parts = full_name.split(' ', 1)
            user.first_name = parts[0]
            user.last_name = parts[1] if len(parts) > 1 else ''
        if created:
            _set_role(user, role)
        user.save()


def _seed_reference_data():
    for source_name in ['DS-A', 'DS-B', 'DS-C', 'DS-D', 'DS-E']:
        DataSource.objects.get_or_create(
            name=source_name,
            defaults={
                'description': 'Manual external copying source.',
                'required_interface': 'All Interfaces',
                'required_size_options': ['6TB', '8TB', '12TB'],
            },
        )


def _datasource_api_id(source):
    if source.name.upper().startswith('DS-'):
        return source.name
    return f'DS-{source.id}'


def _resolve_datasource(source_id):
    if not source_id:
        return None
    source_id = str(source_id).strip()
    direct = DataSource.objects.filter(name=source_id).first()
    if direct:
        return direct

    ds_num_match = re.fullmatch(r'DS-(\d+)', source_id, flags=re.IGNORECASE)
    if ds_num_match:
        return DataSource.objects.filter(id=int(ds_num_match.group(1))).first()

    if source_id.isdigit():
        return DataSource.objects.filter(id=int(source_id)).first()

    return None


def _size_to_capacity_tb(size_str):
    if not size_str:
        return 0
    m = re.search(r'(\d+)', str(size_str))
    if not m:
        return 0
    return int(m.group(1))


def _capacity_to_size(capacity):
    if capacity is None:
        return ''
    if capacity <= 100:
        return f'{int(capacity)}TB'
    # Backward compatibility if old data used bytes.
    tb = max(1, int(round(capacity / float(10**12))))
    return f'{tb}TB'


def _ensure_system_haver():
    return DiskHaver.objects.get_or_create(name='System Intake')[0]


def _create_replication_log(action, table_name, record_id, payload, description=''):
    ReplicationLog.objects.create(
        id=f'LOG-{uuid.uuid4().hex}',
        action=action,
        table_name=table_name,
        record_id=record_id,
        payload=payload,
        description=description,
    )


def _create_status_log(disk, status, operator='System', description=''):
    DiskStatusLog.objects.create(
        id=f'STLOG-{uuid.uuid4().hex}',
        disk=disk,
        status=status,
        operator=operator,
        description=description or f'Disk moved to {status}.',
    )


def _serialize_datasource(source):
    return {
        'id': _datasource_api_id(source),
        'name': source.name,
        'description': source.description,
        'required_specs': {
            'interface': source.required_interface or 'All Interfaces',
            'size_options': source.required_size_options or [],
        },
    }


def _serialize_duplicator(dup):
    return {
        'id': dup.id,
        'name': dup.name,
        'manufacturer': dup.manufacturer,
        'slots_total': dup.slots_total,
        'slots_status': dup.slots_status or [],
        'year_in_service': dup.year_in_service,
    }


def _disk_status_from_havings(disk):
    last = DiskHavings.objects.filter(disk=disk).order_by('-when').first()
    if not last:
        return 'received'
    return HAVINGS_TO_STATUS.get(last.havings_type, 'received')


def _serialize_disk(disk):
    model = disk.disk_model
    status = disk.status or _disk_status_from_havings(disk)

    if not disk.source_requested_id:
        last_having = DiskHavings.objects.filter(disk=disk).order_by('-when').first()
        source = last_having.datasource if last_having else None
    else:
        source = disk.source_requested

    return {
        'id': disk.id,
        'hd_manufacturer': model.make,
        'hd_model': model.model,
        'hd_serial': disk.serial_number,
        'hd_size': _capacity_to_size(model.capacity),
        'hd_speed': disk.hd_speed or (disk.firmware_version or ''),
        'source_requested_id': _datasource_api_id(source) if source else '',
        'status': status,
        'received_time': _iso(disk.received_time),
        'copy_start_time': _iso(disk.copy_start_time),
        'copy_complete_time': _iso(disk.copy_complete_time),
        'copy_fail_time': _iso(disk.copy_fail_time),
        'pickup_time': _iso(disk.pickup_time),
        'duplicator_id': disk.duplicator_id,
        'duplicator_history': disk.duplicator_history or [],
        'hd_image': disk.hd_image,
    }


def _resolve_or_create_disk_model(payload):
    make = payload.get('hd_manufacturer') or 'Unknown'
    model_name = payload.get('hd_model') or 'Unknown Model'
    capacity_tb = _size_to_capacity_tb(payload.get('hd_size'))

    model, _ = DiskModel.objects.get_or_create(
        make=make,
        model=model_name,
        defaults={'capacity': capacity_tb},
    )
    if capacity_tb and model.capacity != capacity_tb:
        model.capacity = capacity_tb
        model.save(update_fields=['capacity'])
    return model


def _apply_status_having(disk, status, source=None):
    havings_type = STATUS_TO_HAVINGS.get(status)
    if not havings_type:
        return
    DiskHavings.objects.create(
        disk=disk,
        disk_haver=_ensure_system_haver(),
        havings_type=havings_type,
        datasource=source,
    )


@csrf_exempt
@require_http_methods(['POST'])
def api_auth_login(request):
    _seed_default_users()
    payload = _json_body(request)

    username = str(payload.get('username', '')).strip()
    password = str(payload.get('password', '')).strip()

    user = authenticate(request, username=username, password=password)
    if not user:
        return JsonResponse({'success': False, 'message': 'Invalid username or password credentials.'}, status=401)

    if not user.is_active:
        return JsonResponse({'success': False, 'message': 'This account is locked by the system administrator.'}, status=403)

    name = (f'{user.first_name} {user.last_name}'.strip() or user.username)
    return JsonResponse(
        {
            'success': True,
            'user': {
                'username': user.username,
                'role': _role_for_user(user),
                'name': name,
            },
        }
    )


@require_http_methods(['GET'])
def api_admin_users(request):
    _seed_default_users()
    User = get_user_model()
    users = []
    for user in User.objects.order_by('username'):
        users.append(
            {
                'username': user.username,
                'name': (f'{user.first_name} {user.last_name}'.strip() or user.username),
                'role': _role_for_user(user),
                'isLocked': not user.is_active,
            }
        )
    return JsonResponse(users, safe=False)


@csrf_exempt
@require_http_methods(['POST'])
def api_admin_users_create(request):
    payload = _json_body(request)
    username = str(payload.get('username', '')).strip()
    name = str(payload.get('name', '')).strip()
    role = str(payload.get('role', 'user')).strip().lower()
    password = str(payload.get('password', '')).strip() or 'password123'
    is_locked = bool(payload.get('isLocked', False))

    if not username or not name:
        return JsonResponse({'error': 'Username, Name, and Role are mandatory.'}, status=400)

    User = get_user_model()
    if User.objects.filter(username__iexact=username).exists():
        return JsonResponse({'error': f'User with username "{username}" already exists.'}, status=400)

    user = User.objects.create_user(username=username, password=password)
    parts = name.split(' ', 1)
    user.first_name = parts[0]
    user.last_name = parts[1] if len(parts) > 1 else ''
    user.is_active = not is_locked
    _set_role(user, role)
    user.save()

    return JsonResponse({'username': user.username, 'name': name, 'role': _role_for_user(user), 'isLocked': is_locked}, status=201)


@csrf_exempt
@require_http_methods(['PUT'])
def api_admin_users_update(request, username):
    payload = _json_body(request)
    User = get_user_model()

    user = User.objects.filter(username__iexact=username).first()
    if not user:
        return JsonResponse({'error': 'User not found.'}, status=404)

    role = str(payload.get('role', _role_for_user(user))).strip().lower()
    name = str(payload.get('name', '')).strip() or user.username
    is_locked = bool(payload.get('isLocked', not user.is_active))
    password = payload.get('password')

    parts = name.split(' ', 1)
    user.first_name = parts[0]
    user.last_name = parts[1] if len(parts) > 1 else ''
    user.is_active = not is_locked

    if password:
        user.set_password(password)

    _set_role(user, role)
    user.save()

    return JsonResponse({'username': user.username, 'name': name, 'role': _role_for_user(user), 'isLocked': is_locked})


@csrf_exempt
@require_http_methods(['DELETE'])
def api_admin_users_delete(request, username):
    if username.lower() == 'admin':
        return JsonResponse({'error': 'The primary system admin account cannot be deleted.'}, status=400)

    User = get_user_model()
    user = User.objects.filter(username__iexact=username).first()
    if not user:
        return JsonResponse({'error': 'User not found.'}, status=404)
    user.delete()

    return JsonResponse({'success': True})


@require_http_methods(['GET'])
def api_replication_stats(request):
    try:
        replica_count = DiskHavings.objects.using('replica').count()
    except Exception:
        replica_count = 0

    logs = [
        {
            'id': x.id,
            'timestamp': _iso(x.timestamp),
            'action': x.action,
            'table_name': x.table_name,
            'description': x.description,
            'record_id': x.record_id,
            'payload': x.payload,
        }
        for x in ReplicationLog.objects.all()[:100]
    ]

    return JsonResponse(
        {
            'master_diskhavings_count': DiskHavings.objects.count(),
            'replica_diskhavings_count': replica_count,
            'logs': logs,
        }
    )


@require_http_methods(['GET'])
def api_datasources(request):
    _seed_reference_data()
    payload = [_serialize_datasource(x) for x in DataSource.objects.order_by('name')]
    return JsonResponse(payload, safe=False)


@csrf_exempt
@require_http_methods(['POST'])
def api_datasources_create(request):
    payload = _json_body(request)
    name = str(payload.get('name', '')).strip()
    required_specs = payload.get('required_specs') or {}

    if not name:
        return JsonResponse({'error': 'Name is required.'}, status=400)

    source = DataSource.objects.create(
        name=name,
        description=str(payload.get('description', '')).strip(),
        required_interface=str(required_specs.get('interface', 'All Interfaces')).strip() or 'All Interfaces',
        required_size_options=required_specs.get('size_options') or [],
    )

    return JsonResponse(_serialize_datasource(source), status=201)


@csrf_exempt
@require_http_methods(['PUT'])
def api_datasources_update(request, source_id):
    payload = _json_body(request)
    source = _resolve_datasource(source_id)
    if not source:
        return JsonResponse({'error': 'DataSource not found.'}, status=404)

    required_specs = payload.get('required_specs') or {}
    source.name = str(payload.get('name', source.name)).strip() or source.name
    source.description = str(payload.get('description', source.description)).strip()
    source.required_interface = str(required_specs.get('interface', source.required_interface)).strip() or 'All Interfaces'
    source.required_size_options = required_specs.get('size_options') or source.required_size_options
    source.save()

    return JsonResponse(_serialize_datasource(source))


@csrf_exempt
@require_http_methods(['DELETE'])
def api_datasources_delete(request, source_id):
    source = _resolve_datasource(source_id)
    if not source:
        return JsonResponse({'error': 'DataSource not found.'}, status=404)
    source.delete()
    return JsonResponse({'success': True})


@require_http_methods(['GET'])
def api_duplicators(request):
    payload = [_serialize_duplicator(x) for x in Duplicator.objects.order_by('id')]
    return JsonResponse(payload, safe=False)


def _next_duplicator_id():
    max_num = 0
    for row in Duplicator.objects.all():
        m = re.search(r'(\d+)$', row.id)
        if m:
            max_num = max(max_num, int(m.group(1)))
    return f'dup-{max_num + 1:02d}'


@csrf_exempt
@require_http_methods(['POST'])
def api_duplicators_create(request):
    payload = _json_body(request)
    name = str(payload.get('name', '')).strip()
    manufacturer = str(payload.get('manufacturer', '')).strip()
    slots_total = int(payload.get('slots_total') or 0)
    slots_status = payload.get('slots_status') or []
    year_in_service = int(payload.get('year_in_service') or datetime.now().year)

    if not name or not manufacturer or slots_total <= 0:
        return JsonResponse({'error': 'Name, manufacturer, and slots_total are required.'}, status=400)

    if not slots_status:
        slots_status = [True] * slots_total

    dup = Duplicator.objects.create(
        id=_next_duplicator_id(),
        name=name,
        manufacturer=manufacturer,
        slots_total=slots_total,
        slots_status=slots_status,
        year_in_service=year_in_service,
    )
    return JsonResponse(_serialize_duplicator(dup), status=201)


@csrf_exempt
@require_http_methods(['PUT'])
def api_duplicators_update(request, duplicator_id):
    payload = _json_body(request)
    dup = Duplicator.objects.filter(id=duplicator_id).first()
    if not dup:
        return JsonResponse({'error': 'Duplicator not found.'}, status=404)

    dup.name = str(payload.get('name', dup.name)).strip() or dup.name
    dup.manufacturer = str(payload.get('manufacturer', dup.manufacturer)).strip() or dup.manufacturer
    if 'slots_total' in payload:
        dup.slots_total = int(payload.get('slots_total') or dup.slots_total)
    if 'slots_status' in payload:
        dup.slots_status = payload.get('slots_status') or dup.slots_status
    if 'year_in_service' in payload:
        dup.year_in_service = int(payload.get('year_in_service') or dup.year_in_service)
    dup.save()

    return JsonResponse(_serialize_duplicator(dup))


@csrf_exempt
@require_http_methods(['DELETE'])
def api_duplicators_delete(request, duplicator_id):
    dup = Duplicator.objects.filter(id=duplicator_id).first()
    if not dup:
        return JsonResponse({'error': 'Duplicator not found.'}, status=404)
    dup.delete()
    return JsonResponse({'success': True})


@require_http_methods(['GET'])
def api_disks(request):
    disks = [_serialize_disk(x) for x in Disk.objects.select_related('disk_model', 'source_requested').order_by('id')]
    return JsonResponse(disks, safe=False)


def _extract_disk_sequence_number(disk_id):
    if not disk_id:
        return None
    match = re.match(r'^(?:disk|DISK)-0*(\d+)(?:-|$)', str(disk_id).strip(), re.IGNORECASE)
    if not match:
        return None
    return int(match.group(1))


def _is_loadtest_disk_id(disk_id):
    return str(disk_id or '').strip().lower().startswith('disk-loadtest-')


@csrf_exempt
@require_http_methods(['POST'])
def api_disks_create(request):
    payload = _json_body(request)
    disk_id = str(payload.get('id', '') or '').strip()
    serial = str(payload.get('hd_serial', '') or '').strip()
    status = str(payload.get('status', 'received')).strip()

    if not disk_id:
        return JsonResponse({'error': 'Disk id is required.'}, status=400)

    if not serial:
        return JsonResponse({'error': 'Disk serial is required.'}, status=400)

    if Disk.objects.filter(id=disk_id).exists():
        return JsonResponse({'error': f'Disk with id "{disk_id}" already exists.'}, status=400)

    if serial.lower() != 'n/a' and Disk.objects.filter(serial_number__iexact=serial).exists():
        return JsonResponse({'error': f'Disk with serial "{serial}" already exists.'}, status=400)

    sequence_number = _extract_disk_sequence_number(disk_id)
    if sequence_number is not None and not _is_loadtest_disk_id(disk_id):
        existing_sequence_numbers = {
            _extract_disk_sequence_number(existing_id)
            for existing_id in Disk.objects.values_list('id', flat=True)
            if _extract_disk_sequence_number(existing_id) is not None
        }
        if sequence_number in existing_sequence_numbers:
            return JsonResponse({'error': f'Disk sequence "{sequence_number}" already exists.'}, status=400)

    model = _resolve_or_create_disk_model(payload)
    source = _resolve_datasource(payload.get('source_requested_id'))

    with transaction.atomic():
        disk = Disk.objects.create(
            id=disk_id,
            disk_model=model,
            serial_number=serial,
            firmware_version=str(payload.get('hd_speed', '')).strip(),
            source_requested=source,
            hd_speed=str(payload.get('hd_speed', '')).strip(),
            status=status,
            received_time=_parse_iso(payload.get('received_time')) or timezone.now(),
            copy_start_time=_parse_iso(payload.get('copy_start_time')),
            copy_complete_time=_parse_iso(payload.get('copy_complete_time')),
            copy_fail_time=_parse_iso(payload.get('copy_fail_time')),
            pickup_time=_parse_iso(payload.get('pickup_time')),
            duplicator_id=payload.get('duplicator_id') or None,
            duplicator_history=payload.get('duplicator_history') or [],
            hd_image=payload.get('hd_image') or None,
        )

        _apply_status_having(disk, status, source=source)
        _create_status_log(disk, status, operator=str(payload.get('operator', 'System')))
        _create_replication_log('INSERT', 'disks', disk.id, _serialize_disk(disk), f'Inserted disk {disk.id}.')

    return JsonResponse(_serialize_disk(disk), status=201)


@require_http_methods(['GET'])
def api_disk_status_logs(request, disk_id):
    disk = Disk.objects.filter(id=disk_id).first()
    if not disk:
        return JsonResponse({'error': 'Disk not found.'}, status=404)

    logs = [
        {
            'id': row.id,
            'disk_id': row.disk_id,
            'status': row.status,
            'timestamp': _iso(row.timestamp),
            'operator': row.operator,
            'description': row.description,
        }
        for row in DiskStatusLog.objects.filter(disk=disk)
    ]

    return JsonResponse(logs, safe=False)


@csrf_exempt
@require_http_methods(['PUT'])
def api_disks_update(request, disk_id):
    payload = _json_body(request)
    disk = Disk.objects.select_related('disk_model', 'source_requested').filter(id=disk_id).first()
    if not disk:
        return JsonResponse({'error': 'Disk not found.'}, status=404)

    old_status = disk.status or 'received'

    model_changed = any(k in payload for k in ['hd_manufacturer', 'hd_model', 'hd_size'])
    if model_changed:
        disk.disk_model = _resolve_or_create_disk_model({
            'hd_manufacturer': payload.get('hd_manufacturer') or disk.disk_model.make,
            'hd_model': payload.get('hd_model') or disk.disk_model.model,
            'hd_size': payload.get('hd_size') or _capacity_to_size(disk.disk_model.capacity),
        })

    if 'hd_serial' in payload:
        disk.serial_number = str(payload.get('hd_serial') or disk.serial_number)
    if 'hd_speed' in payload:
        disk.hd_speed = str(payload.get('hd_speed') or '')
        disk.firmware_version = disk.hd_speed
    if 'source_requested_id' in payload:
        disk.source_requested = _resolve_datasource(payload.get('source_requested_id'))

    for attr in ['received_time', 'copy_start_time', 'copy_complete_time', 'copy_fail_time', 'pickup_time']:
        if attr in payload:
            setattr(disk, attr, _parse_iso(payload.get(attr)))

    if 'hd_image' in payload:
        disk.hd_image = payload.get('hd_image')

    if 'duplicator_id' in payload:
        new_dup_id = payload.get('duplicator_id') or None
        if new_dup_id and new_dup_id != disk.duplicator_id:
            history = list(disk.duplicator_history or [])
            dup_name = new_dup_id
            dup = Duplicator.objects.filter(id=new_dup_id).first()
            if dup:
                dup_name = dup.name
            history.insert(0, {'duplicator_id': new_dup_id, 'duplicator_name': dup_name, 'timestamp': timezone.now().isoformat()})
            disk.duplicator_history = history
        disk.duplicator_id = new_dup_id

    if 'status' in payload:
        disk.status = str(payload.get('status') or disk.status)

    disk.save()

    if disk.status != old_status:
        _apply_status_having(disk, disk.status, source=disk.source_requested)
        _create_status_log(
            disk,
            disk.status,
            operator=str(payload.get('operator', 'System')),
            description=str(payload.get('description', f'Disk moved from {old_status} to {disk.status}.')),
        )

    _create_replication_log('UPDATE', 'disks', disk.id, _serialize_disk(disk), f'Updated disk {disk.id}.')
    return JsonResponse(_serialize_disk(disk))


@csrf_exempt
@require_http_methods(['DELETE'])
def api_disks_delete(request, disk_id):
    disk = Disk.objects.filter(id=disk_id).first()
    if not disk:
        return JsonResponse({'error': 'Disk not found.'}, status=404)

    _create_replication_log('DELETE', 'disks', disk.id, {'id': disk.id}, f'Deleted disk {disk.id}.')
    disk.delete()
    return JsonResponse({'success': True})


@require_http_methods(['GET'])
def api_kiosk_lookup_disk(request, disk_id):
    disk = Disk.objects.select_related('disk_model').filter(id__iexact=disk_id).first()
    if not disk:
        disk = Disk.objects.select_related('disk_model').filter(serial_number__iexact=disk_id).first()

    if not disk:
        return JsonResponse({'found': False, 'error': 'Disk not found.'}, status=404)

    logs = [
        {
            'id': row.id,
            'disk_id': row.disk_id,
            'status': row.status,
            'timestamp': _iso(row.timestamp),
            'operator': row.operator,
            'description': row.description,
        }
        for row in DiskStatusLog.objects.filter(disk=disk)
    ]

    if not logs:
        for having in DiskHavings.objects.filter(disk=disk).order_by('-when'):
            logs.append(
                {
                    'id': f'HAVING-{having.id}',
                    'disk_id': disk.id,
                    'status': HAVINGS_TO_STATUS.get(having.havings_type, 'received'),
                    'timestamp': _iso(having.when),
                    'operator': having.disk_haver.name,
                    'description': f'Havings event: {having.havings_type}',
                }
            )

    return JsonResponse({
        'found': True,
        'disk_id': disk.id,
        'disk': _serialize_disk(disk),
        'status_logs': logs,
    })


@require_http_methods(['GET'])
def api_kiosk_replica_diskhavings(request):
    try:
        rows = list(DiskHavings.objects.using('replica').order_by('-when')[:200])
    except Exception:
        rows = list(DiskHavings.objects.order_by('-when')[:200])

    payload = [
        {
            'disk_id': row.disk_id,
            'disk_haver_id': row.disk_haver_id,
            'havings_type': row.havings_type,
            'when': _iso(row.when),
        }
        for row in rows
    ]
    return JsonResponse(payload, safe=False)


@csrf_exempt
@require_http_methods(['POST'])
def api_admin_generate_mock_load_test(request):
    payload = _json_body(request)
    count = int(payload.get('count') or 0)
    if count not in {10, 100, 500, 1000}:
        return JsonResponse({'success': False, 'error': 'Count must be one of: 10, 100, 500, 1000.'}, status=400)

    _seed_reference_data()
    sources = list(DataSource.objects.order_by('name'))
    if not sources:
        return JsonResponse({'success': False, 'error': 'No data sources configured.'}, status=400)

    created = 0
    for _ in range(count):
        disk_id = f"disk-loadtest-{uuid.uuid4().hex[:10]}"
        model = DiskModel.objects.create(
            make=random.choice(['Seagate', 'Western Digital', 'Toshiba', 'HGST']),
            model=f'LoadTest-{random.randint(1000, 9999)}',
            capacity=random.choice([6, 8, 12]),
        )
        source = random.choice(sources)
        disk = Disk.objects.create(
            id=disk_id,
            disk_model=model,
            serial_number=f'SN-LT-{uuid.uuid4().hex[:10].upper()}',
            firmware_version='7200 RPM',
            source_requested=source,
            hd_speed='7200 RPM',
            status='received',
            received_time=timezone.now(),
        )
        _apply_status_having(disk, 'received', source=source)
        _create_status_log(disk, 'received', operator='LoadTest Seeder')
        _create_replication_log('INSERT', 'disks', disk.id, _serialize_disk(disk), 'Inserted load-test disk.')
        created += 1

    return JsonResponse({'success': True, 'message': f'Generated {created} load-test disk records.'})


@csrf_exempt
@require_http_methods(['POST'])
def api_admin_purge_mock_load_test(request):
    disks = list(Disk.objects.filter(id__startswith='disk-loadtest-'))
    deleted = len(disks)
    for disk in disks:
        _create_replication_log('DELETE', 'disks', disk.id, {'id': disk.id}, 'Purged load-test disk.')
        disk.delete()

    return JsonResponse({'success': True, 'message': f'Purged {deleted} load-test disk records.'})


@csrf_exempt
@require_http_methods(['POST'])
def api_disks_scan_label(request):
    payload = _json_body(request)
    image_name = str(payload.get('imageName', '')).lower()

    if 'wd' in image_name or 'western' in image_name:
        data = {
            'hd_manufacturer': 'Western Digital',
            'hd_model': 'WD Red Plus WD60EFAX',
            'hd_serial': f'W6TB-WD-{random.randint(100, 999)}',
            'hd_size': '6TB',
            'hd_speed': '5400 RPM',
        }
    elif 'toshiba' in image_name:
        data = {
            'hd_manufacturer': 'Toshiba',
            'hd_model': 'N300 HDWG120',
            'hd_serial': f'T12TB-{random.randint(100, 999)}',
            'hd_size': '12TB',
            'hd_speed': '7200 RPM',
        }
    else:
        data = {
            'hd_manufacturer': 'Seagate',
            'hd_model': 'IronWolf ST8000VN004',
            'hd_serial': f'S8TB-{random.randint(100, 999)}',
            'hd_size': '8TB',
            'hd_speed': '7200 RPM',
        }

    return JsonResponse({'success': True, 'source': 'Heuristic Match Fallback System', 'data': data})


@csrf_exempt
@require_http_methods(['GET', 'POST'])
def api_admin_users_collection(request):
    if request.method == 'GET':
        return api_admin_users(request)
    return api_admin_users_create(request)


@csrf_exempt
@require_http_methods(['PUT', 'DELETE'])
def api_admin_users_item(request, username):
    if request.method == 'PUT':
        return api_admin_users_update(request, username)
    return api_admin_users_delete(request, username)


@csrf_exempt
@require_http_methods(['GET', 'POST'])
def api_datasources_collection(request):
    if request.method == 'GET':
        return api_datasources(request)
    return api_datasources_create(request)


@csrf_exempt
@require_http_methods(['PUT', 'DELETE'])
def api_datasources_item(request, source_id):
    if request.method == 'PUT':
        return api_datasources_update(request, source_id)
    return api_datasources_delete(request, source_id)


@csrf_exempt
@require_http_methods(['GET', 'POST'])
def api_duplicators_collection(request):
    if request.method == 'GET':
        return api_duplicators(request)
    return api_duplicators_create(request)


@csrf_exempt
@require_http_methods(['PUT', 'DELETE'])
def api_duplicators_item(request, duplicator_id):
    if request.method == 'PUT':
        return api_duplicators_update(request, duplicator_id)
    return api_duplicators_delete(request, duplicator_id)


@csrf_exempt
@require_http_methods(['GET', 'POST'])
def api_disks_collection(request):
    if request.method == 'GET':
        return api_disks(request)
    return api_disks_create(request)


@csrf_exempt
@require_http_methods(['PUT', 'DELETE'])
def api_disks_item(request, disk_id):
    if request.method == 'PUT':
        return api_disks_update(request, disk_id)
    return api_disks_delete(request, disk_id)
