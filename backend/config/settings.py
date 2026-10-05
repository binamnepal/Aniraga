import os
from datetime import timedelta
from pathlib import Path

import dj_database_url
from corsheaders.defaults import default_headers
from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def env_list(name, default=""):
    return [v.strip() for v in os.getenv(name, default).split(",") if v.strip()]


# ---------------------------------------------------------------------
# Basic Django settings
# ---------------------------------------------------------------------

SECRET_KEY = os.getenv(
    "DJANGO_SECRET_KEY",
    "dev-insecure-key-change-me"
)

DEBUG = os.getenv("DJANGO_DEBUG", "false").lower() == "true"


# Render / production hosts.
# ".onrender.com" (leading dot) allows any Render address, so you never have to
# type your exact service name. Extra hosts can be added with DJANGO_ALLOWED_HOSTS.
ALLOWED_HOSTS = ["localhost", "127.0.0.1", ".onrender.com"] + env_list("DJANGO_ALLOWED_HOSTS")


# CSRF trusted origins (needed for the /admin login over https)
CSRF_TRUSTED_ORIGINS = ["https://anivexa.binamnepal173.workers.dev/m"] + env_list("CSRF_TRUSTED_ORIGINS")


if not DEBUG and SECRET_KEY.startswith("dev-insecure"):
    raise ImproperlyConfigured(
        "Set DJANGO_SECRET_KEY to a long random value when DJANGO_DEBUG is false."
    )


# ---------------------------------------------------------------------
# Installed applications
# ---------------------------------------------------------------------

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    "corsheaders",
    "rest_framework",

    "accounts",
    "catalog",
    "streaming",
    "library",
]


# ---------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
]


# ---------------------------------------------------------------------
# URLs / WSGI
# ---------------------------------------------------------------------

ROOT_URLCONF = "config.urls"

WSGI_APPLICATION = "config.wsgi.application"


# ---------------------------------------------------------------------
# Templates
# ---------------------------------------------------------------------

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ]
        },
    }
]


# ---------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------

# Production:
# DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/DBNAME
#
# Local:
# If DATABASE_URL is not set, SQLite will be used.

DATABASES = {
    "default": dj_database_url.parse(
        os.getenv("DATABASE_URL")
        or f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
        conn_max_age=600,
        conn_health_checks=True,
    )
}


# ---------------------------------------------------------------------
# Password validation
# ---------------------------------------------------------------------

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {
            "min_length": 8
        },
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]


# ---------------------------------------------------------------------
# Internationalization
# ---------------------------------------------------------------------

LANGUAGE_CODE = "en-us"

TIME_ZONE = "UTC"

USE_I18N = True

USE_TZ = True


# ---------------------------------------------------------------------
# Static files / WhiteNoise
# ---------------------------------------------------------------------

STATIC_URL = "static/"

STATIC_ROOT = BASE_DIR / "staticfiles"

STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}


DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# ---------------------------------------------------------------------
# Cache
# ---------------------------------------------------------------------

if os.getenv("REDIS_URL"):
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": os.environ["REDIS_URL"],
        }
    }
else:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        }
    }


# ---------------------------------------------------------------------
# Django REST Framework
# ---------------------------------------------------------------------

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],

    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.AllowAny",
    ],

    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],

    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
        "rest_framework.throttling.ScopedRateThrottle",
    ],

    "DEFAULT_THROTTLE_RATES": {
        "anon": "600/min",
        "user": "1200/min",
        "auth": "20/min",
        "view": "30/min",
        "comment": "12/min",
    },
}


# ---------------------------------------------------------------------
# JWT
# ---------------------------------------------------------------------

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),

    "REFRESH_TOKEN_LIFETIME": timedelta(days=30),

    "ROTATE_REFRESH_TOKENS": True,

    "AUTH_HEADER_TYPES": (
        "Bearer",
    ),
}


# ---------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------

CORS_ALLOWED_ORIGINS = env_list(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
)

CORS_ALLOW_HEADERS = list(default_headers) + [
    "range",
]

CORS_EXPOSE_HEADERS = [
    "Content-Range",
    "Accept-Ranges",
    "Content-Length",
]


# ---------------------------------------------------------------------
# Anivexa Streaming API
# ---------------------------------------------------------------------

ANIVEXA_API_URL = os.getenv(
    "ANIVEXA_API_URL",
    "http://localhost:4000",
)


# ---------------------------------------------------------------------
# Production security
# ---------------------------------------------------------------------

if not DEBUG:

    USE_X_FORWARDED_HOST = True

    SECURE_PROXY_SSL_HEADER = (
        "HTTP_X_FORWARDED_PROTO",
        "https",
    )

    SESSION_COOKIE_SECURE = True

    CSRF_COOKIE_SECURE = True

    SECURE_HSTS_SECONDS = 31536000