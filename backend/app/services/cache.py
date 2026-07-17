"""
Query Result Cache — Upstash Redis via REST API.

Caches full pipeline results keyed by normalized query.
Cache hit = 0 LLM calls, ~50ms response time.
TTL: 24 hours by default.
"""
import hashlib
import json
import os

import requests
from dotenv import load_dotenv

load_dotenv()

_URL   = os.getenv("UPSTASH_REDIS_REST_URL", "")
_TOKEN = os.getenv("UPSTASH_REDIS_REST_TOKEN", "")
_TTL   = 86400  # 24 hours


def _enabled() -> bool:
    return bool(_URL and _TOKEN)


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {_TOKEN}",
        "Content-Type":  "application/json",
    }


def _key(query: str) -> str:
    norm = query.lower().strip()
    return f"simax:v1:{hashlib.md5(norm.encode()).hexdigest()}"


def get_cached(query: str) -> dict | None:
    """Return cached result for query, or None on miss."""
    if not _enabled():
        return None
    try:
        r = requests.get(
            f"{_URL}/get/{_key(query)}",
            headers=_headers(),
            timeout=2,
        )
        result = r.json().get("result")
        if result:
            print(f"[cache] HIT for: {query!r:.60}")
            return json.loads(result)
    except Exception as e:
        print(f"[cache] get error: {e}")
    return None


def set_cached(query: str, result: dict, ttl: int = _TTL) -> None:
    """Store result in cache with TTL (seconds)."""
    if not _enabled():
        return
    try:
        value = json.dumps(result, default=str)
        requests.post(
            _URL,
            headers=_headers(),
            json=["SETEX", _key(query), ttl, value],
            timeout=2,
        )
        print(f"[cache] SET for: {query!r:.60} (TTL {ttl}s)")
    except Exception as e:
        print(f"[cache] set error: {e}")


def invalidate(query: str) -> None:
    """Remove a specific query from cache."""
    if not _enabled():
        return
    try:
        requests.get(f"{_URL}/del/{_key(query)}", headers=_headers(), timeout=2)
    except Exception as e:
        print(f"[cache] del error: {e}")


def flush_all() -> None:
    """Clear all simax cache keys (admin use only)."""
    if not _enabled():
        return
    try:
        requests.get(f"{_URL}/flushdb", headers=_headers(), timeout=5)
        print("[cache] flushed all keys")
    except Exception as e:
        print(f"[cache] flush error: {e}")
