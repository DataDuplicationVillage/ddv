from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import DiskHavings

@receiver(post_save, sender=DiskHavings)
def sync_to_replica_on_save(sender, instance, **kwargs):
    # Save a direct copy into the replica sqlite3 database using multi-db routing
    instance.save(using='replica')

@receiver(post_delete, sender=DiskHavings)
def sync_to_replica_on_delete(sender, instance, **kwargs):
    try:
        instance.delete(using='replica')
    except Exception:
        pass
