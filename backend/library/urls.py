from django.urls import path

from . import views

urlpatterns = [
    path("library/watchlist/", views.WatchlistView.as_view()),
    path("library/watchlist/<int:anilist_id>/", views.WatchlistDetailView.as_view()),
    path("library/favorites/", views.FavoritesView.as_view()),
    path("library/favorites/<int:anilist_id>/", views.FavoriteDetailView.as_view()),
    path("library/status/<int:anilist_id>/", views.LibraryStatusView.as_view()),
    path("library/progress/", views.ProgressView.as_view()),
    path("library/progress/<int:anilist_id>/", views.ProgressByAnimeView.as_view()),
    path("library/continue/", views.ContinueWatchingView.as_view()),
    path("library/history/", views.HistoryView.as_view()),
    path("library/history/<int:anilist_id>/", views.HistoryItemView.as_view()),
    path("library/view/", views.RecordViewView.as_view()),
    path("comments/", views.CommentsView.as_view()),
    path("comments/recent/", views.RecentCommentsView.as_view()),
    path("comments/<int:pk>/", views.CommentDetailView.as_view()),
]
