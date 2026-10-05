from django.conf import settings
from django.db import models


class WatchlistItem(models.Model):
    class Status(models.TextChoices):
        WATCHING = "watching", "Watching"
        PLAN = "plan", "Plan to watch"
        COMPLETED = "completed", "Completed"
        ON_HOLD = "on_hold", "On hold"
        DROPPED = "dropped", "Dropped"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="watchlist")
    anilist_id = models.PositiveIntegerField()
    title = models.CharField(max_length=255)
    cover = models.URLField(max_length=500, blank=True)
    format = models.CharField(max_length=20, blank=True)
    episodes = models.PositiveIntegerField(null=True, blank=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PLAN)
    added_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user", "anilist_id")
        ordering = ["-updated_at"]


class Favorite(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="favorites")
    anilist_id = models.PositiveIntegerField()
    title = models.CharField(max_length=255)
    cover = models.URLField(max_length=500, blank=True)
    format = models.CharField(max_length=20, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "anilist_id")
        ordering = ["-created_at"]


class WatchProgress(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="progress")
    anilist_id = models.PositiveIntegerField()
    episode = models.PositiveIntegerField()
    audio = models.CharField(max_length=3, default="sub")
    provider = models.CharField(max_length=30, blank=True)
    position = models.FloatField(default=0)
    duration = models.FloatField(default=0)
    completed = models.BooleanField(default=False)
    title = models.CharField(max_length=255)
    cover = models.URLField(max_length=500, blank=True)
    total_episodes = models.PositiveIntegerField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user", "anilist_id", "episode")
        ordering = ["-updated_at"]
        indexes = [models.Index(fields=["user", "-updated_at"], name="prog_user_recent_idx")]


class Comment(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="comments")
    anilist_id = models.PositiveIntegerField()
    episode = models.PositiveIntegerField(null=True, blank=True)
    anime_title = models.CharField(max_length=255, blank=True)
    parent = models.ForeignKey("self", null=True, blank=True, on_delete=models.CASCADE, related_name="replies")
    body = models.TextField(max_length=1000)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["anilist_id", "episode"], name="comment_anime_ep_idx")]


class ViewEvent(models.Model):
    """One row per episode started. Powers the site's own Top 10 (day / week / month)."""

    anilist_id = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        indexes = [models.Index(fields=["anilist_id", "created_at"], name="view_anime_time_idx")]
