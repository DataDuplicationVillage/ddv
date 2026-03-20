from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('kiosk/<str:disk_id>/', views.kiosk_scan, name='kiosk_scan'),
]
