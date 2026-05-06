from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from guardian.shortcuts import assign_perm
from .models import DiskHavings, DiskHaver, Disk, DiskModel, DataSource

def sync_to_replica_on_save_handler(sender, instance, **kwargs):
    # Save a direct copy into the replica sqlite3 database using multi-db routing
    try:
        instance.save(using='replica')
    except Exception as e:
        print(f"Replica save failed for {sender}: {e}")

def sync_to_replica_on_delete_handler(sender, instance, **kwargs):
    try:
        instance.delete(using='replica')
    except Exception:
        pass

for model in [DiskModel, DataSource, DiskHaver, Disk, DiskHavings]:
    post_save.connect(sync_to_replica_on_save_handler, sender=model)
    post_delete.connect(sync_to_replica_on_delete_handler, sender=model)

@receiver(post_save, sender=DiskHavings)
def assign_permissions_on_save(sender, instance, created, **kwargs):
    if instance.disk_haver and instance.disk_haver.user:
        assign_perm('view_diskhavings', instance.disk_haver.user, instance)

@receiver(post_save, sender=DiskHaver)
def ensure_user_is_staff(sender, instance, created, **kwargs):
    if instance.user and not instance.user.is_staff:
        instance.user.is_staff = True
        instance.user.save(update_fields=['is_staff'])
