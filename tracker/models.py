from django.db import models
from django.contrib.auth.models import User

class DiskModel(models.Model):
    make = models.CharField(max_length=255)
    model = models.CharField(max_length=255)
    capacity = models.BigIntegerField(help_text="Capacity in Terabytes")

    def __str__(self):
        return f"{self.make} {self.model} ({self.capacity} B)"

class DiskHaver(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, null=True, blank=True)
    name = models.CharField(max_length=255)

    def __str__(self):
        return self.name

class DataSource(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    required_interface = models.CharField(max_length=50, blank=True, default='All Interfaces')
    required_size_options = models.JSONField(default=list, blank=True)

    def __str__(self):
        return self.name

class Disk(models.Model):
    id = models.CharField(max_length=255, primary_key=True, help_text="QR code ID")
    disk_model = models.ForeignKey(DiskModel, on_delete=models.CASCADE)
    serial_number = models.CharField(max_length=255)
    firmware_version = models.CharField(max_length=255)
    source_requested = models.ForeignKey(DataSource, on_delete=models.SET_NULL, null=True, blank=True)

    # Frontend portal compatibility fields.
    hd_speed = models.CharField(max_length=50, blank=True, default='')
    status = models.CharField(max_length=20, default='received')
    received_time = models.DateTimeField(null=True, blank=True)
    copy_start_time = models.DateTimeField(null=True, blank=True)
    copy_complete_time = models.DateTimeField(null=True, blank=True)
    copy_fail_time = models.DateTimeField(null=True, blank=True)
    pickup_time = models.DateTimeField(null=True, blank=True)
    duplicator_id = models.CharField(max_length=100, blank=True, null=True)
    duplicator_history = models.JSONField(default=list, blank=True)
    hd_image = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"Disk {self.id} (SN: {self.serial_number})"

class DiskHavings(models.Model):
    HAVING_TYPE_CHOICES = [
        ('give', 'Give'),
        ('take', 'Take'),
        ('copyready', 'Copy Ready'),
        ('copysuccess', 'Copy Success'),
        ('copyfail', 'Copy Fail'),
        ('broken', 'Broken'),
    ]
    when = models.DateTimeField(auto_now_add=True)
    disk = models.ForeignKey(Disk, on_delete=models.CASCADE)
    disk_haver = models.ForeignKey(DiskHaver, on_delete=models.CASCADE)
    havings_type = models.CharField(max_length=20, choices=HAVING_TYPE_CHOICES)
    datasource = models.ForeignKey(DataSource, on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return f"{self.disk_haver.name} - {self.havings_type} - {self.disk.id}"


class Duplicator(models.Model):
    id = models.CharField(max_length=50, primary_key=True)
    name = models.CharField(max_length=100, unique=True)
    manufacturer = models.CharField(max_length=100)
    slots_total = models.PositiveIntegerField(default=0)
    slots_status = models.JSONField(default=list, blank=True)
    year_in_service = models.PositiveIntegerField(default=2026)

    def __str__(self):
        return self.name


class DiskStatusLog(models.Model):
    id = models.CharField(max_length=100, primary_key=True)
    disk = models.ForeignKey(Disk, on_delete=models.CASCADE)
    status = models.CharField(max_length=20)
    timestamp = models.DateTimeField(auto_now_add=True)
    operator = models.CharField(max_length=100, default='System')
    description = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['-timestamp']


class ReplicationLog(models.Model):
    id = models.CharField(max_length=100, primary_key=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    action = models.CharField(max_length=20)
    table_name = models.CharField(max_length=50)
    description = models.TextField(blank=True, default='')
    record_id = models.CharField(max_length=255)
    payload = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['-timestamp']
