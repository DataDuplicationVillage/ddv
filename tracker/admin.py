from django.contrib import admin
from .models import DiskModel, DiskHaver, DataSource, Disk, DiskHavings

admin.site.register(DiskModel)
admin.site.register(DiskHaver)
admin.site.register(DataSource)
admin.site.register(Disk)
admin.site.register(DiskHavings)
