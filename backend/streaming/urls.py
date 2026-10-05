from django.urls import path

from . import proxy, views

urlpatterns = [
    path("episodes/<int:anilist_id>/", views.episodes),
    path("watch/<int:anilist_id>/", views.watch),
    path("proxy/", proxy.stream_proxy, name="stream-proxy"),
]
