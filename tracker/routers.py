class ReplicaRouter:
    """
    A router to control database operations for replica databases.
    """
    def db_for_read(self, model, **hints):
        if hints.get('read_replica'):
            return 'replica'
        return None

    def db_for_write(self, model, **hints):
        return 'default'

    def allow_relation(self, obj1, obj2, **hints):
        return True

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        if db == 'replica':
            # Run schema migrations in replica as well for sqlite file initialization
            return True
        return True
