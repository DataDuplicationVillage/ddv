from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from guardian.shortcuts import assign_perm
from .models import DiskHavings, DiskHaver

@receiver(post_save, sender=DiskHavings)
def sync_to_replica_on_save(sender, instance, **kwargs):
    # Save a direct copy into the replica sqlite3 database using multi-db routing
    instance.save(using='replica')
    if instance.disk_haver and instance.disk_haver.user:
        assign_perm('view_diskhavings', instance.disk_haver.user, instance)

@receiver(post_delete, sender=DiskHavings)
def sync_to_replica_on_delete(sender, instance, **kwargs):
    try:
        instance.delete(using='replica')
    except Exception:
        pass

@receiver(post_save, sender=DiskHaver)
def ensure_user_is_staff(sender, instance, **kwargs):
    if instance.user and not instance.user.is_staff:
        instance.user.is_staff = True
        instance.user.save(update_fields=['is_staff'])
