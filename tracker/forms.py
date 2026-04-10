from django import forms
from .models import DiskModel

class DiskGenerateQRForm(forms.Form):
    disk_model = forms.ModelChoiceField(queryset=DiskModel.objects.all(), required=True)
    serial_number = forms.CharField(max_length=255, required=True)
    firmware_version = forms.CharField(max_length=255, required=True)
