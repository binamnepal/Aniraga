"""Thin cached client for the AniList GraphQL API (the catalog + identity layer)."""
import hashlib
import json
import logging

import requests
from django.core.cache import cache
from rest_framework.exceptions import APIException, NotFound

log = logging.getLogger(__name__)

ANILIST_URL = "https://graphql.anilist.co"
HEADERS = {"Content-Type": "application/json", "Accept": "application/json", "User-Agent": "AniragaSite/1.0"}


class UpstreamError(APIException):
    status_code = 502
    default_detail = "AniList is not responding. Try again in a moment."
    default_code = "upstream_error"


def run(gql, variables=None, ttl=600):
    """Run a query. Results are cached; if AniList fails we fall back to the last good copy."""
    variables = {k: v for k, v in (variables or {}).items() if v not in (None, [], "")}
    key = "al:" + hashlib.sha1((gql + json.dumps(variables, sort_keys=True)).encode()).hexdigest()
    hit = cache.get(key)
    if hit is not None:
        return hit
    try:
        res = requests.post(ANILIST_URL, json={"query": gql, "variables": variables}, headers=HEADERS, timeout=15)
        payload = res.json()
        if res.status_code == 404:
            raise NotFound("We couldn't find that anime.")
        if res.status_code >= 400 or not payload.get("data"):
            log.warning("AniList %s: %s", res.status_code, str(payload.get("errors"))[:400])
            raise ValueError("bad response")
    except NotFound:
        raise
    except (requests.RequestException, ValueError):
        stale = cache.get(key + ":stale")
        if stale is not None:
            return stale
        raise UpstreamError()
    data = payload["data"]
    cache.set(key, data, ttl)
    cache.set(key + ":stale", data, 60 * 60 * 24)
    return data


FRAG_CARD = """
fragment Card on Media {
  id idMal type format status episodes duration season seasonYear
  title { romaji english native }
  coverImage { extraLarge large color }
  bannerImage averageScore popularity favourites genres isAdult
  nextAiringEpisode { episode airingAt }
}
"""

PAGE_Q = FRAG_CARD + """
query($page:Int,$perPage:Int,$search:String,$genres:[String],$format:MediaFormat,$status:MediaStatus,
      $season:MediaSeason,$year:Int,$sort:[MediaSort],$popMin:Int,$ids:[Int]){
  Page(page:$page, perPage:$perPage){
    pageInfo{ total currentPage lastPage hasNextPage perPage }
    media(type:ANIME, isAdult:false, search:$search, genre_in:$genres, format:$format, status:$status,
          season:$season, seasonYear:$year, sort:$sort, popularity_greater:$popMin, id_in:$ids){ ...Card }
  }
}
"""

SPOT_Q = FRAG_CARD + """
fragment Spot on Media {
  ...Card
  description(asHtml:false)
  trailer { id site }
  studios(isMain:true){ nodes { name } }
}
query{
  Page(page:1, perPage:20){
    media(type:ANIME, isAdult:false, sort:TRENDING_DESC, status:RELEASING, format_in:[TV,TV_SHORT,ONA]){ ...Spot }
  }
}
"""

DETAIL_Q = FRAG_CARD + """
query($id:Int){
  Media(id:$id, type:ANIME){
    ...Card
    description(asHtml:false)
    source startDate{year month day} endDate{year month day}
    synonyms hashtag
    trailer { id site }
    studios { edges { isMain node { id name } } }
    tags { name rank isMediaSpoiler }
    externalLinks { site url }
    rankings { rank type context allTime }
    characters(perPage:14, sort:[ROLE,RELEVANCE]){
      edges{ role node{ id name{ full } image{ large } } voiceActors(language:JAPANESE){ id name{ full } image{ large } } }
    }
    relations{ edges{ relationType(version:2) node{ ...Card } } }
    recommendations(perPage:14, sort:RATING_DESC){ nodes{ mediaRecommendation{ ...Card } } }
  }
}
"""

SCHEDULE_Q = FRAG_CARD + """
query($page:Int,$start:Int,$end:Int){
  Page(page:$page, perPage:50){
    pageInfo{ hasNextPage }
    airingSchedules(airingAt_greater:$start, airingAt_lesser:$end, sort:TIME){
      id episode airingAt media{ ...Card }
    }
  }
}
"""

SORTS = {
    "TRENDING_DESC", "POPULARITY_DESC", "SCORE_DESC", "FAVOURITES_DESC", "START_DATE_DESC",
    "UPDATED_AT_DESC", "ID_DESC", "END_DATE_DESC", "TITLE_ROMAJI", "TITLE_ENGLISH", "SEARCH_MATCH",
}
FORMATS = {"TV", "TV_SHORT", "MOVIE", "SPECIAL", "OVA", "ONA", "MUSIC"}
STATUSES = {"RELEASING", "FINISHED", "NOT_YET_RELEASED", "CANCELLED", "HIATUS"}
SEASONS = {"WINTER", "SPRING", "SUMMER", "FALL"}

GENRES = [
    "Action", "Adventure", "Comedy", "Drama", "Ecchi", "Fantasy", "Horror", "Mahou Shoujo", "Mecha",
    "Music", "Mystery", "Psychological", "Romance", "Sci-Fi", "Slice of Life", "Sports",
    "Supernatural", "Thriller",
]


def media_page(page=1, per_page=24, sort=None, ttl=600, **filters):
    variables = {"page": page, "perPage": per_page, "sort": [sort] if sort else None, **filters}
    return run(PAGE_Q, variables, ttl=ttl)["Page"]


def keep_anime(media):
    return bool(media) and not media.get("isAdult") and media.get("type", "ANIME") == "ANIME"
