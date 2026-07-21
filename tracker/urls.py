from django.urls import path, re_path
from . import views
from . import api_views

urlpatterns = [
    # Frontend build assets served for Django-hosted SPA mode on port 8000.
    path('assets/<path:asset_path>', views.spa_asset, name='spa_asset'),
    path('health/frontend', views.spa_health, name='spa_health_frontend'),
    path('api/health/frontend', views.spa_health, name='api_spa_health_frontend'),

    # API compatibility routes for ddv-drive-tracker frontend.
    path('api/auth/login', api_views.api_auth_login, name='api_auth_login'),
    path('api/admin/users', api_views.api_admin_users_collection, name='api_admin_users_collection'),
    path('api/admin/users/<str:username>', api_views.api_admin_users_item, name='api_admin_users_item'),
    path('api/admin/replication-stats', api_views.api_replication_stats, name='api_replication_stats'),
    path('api/admin/generate-mock-load-test', api_views.api_admin_generate_mock_load_test, name='api_admin_generate_mock_load_test'),
    path('api/admin/purge-mock-load-test', api_views.api_admin_purge_mock_load_test, name='api_admin_purge_mock_load_test'),
    path('api/datasources', api_views.api_datasources_collection, name='api_datasources_collection'),
    path('api/datasources/<str:source_id>', api_views.api_datasources_item, name='api_datasources_item'),
    path('api/duplicators', api_views.api_duplicators_collection, name='api_duplicators_collection'),
    path('api/duplicators/<str:duplicator_id>', api_views.api_duplicators_item, name='api_duplicators_item'),
    path('api/disks', api_views.api_disks_collection, name='api_disks_collection'),
    path('api/disks/scan-label', api_views.api_disks_scan_label, name='api_disks_scan_label'),
    path('api/disks/<str:disk_id>/status-logs', api_views.api_disk_status_logs, name='api_disk_status_logs'),
    path('api/disks/<str:disk_id>', api_views.api_disks_item, name='api_disks_item'),
    path('api/kiosk/lookup-disk/<str:disk_id>', api_views.api_kiosk_lookup_disk, name='api_kiosk_lookup_disk'),
    path('api/kiosk/replica-diskhavings', api_views.api_kiosk_replica_diskhavings, name='api_kiosk_replica_diskhavings'),

    # Legacy template-based kiosk routes retained under /legacy.
    path('legacy/kiosk/', views.kiosk_home, name='kiosk_home'),
    path('legacy/kiosk/<str:disk_id>/', views.kiosk_scan, name='kiosk_scan'),

    # Single-page app host and fallback routes.
    path('', views.spa_index, name='spa_index'),
    re_path(r'^(?!api(?:/|$)|legacy(?:/|$)|assets(?:/|$)|static/).*$', views.spa_index, name='spa_fallback'),
]
