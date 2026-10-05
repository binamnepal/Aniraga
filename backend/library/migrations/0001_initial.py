import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="ViewEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("anilist_id", models.PositiveIntegerField()),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
            ],
            options={
                "indexes": [models.Index(fields=["anilist_id", "created_at"], name="view_anime_time_idx")],
            },
        ),
        migrations.CreateModel(
            name="WatchlistItem",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("anilist_id", models.PositiveIntegerField()),
                ("title", models.CharField(max_length=255)),
                ("cover", models.URLField(blank=True, max_length=500)),
                ("format", models.CharField(blank=True, max_length=20)),
                ("episodes", models.PositiveIntegerField(blank=True, null=True)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("watching", "Watching"),
                            ("plan", "Plan to watch"),
                            ("completed", "Completed"),
                            ("on_hold", "On hold"),
                            ("dropped", "Dropped"),
                        ],
                        default="plan",
                        max_length=12,
                    ),
                ),
                ("added_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="watchlist",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-updated_at"],
                "unique_together": {("user", "anilist_id")},
            },
        ),
        migrations.CreateModel(
            name="Favorite",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("anilist_id", models.PositiveIntegerField()),
                ("title", models.CharField(max_length=255)),
                ("cover", models.URLField(blank=True, max_length=500)),
                ("format", models.CharField(blank=True, max_length=20)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="favorites",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
                "unique_together": {("user", "anilist_id")},
            },
        ),
        migrations.CreateModel(
            name="WatchProgress",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("anilist_id", models.PositiveIntegerField()),
                ("episode", models.PositiveIntegerField()),
                ("audio", models.CharField(default="sub", max_length=3)),
                ("provider", models.CharField(blank=True, max_length=30)),
                ("position", models.FloatField(default=0)),
                ("duration", models.FloatField(default=0)),
                ("completed", models.BooleanField(default=False)),
                ("title", models.CharField(max_length=255)),
                ("cover", models.URLField(blank=True, max_length=500)),
                ("total_episodes", models.PositiveIntegerField(blank=True, null=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="progress",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-updated_at"],
                "unique_together": {("user", "anilist_id", "episode")},
                "indexes": [models.Index(fields=["user", "-updated_at"], name="prog_user_recent_idx")],
            },
        ),
        migrations.CreateModel(
            name="Comment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("anilist_id", models.PositiveIntegerField()),
                ("episode", models.PositiveIntegerField(blank=True, null=True)),
                ("anime_title", models.CharField(blank=True, max_length=255)),
                ("body", models.TextField(max_length=1000)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "parent",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="replies",
                        to="library.comment",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="comments",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
                "indexes": [models.Index(fields=["anilist_id", "episode"], name="comment_anime_ep_idx")],
            },
        ),
    ]
