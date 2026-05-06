from django.urls import path
from . import views

urlpatterns = [
    path('', views.kiosk_home, name='kiosk_home'),
    path('kiosk/<str:disk_id>/', views.kiosk_scan, name='kiosk_scan'),
]
