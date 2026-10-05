from rest_framework import permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Comment, Favorite, ViewEvent, WatchlistItem, WatchProgress
from .serializers import (
    CommentSerializer,
    FavoriteSerializer,
    ProgressSerializer,
    WatchlistSerializer,
)

Authed = [permissions.IsAuthenticated]


def int_or_none(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


# ---- Watchlist ----------------------------------------------------------
class WatchlistView(APIView):
    permission_classes = Authed

    def get(self, request):
        qs = WatchlistItem.objects.filter(user=request.user)
        if request.query_params.get("status"):
            qs = qs.filter(status=request.query_params["status"])
        return Response(WatchlistSerializer(qs, many=True).data)

    def post(self, request):
        serializer = WatchlistSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        anilist_id = data.pop("anilist_id")
        obj, _ = WatchlistItem.objects.update_or_create(user=request.user, anilist_id=anilist_id, defaults=data)
        return Response(WatchlistSerializer(obj).data, status=status.HTTP_201_CREATED)


class WatchlistDetailView(APIView):
    permission_classes = Authed

    def delete(self, request, anilist_id):
        WatchlistItem.objects.filter(user=request.user, anilist_id=anilist_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ---- Favorites ----------------------------------------------------------
class FavoritesView(APIView):
    permission_classes = Authed

    def get(self, request):
        return Response(FavoriteSerializer(Favorite.objects.filter(user=request.user), many=True).data)

    def post(self, request):
        serializer = FavoriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        anilist_id = data.pop("anilist_id")
        obj, _ = Favorite.objects.update_or_create(user=request.user, anilist_id=anilist_id, defaults=data)
        return Response(FavoriteSerializer(obj).data, status=status.HTTP_201_CREATED)


class FavoriteDetailView(APIView):
    permission_classes = Authed

    def delete(self, request, anilist_id):
        Favorite.objects.filter(user=request.user, anilist_id=anilist_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class LibraryStatusView(APIView):
    permission_classes = Authed

    def get(self, request, anilist_id):
        item = WatchlistItem.objects.filter(user=request.user, anilist_id=anilist_id).first()
        return Response({
            "watchlist": item.status if item else None,
            "favorite": Favorite.objects.filter(user=request.user, anilist_id=anilist_id).exists(),
        })


# ---- Progress / history -------------------------------------------------
class ProgressView(APIView):
    permission_classes = Authed

    def post(self, request):
        serializer = ProgressSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        anilist_id, episode = data.pop("anilist_id"), data.pop("episode")
        data.setdefault("title", "")
        WatchProgress.objects.update_or_create(
            user=request.user, anilist_id=anilist_id, episode=episode, defaults=data
        )
        # Finishing a title moves it to "Completed" automatically; starting one puts it in "Watching".
        total = data.get("total_episodes")
        item = WatchlistItem.objects.filter(user=request.user, anilist_id=anilist_id).first()
        if item and item.status in (WatchlistItem.Status.PLAN, WatchlistItem.Status.ON_HOLD):
            item.status = WatchlistItem.Status.WATCHING
            item.save(update_fields=["status", "updated_at"])
        if item and total and data.get("completed") and episode >= total:
            item.status = WatchlistItem.Status.COMPLETED
            item.save(update_fields=["status", "updated_at"])
        return Response({"ok": True})


class ProgressByAnimeView(APIView):
    permission_classes = Authed

    def get(self, request, anilist_id):
        qs = WatchProgress.objects.filter(user=request.user, anilist_id=anilist_id)
        return Response(ProgressSerializer(qs, many=True).data)


class ContinueWatchingView(APIView):
    permission_classes = Authed

    def get(self, request):
        seen, items = set(), []
        for row in WatchProgress.objects.filter(user=request.user)[:200]:
            if row.anilist_id in seen:
                continue
            seen.add(row.anilist_id)
            items.append(row)
            if len(items) >= 20:
                break
        return Response(ProgressSerializer(items, many=True).data)


class HistoryView(APIView):
    permission_classes = Authed

    def get(self, request):
        qs = WatchProgress.objects.filter(user=request.user)[:100]
        return Response(ProgressSerializer(qs, many=True).data)

    def delete(self, request):
        WatchProgress.objects.filter(user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class HistoryItemView(APIView):
    permission_classes = Authed

    def delete(self, request, anilist_id):
        WatchProgress.objects.filter(user=request.user, anilist_id=anilist_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ---- Views counter (feeds the Top 10) -------------------------------------
class RecordViewView(APIView):
    throttle_scope = "view"

    def post(self, request):
        anilist_id = int_or_none(request.data.get("anilist_id"))
        if not anilist_id or anilist_id < 1:
            raise ValidationError({"anilist_id": "A valid AniList id is required."})
        ViewEvent.objects.create(anilist_id=anilist_id)
        return Response({"ok": True})


# ---- Comments -----------------------------------------------------------
class CommentsView(APIView):
    def get_throttles(self):
        if self.request.method == "POST":
            self.throttle_scope = "comment"
        return super().get_throttles()

    def get_permissions(self):
        return [permissions.IsAuthenticated()] if self.request.method == "POST" else [permissions.AllowAny()]

    def get(self, request):
        anilist_id = int_or_none(request.query_params.get("anilist_id"))
        if not anilist_id:
            raise ValidationError({"anilist_id": "Required."})
        episode = int_or_none(request.query_params.get("episode"))
        qs = Comment.objects.filter(anilist_id=anilist_id, episode=episode).select_related("user")[:150]
        return Response(CommentSerializer(qs, many=True, context={"request": request}).data)

    def post(self, request):
        serializer = CommentSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        parent = serializer.validated_data.get("parent")
        anilist_id = serializer.validated_data["anilist_id"]
        if parent and (parent.anilist_id != anilist_id or parent.parent_id):
            raise ValidationError({"parent": "You can only reply to a top-level comment on the same anime."})
        comment = serializer.save(user=request.user)
        return Response(CommentSerializer(comment, context={"request": request}).data, status=status.HTTP_201_CREATED)


class CommentDetailView(APIView):
    permission_classes = Authed

    def delete(self, request, pk):
        comment = Comment.objects.filter(pk=pk).first()
        if not comment:
            return Response(status=status.HTTP_204_NO_CONTENT)
        if comment.user_id != request.user.id and not request.user.is_staff:
            return Response({"detail": "You can only delete your own comments."}, status=status.HTTP_403_FORBIDDEN)
        comment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class RecentCommentsView(APIView):
    def get(self, request):
        qs = Comment.objects.filter(parent__isnull=True).select_related("user")[:8]
        return Response(CommentSerializer(qs, many=True, context={"request": request}).data)
