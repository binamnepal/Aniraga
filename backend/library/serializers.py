from rest_framework import serializers

from .models import Comment, Favorite, WatchlistItem, WatchProgress


class WatchlistSerializer(serializers.ModelSerializer):
    class Meta:
        model = WatchlistItem
        fields = ("anilist_id", "title", "cover", "format", "episodes", "status", "added_at", "updated_at")
        read_only_fields = ("added_at", "updated_at")


class FavoriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Favorite
        fields = ("anilist_id", "title", "cover", "format", "created_at")
        read_only_fields = ("created_at",)


class ProgressSerializer(serializers.ModelSerializer):
    class Meta:
        model = WatchProgress
        fields = (
            "anilist_id", "episode", "audio", "provider", "position", "duration",
            "completed", "title", "cover", "total_episodes", "updated_at",
        )
        read_only_fields = ("updated_at",)
        extra_kwargs = {"title": {"required": False}, "cover": {"required": False, "allow_blank": True}}


class CommentSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    mine = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = ("id", "anilist_id", "episode", "anime_title", "parent", "body", "username", "mine", "created_at")
        read_only_fields = ("id", "username", "mine", "created_at")

    def get_mine(self, obj):
        request = self.context.get("request")
        return bool(request and request.user.is_authenticated and obj.user_id == request.user.id)

    def validate_body(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Write something first.")
        if len(value) > 1000:
            raise serializers.ValidationError("Keep it under 1000 characters.")
        return value
