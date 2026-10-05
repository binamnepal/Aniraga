from rest_framework.decorators import api_view
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from . import services


@api_view(["GET"])
def episodes(request, anilist_id):
    return Response(services.get_episodes(anilist_id))


@api_view(["GET"])
def watch(request, anilist_id):
    q = request.query_params
    try:
        episode = int(q.get("ep", ""))
    except ValueError:
        raise ValidationError({"ep": "Episode number is required."})
    return Response(
        services.get_streams(request, q.get("provider", ""), anilist_id, q.get("audio", "sub"), episode)
    )
