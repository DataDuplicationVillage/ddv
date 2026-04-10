import uuid
import qrcode
import base64
from io import BytesIO
from django.urls import path
from django.template.response import TemplateResponse
from django.contrib import admin
from unfold.admin import ModelAdmin
from guardian.shortcuts import get_objects_for_user
from .models import DiskModel, DiskHaver, DataSource, Disk, DiskHavings
from .forms import DiskGenerateQRForm


@admin.register(DiskHavings)
class DiskHavingsAdmin(ModelAdmin):
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        return get_objects_for_user(request.user, 'tracker.view_diskhavings', klass=qs)

    def has_module_permission(self, request):
        if super().has_module_permission(request):
            return True
        return hasattr(request.user, 'diskhaver')

    def has_view_permission(self, request, obj=None):
        if super().has_view_permission(request, obj):
            return True
        if obj is None:
            return hasattr(request.user, 'diskhaver')
        return request.user.has_perm('tracker.view_diskhavings', obj)

@admin.register(DiskModel)
class DiskModelAdmin(ModelAdmin):
    pass

@admin.register(DiskHaver)
class DiskHaverAdmin(ModelAdmin):
    pass

@admin.register(DataSource)
class DataSourceAdmin(ModelAdmin):
    pass

@admin.register(Disk)
class DiskAdmin(ModelAdmin):
    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('generate-qr/', self.admin_site.admin_view(self.generate_qr_view), name='generate_disk_qr'),
        ]
        return custom_urls + urls

    def generate_qr_view(self, request):
        context = dict(
            self.admin_site.each_context(request),
            title="Generate Disk QR",
        )

        if request.method == 'POST':
            form = DiskGenerateQRForm(request.POST)
            if form.is_valid():
                disk_id = f"DDV-{uuid.uuid4()}"

                # Create disk row
                Disk.objects.create(
                    id=disk_id,
                    disk_model=form.cleaned_data['disk_model'],
                    serial_number=form.cleaned_data['serial_number'],
                    firmware_version=form.cleaned_data['firmware_version']
                )

                # Generate QR code
                img = qrcode.make(disk_id)
                buf = BytesIO()
                img.save(buf, format='PNG')
                image_base64 = base64.b64encode(buf.getvalue()).decode('utf-8')

                context['qr_image'] = image_base64
                context['disk_id'] = disk_id
        else:
            form = DiskGenerateQRForm()

        context['form'] = form
        return TemplateResponse(request, "admin/tracker/disk/generate_qr.html", context)
