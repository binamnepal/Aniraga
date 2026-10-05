from django.urls import path

from . import views

urlpatterns = [
    path("home/", views.home),
    path("anime/browse/", views.browse),
    path("anime/suggest/", views.suggest),
    path("anime/top/", views.top),
    path("anime/schedule/", views.schedule),
    path("anime/genres/", views.genres),
    path("anime/<int:anilist_id>/", views.detail),
]
