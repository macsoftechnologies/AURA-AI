import hashlib
import json
import logging
import os
import redis

logger = logging.getLogger(__name__)
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

try:
    redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)
    redis_client.ping()
except Exception:
    redis_client = None
    logger.info("Redis not detected. Operating RAG without in-memory caching.")


def get_rag_cache(user_id: int, query: str, lang: str):
    if not redis_client:
        return None
    try:
        key = f"aura:rag:{user_id}:{lang}:{hashlib.sha256(query.strip().lower().encode()).hexdigest()}"
        val = redis_client.get(key)
        return json.loads(val) if val else None
    except Exception:
        return None


def set_rag_cache(user_id: int, query: str, lang: str, data: dict, ttl: int = 3600):
    if not redis_client:
        return
    try:
        key = f"aura:rag:{user_id}:{lang}:{hashlib.sha256(query.strip().lower().encode()).hexdigest()}"
        redis_client.setex(key, ttl, json.dumps(data))
    except Exception:
        pass