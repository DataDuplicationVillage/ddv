from django import forms
from .models import DiskModel, DiskHavings

class DiskGenerateQRForm(forms.Form):
    MODE_CHOICES = [
        ('new', 'New Disk + New Owner Pair'),
        ('existing', 'Add Disk to Existing Owner'),
    ]
    mode = forms.ChoiceField(choices=MODE_CHOICES, widget=forms.RadioSelect, initial='new')
    
    disk_model = forms.ModelChoiceField(queryset=DiskModel.objects.all(), required=True)
    serial_number = forms.CharField(max_length=255, required=True)
    firmware_version = forms.CharField(max_length=255, required=True)
    havings_type = forms.ChoiceField(choices=DiskHavings.HAVING_TYPE_CHOICES, initial='give')

    existing_disk_id = forms.CharField(max_length=255, required=False, label="Scan Existing Disk ID")

    def clean(self):
        cleaned_data = super().clean()
        mode = cleaned_data.get('mode')
        
        if mode == 'existing':
            existing_disk_id = cleaned_data.get('existing_disk_id')
            if not existing_disk_id:
                self.add_error('existing_disk_id', 'Required to lookup existing owner.')
            else:
                history = DiskHavings.objects.filter(disk_id=existing_disk_id).order_by('-when')
                if not history.exists():
                    self.add_error('existing_disk_id', f'Disk {existing_disk_id} has no history. Cannot determine owner.')
                else:
                    cleaned_data['found_diskhaver'] = history.first().disk_haver
        return cleaned_data
