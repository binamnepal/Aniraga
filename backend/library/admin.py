from django.contrib import admin

from .models import Comment, Favorite, ViewEvent, WatchlistItem, WatchProgress

admin.site.register(WatchlistItem)
admin.site.register(Favorite)
admin.site.register(WatchProgress)
admin.site.register(ViewEvent)


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ("user", "anime_title", "episode", "created_at")
    search_fields = ("body", "anime_title", "user__username")
