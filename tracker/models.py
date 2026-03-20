from django.db import models
from django.contrib.auth.models import User

class DiskModel(models.Model):
    make = models.CharField(max_length=255)
    model = models.CharField(max_length=255)
    capacity = models.BigIntegerField(help_text="Capacity in bytes")

    def __str__(self):
        return f"{self.make} {self.model} ({self.capacity} B)"

class DiskHaver(models.Model):
    PERMISSION_CHOICES = [
        ('ADMIN', 'Admin'),
        ('VOLUNTEER', 'Volunteer'),
        ('USER', 'User'),
    ]
    user = models.OneToOneField(User, on_delete=models.CASCADE, null=True, blank=True)
    name = models.CharField(max_length=255)
    permission = models.CharField(max_length=20, choices=PERMISSION_CHOICES, default='USER')

    def __str__(self):
        return self.name

class DataSource(models.Model):
    name = models.CharField(max_length=255)

    def __str__(self):
        return self.name

class Disk(models.Model):
    id = models.CharField(max_length=255, primary_key=True, help_text="QR code ID")
    disk_model = models.ForeignKey(DiskModel, on_delete=models.CASCADE)
    serial_number = models.CharField(max_length=255)
    firmware_version = models.CharField(max_length=255)

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
